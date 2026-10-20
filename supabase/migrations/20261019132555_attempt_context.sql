-- Doing drills keep what was shown with the attempt: the targeted premise, the argument, and the author's reply (generated once).
alter table public.attempt add column context jsonb;
