-- Hosted use access check (PHASE_15_PLUS 4.4, Phase 18 acceptance). Run through the Supabase connector or the SQL
-- editor after supabase/tests/rls_isolation.sql. It acts as a throwaway second user and as the owner, then raises an
-- exception so nothing persists. Every line of the message should end in "ok".
do $$
declare
  b uuid := gen_random_uuid();
  owner_id uuid := (select user_id from public.owner);
  n int;
  j json;
  out text[] := '{}';
begin
  insert into auth.users (id, instance_id, aud, role, email) values (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hosted-b@example.invalid');

  -- the owner mints a code
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  insert into public.invite (code) values ('TESTCASE22');
  select count(*) into n from public.invite where code = 'TESTCASE22';
  out := out || format('owner makes and sees a code: %s %s', n, case when n = 1 then 'ok' else 'FAIL' end);
  j := public.instance_status();
  out := out || format('owner sees accounts against the cap: %s %s', j, case when j ->> 'cap' is not null then 'ok' else 'FAIL' end);

  -- a second user sees no codes, cannot make one, cannot change the cap, cannot claim directly
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.invite;
  out := out || format('second user sees codes: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);
  begin
    insert into public.invite (code) values ('FAKEDCASE2');
    out := array_append(out, 'second user makes a code: FAIL');
  exception when insufficient_privilege then
    out := array_append(out, 'second user cannot make a code: ok');
  end;
  update public.app_config set user_cap = 999 where true;
  get diagnostics n = row_count;
  out := out || format('second user changes the cap: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);
  select count(*) into n from public.app_config;
  out := out || format('second user reads the instance settings: %s %s', n, case when n = 1 then 'ok' else 'FAIL' end);
  begin
    perform public.claim_invite('TESTCASE22', true);
    out := array_append(out, 'second user claims a code directly: FAIL');
  exception when insufficient_privilege then
    out := array_append(out, 'second user cannot claim a code directly: ok');
  end;
  j := public.instance_status();
  out := out || format('second user gets no instance status: %s %s', coalesce(j::text, 'null'), case when j is null then 'ok' else 'FAIL' end);
  out := out || format('second user is not the owner: %s', case when not public.is_owner() then 'ok' else 'FAIL' end);

  -- the hourly count is per user and only bump_llm_rate() writes it
  n := public.bump_llm_rate();
  n := public.bump_llm_rate();
  out := out || format('second user bumps their own hourly count: %s %s', n, case when n = 2 then 'ok' else 'FAIL' end);
  begin
    insert into public.llm_rate (hour, calls) values (date_trunc('hour', now()) + interval '1 hour', 0);
    out := array_append(out, 'second user writes the hourly count directly: FAIL');
  exception when insufficient_privilege then
    out := array_append(out, 'second user cannot write the hourly count directly: ok');
  end;

  -- the drafts quota: uploads stop once a user holds 90 MB
  insert into storage.objects (bucket_id, name, metadata) values ('drafts', b || '/big.pdf', '{"size": 95000000}');
  out := array_append(out, 'second user uploads under the quota: ok');
  begin
    insert into storage.objects (bucket_id, name, metadata) values ('drafts', b || '/more.pdf', '{"size": 1000}');
    out := array_append(out, 'second user uploads over the quota: FAIL');
  exception when insufficient_privilege then
    out := array_append(out, 'second user cannot upload over the quota: ok');
  end;
  begin
    insert into storage.objects (bucket_id, name, metadata) values ('drafts', owner_id || '/x.pdf', '{"size": 10}');
    out := array_append(out, 'second user uploads into the owner''s folder: FAIL');
  exception when insufficient_privilege then
    out := array_append(out, 'second user cannot upload into the owner''s folder: ok');
  end;

  -- the owner cannot see the second user's counts or files
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true);
  select count(*) into n from public.llm_rate where user_id = b;
  out := out || format('owner sees the second user''s hourly count: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);
  select count(*) into n from storage.objects where bucket_id = 'drafts' and name like b || '/%';
  out := out || format('owner sees the second user''s drafts: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);

  -- deleting the account removes every row it owned (its files go through the Storage API in delete-account)
  reset role;
  delete from auth.users where id = b;
  select count(*) into n from public.llm_rate where user_id = b;
  out := out || format('a deleted account leaves no hourly count: %s %s', n, case when n = 0 then 'ok' else 'FAIL' end);

  raise exception '%', array_to_string(out, E'\n');
end
$$;
