-- Content pack access check (PHASE_15_PLUS 3.2, Phase 17 acceptance). Run through the Supabase connector or the SQL
-- editor after a pack is uploaded. It reads the content bucket as a throwaway second user, as the owner and signed
-- out, then raises an exception so nothing persists. Every line of the message should end in "ok".
do $$
declare
  other uuid := gen_random_uuid();
  owner_id uuid := (select user_id from public.owner);
  n int;
  out text[] := '{}';
begin
  insert into auth.users (id, instance_id, aud, role, email) values (other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'content-b@example.invalid');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'content' and name like 'packs/%/owner-only/%';
  out := out || format('second user sees owner-only objects: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);
  select count(*) into n from storage.objects where bucket_id = 'content' and name like 'packs/%/units/%';
  out := out || format('second user sees unit files: %s %s', n, case when n > 0 then 'ok' else 'FAIL' end);
  select count(*) into n from storage.objects where bucket_id = 'content' and name = 'packs/current.json';
  out := out || format('second user sees current.json: %s %s', n, case when n = 1 then 'ok' else 'FAIL' end);
  begin
    insert into storage.objects (bucket_id, name) values ('content', 'packs/forged/pack.json');
    out := array_append(out, 'second user writes to content: FAIL');
  exception when others then
    out := array_append(out, 'second user cannot write to content: ok');
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'content' and name like 'packs/%/owner-only/%';
  out := out || format('owner sees owner-only objects: %s %s', n, case when n >= 1 then 'ok' else 'FAIL' end);

  reset role;
  set local role anon;
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from storage.objects where bucket_id = 'content';
  out := out || format('signed out sees content: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);

  raise exception '%', array_to_string(out, E'\n');
end
$$;
