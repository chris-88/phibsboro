# Migrations

Forward-only. These files are the whole truth about the schema (S1.1 AC18), and they are applied to
the production project by the deploy workflow on every push to `main` (D18).

## The rule

- **A merged migration file is never edited.** Once a file is on `main` it has been applied to
  production under that timestamp, and `supabase db push` will never apply it again. Editing it
  changes what a fresh `supabase db reset` produces while leaving production as it was.
- **Corrections ship as a new timestamped migration.** `supabase migration new <name>`, then the
  `alter`, `create` or `drop` that fixes it.
- **There are no down migrations.** Nothing in this directory is reversible by tooling. If a
  migration is wrong, write the next one.
- `supabase migration repair` is a production incident tool, not a workflow step.

## Enforcement

The CI `db` job fails a pull request that modifies or deletes a migration file that already exists
on `main`:

```sh
git diff --diff-filter=MD --name-only origin/main...HEAD -- supabase/migrations
```

must print nothing. Adding a file is fine; that is the only kind of change this directory takes.

## Applying

| Where            | How                                                                    |
| ---------------- | ---------------------------------------------------------------------- |
| Local stack      | `npm run db:reset` — drops the local database and replays every file   |
| Hosted project   | `supabase db push` from a linked checkout; CI does this on merge (D18) |
| Types afterwards | `npm run db:types` regenerates `src/lib/database.types.ts`             |

There is no `seed.sql` here on purpose. The seed is a Node script, `supabase/seed/seed.ts` (D15),
because auth users cannot be created in SQL; `[db.seed]` is disabled in `config.toml` so a stray file
cannot split the seed across two mechanisms.
