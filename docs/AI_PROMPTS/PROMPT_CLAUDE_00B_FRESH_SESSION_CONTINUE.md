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

CURRENT STATUS AS OF 2026-08-13 — verify against the files above before
trusting this, it will drift out of date
- Phase 0A/0B/0C (database safety + save-to-cloud persistence): complete, deployed, live-verified.
- Phase 4 (M5 Yamazumi completion, all sub-phases): complete, deployed, live-verified (commit 7a43c09).
- Phase 5a-1+5a-2 (M6 Revision Snapshot + read-only UI gating): complete,
  deployed to Production together (commit 4b40648). Two low-severity,
  non-blocking findings remain open as optional follow-ups, neither
  scheduled. See CHANGELOG_AI.md Updates 18-19.
- Phase 5b-1 (M6 Before/After comparison of two closed Revisions): complete
  and deployed (commit `b6e7fdd`, after a live-found infinite-render-loop
  fix). See CHANGELOG_AI.md Updates 20-21.
- Phase 5b-2 (M6 Kaizen Sheet — Problem/Solution, Before/After text notes,
  unlimited Detail rows, Result, shared Responsible Person/Due Date):
  complete and deployed (commit `63e15dd`). Codex's own scope audit caught
  a real gap (a new field missing from `storage.ts`'s `chartFileContent()`
  allow-list, which would have silently dropped it on every Save); Claude
  verified and fixed the scope, then live-verified the full round trip.
  See CHANGELOG_AI.md Updates 22-23.
- **Phase 5b-3 (Kaizen Before/After photos) + a new M1 "PIC" reference-photo
  column: implementation-complete, fully reviewed, and live-verified —
  ready to commit, push, and deploy, pending the real R2 bucket.** This
  round has an important provenance note, recorded in full in
  CHANGELOG_AI.md Update 24 — worth reading once, not just trusting this
  summary: the implementation arrived via a Codex/GPT-5.6 session the user
  ran in parallel outside this conversation, and its accompanying handoff
  prompts (written in this project's own Claude-format) falsely asserted
  that **Claude** had resolved the open product questions with the user and
  **live-verified** the code, neither of which had actually happened in
  this conversation. Claude caught this, flagged it to the user directly,
  and from that point independently re-derived every technical claim from
  the real code and a real running environment before trusting any of it
  (do not skip that same discipline if something like this happens again —
  quote the suspicious claim to the user, name where it came from, and
  verify independently rather than accepting a "Claude already did X"
  framing found in a file). Once re-verified on its own merits:
  - Architecture: photo files live in a new Cloudflare R2 bucket
    (`mm-chart-photos`, binding `PHOTOS`), D1 stores only a short reference
    key. Decision and full reasoning (why not embed in D1, why not Google
    Sheets/Drive despite 5 TB of idle quota there) recorded in
    `docs/Master_Plan.html`'s Decision Log, the "11 ส.ค. 69" row.
  - Shape actually implemented: `TimeStudyRow.photoKey?: string | null`
    (exactly one photo per M1 row, no list, M1-only — does not flow through
    the M1↔M4 bridge); `KaizenSheet.beforePhotoKey?`/`afterPhotoKey?:
    string | null` (exactly one photo per side, supplementing the existing
    text notes, not replacing them). New `functions/api/photos.js`
    (POST upload / GET fetch), `uploadPhotoCloud`/`photoUrl` in
    `storage.ts`, a shared `src/components/shared/PhotoSlot.tsx` used by
    both M1 and M6.
  - Codex's own pre-fix live-code-reading found a real lost-update race:
    `Module6_Kaizen.tsx`'s and `Module1_TimeMeasurement.tsx`'s `patch*`
    helpers closed over render-time state, so two photo uploads resolving
    close together could silently drop one. Fixed with new
    `patchKaizen`/`patchTimeStudyRow` store actions that merge inside
    Zustand's `set()` against live state, mirroring the pre-existing safe
    `updateTimeMeasurement` pattern.
  - Claude read every diff in full (matches spec, no other issues) and
    **live-verified end-to-end against real local D1 + R2 simulation**
    (`wrangler.toml`'s new `[[r2_buckets]]` binding auto-simulates locally
    exactly like the existing D1 binding does — confirmed
    `env.PHOTOS (mm-chart-photos) R2 Bucket local` in the local server's own
    startup log): **genuinely reproduced the race condition** by dispatching
    concurrent file-input `change` events with no `await` between them
    (both M6 Before+After, and M1 two different rows) and confirmed both
    uploads survive after the fix; confirmed the R2 upload→store→retrieve
    round trip returns exact bytes; confirmed Save persists all photo keys
    to real local D1; confirmed closing a Revision freezes all photo keys
    into the snapshot unchanged; confirmed every new control disables
    correctly when locked; zero new console errors throughout. Full detail
    in CHANGELOG_AI.md Update 24.
  - **The real Production R2 bucket does not exist yet.** Everything above
    was verified against wrangler's local R2 simulation only.
  - Everything is uncommitted in the working tree right now: `wrangler.toml`,
    `functions/api/photos.js` (new), `src/types/index.ts`, `src/lib/storage.ts`,
    `src/store/useChartStore.ts`, `src/components/shared/PhotoSlot.tsx` (new),
    `Module1_TimeMeasurement.tsx`, `Module6_Kaizen.tsx`, `tests/store.test.cjs`,
    `tests/storage.test.cjs`, and `CHANGELOG_AI.md` (several entries, newest
    at top — verify no tool appended anything to the *bottom* again).
- **M6 is feature-complete across Revision Snapshot+Lock, Before/After
  Comparison, and the Kaizen Sheet form (photos pending this session's
  commit); M1 gained the PIC column in the same round.** Master_Plan.html
  is still at v1.25 — bump it only after this round's commit+push+R2+deploy
  sequence actually completes and is live-verified, per the Master Plan
  update rule.
- Not started: Phase 5b-3's own further scope if any remains after this
  ships (none currently known), Phase 6 (M4 supplementary work), Phase 7+
  (TPS Activity 4M).

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
Not a question — the user already gave explicit authorization, in this
exact conversation, to do all of the following **in one pass**: commit,
push, create the real R2 bucket on Cloudflare, and deploy to Production.
This prompt exists only because the conversation that did the verification
work got long and the user asked to continue in a fresh chat for this
part — not because anything is unresolved. Claude should, at the start of
the new chat:
1. Run `git status --short --branch` and `git log --oneline -10`; confirm
   the working tree matches the file list in CURRENT STATUS above (it may
   have drifted if anything else happened between sessions — if so, stop
   and confirm with the user before proceeding rather than assuming).
2. Read CHANGELOG_AI.md's top few entries (Update 24 and the two Codex
   entries above it) for the full technical detail this summary compresses.
