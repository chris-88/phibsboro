-- S10.1 (V9): each team gets a colour, used as the calendar dot (S10.2). Additive and backward
-- compatible — the column is NOT NULL with a default, so existing rows take the default and every
-- reader of the row keeps working. Admin-editable through the existing teams update policy (S1.3);
-- a manager's update still affects zero rows, so nobody but an admin can change it.
alter table public.teams
  add column colour text not null default '#1e40af';

-- The DB half of the palette guard: any stored value must be a 6-digit hex. The client offers only
-- the fixed accessible palette (TEAM_PALETTE); this refuses anything else however it arrives.
alter table public.teams
  add constraint teams_colour_hex check (colour ~ '^#[0-9a-fA-F]{6}$');

-- Seed the two existing teams distinct accessible palette entries so Firsts and Seconds are
-- immediately distinguishable on the calendar (blue and red).
update public.teams set colour = '#1e40af' where name = 'Firsts';
update public.teams set colour = '#b91c1c' where name = 'Seconds';
