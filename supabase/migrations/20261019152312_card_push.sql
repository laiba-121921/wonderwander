-- Card reminders (BUILD_PLAN 18): pg_cron calls the push function once a day at the profile's push hour, through pg_net.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Server-only values live in Vault. The job's shared secret is random and generated here; it never leaves the database.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_cron_secret', 'wonderwander: proves the daily job to the push function');
select vault.create_secret('https://ekspkhpcuqkscbndglpy.supabase.co/functions/v1/push', 'push_function_url', 'wonderwander: where the daily job sends its call');

-- Only the push function (service role) may read these or store the VAPID key pair it generates on first use.
create or replace function public.push_secret(secret_name text) returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1
$$;

create or replace function public.push_store_vapid(keys text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_vapid_keys') then
    perform vault.create_secret(keys, 'push_vapid_keys', 'wonderwander: VAPID key pair for card reminders');
  end if;
end
$$;

revoke all on function public.push_secret(text) from public, anon, authenticated;
revoke all on function public.push_store_vapid(text) from public, anon, authenticated;
grant execute on function public.push_secret(text) to service_role;
grant execute on function public.push_store_vapid(text) to service_role;

-- The push hour is local; cron runs in UTC, so the job is rescheduled whenever the hour or timezone changes.
create or replace function public.schedule_card_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  utc_hour int := extract(hour from ((current_date + make_time(new.push_hour, 0, 0)) at time zone new.timezone) at time zone 'UTC');
begin
  perform cron.schedule(
    'wonderwander-card-push',
    format('0 %s * * *', utc_hour),
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_function_url'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
        body := '{}'::jsonb
      )
    $job$
  );
  return new;
end
$$;

revoke all on function public.schedule_card_push() from public, anon, authenticated;

create trigger profile_schedule_card_push
after insert or update of push_hour, timezone on public.profile
for each row execute function public.schedule_card_push();

-- schedule now for the existing profile
update public.profile set push_hour = push_hour;
