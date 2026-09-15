# CI

`.github/workflows/ci.yml` is the only pipeline that gates a merge. It runs on every pull request and on
every push to `main`. Deployment is a separate workflow, owned by S0.5, triggered on push to `main`, and it
runs no tests: the pipeline gates the merge, the merge gates the deploy (D14).

## Rules every job inherits

- **One job reads secrets and touches hosted data, and it no longer runs by default.** The `rls (hosted)`
  job, S1.4's `npm run test:rls`, runs against the hosted project (D63) with `SUPABASE_PROJECT_REF`,
  `SUPABASE_ACCESS_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY`. Its `globalSetup` **wipes and reseeds** the one
  shared project, so now that the project holds data worth keeping it is gated off ordinary pushes (see
  "The hosted RLS suite is off by default" below) and runs only on demand. No other step reads `secrets.*`,
  and no workflow uses GitHub's privileged fork trigger — the `_target` variant of `pull_request`, which
  hands fork code the repository's secrets. A pull request from a fork therefore runs everything but that
  one job. The Supabase CLI's local anon and service-role keys are published constants, committed in
  `.env.example` (D38).
- **`TZ: UTC`** at workflow level and on each job (D53). A Dublin date assertion that passes locally in July
  fails on a UTC runner in January.
- **Node from `.nvmrc`.** `actions/setup-node@v5` with `node-version-file: .nvmrc` and `cache: npm`, so the
  runner and the pin in S0.1 cannot drift apart. No Node matrix: a matrix tests a configuration nobody
  ships.
- **One pinned Supabase CLI.** The workflow-level `env` key `SUPABASE_CLI_VERSION` holds an exact version,
  never `latest`. Any job that runs `supabase/setup-cli` reads that key rather than pinning its own, because
  the CLI version decides whether `[auth.sessions]` in S2.6 is honoured or silently ignored. Bumping it is a
  manual change in its own pull request.
- **`permissions: contents: read`** at workflow level, and nothing else.
- **One run per ref.** `concurrency` is keyed on the ref with `cancel-in-progress: true`, so a force-push
  does not leave two runs racing.

## Jobs

| Job          | Owner                  | Does                                                                                                                                                                                                                 | Must never                                                            |
| ------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `check`      | S0.7                   | `npm ci`, typecheck, lint, format check, unit tests, production build, env parity — each its own step so a failure names itself                                                                                      | Read a secret, or start a database                                    |
| `pr-title`   | S0.7                   | Fails a pull request whose title is not a conventional commit, naming the allowed types                                                                                                                              | Run on `push`; interpolate the title into a shell line                |
| `db`         | S1.1                   | Local Supabase stack, `supabase db reset`, structural tests, the seed, generated-type and `db diff` checks (gated behind `RUN_LOCAL_STACK`)                                                                          | Pin its own CLI version; skip `fetch-depth: 0`, which S1.1 AC20 needs |
| `rls`        | S1.4                   | `npm run test:rls` against the hosted project (secrets). **Wipes and reseeds**, so off by default — runs only on a `run_rls=true` dispatch or `RUN_RLS_HOSTED='true'`; skipped on a fork                             | Run on an ordinary push and destroy live data                         |
| `migrations` | S1.1 (AC20)            | Pure-git check that no merged migration was edited or deleted (`origin/main...HEAD`). No secret, no database — runs on every push and PR, forks included                                                             | Read a secret or start a database                                     |
| `pwa`        | S0.4                   | Build, then the Playwright `pwa` project against `vite preview`: two-build staleness, offline shell, cold deep link, and Chromium's installability verdict (Lighthouse dropped its PWA audits; see S0.4 build notes) | Need a stack or a secret; drive the live site                         |
| `e2e`        | S2.5, extended by S7.3 | Local stack plus seed, `vite preview` on 127.0.0.1:4173, Playwright (gated behind `RUN_LOCAL_STACK`)                                                                                                                 | Touch the live site (D17)                                             |

`check`, `pwa`, `migrations` and `pr-title` are the jobs that always run; `rls`, `db` and `e2e` are gated
(see below). A story that adds a job adds its row above and adds the job to the required status checks below,
in the same pull request.

`db` is the only job that runs `supabase start`, and the only one that needs Docker on the runner. It
resets the local database from `supabase/migrations/` twice (S1.1 AC1), runs `npm run test:db`, then
asserts the generated enums are unions (AC17), that the committed `src/lib/database.types.ts` matches what
the migrations generate (S1.5 AC1 — regenerate with `npm run db:types`; the PostgREST version stamp is the
one line excluded, because the hosted project's and the local stack's differ), that `supabase db diff` is
empty after a reset (AC18), and that no migration already on `main` was modified or deleted (AC20,
`origin/main...HEAD`).

