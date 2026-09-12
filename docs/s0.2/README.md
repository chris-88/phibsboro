# S0.2 — shell screenshots

Chromium at a 375 x 667 viewport, one per role (AC14). Taken against `npm run preview` with
`App.tsx` temporarily reading `?role=` and `?path=` from the query string; the committed
`App.tsx` hard-codes `role="player"` until S2.9 supplies the real one.

| File                    | Role    | Path                                                       |
| ----------------------- | ------- | ---------------------------------------------------------- |
| `shell-375-player.png`  | player  | `/`                                                        |
| `shell-375-manager.png` | manager | `/manage/event/new` — Manage is active from a deeper route |
| `shell-375-admin.png`   | admin   | `/admin`                                                   |
