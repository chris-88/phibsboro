# Deployment

`.github/workflows/deploy.yml` is the only path that publishes. It runs on every push to `main` and on
`workflow_dispatch`. Tests are not re-run here — `main` is protected and S0.7's `check` job has already
passed on the pull request (D14).

```
migrate  →  build  →  deploy  →  smoke
```

A failure in any job leaves the previously deployed site untouched and serving.

## Current state: project page, not the custom domain

The site is live at **https://chris-88.github.io/phibsboro/**.

`app.phibsboro.ie` is not yet pointed at GitHub Pages. Shipping a `CNAME` file before the DNS resolves
would take the site offline, so the custom domain is deliberately deferred. The bundle is therefore built
with a base path of `/phibsboro/`, carried by the `VITE_BASE_PATH` repository variable rather than
hardcoded in `vite.config.ts`.

### Switching to app.phibsboro.ie

Three steps, in this order:

1. **DNS.** Add a `CNAME` record at your registrar: host `app`, value `chris-88.github.io`. No apex
   records — this is a subdomain. Wait for it to resolve (`dig +short app.phibsboro.ie`).
2. **CNAME file.** `echo app.phibsboro.ie > public/CNAME` and commit it. `scripts/verify-dist.sh`
   starts enforcing AC9 automatically once that file exists.
3. **Base path.** Set the `VITE_BASE_PATH` repository variable to `/` and `VITE_APP_BASE_URL` to
   `https://app.phibsboro.ie`. Then confirm "Enforce HTTPS" is ticked in Settings → Pages (AC8).

Run the workflow by hand (`gh workflow run deploy.yml`) rather than waiting for a commit.

## Repository variables and secrets

`VITE_`-prefixed values are **variables, not secrets** (D38). They ship inside a public bundle on every
page load; calling them secret produces bad reasoning downstream. The anon key is public by design and
RLS is the enforcement layer.

| Name                        | Kind     | Set? | Value                                                      |
| --------------------------- | -------- | ---- | ---------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | variable | ✅   | production project URL                                     |
| `VITE_SUPABASE_ANON_KEY`    | variable | ❌   | production anon key — public, D38                          |
| `VITE_APP_BASE_URL`         | variable | ✅   | used by the share link, D13                                |
| `VITE_BASE_PATH`            | variable | ✅   | `/phibsboro/` now, `/` on the custom domain                |
| `VITE_SENTRY_DSN`           | variable | ❌   | public, ships in the bundle                                |
| `VITE_SENTRY_ENVIRONMENT`   | variable | ✅   | `production`                                               |
| `VITE_SENTRY_RELEASE`       | neither  | n/a  | set by the workflow to `${{ github.sha }}`                 |
| `SENTRY_ORG`                | variable | ❌   | org slug                                                   |
| `SENTRY_PROJECT`            | variable | ❌   | project slug                                               |
| `SENTRY_AUTH_TOKEN`         | secret   | ❌   | sourcemap upload only                                      |
| `SUPABASE_ACCESS_TOKEN`     | secret   | ❌   | CLI auth for `db push`                                     |
| `SUPABASE_PROJECT_REF`      | secret   | ❌   | production project ref                                     |
| `SUPABASE_SERVICE_ROLE_KEY` | secret   | ❌   | local and CI only; never referenced by this workflow (AC5) |

Set a variable with `gh variable set NAME --body VALUE`, a secret with `gh secret set NAME`.

### What the unset ones block

- **`VITE_SUPABASE_ANON_KEY`** — nothing yet. No code reads it until S1.5 builds the Supabase client.
- **`SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF`** — the `migrate` job skips itself while either is
  absent, so deploys succeed but no migration is ever applied. **These must be set before S1.1 merges**,
  or the first schema change will silently never reach production.
- **Sentry** — S0.6 skips initialisation on a blank DSN, and the sourcemap upload step is guarded.

## Guards

- `scripts/verify-dist.sh` gates the publish: no `*.map` in the artifact (AC6), no secret prefix present
  in the bundle (AC7), `CNAME` correct when one is configured (AC9), and the `pfc-release` meta tag
  present.
- `scripts/check-env-parity.mjs` fails if `.env.example` and the build job's `env:` block disagree about
  which `VITE_` keys exist (AC14). It runs in S0.7's `check` job, so the drift is caught on the pull
  request rather than at deploy time.
- `concurrency: { group: pages, cancel-in-progress: false }` — two merges a minute apart queue rather
  than interleave, and the later commit is the one left live (AC11).

## Smoke check

`smoke` runs Playwright's `smoke-deployed` project against the live origin after publishing. It is
read-only by construction: it signs in to nothing and writes nothing, so it is safe against production.
It asserts the site returns 200 and that the `pfc-release` meta tag carries the commit that built it.

`tests/e2e/smoke.deployed.spec.ts` walks every D34 route with a real segment value, hard-reloads each,
and asserts a 200 plus a per-route document title (S0.3 AC1, AC5); asserts the 404 screen for `/#/nope`;
and asserts that the path form `event/<uuid>` is redirected to `/#/event/<uuid>` by `404.html` (S0.3
AC7). Every URL in it is relative with no leading slash, because `SMOKE_BASE_URL` carries `/phibsboro/`
while the site is on the project page and Playwright resolves a leading slash against the bare origin.
S3.3 switches the unknown-route target to `/event/00000000-0000-0000-0000-000000000000` when it ships
the real not-found state (D17).