`npm run test:rls` is S1.4's suite: `vitest.rls.config.ts`, hosted-only, wiping and reseeding the project in
`globalSetup` before its assertions as anon, player, manager, admin, stranger and leaver. It prints the
project ref and row counts before it wipes (D63). Because it destroys whatever data is in the shared project,
it is **off by default** (see below) — run it locally, or dispatch it, when RLS policies or migrations change,
and at go-live.

`npm test` is S0.1's `vitest run`. S7.2 changes that one step to `vitest run --coverage` and adds the
coverage floor; it changes nothing else in the job.

`scripts/check-env-parity.mjs` is S0.5's file (its AC14): it compares the `VITE_` keys in `.env.example`
against the `env:` block of the deploy workflow and fails on any key present in one and missing from the
other. The step that runs it lives in `check` and exists from S0.7; before S0.5 ships the script there is
nothing to compare, so the step reports that and passes.

## Branch protection on `main`

Branch protection is a repository setting, not a file, so this section is the record of it.

- `main` requires a pull request before merging. Direct pushes are refused.
- Required status checks: `check` and `pr-title`. `db` is added by S1.1, `pwa` by S0.4, `e2e` by S2.5.
- "Require branches to be up to date before merging" is on, so a green check means green against the tip of
  `main`, not against a stale base.
- No other rule. No required reviewers: this is a one-maintainer repository and a self-approval rule would
  only be worked around.

Applied in Settings → Branches once the Epic 0 foundation commits are on `origin/main`. Enabling it before
then would refuse the pushes that put this workflow on `main` in the first place, and the two required
checks do not exist as check names until the workflow has run once.

## The local-stack jobs are gated (2026-09-14)

`db (local stack)` and `e2e (local stack)` bring up the CLI's local Supabase stack. On CLI 2.108
that stack's REST gateway answers **HTTP 403** to the seed's service-role key — a quirk that does
not occur against the hosted project (the same client and key work there) and cannot be reproduced
or debugged without local Docker, which this environment lacks.

To stop every push failing on an unfixable-here job, both are gated behind the repository variable
**`RUN_LOCAL_STACK`**. Unset, they skip (a skipped job is green and sends no failure notification).

**The migration-immutability check (AC20) is its own job now.** It used to live inside the `rls`
job; since that job is gated off (below), the pure-git AC20 check moved to a standalone `migrations`
job that runs on every push and pull request, forks included.

## The hosted RLS suite is off by default (2026-09-15)

The `rls (hosted)` job's `globalSetup` wipes and reseeds the one shared Supabase project (D63). While
that project was empty scaffolding this was free; once it started holding real data — events a
manager created, availability, squads — running it on every push **destroyed that data on every
deploy**. So the job is now gated:

- On a push or pull request it runs **only** if the repository variable **`RUN_RLS_HOSTED`** is
  `'true'` (unset by default, so it skips — a skipped job is green and silent). The same-repo guard
  still applies, so a fork pull request never selects it.
- It can always be run **on demand** without touching the variable: `gh workflow run ci.yml -f
run_rls=true` (or the "Run workflow" button, with the RLS toggle on). That dispatch still wipes and
  reseeds, so only run it when the shared project's data is expendable.
- Locally, `npm run test:rls` is unchanged — it wipes and reseeds too, so treat it the same way.

**When to run it:** whenever RLS policies or the RPCs change, whenever a migration lands, and as part
of the go-live checklist (`docs/database.md`), which is also when a reseed is acceptable. Between
those, RLS is unchanged, so the risk of the gate being off is a policy regression slipping in
unverified — mitigated by RLS changes being rare and always shipped with an explicit RLS run.

**To turn it back on for every push** (e.g. approaching go-live, once the data is disposable again):
`gh variable set RUN_RLS_HOSTED --body true`; unset it with `gh variable delete RUN_RLS_HOSTED`.

**To re-enable** once the 403 is fixed: `gh variable set RUN_LOCAL_STACK --body true`, then the two
jobs run again. What is temporarily unenforced while gated: the local schema/trigger structural
tests (`test:db`, S1.1/S1.2), the generated-types-current check (S1.5 AC1), and the Playwright
`e2e` deep-link walk (S2.5) — all documented in their story files.
