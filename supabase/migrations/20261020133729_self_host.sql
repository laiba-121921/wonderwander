-- PHASE_15_PLUS 5: what a fresh instance needs to stand on its own.

-- The sign-in screen shows the instance name before anyone has signed in.
create policy app_config_read_signed_out on public.app_config for select to anon using (true);

-- The hourly card job calls this instance's own push function. An earlier migration stored the original project's
-- address; the `setup` function puts the right one here on every instance.
create or replace function public.set_push_url(url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid := (select id from vault.secrets where name = 'push_function_url');
begin
  if sid is null then
    perform vault.create_secret(url, 'push_function_url', 'wonderwander: where the hourly job sends its call');
  else
    perform vault.update_secret(sid, url);
  end if;
end
$$;
revoke all on function public.set_push_url(text) from public, anon, authenticated;
grant execute on function public.set_push_url(text) to service_role;
