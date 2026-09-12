# S<N.N> — <Story title>

| | |
|---|---|
| **Epic** | <N — Epic name> |
| **Status** | Not started |
| **Depends on** | <story IDs, or "—"> |
| **Blocks** | <story IDs, or "—"> |
| **Size** | <S / M / L> |
| **Risk** | <low / medium / high — one clause on why> |

## Goal

<Two or three sentences. What a user or operator can do once this is done that they could not do before. Written in terms of the MVP journey, not in terms of code.>

## Context

<Why this story exists and what it assumes. Reference the relevant CLAUDE.md section. Call out any decision recorded in [00-decisions.md](00-decisions.md) — written `../00-decisions.md` from inside `spec/stories/` — that this story depends on.>

## Scope

**In**
- <bullet>

**Out**
- <bullet — especially anything a reader might reasonably assume is included but is not>

## Acceptance criteria

Each criterion is independently checkable by a person or a test.

- [ ] **AC1** — <criterion>
- [ ] **AC2** — <criterion>

## Implementation notes

<Concrete guidance: files and directories to create, named exports, library choices, SQL, gotchas. Enough that an engineer does not have to re-derive the design, not so much that it becomes the code. Use fenced blocks for SQL, types and signatures.>

## Data and API surface

<Tables touched, RPCs called, Zod schemas added, TanStack Query keys and mutations introduced. Write "None" if the story touches no server state.>

## UI states

<Every screen this story adds or changes. Write "Not a UI story" if it adds no screen.>

| Screen | Loading | Empty | Error | Populated |
|---|---|---|---|---|
| <route> | <behaviour> | <behaviour> | <behaviour> | <behaviour> |

## Test plan

- **Unit** — <what, or "none">
- **Integration / RLS** — <what, or "none">
- **E2E** — <what, or "none">
- **Manual** — <what a human checks on a real device, or "none">

## Definition of done

- [ ] All acceptance criteria met
- [ ] `npm run typecheck` and `npm run lint` clean
- [ ] Tests for this story pass in CI
- [ ] Four UI states handled on every screen touched
- [ ] S1.4 RLS suite still passes
- [ ] <any story-specific gate>

## Open questions

<Numbered, each with a proposed default so the story is not blocked on an answer. Write "None." if there are none.>
