-- PHASE_15_PLUS 1: grading without the weekly queue. A soft retry is recorded as its own attempt; a final verdict
-- settled by the tie-break (and every argument or boss verdict) can be appealed. Nothing existing is changed or dropped.
alter type public.verdict add value if not exists 'RETRY';
alter table public.attempt add column appealable boolean not null default false;
alter table public.attempt add column retry_of uuid references public.attempt (id) on delete set null;
create index attempt_retry_of_idx on public.attempt (retry_of);
