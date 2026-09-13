# CI

`.github/workflows/ci.yml` is the only pipeline that gates a merge. It runs on every pull request and on
every push to `main`. Deployment is a separate workflow, owned by S0.5, triggered on push to `main`, and it
runs no tests: the pipeline gates the merge, the merge gates the deploy (D14).

## Rules every job inherits

- **No secret.** No job reads `secrets.*`, and no workflow uses GitHub's privileged fork trigger — the
  `_target` variant of `pull_request`, which hands fork code the repository's secrets. A pull request from a
  fork therefore runs the whole pipeline. The Supabase CLI's local anon and service-role keys are published
  constants, committed in `.env.example` (D38). Hosted credentials belong to the deploy workflow alone.
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

| Job        | Owner                  | Does                                                                                                                                                                                                                 | Must never                                                            |
| ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `check`    | S0.7                   | `npm ci`, typecheck, lint, format check, unit tests, production build, env parity — each its own step so a failure names itself                                                                                      | Read a secret, or start a database                                    |
| `pr-title` | S0.7                   | Fails a pull request whose title is not a conventional commit, naming the allowed types                                                                                                                              | Run on `push`; interpolate the title into a shell line                |
| `db`       | S1.1, extended by S1.4 | Local Supabase stack, `supabase db reset`, structural tests, then the seed and the RLS project                                                                                                                       | Pin its own CLI version; skip `fetch-depth: 0`, which S1.1 AC20 needs |
| `pwa`      | S0.4                   | Build, then the Playwright `pwa` project against `vite preview`: two-build staleness, offline shell, cold deep link, and Chromium's installability verdict (Lighthouse dropped its PWA audits; see S0.4 build notes) | Need a stack or a secret; drive the live site                         |
| `e2e`      | S2.5, extended by S7.3 | Local stack plus seed, `vite preview` on 127.0.0.1:4173, Playwright                                                                                                                                                  | Touch the live site (D17)                                             |

`check`, `pwa` and `db` are the jobs in the file. A story that adds a job adds its row above and adds the
job to the required status checks below, in the same pull request.

`db` is the only job that runs `supabase start`, and the only one that needs Docker on the runner. It
resets the local database from `supabase/migrations/` twice (S1.1 AC1), runs `npm run test:db`, then
asserts the generated enums are unions (AC17), that `supabase db diff` is empty after a reset (AC18), and
that no migration already on `main` was modified or deleted (AC20, `origin/main...HEAD`).

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
