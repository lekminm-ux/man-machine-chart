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

CURRENT STATUS AS OF 2026-08-06 — verify against the files above before
trusting this, it will drift out of date
- Phase 0A/0B/0C (database safety + save-to-cloud persistence): complete, deployed, live-verified.
- Phase 4 (M5 Yamazumi completion — 4a Min/Max/Avg overlay, 4b Periodical/
  Changeover tiers, 4c-1 per-row segments, 4c-2 Drag & Drop): complete,
  committed and pushed (commit 49624fa), NOT yet deployed to Production.
- Nothing else in the numbered roadmap (Phase 5 M6 Kaizen, Phase 6 M4
  supplementary work, Phase 7+ TPS Activity 4M) has started yet.

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
Phase 4 (M5 Yamazumi — 4a/4b/4c-1/4c-2) is fully committed and pushed
(commit 49624fa, in sync with origin/main) but NOT yet deployed to
Production. Ask the user to decide: (a) authorize deploying it to
https://man-machine-chart.pages.dev now, and/or (b) what to plan next —
Phase 5 (M6 Kaizen + Before/After) or another docs/Master_Plan.html roadmap
item.
```
