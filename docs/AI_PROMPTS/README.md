# AI Collaboration Prompts — Man-Machine Chart

Project root:

`D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation`

This project uses the same separation of responsibilities as the Technical Injection Blow Mold project:

| Role | Responsibility | Coding authority |
|---|---|---|
| Claude | Review, root-cause analysis, fix/feature planning, Acceptance Criteria, resolving design ambiguity, reading every diff for logic correctness, git commit/push/deploy, Final Review, and Production/live verification | Does not write application source code unless the user explicitly authorizes that specific instance |
| GPT/Codex | Implement application source code per Claude's plan; write/adjust automated tests; **run `node --test`/lint/build/`git diff --check` as the primary source of truth for those results** | Implements only the approved scope; must not expand scope on its own |
| User | Approves scope, starts coding, decides unresolved business choices, and authorizes deployment/escalation | Final decision maker |

(Role split updated 2026-08-03 — the user reversed the original GPT/Claude split above it replaced: Claude now owns review/plan/QA, Codex now owns implementation. Prompts 1-4 below predate this change and describe the old GPT-reviews/Claude-implements loop; treat their *content* as historical reference for what each phase covered, not as the current role assignment.)

**Verification-depth split, refined 2026-08-06** (token-usage rebalance after the Phase 4 rounds — Claude was independently re-running every automated check Codex had already run, which is pure duplication with no added confidence since those commands are deterministic):

- **Trust Codex's own `node --test` / lint / build / `git diff --check` output by default.** Claude re-runs them independently only when something looks off (file scope doesn't match the plan, numbers look inconsistent, or the diff itself raises a question) — not as a routine step every round.
- **Claude still reads every diff in full for logic correctness.** This is cheap and has caught real bugs purely from reading code (e.g. the Phase 0C `_unconfirmed`/hydration findings) — do not cut this.
- **Browser/live verification stays with Claude, but scoped to risk, not applied uniformly.** New interactive/UI-facing features (e.g. Phase 4c-2's drag-and-drop) get full manual/simulated verification — this has caught real bugs automated tests couldn't (the Phase 4c-2 `dragend`-never-fires state-leak was only found by simulating a real drag sequence and inspecting the resulting DOM). Low-risk additive or backend-only changes can skip this step.
- **CHANGELOG_AI.md entries should not be duplicated.** Codex writes its own detailed implementation entry; Claude's follow-up entry (if any) should be a short verdict plus whatever Codex's report didn't cover (e.g. Claude's own browser-verification findings), not a restatement.
- **Future improvement to consider:** if Codex's own environment gains a working local Wrangler/Pages Dev setup (it currently reports `/api/folders` 404s and cannot exercise a real chart), Codex could self-verify more UI work directly, further reducing how often Claude needs to do it. This is a tooling/environment change for the user to set up, not something Claude can arrange from inside a chat.
- **New-chat checkpoint, added 2026-08-06:** a `PreCompact` hook in `.claude/settings.json` notifies the user when this conversation is about to auto-compact (the real signal that context has grown large — Claude cannot poll its own token usage, so this had to be a hook, not a memory note). Claude should treat that notification, or its own read of a natural phase/milestone boundary, as a cue to proactively refresh Prompt 0B's dated sections and offer a new chat rather than waiting to be asked. Full rule text lives in `PROJECT_CONTEXT.md`'s "New-chat / token-efficiency checkpoint" section — this is a pointer, not a duplicate.
- **GPT-5.6 context checkpoint, added 2026-08-10:** the official API model docs list a 1,050,000-token context window for GPT-5.6 Sol/Terra/Luna; at 70% (735,000 tokens), alert the user and prepare the filled-in [GPT-5.6 new-chat checkpoint prompt](PROMPT_NEW_CHAT_GPT56_CONTEXT_CHECKPOINT.md). Use the model/harness usage report when available; if it is unavailable, label the exact usage as unknown and use the PreCompact/system warning as the fallback. Full operational rules live in `PROJECT_CONTEXT.md`.

## Prompt order

