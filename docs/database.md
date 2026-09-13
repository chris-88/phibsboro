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
npm run db:types                        # regenerate types after a schema change
```

CI does the same in `deploy.yml`'s `migrate` job, which gates the publish (D18). The secrets are set
and `supabase/migrations/` exists, so every push to `main` applies pending migrations to production.
The rule for that directory is in [`supabase/migrations/README.md`](../supabase/migrations/README.md):
forward-only, never edit an applied file.

`npm run test:db` runs the S1.1 structural assertions (`tests/db/`) against the CLI's **local** stack
(`supabase start`, needs Docker). It reads no environment, so it cannot be pointed at the hosted project;
the CI `db` job runs it on every pull request.

## Test data

There is one Supabase project, not two. The access token has no organisation scope, so project creation
returns 403 and a dedicated test project cannot be created from here.

That is fine for now. The project holds no real data, so the S1.4 RLS suite truncates freely and
`npm run db:seed` puts it back. The suite prints the project ref and the row counts it is about to
destroy before it does ([D63](../spec/00-decisions.md)).

## Go-live checklist

Before the club's members register, in this order:

1. **Stop the RLS suite pointing at production.** From the moment real data exists, a CI run that
   truncates it is a data-loss incident. Either create a second project — an organisation-scoped personal
   access token does it in a minute — and point CI's `SUPABASE_PROJECT_REF` at that, or stop running the
   suite in CI against production.
2. **Nuke the test data and seed for real.** Drop the seeded fixtures, create the club's actual teams
   (S6.1) and generate their join links (S6.2).
3. **Rotate the credentials** that have been used during development.
4. ~~Point the custom domain~~ — done 2026-09-13, `app.phibsboro.ie` is live.
