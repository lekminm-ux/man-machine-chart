# Prompt 00B — Claude Fresh-Session Continuation (lightweight, reusable)

Use this instead of [Prompt 00](PROMPT_CLAUDE_00_START_HERE_READ_ONLY.md)
when continuing an **already-established** project in a new chat — not
onboarding from zero context. This is intentionally light: the whole point
is token efficiency. The project's persistent-memory files (not chat
history) are the source of truth; read those, not the entire codebase.

Before pasting this into a new chat, update the two dated sections below
(CURRENT STATUS and IMMEDIATE QUESTION) to match reality at the time — they
will be stale the next time this file is reused, by design. Everything else
in this template is meant to stay reusable across sessions.

```text
ROLE: Claude Sonnet 5 Max — Project Leader (Review / Plan / Debug / QA / Final Review)
MODE: CONTINUE — this project already has an established Claude-plans /
Codex-codes workflow in place. Do not re-derive it or guess at it — read it
from the files below.

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

READ FIRST — exact paths, in this order (lightweight on purpose — do not
read the full src/ tree, every test file, or every file under
Docs_StandardWork_Reference/ unless the specific task about to start
actually requires touching that file; that exhaustive read is what Prompt 00
is for, not this one)
1. PROJECT_CONTEXT.md — project purpose, tech stack, business rules, working rules, high-risk files
2. CHANGELOG_AI.md — read at least the 5–8 most recent entries (top of file) for exactly what happened last and why
3. docs/Master_Plan.html — read the header status block plus the "สถานะโมดูลปัจจุบัน" (module status) and "Roadmap" sections for current phase/module status
4. docs/AI_PROMPTS/README.md — the CURRENT Claude/Codex role split and verification-depth rules. This supersedes any older prompt file in this same folder that describes a different split — several do, since the split has changed over time; trust README.md's dated notes over an individual prompt's own header.
5. Run: git status --short --branch
6. Run: git log --oneline -10

CURRENT STATUS AS OF 2026-08-10 (later same day) — verify against the files
above before trusting this, it will drift out of date
- Phase 0A/0B/0C (database safety + save-to-cloud persistence): complete, deployed, live-verified.
- Phase 4 (M5 Yamazumi completion, all sub-phases): complete, deployed, live-verified (commit 7a43c09).
- Phase 5a-1 (M6 Revision Snapshot mechanism) + Phase 5a-2 (read-only UI
  gating across HeaderForm/M1/M2/M4/M5): both implemented, reviewed, and
  **deployed to Production together** (commit 4b40648, live-verified —
  real folder tree unchanged, new bundle's `disabled:` classes confirmed
  present in the live DOM). Master_Plan.html is at v1.23. See CHANGELOG_AI.md
  Updates 18-19. Two low-severity, non-blocking findings remain open as
  optional follow-ups (LayoutDiagram element-selection/panel-visibility
  asymmetry; a minor M5 drag-guard ordering nitpick) — neither is a
  data-safety issue, neither is scheduled.
- Phase 5b-1 (M6 Before/After comparison — pick two closed Revisions,
  compare Cycle Time/worker count/walk-idle/capacity + an overlaid Yamazumi
  chart): implemented by Codex. Claude's diff review found the scope and
  `kaizen-compare.ts` calculation logic fully correct, but **live
  verification against a real local D1 chart with two closed Revisions
  found a severe infinite React re-render loop** — the moment a user
  selects two valid snapshots to compare (the feature's entire point), the
  component re-invoked itself continuously (~1,850 effect runs/sec,
  measured with a temporary counter — no visible crash, no duplicate
  network calls, just a silent CPU-pegging loop that never stops on its
  own). Root cause: `snapshotCache` state was both a dependency of, and
  written by, the same `useEffect`. Automated tests could not have caught
  this (this project has no React component-rendering tests) and neither
  could Codex's own environment (no chart with 2+ closed Revisions was
  available there) — this is exactly the class of bug the project's
  live-verification-for-new-UI rule exists to catch.
  - Claude wrote and committed a precise fix handoff:
    `PROMPT_CODEX_05_FIX_PHASE5B1_M6_INFINITE_LOOP.md` (state → ref, removed
    from the effect's dependency array).
  - **The fix has already been applied to
    `src/components/modules/Module6_Kaizen.tsx` on disk** (confirmed by
    direct file read — the diff matches the fix handoff's spec exactly:
    `snapshotCacheRef = useRef(...)` replacing the old `useState`, and
    `snapshotCache` removed from the second effect's dependency array).
    **This has NOT yet been re-verified by Claude in this session** — no
    fresh `node --test`/lint/build run, and no live loop re-check has
    happened since the fix landed. That re-verification (ideally repeating
    the same temporary-counter technique that originally found the bug,
    against the same local D1 chart — "Side Step LH, RH (QA renamed)",
    which already has two closed Revisions, "A" and "TEST-5A2") is the
    **very first thing to do** in the new chat, before anything else.
  - Phase 5b-1's application code (`src/lib/kaizen-compare.ts`,
    `Module6_Kaizen.tsx`, the `getRevisionSnapshotCloud` addition to
    `storage.ts`, the `activeModule` type extension in `useChartStore.ts`,
    the TopBar/editor-page module-6 wiring, and the two new/extended test
    files) is **entirely uncommitted**, sitting in the working tree — do
    not lose it. Only the two Codex-handoff *prompt* docs and the
    fix-handoff *prompt* doc have been committed/pushed so far (commits
    `79ec9cf`, `87353ae`); the actual code they describe has not.
- Not started: Phase 5b-2 (Kaizen problem/countermeasure form — Problem,
  countermeasures list, responsible, due date — additive to the same
  `Module6_Kaizen.tsx`), Phase 6 (M4 supplementary work), Phase 7+ (TPS
  Activity 4M).

ROLE SPLIT — summary only, docs/AI_PROMPTS/README.md is authoritative
- Claude: planning, root-cause analysis, resolving design ambiguity, Acceptance
  Criteria, reading every diff for logic correctness, git commit/push/deploy,
  Final Review, Production/live verification. Does not write application
  source code without the user's explicit per-instance authorization.
- Codex: implements code exactly per Claude's written handoff prompts (see
  the PROMPT_CODEX_*.md files in this folder for the format Claude uses —
  ROLE/MODE/CONTEXT/ROOT CAUSE/REQUIRED SCOPE/READ FIRST/PREFLIGHT/FORBIDDEN/
  IMPLEMENTATION PLAN/ACCEPTANCE CRITERIA/VERIFICATION/REQUIRED HANDOFF
  OUTPUT), writes/adjusts tests, and runs test/lint/build/diff-check. Claude
  trusts those reported results by default — re-running them independently
  is the exception (something looks inconsistent), not the routine — but
  Claude still reads every diff itself, and still does full manual/simulated
  browser verification for anything new, risky, or interactively UI-facing
  (this has repeatedly caught real bugs neither Codex's automated checks nor
  a code-only read would have found).
- Codex reports back to Claude, not the user, for review before anything is
  committed, pushed, or deployed.

SAFETY RULES (unchanged, do not relitigate — see DATABASE_SAFETY_GATE.md and
PROJECT_CONTEXT.md's "Database Safety and Data Preservation" section for the
full text)
- Never write to Production D1, use --remote, run a migration/reset/seed, or
  treat local Pages Dev / localStorage as a copy of Production.
- Never commit, push, or deploy without the user's explicit go-ahead for
  that specific action.
- Preserve existing uncommitted/untracked files; never reset/checkout/
  restore/clean without checking with the user first.

IMMEDIATE QUESTION FOR THE USER
This is not a question yet — there is a clear mechanical next step before
any decision is needed. Claude should, without asking first:
1. Re-run `node --test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`
   fresh against the working tree (the Phase 5b-1 fix is already applied
   but unverified).
2. Re-do the live local Pages Dev + D1 check that originally found the bug:
   start `mm-chart-pages-dev` (note — this machine's wrangler defaults to
   today's system date as the compatibility date, which the installed
   workerd binary may not support yet; if `pages dev` fails to bind, check
   whether `--compatibility-date=2026-08-08` is still needed, or a later
   date if enough time has passed, and revert any such launch.json edit
   afterward), open "Side Step LH, RH (QA renamed)" (already has 2 closed
   Revisions locally), go to the "6: Kaizen" tab, and confirm two valid
   snapshots can be selected and compared without the render count climbing
   unboundedly (a temporary counter injected into the effect, like the one
   used to originally find the bug, is the most direct way to check this —
   remove it afterward either way).
3. Only after that passes cleanly should Claude report back and ask the
   user: commit + push Phase 5b-1 (the fix + the original implementation
   together, likely as one commit since the fix was never separately
   shipped), and — unlike the 5a-1/5a-2 pair — there is no strong reason to
   hold deployment back for Phase 5b-2 to also be ready first, since a
   working Before/After comparison is a complete, useful feature on its own
   (Phase 5b-2 only adds an unrelated form to the same tab, it doesn't
   complete a half-broken state the way 5a-2 did for 5a-1) — but confirm
   that reasoning with the user rather than assuming it.
4. If the fix does NOT hold up under re-verification, do not commit
   anything — write a further fix-and-retest round instead, the same way
   this one was produced.
```
