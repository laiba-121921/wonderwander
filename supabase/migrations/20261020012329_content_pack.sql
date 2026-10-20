-- PHASE_15_PLUS 3.2: the curriculum lives in a private bucket. Every signed-in user may read a pack, except its
-- owner-only/ objects, which only the instance owner may read. Only the owner may write.

-- One row: the owner's user id, set by the `setup` function from the OWNER_EMAIL secret. Nobody reads the table
-- directly; is_owner() answers for the caller.
create table public.owner (
  one boolean primary key default true check (one),
  user_id uuid not null references auth.users on delete cascade
);
alter table public.owner enable row level security;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.owner where user_id = (select auth.uid()))
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit) values ('content', 'content', false, 10485760);

create policy content_read on storage.objects for select to authenticated
  using (bucket_id = 'content' and (name !~ '^packs/[^/]+/owner-only/' or (select public.is_owner())));
create policy content_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and (select public.is_owner()));
create policy content_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'content' and (select public.is_owner())) with check (bucket_id = 'content' and (select public.is_owner()));
create policy content_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'content' and (select public.is_owner()));
