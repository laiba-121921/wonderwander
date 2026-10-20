-- Profile row only (BUILD_PLAN 4). The app also creates it on first sign-in, so this is for a fresh or reset database.
insert into public.profile (user_id)
select id from auth.users
on conflict (user_id) do nothing;
