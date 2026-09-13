-- Covering indexes for the five foreign keys the Supabase performance advisor flagged after the
-- schema migration. They serve the on-delete set-null and restrict scans when a profile or team
-- is deleted; no read query filters on any of these columns (D39, A20). A separate migration
-- because the schema migration was already applied to the hosted project when the advisor ran,
-- and an applied migration is never edited (supabase/migrations/README.md).
create index team_invites_created_by_idx on public.team_invites (created_by);
create index reset_tokens_team_id_idx    on public.reset_tokens (team_id);
create index reset_tokens_created_by_idx on public.reset_tokens (created_by);
create index events_created_by_idx       on public.events (created_by);
create index attendance_recorded_by_idx  on public.attendance (recorded_by);
