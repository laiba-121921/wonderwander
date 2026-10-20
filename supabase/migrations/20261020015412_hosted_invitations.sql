-- PHASE_15_PLUS 4: hosted use by invitation. Public sign-ups stay off; the `invite` function checks a code with
-- claim_invite() and then creates the account itself with the admin API.

-- One row of instance settings, readable by every signed-in user, changed only by the owner.
create table public.app_config (
  one boolean primary key default true check (one),
  instance_name text not null default 'wonderwander',
  user_cap int not null default 25 check (user_cap > 0)
);
insert into public.app_config default values;
alter table public.app_config enable row level security;
create policy app_config_read on public.app_config for select to authenticated using (true);
create policy app_config_owner_update on public.app_config for update to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));

-- Invite codes, minted and seen by the owner alone.
create table public.invite (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  max_uses int not null default 1 check (max_uses between 1 and 25),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz not null default now() + interval '14 days',
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.invite enable row level security;
create policy invite_owner on public.invite for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
create index invite_created_by on public.invite (created_by);

-- Checks a code; with p_claim it also uses it up. One at a time, so two sign-ups cannot both take the last place.
create or replace function public.claim_invite(p_code text, p_claim boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invite%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('wonderwander-invite'));
  select * into inv from public.invite where code = upper(trim(p_code)) for update;
  if not found then return 'invalid'; end if;
  if inv.expires_at < now() then return 'expired'; end if;
  if inv.uses >= inv.max_uses then return 'used'; end if;
  if (select count(*) from auth.users) >= (select user_cap from public.app_config) then return 'full'; end if;
  if p_claim then update public.invite set uses = uses + 1 where code = inv.code; end if;
  return 'ok';
end
$$;

-- Gives a use back when the account could not be made after all.
create or replace function public.release_invite(p_code text) returns void
language sql security definer set search_path = '' as $$
  update public.invite set uses = greatest(uses - 1, 0) where code = upper(trim(p_code))
$$;

revoke all on function public.claim_invite(text, boolean) from public, anon, authenticated;
revoke all on function public.release_invite(text) from public, anon, authenticated;
grant execute on function public.claim_invite(text, boolean) to service_role;
grant execute on function public.release_invite(text) to service_role;

-- For the owner's Invitations section: accounts in use against the cap. Anyone else gets null.
create or replace function public.instance_status() returns json
language sql stable security definer set search_path = '' as $$
  select case when public.is_owner() then json_build_object('users', (select count(*) from auth.users), 'cap', (select user_cap from public.app_config)) end
$$;
revoke all on function public.instance_status() from public, anon;
grant execute on function public.instance_status() to authenticated;

-- Onboarding (4.2): a new profile has no name and has not finished the first run. The existing profile has.
alter table public.profile add column onboarded boolean not null default false;
update public.profile set onboarded = true;
alter table public.profile alter column display_name set default '';

-- Per-user rate limit on the llm function (4.4). Users may read their own counts; only bump_llm_rate() writes.
create table public.llm_rate (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  hour timestamptz not null,
  calls int not null default 0,
  primary key (user_id, hour)
);
alter table public.llm_rate enable row level security;
create policy llm_rate_own_read on public.llm_rate for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.bump_llm_rate() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  insert into public.llm_rate (user_id, hour, calls) values (auth.uid(), date_trunc('hour', now()), 1)
  on conflict (user_id, hour) do update set calls = public.llm_rate.calls + 1
  returning calls into n;
  delete from public.llm_rate where user_id = auth.uid() and hour < date_trunc('hour', now()) - interval '1 day';
  return n;
end
$$;
revoke all on function public.bump_llm_rate() from public, anon;
grant execute on function public.bump_llm_rate() to authenticated;

-- Drafts quota (4.4): 100 MB per user. A new upload is refused once the user's files reach 90 MB, so with the 10 MB
-- file limit the total never passes 100 MB.
create or replace function public.drafts_bytes() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects
  where bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text
$$;
revoke all on function public.drafts_bytes() from public, anon;
grant execute on function public.drafts_bytes() to authenticated;

drop policy drafts_own_files on storage.objects;
create policy drafts_own_read on storage.objects for select to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy drafts_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.drafts_bytes()) < 94371840);
create policy drafts_own_update on storage.objects for update to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text and (select public.drafts_bytes()) < 94371840);
create policy drafts_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Card reminders for more than one person: the job runs every hour and the push function sends to each profile
-- whose local push hour it is, so one person's settings no longer move everyone's reminder.
drop trigger profile_schedule_card_push on public.profile;
drop function public.schedule_card_push();
select cron.schedule(
  'wonderwander-card-push',
  '0 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_function_url'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
      body := '{}'::jsonb
    )
  $job$
);
