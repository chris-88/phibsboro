-- The club crest is monochrome, so team colours default to near-black (Chris, 2026-09-14).
-- Additive: existing rows are updated separately; new teams get this default.
alter table public.teams alter column colour set default '#171717';
