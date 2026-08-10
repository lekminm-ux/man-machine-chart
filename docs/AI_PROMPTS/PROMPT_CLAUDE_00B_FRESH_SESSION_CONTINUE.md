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

CURRENT STATUS AS OF 2026-08-10 — verify against the files above before
trusting this, it will drift out of date
- Phase 0A/0B/0C (database safety + save-to-cloud persistence): complete, deployed, live-verified.
- Phase 4 (M5 Yamazumi completion — 4a Min/Max/Avg overlay, 4b Periodical/
  Changeover tiers, 4c-1 per-row segments, 4c-2 Drag & Drop): complete,
  committed, pushed, deployed to Production, and read-only live-verified
  (commit 7a43c09).
- Phase 5a-1 (M6 Revision Snapshot mechanism — schema, /api/revisions,
  store guards, minimal HeaderForm close/open-revision UI): implemented,
  reviewed, and locally verified. Committed and pushed (commit b982cc3).
  Its additive Production D1 schema (chart_files.lockedAt,
  revision_snapshots) has been migrated and verified live (zero data loss,
  zero existing chart affected) — see CHANGELOG_AI.md Update 17.
- Phase 5a-2 (read-only UI gating across HeaderForm's remaining fields +
  M1/M2/M4/M5): implemented by Codex, reviewed diff-by-diff by Claude (two
  low-severity, non-blocking UX findings noted — a LayoutDiagram
  element-selection/panel-visibility asymmetry and a minor M5 drag-guard
  ordering nitpick, neither a data-safety issue), and verified live
  end-to-end against a real local D1/Pages Dev — every module's controls
  confirmed `disabled` in the actual rendered DOM (not just the source
  diff), full close→verify-every-module-blocked→open→editable-again cycle
  held with zero data loss. See CHANGELOG_AI.md Update 18. Being committed
  and pushed this session; **application code (both 5a-1 and 5a-2 together)
  is still NOT deployed** — deploying them together was always the plan,
  since 5a-1 was deliberately held back until 5a-2 was ready.
- Not started: Phase 5b (Before/After comparison page + Kaizen sheet +
  export), Phase 6 (M4 supplementary work), Phase 7+ (TPS Activity 4M).

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
Both Phase 5a-1 and Phase 5a-2 application code are now implemented,
reviewed, and locally verified — the one thing the team has been waiting
for before deploying the lock feature at all. Ask the user to confirm:
(a) authorize deploying both together to
https://man-machine-chart.pages.dev now (this is the moment the original
sequencing plan was building toward), (b) address the two minor Phase 5a-2
findings first (LayoutDiagram element-selection gap, M5 drag-guard
ordering) before deploying, or (c) something else — e.g. start planning
Phase 5b (Before/After comparison page) instead.
```
