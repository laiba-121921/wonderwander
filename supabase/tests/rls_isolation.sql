-- RLS isolation check (BUILD_PLAN 22, Phase 3 acceptance).
-- Run in the SQL editor or through the Supabase connector. It creates two throwaway users, writes as A,
-- reads and forges as B and as the signed-out role, then raises an exception so every change rolls back.
-- The exception message is the result: every line should end in "ok".
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  n int;
  out text[] := '{}';
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.invalid'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.invalid');

  -- as user A: write a profile and an item
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into profile default values;
  insert into item_state (item_id, status) values ('logic-1:drill:L1-01', 'passed');
  select count(*) into n from item_state;
  out := out || format('A sees own item_state rows: %s %s', n, case when n = 1 then 'ok' else 'FAIL' end);

  -- as user B: sees nothing of A's
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from profile;
  out := out || format('B sees profile rows: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);
  select count(*) into n from item_state;
  out := out || format('B sees item_state rows: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);
  update item_state set status = 'locked' where true;
  get diagnostics n = row_count;
  out := out || format('B updates A rows: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);
  begin
    insert into item_state (user_id, item_id) values (a, 'forged');
    out := out || 'B inserts a row as A: allowed FAIL'::text;
  exception when insufficient_privilege then
    out := out || 'B inserts a row as A: refused ok'::text;
  end;

  -- signed out: no access at all
  reset role;
  set local role anon;
  begin
    perform 1 from profile;
    out := out || 'anon reads profile: allowed FAIL'::text;
  exception when insufficient_privilege then
    out := out || 'anon reads profile: refused ok'::text;
  end;

  raise exception 'RLS RESULT (rolled back): %', array_to_string(out, ' | ');
end
$$;