0. [Claude read-only project onboarding](PROMPT_CLAUDE_00_START_HERE_READ_ONLY.md) — heavyweight, exhaustive; use only for true zero-context onboarding
0B. [Claude fresh-session continuation](PROMPT_CLAUDE_00B_FRESH_SESSION_CONTINUE.md) — lightweight, reusable; use this instead of Prompt 00 when starting a new chat to continue an already-established project (this is the normal case going forward — update its dated status section before pasting). Per the new-chat checkpoint rule above, Claude should keep this file's dated sections current proactively, not only when the user asks.
Context checkpoint: [GPT-5.6 context checkpoint / new-chat handoff](PROMPT_NEW_CHAT_GPT56_CONTEXT_CHECKPOINT.md) — fill and paste when the 70% GPT-5.6 threshold is reached.
0A. [Claude database inventory and recovery export](PROMPT_CLAUDE_01A_DATABASE_SAFETY_PREFLIGHT_READ_ONLY.md) — required before persistence, schema, deployment, or data-recovery work
1. [GPT project audit and Master Plan](PROMPT_GPT_01_PROJECT_AUDIT_AND_MASTER_PLAN.md)
2. [Claude implementation of an approved plan](PROMPT_CLAUDE_02_IMPLEMENT_APPROVED_PLAN.md)
2A. [Claude runtime data-safety guards](PROMPT_CLAUDE_02A_DATA_SAFETY_RUNTIME_GUARDS.md) — use only for the approved Phase 0B guard scope after the read-only preflight
3. [GPT review of Claude handoff](PROMPT_GPT_03_REVIEW_CLAUDE_HANDOFF.md)
4. [Claude fix and re-test loop](PROMPT_CLAUDE_04_FIX_RETEST.md)

Fresh-chat handoff after Phase 0C: [final review and release prompt](PROMPT_NEW_CHAT_PHASE_0C_FINAL_REVIEW_AND_RELEASE.md).

Phase 4 (M5 Yamazumi completion), under the new Claude-plans/Codex-codes split:
[Phase 4a — Min/Max/Avg overlay](PROMPT_CODEX_PHASE4A_M5_YAMAZUMI_MINMAXAVG.md) (shipped, commit 06898ea),
[Phase 4b — Periodical/Changeover tiers](PROMPT_CODEX_PHASE4B_M5_PERIODICAL_CHANGEOVER.md) (shipped, commit 979774a),
[Phase 4c-1 — per-job-element bar segments](PROMPT_CODEX_PHASE4C1_M5_PER_ROW_SEGMENTS.md) (shipped, commit 2ea7df5),
[Phase 4c-2 — Drag & Drop rebalancing](PROMPT_CODEX_PHASE4C2_M5_DRAG_DROP.md) (shipped, commit 49624fa, after [a follow-up fix](PROMPT_CODEX_04_FIX_PHASE4C2_DRAGEND_STUCK.md) for a drag-state-stuck bug Claude found on review).

**Phase 4 (M5 Yamazumi) is now complete end to end** — committed, pushed, deployed to Production, and read-only live-verified (6 Aug 2026, commit `7a43c09`). Codex reports back to Claude (not the user) for review before any further phase, commit, push, or deploy.

Phase 5 (M6 Kaizen + Before/After), sub-phases:
[Phase 5a-1 — Revision Snapshot mechanism](PROMPT_CODEX_PHASE5A1_REVISION_SNAPSHOT.md)
(shipped, commit b982cc3) — implemented by Codex, reviewed diff-by-diff by
Claude (no bugs found), one out-of-scope test-mock conflict fixed by Claude
directly with explicit authorization, and verified live against a real local
Pages Dev + D1 environment (close/lock, blocked save, open/unlock, save
resumes — full cycle, zero data loss). `node --test` 184/184, build/lint/
diff-check all clean. Committed and pushed. Its additive Production D1
schema (`chart_files.lockedAt`, `revision_snapshots`) was migrated
separately on 7 Aug 2026 after its own Database Safety preflight (commit
11ce2f8) — zero data loss, zero existing chart affected. Application code
deployment is deliberately held back until Phase 5a-2 ships, so the
continuously-active team never sees a half-locked UI (Rev No. disabled while
every other field stays freely editable).
[Phase 5a-2 — read-only UI gating](PROMPT_CODEX_PHASE5A2_READONLY_UI_GATING.md)
(planned by Claude 9 Aug 2026, not yet implemented) — extends the same
`isLocked` pattern HeaderForm's Rev No. field already uses to every other
input across HeaderForm, M1, M2, M4 (StepTable/LayoutDiagram/SummaryTable),
and M5; M3 is confirmed to need no changes (no write path into chart
content). Also fixes a latent `duplicateFile` bug found while planning this
phase: duplicating a locked chart copied `lockedAt` into the new file
client-side even though the server never persists it on create, leaving the
duplicate stuck showing "locked" with no way to unlock it via UI.
Phase 5b (the Before/After comparison page itself) remains separately
scoped next, after 5a-2 ships and both are deployed together.

