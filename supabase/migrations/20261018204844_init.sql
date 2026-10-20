-- wonderwander initial schema (BUILD_PLAN.md section 6).
-- Every table belongs to one user and is protected by the same RLS rule.

create table profile (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text not null default 'Laiba',
  timezone text not null default 'Asia/Karachi',
  weekend_day smallint not null default 0 check (weekend_day between 0 and 6), -- 0 Sunday ... 6 Saturday
  push_threshold int not null default 12 check (push_threshold > 0),
  push_hour smallint not null default 20 check (push_hour between 0 and 23), -- local hour
  track_rotation_start date,
  created_at timestamptz not null default now()
);

create type item_status as enum ('available', 'pending_review', 'passed', 'locked', 'revision_required');

create table item_state (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,
  unit_id text,
  status item_status not null default 'available',
  locked_until timestamptz,
  revision_done_at timestamptz,
  fail_count int not null default 0,
  last_attempt_id uuid,
  last_feedback text,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create type attempt_source as enum ('typed', 'voice', 'upload', 'tap');
create type verdict as enum ('PASS', 'FAIL', 'ABSTAIN', 'QUEUED');

create table attempt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,
  item_class text not null, -- tap, recall, card, comprehension, reconstruct, object, reply, boss, final_boss, ladder, referee, paper
  exercise_text text not null, -- exactly what was shown (variant aware)
  variant_id uuid,
  answer_text text not null,
  source attempt_source not null,
  key_version int,
  grader jsonb,
  auditor jsonb,
  decision verdict not null,
  confidence text,
  created_at timestamptz not null default now()
);

create table variant (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,
  text text not null,
  structure_ok boolean not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table card_state (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id text not null,
  fsrs jsonb not null, -- ts-fsrs Card object
  due timestamptz not null,
  pass_days date[] not null default '{}', -- distinct local dates with a PASS
  primary key (user_id, card_id)
);

create table card_review (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id text not null,
  attempt_id uuid references attempt (id) on delete set null,
  rating smallint not null,
  reviewed_at timestamptz not null default now()
);

create type queue_status as enum ('pending', 'ruled');

create table review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  attempt_id uuid not null references attempt (id) on delete cascade,
  item_id text not null,
  reason text not null, -- which escalation rule fired
  status queue_status not null default 'pending',
  ruling verdict, -- PASS or FAIL
  ruling_reason text,
  ruled_at timestamptz,
  created_at timestamptz not null default now()
);

create table key_override (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,
  version int not null,
  accept_add text[] not null default '{}',
  reject_add text[] not null default '{}',
  required_edit text[], -- null means unchanged
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id, version)
);

create table boss_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  boss_id text not null, -- unit or domain final boss id
  transcript jsonb not null default '[]', -- [{role,text,level,matched,conceded,at}]
  level smallint not null default 1,
  phase text not null default 'normal', -- normal or reversal
  status text not null default 'active', -- active, judging, decided
  attempt_id uuid references attempt (id) on delete set null,
  created_at timestamptz not null default now()
);

create table writing_submission (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  domain_id text, -- null for the final paper
  step text not null, -- abstract, reconstruction, objection_reply, draft, revision, final_paper
  title text,
  text text not null,
  word_count int not null,
  source attempt_source not null,
  file_path text, -- storage path when uploaded
  attempt_id uuid references attempt (id) on delete set null,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table session_log (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  local_date date not null,
  kind text not null, -- daily or weekend
  track text,
  items_done int not null default 0,
  minutes int not null default 0,
  primary key (user_id, local_date, kind)
);

create table llm_usage (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  usage_date date not null,
  mode text not null,
  calls int not null default 0,
  primary key (user_id, usage_date, mode)
);

create table push_subscription (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text primary key,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for foreign keys and the common reads.
create index attempt_user_item_idx on attempt (user_id, item_id, created_at desc);
create index variant_user_item_idx on variant (user_id, item_id);
create index card_state_due_idx on card_state (user_id, due);
create index card_review_user_idx on card_review (user_id, card_id);
create index card_review_attempt_idx on card_review (attempt_id);
create index review_queue_user_status_idx on review_queue (user_id, status);
create index review_queue_attempt_idx on review_queue (attempt_id);
create index boss_session_user_idx on boss_session (user_id, boss_id);
create index boss_session_attempt_idx on boss_session (attempt_id);
create index writing_submission_user_idx on writing_submission (user_id, domain_id, step);
create index writing_submission_attempt_idx on writing_submission (attempt_id);
create index push_subscription_user_idx on push_subscription (user_id);

-- One RLS pattern everywhere: a signed-in user sees and writes only their own rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profile', 'item_state', 'attempt', 'variant', 'card_state', 'card_review', 'review_queue',
    'key_override', 'boss_session', 'writing_submission', 'session_log', 'llm_usage', 'push_subscription'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    -- the signed-out role never needs these tables
    execute format('revoke all on public.%I from anon', t);
  end loop;
end
$$;

-- Private bucket for uploaded drafts: path is <user_id>/<submission_id>.<ext>, 10 MB, PDF and DOCX only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drafts',
  'drafts',
  false,
  10485760,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

create policy drafts_own_files on storage.objects for all to authenticated
  using (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'drafts' and (storage.foldername(name))[1] = (select auth.uid())::text);
