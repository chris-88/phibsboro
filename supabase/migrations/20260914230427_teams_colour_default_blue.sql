-- Revert the default back to the original blue: Chris only wanted the APP accent greyed, not the
-- team colours (which distinguish teams on the calendar). Forward-only correction.
alter table public.teams alter column colour set default '#1e40af';
