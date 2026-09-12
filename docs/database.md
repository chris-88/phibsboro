# Database access

Everything needed to change the schema, inspect data or run the RLS suite is already configured. No
database password is involved anywhere: the personal access token carries the authority.

## The three credentials

| Credential                  | Where it lives                  | What it does                                                                                         |
| --------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`     | `.env.local`, repo **secret**   | Management API and the Supabase CLI. Runs SQL as `postgres`, applies migrations, generates types.    |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, repo **secret**   | Auth admin (create and delete users) and PostgREST calls that bypass RLS. Used by the S1.4 fixtures. |
| `VITE_SUPABASE_ANON_KEY`    | `.env.local`, repo **variable** | What the browser uses. Public by design (D38); RLS is the enforcement layer.                         |

Project: `phibsboro`, ref `hhhlbermhelfgxgkgitz`, region `eu-west-2` (London), Postgres 17.6.

## Running SQL

```bash
node scripts/db.mjs "select count(*) from profiles"
node scripts/db.mjs --file supabase/migrations/0001_schema.sql
echo "select now()" | node scripts/db.mjs
node scripts/db.mjs "select * from teams" --json
```

It runs as the `postgres` superuser through `POST /v1/projects/{ref}/database/query`, so it can do DDL —
tables, policies, functions, triggers, grants. Use it for inspection and one-off checks.

**Schema changes still go in a migration file**, not through this script. The script is how you look at
the database and how you check a migration did what you meant; `supabase db push` is how the schema
actually changes, so that production and CI stay reproducible.

## Migrations

The project is linked, so these work with no further setup:

```bash
supabase migration list --linked        # what is applied where
supabase db push                        # apply pending migrations
supabase gen types typescript --project-id hhhlbermhelfgxgkgitz --schema public \
  > src/lib/database.types.ts           # regenerate types after a schema change
```

CI does the same in `deploy.yml`'s `migrate` job, which gates the publish (D18). That job currently
skips itself when the Supabase secrets are absent — they are now set, so it will run for real as soon as
`supabase/migrations/` exists.

## Test isolation

There is one Supabase project, not two. The access token has no organisation scope, so project creation
returns 403 and a dedicated test project cannot be created from here.

The S1.4 RLS suite therefore **must not truncate anything**. Every test run:

- creates its own fixtures under a unique run id — teams named `test-<runId>-…`, users with phone numbers
  in a reserved range — so two runs never collide and a run never touches real data;
- deletes only the rows it created, in an `afterAll`, keyed on that run id;
- never issues `truncate`, `drop schema`, or a delete without a run-id predicate.

This is enforced, not merely intended: `scripts/check-conventions.mjs` fails on a bare `truncate` or an
unscoped `delete from` under `tests/`. See [D63](../spec/00-decisions.md).

That keeps the POC data intact while the suite runs against the same project as the live site. If a
second project is wanted later, issue a PAT with organisation scope and it can be created in a minute.
