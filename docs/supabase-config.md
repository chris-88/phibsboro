# Supabase Auth configuration (hosted project)

The hosted dashboard is not in the repo, so the session and refresh settings that keep a player
signed in for a season live here as the record of record. `supabase config push` is **never** run
against the hosted project (see the `[auth.sms.twilio]` note in `supabase/config.toml`), so
`supabase/config.toml` governs the local CLI stack and this file governs the hosted project. Both
halves are asserted: the committed TOML by the config-drift Vitest test (S2.6), the hosted values
by the row below.

## Project

- Ref: `hhhlbermhelfgxgkgitz` — eu-west-2, Postgres 17.6.

## Auth session and refresh settings

Read from the Management API `GET /v1/projects/{ref}/config/auth` on the date below. These are the
values S2.6 (D59) depends on. The Management API key names differ from the TOML key names; both are
given.

| Setting                                 | Hosted value               | `config.toml` key                      | Meaning                                                                                       |
| --------------------------------------- | -------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `jwt_exp`                               | `3600`                     | `jwt_expiry = 3600`                    | Access token lives one hour, then a silent refresh.                                           |
| `refresh_token_rotation_enabled`        | `true`                     | `enable_refresh_token_rotation = true` | Each refresh mints a new refresh token.                                                       |
| `security_refresh_token_reuse_interval` | `10`                       | `refresh_token_reuse_interval = 10`    | A rotated token still works for 10s, so a double-fire on resume does not sign the player out. |
| `sessions_timebox`                      | `0`                        | `timebox = "0h"`                       | No absolute session cap — never logged out mid-season.                                        |
| `sessions_inactivity_timeout`           | `0`                        | `inactivity_timeout = "8760h"`         | Hosted: **no** inactivity timeout at all. TOML: 365 days. See the drift note below.           |
| `password_min_length`                   | `8`                        | `minimum_password_length = 8`          | S1.2 / S2.1.                                                                                  |
| `site_url`                              | `https://app.phibsboro.ie` | `site_url`                             | S1.2 amendment (2026-09-13).                                                                  |
| `external_phone_enabled`                | `true`                     | —                                      | Phone provider on (D19 path A).                                                               |
| `sms_autoconfirm`                       | `true`                     | —                                      | No SMS, no OTP; numbers unverified by design (D19).                                           |

### Drift note — inactivity timeout

The hosted project sets `sessions_inactivity_timeout = 0`, which GoTrue reads as **no inactivity
timeout**: a session never expires from being idle. `config.toml` sets `inactivity_timeout =
"8760h"` (365 days), the finite value AC1 names. Both satisfy the brief's "a player should not need
to re-enter a password for a full season" — the hosted setting more strongly (unbounded). The TOML
carries a bounded, reviewable number; the hosted project is left unbounded and is not pushed to. If
the hosted value is ever tightened, it must stay at or above 365 days, and this row must be
re-checked.

## How to re-check

Run, from the repo root, with `.env.local` present:

```
node -e 'import("node:fs").then(async(fs)=>{for(const l of fs.readFileSync(".env.local","utf8").split("\n")){const t=l.trim();if(!t||t.startsWith("#"))continue;const i=t.indexOf("=");if(i>-1)process.env[t.slice(0,i)]??=t.slice(i+1)}const r=await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/config/auth`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`}});const j=await r.json();for(const k of["jwt_exp","refresh_token_rotation_enabled","security_refresh_token_reuse_interval","sessions_timebox","sessions_inactivity_timeout","password_min_length","site_url"])console.log(k,"=",JSON.stringify(j[k]))})'
```

## Checked

- 2026-09-13 by christopherlquinn@gmail.com, against ref `hhhlbermhelfgxgkgitz` via the Management
  API. Re-check at every release that changes auth.
