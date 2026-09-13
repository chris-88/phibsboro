-- S1.3 — the shape of the security layer, in one query. Not a test: S1.4 owns the assertions.
-- Prints one row per table with RLS state, policy count and the anon / authenticated table
-- grants, then one row per function in public with its definer flag, search_path and the roles
-- holding execute. Run with `node scripts/db.mjs --file supabase/checks/rls-inventory.sql`, or
-- through psql against the local stack; paste the output into the pull request.
--
-- Expected: eight tables, rls true on every one, team_invites and reset_tokens at zero policies
-- with no anon or authenticated grant, anon holding nothing on any table; every function
-- security definer with search_path="", anon executing exactly get_event_preview,
-- lookup_team_invite and redeem_reset_token.

with tables as (
  select c.oid, c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
grants as (
  select g.table_name, g.grantee, string_agg(left(g.privilege_type, 1), '' order by g.privilege_type) privs
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
  group by g.table_name, g.grantee
)
select 'table'::text                                        as kind,
       t.relname::text                                      as name,
       (select c.relrowsecurity from pg_class c where c.oid = t.oid)::text as rls,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = t.relname)::text as policies,
       coalesce((select privs from grants where table_name = t.relname and grantee = 'anon'), '-')          as anon,
       coalesce((select privs from grants where table_name = t.relname and grantee = 'authenticated'), '-') as authenticated
from tables t

union all

select 'function',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       p.prosecdef::text,
       coalesce(array_to_string(p.proconfig, ','), '-'),
       case when has_function_privilege('anon', p.oid, 'execute') then 'X' else '-' end,
       case when has_function_privilege('authenticated', p.oid, 'execute') then 'X' else '-' end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'

order by 1, 2;