Phase 5a-1 and 5a-2 shipped together (commit `4b40648`, deployed 10 Aug
2026 — see CHANGELOG_AI.md Update 19). Phase 5b, sub-phases:
[Phase 5b-1 — M6 Before/After comparison](PROMPT_CODEX_PHASE5B1_BEFORE_AFTER_COMPARISON.md)
(implemented by Codex 10 Aug 2026, fixed and shipped 11 Aug 2026) — adds a
6th "Kaizen" module tab that compares two closed Revision snapshots (Cycle
Time + % change, worker count, walk/idle time, capacity/shift, and an
overlaid Yamazumi chart), per docs/Master_Plan.html section 6. Comparison
is restricted to two closed Revisions only — never the live/editable
current state — an explicit user decision, since the whole point of
"always re-measure after Kaizen" is comparing two frozen, trustworthy
numbers. Claude's diff review found the scope and calculation logic
correct, but live verification against a real local D1 chart with two
closed Revisions found the component enters an infinite React re-render
loop (~1,850 effect runs/sec, confirmed by a temporary counter) the moment
two valid snapshots are actually selected — invisible to automated tests
(no React component-rendering tests exist in this project) and to Codex's
own environment check (no chart with 2+ closed Revisions was available
there). Root cause: `snapshotCache` state was both a dependency of, and
written by, the same effect. Fix handoff:
[Phase 5b-1 fix — M6 infinite loop](PROMPT_CODEX_05_FIX_PHASE5B1_M6_INFINITE_LOOP.md)
(state → ref, removed from the effect's dependency array) — re-verified
live by Claude 11 Aug 2026 with the same temporary-counter technique
(stayed bounded at 2→3→4 across three selection changes instead of
climbing), committed, pushed, and deployed to Production
(commit `b6e7fdd`, see CHANGELOG_AI.md Updates 20-21).
[Phase 5b-2 — M6 Kaizen Sheet form](PROMPT_CODEX_PHASE5B2_KAIZEN_SHEET.md)
(planned by Claude 11 Aug 2026, not yet implemented) — adds an editable
Kaizen problem/countermeasure section to the same `Module6_Kaizen.tsx` file
5b-1 created, additive to the live/current chart content (not the frozen
Revision snapshots 5b-1 reads). Claude read the actual source Excel
"kaizen" sheet directly this time (both reference workbooks agree, an
identical company-standard template) — the machine still has no working
Python interpreter, so this was done by parsing the `.xlsx` zip/XML
directly rather than deferring to Master Plan's earlier paraphrase. The
real sheet has BEFORE/AFTER boxes (most likely meant for photos, not
numbers — the numeric Before/After is already covered by 5b-1), separate
Problem/Solution fields, and an unlimited-rows Detail list (description +
1-5 rating + Response + Eva), plus one overall Result. It has no literal
"responsible person"/"due date" fields — those were in the original
Master Plan vision but not on the physical form; the user confirmed
keeping them anyway, as one shared pair for the whole sheet rather than
one per Detail row. Photo/image attachment for Before/After is
intentionally deferred to a future Phase 5b-3, noted in the handoff but
not built now.

For this task, run Prompt 02A before the normal Prompt 02. Prompt 02A is the
approved Phase 0B safety gate and must finish with a handoff to GPT/Codex.

Repeat steps 3–4 until GPT returns `PASS` or `APPROVED_FOR_PHASE_CLOSURE`. GPT then updates `docs/Master_Plan.html`, `PROJECT_CONTEXT.md`, and the handoff/change records as appropriate.

## Continuous usability rule

The local/Production separation is an engineering safety boundary, not a reason
for the user to work from a permanently separate local copy. The deployed
WebApp must remain usable while improvements are developed. After GPT review
and explicit user authorization, the approved version must be committed,
deployed to `https://man-machine-chart.pages.dev`, and verified there. A safety
guard may block only the unsafe operation; it must not unnecessarily block
viewing existing charts or normal chart work. If Cloud is unavailable, show
cached data for review and fail closed for writes that could overwrite or
delete Production data.

## Active-user continuous release gate

This WebApp has ongoing users. Future AI sessions must assume that users may be
viewing or editing charts while the code is being improved.

- Release only from a GPT-reviewed commit; keep the last known-good Production
  deployment available as the rollback target until the new release is verified.
- Preserve backward compatibility for existing UI clients, API fields/endpoints,
  and saved chart JSON. Any breaking API or schema change requires a new GPT plan,
  a compatibility window, and explicit user approval.
- Treat schema work as an expand/compatibility/contract sequence. Never use an
  ad-hoc `ALTER TABLE`, `schema.sql`, reset, seed, or bulk repair during a normal
  active-user release.
- If a release is unhealthy, keep existing charts readable, fail closed for
  unsafe writes, show a clear message, and roll back the application. Do not
  overwrite data while attempting recovery.
- Do not claim safe concurrent editing until server-side authentication,
  authorization, audit identity, optimistic version checks, and conflict
  handling are implemented and reviewed. The Admin PIN is not a substitute.
- Record commit, deployment result, live verification, rollback target, and open
  checks in the Master Plan, Deployment Checklist, and CHANGELOG.

## Save-to-cloud persistence gate

The Save button is successful only when the deployed server confirms the write
to the authoritative Cloudflare/D1 store and a fresh read confirms the complete
payload. Local React state, localStorage, fixtures, or local D1 are never proof
that Production data was saved.

- Keep the chart dirty and show an unconfirmed/failed state until the API returns
  explicit success with the chart identity and server version/timestamp.
- For every save-related change and every release, make a uniquely identifiable
  edit, save it through the deployed WebApp, read it back through the deployed
  API, compare metadata and all step/timeline values, refresh/reopen the WebApp,
  and read it again from Cloud. Record URL, chart identity, response, read-back,
  reopen result, and timestamp.
- On timeout, error, or ambiguous status, preserve unsaved work for retry, block
  unsafe overwrite, and tell the user that the Cloud write is unconfirmed. Never
  replace Cloud data with an empty or stale local fallback.
- Existing-chart updates require server-side version/conflict protection before
  safe concurrent editing may be claimed. An Admin PIN is not sufficient.
- Any schema, API, backup, restore, or recovery work required by this gate must
  return to GPT planning. Never reset, reseed, bulk-repair, or delete data to
  make a persistence test appear to pass.

## Project-specific read policy

Read the real project files before making decisions. Treat these as generated, local-only, or non-canonical unless a prompt explicitly asks for forensic inspection:

- `.git/**`
- `node_modules/**`
- `.next/**`
- `out/**`
- `tsconfig.tsbuildinfo`
- `next-env.d.ts`
- `_Backup_scratch_OneDriveMigration_20260719/**`

The reference documents under `Docs_StandardWork_Reference/` are read-only evidence. Do not edit, move, rename, delete, or overwrite them.

## Gate statuses

- `APPROVED` — GPT accepts the implementation plan; coding still requires an explicit user command.
- `CHANGES_REQUIRED` — Claude must not code; revise the plan or fix the requested scope first.
- `PLAN_CHANGE_REQUIRED` — scope, architecture, schema, API contract, or source-of-truth changed; return to GPT planning.
- `BLOCKED` — required file, source, permission, or decision is missing.
- `PASS` — GPT has verified the requested implementation and evidence.

Every prompt in this folder must contain: `READ FIRST`, inspection commands, authoritative sources, allowed files, forbidden actions, acceptance criteria, stop conditions, and required output.

## Database safety gate

`DATABASE_SAFETY_GATE.md` is the canonical rule set for protecting real D1 data.
It defines the separation between Production D1, local Pages Dev D1, browser
localStorage, and recovery exports. Any session involving persistence, schema,
API, deployment, migration, seed data, deletion, or recovery must read and obey
that file. A passing test/build/deploy is never sufficient evidence that the
four-level folder tree or chart contents were preserved.

The required first action for such work is the read-only inventory/export in
`PROMPT_CLAUDE_01A_DATABASE_SAFETY_PREFLIGHT_READ_ONLY.md`. It must finish with
`DATA_SAFE_READ_ONLY_COMPLETE` or `DATA_SAFETY_BLOCKED`; it must not silently
reset local state or write to Production.

For the current Machine Chart task, Phase 0A passed and the external recovery
export was verified. The next Claude session must use the dedicated Phase 0B
prompt for runtime guards before any normal feature implementation. That prompt
does not authorize schema migration, Production writes, authentication work,
deployment, or push.