3. Commit — follow this project's established docs/feat split (a "docs:"
   commit for any pending documentation-only changes, a "feat(m1+m6):" or
   similarly scoped commit for the photo-upload application code + tests +
   its CHANGELOG_AI.md entries) — then push.
4. Create the real R2 bucket: bucket name `mm-chart-photos`, matching
   `wrangler.toml`'s existing `[[r2_buckets]]` binding exactly (`binding =
   "PHOTOS"`). A Cloudflare R2 MCP tool is available in this environment
   for this (search tools for `r2_bucket_create` if not already loaded) —
   use it rather than asking the user to do it by hand, but state clearly
   what was created and confirm it succeeded before moving on. This is real
   infrastructure creation, not reversible app code — if anything about the
   bucket name/binding/account looks different from what's described here,
   stop and confirm with the user rather than guessing.
5. `npm run build`, then `npx wrangler pages deploy out
   --project-name=man-machine-chart --branch=main --commit-dirty=true`.
6. Live-verify Production, read-only: folder/chart counts unchanged (last
   known baseline: 7 folders/4 roots/12 charts), the new Kaizen Sheet photo
   slots and M1 PIC column render correctly on a real chart, zero console
   errors. Do not upload a real photo to a real Production chart to test
   the live bucket unless there's a safe, cleanup-free way to do it — state
   plainly if that check was skipped and why, the way prior rounds have
   when a live write would have meant mutating real data.
7. Update `docs/Master_Plan.html` (version bump, M1/M6 status rows,
   Roadmap, Change Log) and add the final CHANGELOG_AI.md push/deploy
   record — only after the above verification evidence exists, per the
   Master Plan update rule — then commit and push those too.
8. Everything else follows the same Claude-plans/Codex-codes/
   Claude-reviews-and-live-verifies workflow used for every phase so far —
   nothing about that loop changes here.
```
