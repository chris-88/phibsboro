# Deployment

`.github/workflows/deploy.yml` is the only path that publishes. It runs on every push to `main` and on
`workflow_dispatch`. Tests are not re-run here — `main` is protected and S0.7's `check` job has already
passed on the pull request (D14).

```
migrate  →  build  →  deploy  →  smoke
```

A failure in any job leaves the previously deployed site untouched and serving.

## Live at app.phibsboro.ie

Cut over on 2026-09-13. `phibsboro.ie` delegates to `ns9`/`ns10.dnsireland.com` (Letshost); the zone
holds one record, `app CNAME chris-88.github.io`. `public/CNAME` is committed, `VITE_BASE_PATH` is `/`,
HTTPS is enforced and the certificate is from Let's Encrypt via GitHub. The old project-page address
`chris-88.github.io/phibsboro/` redirects here.

`scripts/switch-domain.sh` did the cutover and stays in the repo as the record of how; the reverse is
documented at the top of that file.

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
- **Sentry** — the app skips initialisation on a blank `VITE_SENTRY_DSN`, so nothing is reported and
  nothing is sent anywhere. The `build` job's `Skip the Sentry sourcemap upload when not configured`
  step reports `configured=false` while `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` or `SENTRY_PROJECT` is
  absent; the bundle is then built with no sourcemaps at all and nothing is uploaded. Set all three
  plus the DSN, and the next deploy builds hidden maps, uploads them under the commit SHA and deletes
  them before publish. Then run the once-per-release check in S0.6's test plan. Note the plugin logs
  an upload failure (bad token, wrong project) without failing the build, so a deploy can go green
  with no maps in Sentry — the manual check is what catches that.

## Guards

- `scripts/verify-dist.sh` gates the publish: no `*.map` in the artifact (AC6), no secret prefix present
  in the bundle (AC7), `CNAME` correct when one is configured (AC9), and the `pfc-release` meta tag
  present. Sourcemaps exist only in a build with Sentry credentials, where `@sentry/vite-plugin`
  deletes them after upload (S0.6 AC4); `vite.config.ts` sets `build.sourcemap: false` otherwise.
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
