# Phibsboro FC

Attendance PWA for Phibsboro FC. Managers create training sessions and matches, share them into the squad
WhatsApp group, and collect availability and attendance.

## Getting started

```bash
nvm use          # Node 24, per .nvmrc
npm ci
cp .env.example .env
npm run dev      # http://localhost:5173
```

The committed `.env.example` points at a local Supabase stack and contains no secret. A clean clone
typechecks, lints, tests and builds without any Supabase or Sentry access.

## Commands

| Command                | What it does                                             |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Vite dev server on port 5173                             |
| `npm run build`        | Typecheck, then production build to `dist/`              |
| `npm run preview`      | Serve `dist/` on port 4173 (the port Playwright targets) |
| `npm run typecheck`    | `tsc -b --noEmit`                                        |
| `npm run lint`         | ESLint, then `scripts/check-conventions.mjs`             |
| `npm run test`         | Vitest, once, with `TZ=UTC`                              |
| `npm run format:check` | Prettier, check only                                     |

## Where things live

- [`spec/`](spec/README.md) — the build plan. One story per PR, built in the order `spec/README.md` gives.
- [`CLAUDE.md`](CLAUDE.md) — the product statement and the fixed stack.
- `src/features/{events,availability,attendance,teams,auth}/` — feature code.
- `src/components/`, `src/lib/`, `src/api/` — shared UI, helpers, and the data layer.
