# CHANGELOG_AI

This file is the shared AI work log for Codex, Claude Code, Antigravity, and any other AI tool working on this project.

## 2026-08-13 (Update 24 — Claude review + live verification: Phase 5b-3 + M1 PIC)

### Tool

- Claude Code (Sonnet 5)

### Context and a provenance note

Phase 5b-3 (Kaizen Before/After photos) and a new M1 "PIC" reference-photo
column arrived in this session's working tree via a Codex/GPT-5.6 session
the user ran in parallel, outside this conversation. The two handoff prompt
files that accompanied that work (`PROMPT_CODEX_PHASE5B3_PHOTO_UPLOAD_M1_KAIZEN.md`,
originally `PROMPT_CODEX_06_FIX_PHASE5B3_PHOTO_RACE.md`) were written in this
project's established Claude-handoff format and asserted that **Claude**
had resolved four open product questions with the user and had **live-
verified** the implementation against real local D1+R2 and found the race
bug described below — none of which happened in this conversation. Claude
flagged this to the user directly rather than acting on the claim, then
independently re-derived the technical findings from the real source before
trusting any of it: confirmed the `storage.ts`-style scope reasoning by
reading the actual diffs, confirmed the race-condition root cause by reading
`Module6_Kaizen.tsx`/`Module1_TimeMeasurement.tsx`/`useChartStore.ts`
directly, and rewrote the fix handoff (`PROMPT_CODEX_06_FIX_PHASE5B3_PHOTO_RACE.md`)
with honest framing — labeling the finding as Claude's own static-analysis
read of the code, not a live reproduction, and instructing Codex not to
claim verification it had not run. Codex's fix-round report (entry directly
below this one) followed that instruction correctly. Recorded here as
project history, not as a judgment on the other tool or the user's
workflow — the point is that every technical claim below was independently
re-verified by Claude against the real code and a real running environment,
not taken on the strength of any prompt's narrative.

### Review verdict

Read every changed file in full across both the original implementation and
the fix round: `wrangler.toml`, `functions/api/photos.js`, `src/types/index.ts`,
`src/lib/storage.ts`, `src/store/useChartStore.ts` (including the new
`patchKaizen`/`patchTimeStudyRow` actions), `src/components/shared/PhotoSlot.tsx`,
`Module1_TimeMeasurement.tsx`, `Module6_Kaizen.tsx`, and both test files.
Everything matches the (Claude-rewritten) fix handoff exactly. The upload
endpoint's security posture (no auth beyond an existing-chart-id check,
client-declared MIME type trusted for storage/serving) is consistent with
this app's whole current model, not a new category of gap — worth hardening
whenever the project's own pending Authorization phase lands, not a blocker
now. No bugs found beyond the race condition Codex's fix round already
addressed.

### Live verification (real local Pages Dev + D1 + R2 simulation, not mocks)

Started `mm-chart-pages-dev` (confirmed `env.PHOTOS (mm-chart-photos) R2
Bucket local` bound automatically from the new `wrangler.toml` binding,
the same way the existing D1 binding already simulates locally). Against
the real chart "Side Step LH, RH (QA renamed)":

- **Reproduced the exact race condition from the bug report, for real**:
  dispatched real `change` events on the Before and After file inputs in
  the same tick (no `await` between them) — both `beforePhotoKey` and
  `afterPhotoKey` survived in the store afterward. Repeated for M1: added a
  second row, dispatched concurrent uploads to both rows' `PhotoSlot`s —
  both rows' `photoKey`s survived, confirming the fix holds under the
  actual failure mode, not just at the unit-test level.
- Confirmed the R2 round trip directly: fetched an uploaded photo's bytes
  back from `/api/photos?key=...` and got back exactly what was uploaded.
- Clicked Save, then fetched `/api/files?id=...` fresh: all four photo keys
  (M6 before/after, both M1 rows) persisted to the real local D1 `content`
  column.
- Closed a Revision (`PHOTO-RACE-FIX-QA`), then fetched the new snapshot
  directly: all four photo keys survived the freeze into
  `revision_snapshots.content` unchanged.
- Confirmed every new control (both M6 photo slots, both M1 row photo
  slots) reported `disabled: true` in the live DOM once locked, matching
  every other module's established gating pattern.
- Zero new console errors through the entire sequence (uploads, save,
  close-revision, tab switches, add-row) — the only console entries present
  were stale leftovers from this session's own earlier, unrelated dev-server
  connection retries, confirmed present before any of this round's
  interaction began.
- Also reordered the two Phase 5b-3-related entries below into this file's
  established newest-first order — no content changed, only position.

### Database Safety Gate / Production statement

No Production D1/R2 access of any kind. Every command targeted the
pre-existing **local** `.wrangler` D1 and the local R2 simulation only. The
real Production R2 bucket does not exist yet. No commit, push, deploy, real
bucket creation, or Production/schema/API change occurred in this entry.

### Next

Phase 5b-3 + the M1 PIC column are implementation-complete, fully reviewed,
and now verified live end-to-end including the exact concurrency failure
mode that motivated the fix. Per the user's explicit authorization, the
next session should, in one pass: commit, push, create the real
`mm-chart-photos` R2 bucket on Cloudflare, build, and deploy — then update
`docs/Master_Plan.html` only after that verification evidence exists, per
the Master Plan update rule.

## 2026-08-13 (Codex FIX_ONLY — Phase 5b-3/M1 photo lost-update race)

### Finding and fix

- Claude identified a high-confidence **static-analysis** lost-update race in
  the uncommitted Phase 5b-3 implementation; this was not reproduced in a
  live browser in this round. `Module6_Kaizen.tsx`'s async photo callbacks
  merged against a render-time `kaizen` closure, and `Module1_TimeMeasurement.tsx`
  did the same with a render-time `study` closure. Their whole-object store
  actions could therefore overwrite an already-completed upload from the
  other slot/row.
- Added `patchKaizen(partial)` and `patchTimeStudyRow(rowId, patch)` to
  `src/store/useChartStore.ts`. Both merge from the active file read inside
  Zustand's `set()` updater, mirroring the established safe
  `updateTimeMeasurement` pattern, and call `persistLocal`.
- `Module6_Kaizen.tsx` now selects the store's `patchKaizen` action; all
  existing call sites are unchanged. `Module1_TimeMeasurement.tsx` now
  delegates its existing `patchRow` helper to `patchTimeStudyRow`; all row
  call sites are unchanged. The unused `KaizenSheet` type import was removed
  as the direct consequence of replacing the local typed closure.
- Added three store regression tests in `tests/store.test.cjs`: sequential
  Before/After partial patches preserve both photo keys, a missing Kaizen
  sheet is seeded from `emptyKaizenSheet()`, and patches to two M1 rows retain
  both photo keys and unrelated row fields.

### Exact fix scope

This FIX_ONLY round changed exactly these five files:

1. `src/store/useChartStore.ts`
2. `src/components/modules/Module1_TimeMeasurement.tsx`
3. `src/components/modules/Module6_Kaizen.tsx`
4. `tests/store.test.cjs`
5. `CHANGELOG_AI.md` (this entry)

The prior Phase 5b-3 implementation files, pre-existing docs changes, and
both prompt files were preserved; no upload endpoint, storage helper, type,
PhotoSlot, binding, or unrelated module logic was touched.

### Verification

- `git status --short --branch`: `main...origin/main`; expected prior
  Phase 5b-3 files/docs plus the five FIX_ONLY scope changes; no commit made.
- `node --test tests/store.test.cjs`: **61 passed, 0 failed**.
- `node --test`: **202 passed, 0 failed**.
- `npm.cmd run lint`: **exit 1**, 5 errors and 23 warnings. The errors are
  the known untouched baseline in `StepTable.tsx`, `Sidebar.tsx`, and
  `TopBar.tsx`; warnings are generated `.wrangler` facades plus existing
  chart/TopBar warnings. No new error occurred in any touched file.
- `npx.cmd tsc --noEmit`: **PASS**.
- `npm.cmd run build`: **PASS** — Next.js 16.2.9 compiled, TypeScript passed,
  and static routes `/`, `/_not-found`, and `/editor` were generated.
- `git diff --check`: **PASS** (exit 0; only normal LF/CRLF working-copy
  warnings).
- Manual browser/Pages Dev verification: **not performed**. `wrangler` is
  unavailable in this environment, so no live concurrent M6 Before/After or
  M1 two-row upload reproduction was claimed. Claude should perform that
  real local Pages Dev + D1 + R2 verification.

No commit, push, deploy, Production D1/R2/schema/API change, or other
Production write occurred. Next action: return this handoff to Claude for
review and live re-verification; do not proceed to another phase or release.

## 2026-08-11 (Codex Phase 5b-3 + M1 PIC shared R2 photo upload)

### Tool / mode

- Codex — `IMPLEMENT_ONLY`, executing the authoritative Phase 5b-3 + M1
  PIC handoff. The user's explicit decisions were treated as the source of
  truth for the combined implementation.

### Scope and files changed

Exactly the ten files in the approved REQUIRED SCOPE were changed:

1. `wrangler.toml`
2. `functions/api/photos.js` (new)
3. `src/types/index.ts`
4. `src/lib/storage.ts`
5. `src/store/useChartStore.ts`
6. `src/components/shared/PhotoSlot.tsx` (new)
7. `src/components/modules/Module1_TimeMeasurement.tsx`
8. `src/components/modules/Module6_Kaizen.tsx`
9. `tests/storage.test.cjs`
10. `CHANGELOG_AI.md` (this entry)

The pre-existing `docs/AI_PROMPTS/PROMPT_CLAUDE_00B_FRESH_SESSION_CONTINUE.md`,
`docs/Master_Plan.html`, and the untracked Phase 5b-3 prompt were preserved
exactly as found; no other file was intentionally changed.

### Final contracts

- `TimeStudyRow` has the single optional field
  `photoKey?: string | null` (one M1 PIC reference key per row; no list).
- `KaizenSheet` has the two optional fields
  `beforePhotoKey?: string | null` and `afterPhotoKey?: string | null` (one
  permanent reference key per Before/After side, supplementing the notes).
- `wrangler.toml` adds R2 binding `PHOTOS` for bucket
  `mm-chart-photos`.
- `functions/api/photos.js` exports `onRequestPost` and `onRequestGet` only.
  POST requires an existing `chart_files` id, accepts only JPEG/PNG/WebP,
  enforces an 8 MB limit, writes `${chartId}/${uuid}.${ext}` to R2 with
  `contentType`, and returns `{ key }`. GET requires `key`, streams the R2
  object with `writeHttpMetadata`, sets an immutable long-lived cache header,
  and returns JSON 404 when absent. There is no DELETE handler or cleanup.
- `src/lib/storage.ts` adds the explicit union
  `UploadPhotoResult = { ok: true; key: string } | { ok: false; error: string }`,
  `uploadPhotoCloud(chartId, file)` (multipart field `photo`), and
  `photoUrl(key)`. `chartFileContent()` and all existing save/create
  functions were left untouched; nested `timeStudy`/`kaizen` objects already
  carry the new keys.
- `PhotoSlot` is shared by M1 and M6, supports one thumbnail/replace picker,
  loading/error state, and UI disabled behavior. M1 places `PIC` between Job
  Element and Worker; M6 places one slot above each existing Before/After
  textarea. The M1 photo remains M1-only: no `ChartStep`, bridge, or M2–M5
  changes.

### Verification

- `git status --short --branch`: `main...origin/main`; only the three
  pre-existing documentation/prompt entries plus the ten-scope implementation
  files are present; no commit was made.
- `node --test`: **199 passed, 0 failed**.
- `npm.cmd run lint`: **exit 1**, 5 errors and 27 warnings, all the known
  pre-existing baseline (`StepTable.tsx`, `Sidebar.tsx`, `TopBar.tsx`, plus
  generated `.wrangler` warnings and existing chart warning); zero new errors
  in any touched implementation file. The new `PhotoSlot` image warning is
  explicitly suppressed for the intentional direct API thumbnail.
- `npx.cmd tsc --noEmit`: **PASS**.
- `npm.cmd run build`: **PASS** — Next.js 16.2.9 compiled, TypeScript passed,
  and static routes `/`, `/_not-found`, `/editor` generated.
- `git diff --check`: **PASS** (exit 0; only normal LF/CRLF working-copy
  warnings were reported).
- `Get-Content -Raw functions/api/photos.js | node --input-type=module
  --check`: **PASS** syntax check.
- A mock Workers-runtime smoke harness exercised POST success, R2 `put`
  metadata/key generation, GET content-type/body streaming, and missing-key
  JSON 404: **PASS** (`200/200/404`).
- Comparison preservation check: the existing Phase 5b-1 comparison section
  in `Module6_Kaizen.tsx` is byte-for-byte identical from its header through
  EOF (`same: true`).
- Manual Pages Dev + local R2 upload/fetch round-trip: **not available**.
  `wrangler` is not installed (`wrangler: NOT_FOUND`), so no local Pages
  Functions/R2 simulation could be started and no upload, reload/save, or
  locked-chart browser check was guessed. Claude should perform that
  Cloudflare Pages/D1/R2 verification separately.

### Safety / next

This combines Phase 5b-3 Kaizen Before/After photos with the new M1 PIC
column under one shared R2 upload mechanism, per the user's explicit request.
Uploaded objects are permanent; replacing a key does not delete the old
object, and no delete/cleanup logic exists by design. The real Production R2
bucket does not exist yet; Claude is creating/wiring it separately, and this
implementation does not require it. **No commit, push, deploy, real R2 bucket
creation, or Production/schema/API deployment change occurred** (the new API
function is local-only and undeployed). Next action: return this handoff to
Claude for review; do not proceed to another phase or release/migration.

## 2026-08-11 (Update 23 — Phase 5b-2 push + Production deploy)

### Tool

- Claude Code (Sonnet 5)

### Authorization

User explicitly authorized, via a single confirmation covering all three
steps together: commit, push, and deploy Phase 5b-2 (the M6 Kaizen Sheet
form) straight to Production, the same pattern as Phase 5b-1.

### Actions taken

1. Committed as two commits, following this project's established
   docs/feat split: `a8644fa` (docs — the Phase 5b-2 Codex handoff plus
   the Master Plan section-6/README corrections written during planning)
   and `63e15dd` (feat(m6) — the actual Phase 5b-2 application code, tests,
   and this file's Update 22 review entry).
2. Pushed both commits: `316efe0..63e15dd` to `origin/main`.
3. Fresh `npm run build` from the pushed commit: PASS, 3/3 static routes.
4. Deployed: `npx wrangler pages deploy out --project-name=man-machine-chart
   --branch=main --commit-dirty=true` → deployment URL
   `https://26a75581.man-machine-chart.pages.dev`.

### Live verification (read-only — no Production D1 write performed)

- Queried `/api/folders` and `/api/files` directly via the page's own
  `fetch`: **7 folders / 4 roots / 12 charts**, exact match to the last
  recorded baseline. Zero decrease, zero unexpected change.
- Opened `BYDSidestep Rev.00` (real Production chart, 0 closed Revisions)
  and clicked into the "6: Kaizen" tab: the new Kaizen Sheet section
  rendered correctly with proper empty-state defaults (blank Problem/
  Solution/Before/After/Result, "No details yet" for the Detail table,
  blank Responsible Person/Due Date) — confirms `activeFile.kaizen ??
  emptyKaizenSheet()` handles a real legacy chart cleanly. The existing
  Phase 5b-1 comparison section below it was unaffected, showing its own
  correct empty state. Zero console errors. Did not type into, save, or
  otherwise mutate this real chart.
- Confirmed the new bundle is live directly via the rendered content
  itself (the Kaizen Sheet section did not exist in the prior deployed
  bundle).

### Database Safety Gate / Production statement

- **No Production D1 write occurred.** Verification was strictly read-only
  browsing plus one live `fetch`-based count check.
- Push and deploy did occur this round, explicitly authorized by the user.
  This entry and the `docs/Master_Plan.html` update are committed and
  pushed next.

### Next

Phase 5b-2 is complete, reviewed, deployed, and live-verified — M6 now
covers Revision snapshot/lock, Before/After comparison, and the editable
Kaizen Sheet. Phase 5b-3 (photo/image attachment for Before/After) remains
unscoped and unscheduled, alongside the two still-open low-severity Phase
5a-2 follow-ups.

## 2026-08-11 (Update 22 — Claude review + live verification: Phase 5b-2)

### Tool

- Claude Code (Sonnet 5)

### Context

Follow-up to Codex's own two entries below ("Codex Phase 5b-2 scope audit"
and "Codex Phase 5b-2 M6 Kaizen Sheet form") — those entries have this
round's full implementation detail; this entry covers only what they
didn't: Claude's diff review verdict and the live D1 round-trip
verification Codex's own environment couldn't run (plain `next dev` has no
Cloudflare Pages Functions, so `/api/folders` 404s there).

### Review verdict

Read every changed file in full: `src/types/index.ts` (`KaizenDetailRow`/
`KaizenSheet`, the `ChartFile.kaizen` addition, `RevisionSnapshotContent`'s
extended `Pick`), `src/lib/storage.ts` (the one-line `chartFileContent()`
fix), `src/store/useChartStore.ts` (`emptyKaizenSheet`/`updateKaizen`,
mirroring `updateMachineCapacity` exactly, no lock check at the store
level), `src/components/modules/Module6_Kaizen.tsx`'s new section (Problem/
Solution, Before/After, unlimited Detail rows, Result/Responsible/Due
Date, all routed through `patchKaizen`, all `disabled={isLocked}`), and
all three test file diffs. Everything matches the amended handoff exactly;
the existing Phase 5b-1 comparison section is untouched (diff shows only
additions). No bugs found.

Also reordered this file: Codex's two Phase 5b-2 entries had been appended
at the very end of a 3800+ line file instead of the top, breaking this
project's established newest-first convention that the fresh-session
continuation prompt relies on ("read the top 5-8 entries") — moved them
here, directly below this entry, with no content change.

### Live verification (real local Pages Dev + D1, not mocks)

Started `mm-chart-pages-dev` directly (the Browser pane's own `preview_start`
process supervisor is unreliable for this specific server in this
environment — same issue as Update 20, same workaround: launch directly,
point a browser tab at it manually). Against the existing local test chart
("Side Step LH, RH (QA renamed)"), filled in every new field (Problem,
Solution, Before, After, one Detail row with Priority=4/Response/Eva,
Result, Responsible Person, Due Date) through real browser interaction —
not by writing DOM values directly, so `patchKaizen`/`updateKaizen`'s
actual code path ran on every field:

- Clicked Save: `PUT /api/files` 200, followed immediately by `GET
  /api/files?id=...` 200. Fetched that same URL again independently and
  confirmed `content.kaizen` matched every field exactly, including
  `priority: 4` as a number (not a string).
- Hard-reloaded the page from scratch: every field still showed the same
  values, confirming this came from Cloud/D1, not component or
  localStorage-only state.
- Set a fresh Rev No. and clicked Close Revision: `PUT /api/files` then
  `POST /api/revisions`, both 200. Fetched the new snapshot directly
  (`GET /api/revisions?id=...`) and confirmed `content.kaizen` — the exact
  data just entered — survived the freeze, proving the original scope gap
  (Update 22's whole reason for existing) is genuinely fixed end-to-end,
  not just at the unit-test level.
- Confirmed every new control (5 textareas, the Add Detail button, all 4
  Detail-row fields, the delete-row button, Responsible Person) reported
  `disabled: true` in the live DOM once locked, plus the "This Revision is
  locked" banner — zero false negatives.
- Clicked Open New Revision: unlocked, every control re-enabled, and the
  already-entered data was still present (same pattern as Phase 5a-1's
  unlock behavior).
- Zero new console errors through the entire cycle (the only entries
  present were the same four stale ones left over from an earlier,
  unrelated tab reuse this session, confirmed present before any of this
  round's interaction began).

### Database Safety Gate / Production statement

No Production D1 access of any kind. Every command targeted the
pre-existing **local** `.wrangler` D1 state only. This did close one real
local Revision (`KAIZEN-5B2-QA`) on the shared local QA chart as part of
proving the round trip — a local-only, disposable test artifact, not
Production data. No commit, push, or deploy occurred in this entry.

### Next

Phase 5b-2 is implementation-complete, fully reviewed, and now verified
live end-to-end including the exact persistence path that was originally
missing. Phase 5b-3 (photo/image attachment for Before/After) remains
unscoped and unscheduled. Pending: user authorization to commit + push,
and separately, deploy.

## 2026-08-11 (Codex Phase 5b-2 M6 Kaizen Sheet form)

### Scope / Implementation

- Implemented the approved Phase 5b-2 additive Kaizen form for the live active
  chart, above the existing Phase 5b-1 Before / After Revision comparison.
  The comparison section and `src/lib/kaizen-compare.ts` were left unchanged.
- Added the optional `ChartFile.kaizen` JSON field and registered it in the
  existing RevisionSnapshotContent pick and the single `chartFileContent()`
  allow-list. `src/lib/storage.ts` received exactly one new line:
  `kaizen: file.kaizen,`; `createFileCloud()`, `saveFileCloud()`, and every
  other function in that file were untouched.
- The implemented exact types are:
  `KaizenDetailRow { id: string; detail: string; priority: number | null;
  response: string; eva: string }` and
  `KaizenSheet { problem: string; solution: string; beforeNote: string;
  afterNote: string; details: KaizenDetailRow[]; result: string;
  responsiblePerson: string; dueDate: string }`. No deliberate deviation
  from the approved plan was required.
- Added `emptyKaizenSheet(): KaizenSheet`, returning empty strings for every
  scalar and `details: []`. Added `updateKaizen(kaizen: KaizenSheet): void`,
  which replaces the active file's whole Kaizen object, bumps `updatedAt`,
  calls `persistLocal`, and deliberately performs no lock check; the UI
  disables every new input/button when `activeFile.lockedAt` is truthy.
- The Details table is unlimited, uses nullable priority values (`—`, 1-5),
  and supports add/delete/edit. Before/After are plain text notes; photo or
  image attachment is intentionally deferred to a future Phase 5b-3.
- Added storage, store, and Revision-close coverage for populated and absent
  Kaizen data. The approved implementation scope files changed were:
  `src/types/index.ts`, `src/lib/storage.ts`, `src/store/useChartStore.ts`,
  `src/components/modules/Module6_Kaizen.tsx`, `tests/store.test.cjs`,
  `tests/revisions.test.cjs`, `tests/storage.test.cjs`, and this file.

### Verification / Handoff

- `git status --short --branch`: implementation changes are limited to the
  eight approved scope files above; pre-existing `docs/AI_PROMPTS/README.md`,
  `docs/Master_Plan.html`, and the untracked Phase 5b-2 prompt were preserved
  unchanged.
- `node --test`: **PASS, 196/196** (0 failures).
- `npm run lint`: the direct PowerShell wrapper is blocked by the machine
  execution policy; equivalent `npm.cmd run lint`: exit 1 with **5 known
  baseline errors / 23 warnings** (the additional warnings are generated
  `.wrangler` facades and existing files), and **zero new errors** in any
  touched file.
- `npx tsc --noEmit`: direct PowerShell wrapper is blocked by the same policy;
  equivalent `npx.cmd tsc --noEmit`: **PASS**.
- `npm run build`: direct PowerShell wrapper is blocked by the same policy;
  equivalent `npm.cmd run build`: **PASS**, all 5 static pages generated
  (`/`, `/_not-found`, and `/editor` in the route table).
- `git diff --check`: **PASS**; only existing LF/CRLF normalization warnings.
- Best-effort manual check: local Next dev served `/editor`; the Browser
  confirmed the visible `6: Kaizen` navigator button and no console errors.
  Plain Next dev does not serve Cloudflare Pages Functions, so `/api/folders`
  returned 404, the UI showed Cloud unavailable, and no active chart was
  available to exercise the new form's fields or Add/Delete controls. The
  local dev server was stopped after the check. Claude should repeat the
  interaction and lock-state check in the Pages/D1-capable environment.
- No commit, push, deploy, Production D1 access, schema change, API/function
  change, migration, or other Production write occurred. This phase only
  extends the existing JSON content shape already round-tripped by the
  existing endpoints.
- **Next action:** return this handoff to Claude for review. Do not proceed to
  any further phase or release/migration action here.

## 2026-08-11 (Codex Phase 5b-2 scope audit — PLAN_CHANGE_REQUIRED)

### Finding

- Before implementation, the required read-through found that
  `src/lib/storage.ts:176-184` defines `chartFileContent()` as an explicit
  field allow-list containing `header`, `steps`, `layoutDiagram`,
  `timeMeasurement`, `timeStudy`, and `machineCapacity`, but not `kaizen`.
- Both `createFileCloud()` and `saveFileCloud()` serialize only that helper's
  result, so adding `ChartFile.kaizen` only in types/store/UI would not persist
  it through the existing Save path or into Revision snapshot content. The
  store's read-back comparison would also omit the field.
- The prompt forbids changing `src/lib/storage.ts` (and requires the new form
  to persist and freeze in snapshots), so the implementation cannot satisfy
  its own acceptance criteria without a scope change.

### Handoff / Safety

- **STATUS: PLAN_CHANGE_REQUIRED**. No implementation source/test file was
  changed. Only this changelog entry was appended.
- Requested decision: expand the allowed scope to include
  `src/lib/storage.ts` (and storage/read-back coverage as needed), or provide
  a revised prompt that defines an in-scope persistence path. No schema,
  endpoint, Production data, commit, push, deploy, or git-mutating command was
  performed.

## 2026-08-11 (Update 21 — Phase 5b-1 push + Production deploy)

### Tool

- Claude Code (Sonnet 5)

### Authorization

User explicitly authorized, via a single confirmation covering all three
steps together: commit, push, and deploy Phase 5b-1 (the M6 Before/After
comparison feature plus the infinite-loop fix, shipped together since the
fix was never separately committed) straight to Production — agreeing with
the reasoning carried over from the prior session that, unlike the
5a-1/5a-2 pair, there is no reason to hold deployment back for Phase 5b-2
(the separate Kaizen problem/countermeasure form) to also be ready first.

### Actions taken

1. Read every remaining diff not yet read in this session before
   committing: `kaizen-compare.ts` in full (pure calculation, no hooks —
   prefers Module 1 time-study data when present, falls back to Module 4
   step data, matching Module 5's existing convention; cycle-time-reduction
   percent correctly guarded against divide-by-zero), plus the smaller
   diffs in `storage.ts` (`getRevisionSnapshotCloud`, validates the full
   response shape before returning ok), `useChartStore.ts` (activeModule
   type extended to include 6), `editor/page.tsx` and `TopBar.tsx` (module-6
   wiring). No issues found — confirms the prior session's review verdict
   independently.
2. Committed as two commits, following this project's established
   docs/feat split: `03d9b43` (docs — the GPT-5.6 context-checkpoint rule
   and continuation-prompt refresh that were already sitting in the working
   tree from an earlier, unrelated Codex session) and `b6e7fdd` (feat(m6) —
   the actual Phase 5b-1 application code, tests, and this file's Update 20
   entry, shipping the fix together with the original never-before-committed
   implementation).
3. Pushed both commits: `87353ae..b6e7fdd` to `origin/main`.
4. Fresh `npm run build` from the pushed commit: PASS, 3/3 static routes.
5. Deployed: `npx wrangler pages deploy out --project-name=man-machine-chart
   --branch=main --commit-dirty=true` → deployment URL
   `https://f14a2365.man-machine-chart.pages.dev`.

### Live verification (read-only — no Production D1 write performed)

- Opened `https://man-machine-chart.pages.dev/editor` fresh. Queried
  `/api/folders` and `/api/files` directly via the page's own `fetch`:
  **7 folders / 4 roots / 12 charts**, folder and chart names all matching
  the last recorded Database Safety baseline (Update 19, 10 Aug 2026)
  exactly. Zero decrease, zero unexpected change.
- Opened `BYDSidestep Rev.00` (real Production chart): zero console errors
  across its normal tabs, confirming the deploy didn't regress anything.
- Confirmed the new bundle is live directly: the module tab bar now shows
  "6: Kaizen" (absent before this release), and clicking it updates the
  header to "MODULE 6: KAIZEN — BEFORE/AFTER COMPARISON" and renders the
  new component's correct empty-state message ("Close at least two
  Revisions...") for this chart, which currently has 0 closed Revisions —
  zero console errors, zero API errors. The "2 closed Revisions" happy
  path was already proven end-to-end against real local D1 in Update 20;
  no real Production chart currently has 2 closed Revisions to repeat that
  exact scenario against live data, consistent with this project's
  established practice of not manufacturing Production test data for
  scenarios already covered by local D1 verification (see Update 17's
  Phase 4c-1+4c-2 entry for the same reasoning).
- Did not close a Revision, save, lock, rename, move, duplicate, or delete
  any real chart.

### Docs updated

`docs/Master_Plan.html` bumped to v1.24: header status block, module-status
table (M6 now shows Phase 5a-1+5a-2+5b-1 done/deployed), Roadmap Phase 5
entry, and a new Change Log table row — all added only after this session's
fresh test/build/deploy/live-verification evidence, per the Master Plan
update rule.

### Database Safety Gate / Production statement

- **No Production D1 write occurred.** Verification was strictly read-only
  browsing plus one live `fetch`-based count check and one DOM/tab-label
  inspection.
- Push and deploy did occur this round, explicitly authorized by the user.
  This entry and the `docs/Master_Plan.html` update are committed and
  pushed next.

### Next

Phase 5b-1 is complete, reviewed, deployed, and live-verified. Phase 5b-2
(the Kaizen problem/countermeasure form — Problem, countermeasures list,
responsible, due date — additive to the same `Module6_Kaizen.tsx`) is the
next planning target, alongside the two still-open low-severity Phase 5a-2
follow-ups (not scheduled).

## 2026-08-10 (Update 20 — Claude re-verification: Phase 5b-1 infinite-loop fix)

### Tool

- Claude Code (Sonnet 5)

### Context

Follow-up to the Phase 5b-1 fix handoff (`PROMPT_CODEX_05_FIX_PHASE5B1_M6_INFINITE_LOOP.md`)
a prior Claude session wrote after finding the M6 Kaizen comparison component stuck in an
infinite re-render loop (~1,850 effect runs/sec) the moment two valid closed-Revision
snapshots were selected. Codex applied the fix (state → ref for `snapshotCache`, removed
from the second effect's dependency array) but it had not yet been re-verified. This
session's job was exactly that re-verification, per
`PROMPT_CLAUDE_00B_FRESH_SESSION_CONTINUE.md`'s immediate-next-step instructions.

### Fix confirmed on disk

Read `src/components/modules/Module6_Kaizen.tsx` in full: `snapshotCacheRef =
useRef<Record<string, RevisionSnapshot>>({})` replaces the old `useState`, and the second
`useEffect`'s dependency array is `[activeFileId, revisionFileId, beforeId, afterId]` —
`snapshotCache` is no longer in it, and nothing the effect does writes to any of its own
four dependencies. Matches the fix handoff exactly.

### Automated checks (fresh, working tree)

`node --test`: **193/193 pass** (up from 185 — includes the new `kaizen-compare.test.cjs`
and extended `storage.test.cjs`). `npm run lint`: exit 1, **5 errors** — identical to the
documented pre-existing baseline (StepTable.tsx x3, Sidebar.tsx x1, TopBar.tsx x1), zero in
any Phase 5b-1 file; warning count varies only with stale `.wrangler/tmp` bundle folders
(git-ignored, not a code issue). `npx tsc --noEmit`: clean. `npm run build`: PASS, 3/3
static routes.

### Live verification (real local Pages Dev + D1, not mocks)

Started `mm-chart-pages-dev` and opened "Side Step LH, RH (QA renamed)" (2 closed
Revisions: `A`, `TEST-5A2`). Repeated the exact technique that originally found the bug — a
temporary render counter injected into the second effect
(`window.__kaizenEffect2Runs`), rebuilt, reloaded, then removed and rebuilt again
afterward (confirmed via `git diff`/`git status` that both `Module6_Kaizen.tsx`, which is
untracked, and the temporarily-touched `.claude/launch.json`, which is tracked, ended the
session with zero unintended change):

- Opening the "6: Kaizen" tab (auto-selects the two most recent snapshots): counter went
  to **2** and stayed at 2 after a further 3s wait — no climb.
- Changing "After" to the same snapshot as "Before" (exercises the effect's early-return
  guard): counter went to **3**, stayed there.
- Changing "Before" to the other snapshot, producing a new genuinely distinct pair
  (`TEST-5A2` → `A`, swapped from the initial `A` → `TEST-5A2`): counter went to **4**,
  stayed there after a further 3s wait.
- Every state transition advanced the counter by exactly 1 and then stopped — the opposite
  of the original ~1,850/sec runaway. `read_network_requests` showed each snapshot fetched
  via `GET /api/revisions?id=...` exactly once each (ref-based cache working as designed,
  no duplicate fetches). Zero console errors from the app itself. The comparison UI
  rendered correctly both times (Revision Metrics table + Overlaid Yamazumi chart, with
  Before/After correctly swapped on the second selection).

### Environment note (not an application bug)

The Browser-pane preview tool's own process supervisor (`preview_start`) could not keep
`wrangler pages dev` alive in this environment across five attempts — it kept losing track
of the process seconds after a clean start with no port conflict, while the identical
command launched directly stayed up and served real D1-backed API routes without issue.
Worked around it by launching the server directly and pointing the browser tab at it
manually; found and cleaned up several orphaned `wrangler`/`workerd` process trees left
behind by the failed `preview_start` attempts (confirmed port 8788 fully free and no stray
processes before finishing). This is local tooling behavior, unrelated to any code in this
repository.

### Database Safety Gate / Production statement

No Production D1 access of any kind. Every command targeted the pre-existing **local**
`.wrangler` D1 state only. No new revision was closed and no chart content was modified —
only existing closed Revisions were read. No commit, push, or deploy occurred in this
entry.

### Next

The Phase 5b-1 fix holds. Phase 5b-1's application code (fix + original implementation,
never separately shipped) is ready to commit and push, pending user authorization; deploy
timing is a separate question for the user.

## 2026-08-10 (Codex — GPT-5.6 context checkpoint / new-chat handoff rule)

### Session goal

Add a standing project rule for the current GPT-5.6 API context limit and make
the required new-chat handoff prompt ready to use when a long session reaches
the checkpoint.

### Actions taken

- Verified against the official OpenAI API model documentation that GPT-5.6
  Sol/Terra/Luna currently list a 1,050,000-token context window. Defined the
  operational threshold as 70% = 735,000 tokens.
- Added the rule to `PROJECT_CONTEXT.md`: finish the current atomic step,
  alert the user in Thai, fill the handoff prompt with real status/evidence/
  risks, and offer a new chat. If the client does not expose reliable usage,
  the assistant must label exact usage as unknown and use the system/
  `PreCompact` warning as fallback.
- Added `docs/AI_PROMPTS/PROMPT_NEW_CHAT_GPT56_CONTEXT_CHECKPOINT.md`, a
  reusable ready-to-fill continuation prompt, and linked it from
  `docs/AI_PROMPTS/README.md`.

### Verification / Safety

- Documentation-only change; no application source, schema, API, D1 data, or
  deployment behavior changed.
- No test/lint/build run was necessary for Markdown-only changes.
- No commit, push, deploy, Production D1 write, migration, reset, or seed was
  performed in this session.
- Source checked: `https://developers.openai.com/api/docs/models` on
  2026-08-10; re-check the vendor page before changing the threshold.

## 2026-08-10 (Update 19 — Phase 5a-1+5a-2 release: push + Production deploy)

### Tool

- Claude Code (Sonnet 5)

### Authorization

User explicitly authorized, via two separate direct confirmations: (1) push
the two pending commits to GitHub, and (2) deploy to Production — noting
this deploy ships Phase 5a-1 and Phase 5a-2's application code together for
the first time, which was always the plan (5a-1's code was deliberately
held back only until 5a-2 was ready).

### Actions taken

1. Pushed `11ce2f8..4b40648` (two commits: `c0c839e` docs, `4b40648` the
   Phase 5a-2 implementation) to `origin/main`.
2. Fresh `node --test` from the pushed commit: 185/185 pass. Fresh
   `npm run build`: exit 0, 3/3 static routes (`/`, `/editor`,
   `/_not-found`).
3. Deployed: `npx wrangler pages deploy out --project-name=man-machine-chart
   --branch=main --commit-dirty=true` → deployment URL
   `https://12c86496.man-machine-chart.pages.dev`.

### Live verification (read-only — no Production D1 write performed)

- Opened `https://man-machine-chart.pages.dev/editor` fresh. Folder tree:
  **7 folders / 4 roots / 12 charts** — counted every folder and chart name
  in the rendered sidebar and confirmed an exact match to the last recorded
  Database Safety baseline (Update 17, 7 Aug 2026). Zero decrease.
- Opened `BYDSidestep Rev.00` (real Production chart, real M1 time-study
  data). Clicked through all 5 module tabs (Time Sheet, Capacity, Gantt,
  Layout, Yamazumi): zero console errors on every one. M1 rendered real
  per-row Min/Max/Fluc/Aver stats; M4 rendered LayoutDiagram (30 SVG element
  groups) and StepTable (18 rows); M5 rendered 13 job-element bars, each
  correctly `draggable="true"` (this chart is unlocked, so Phase 4c-2's
  existing drag-and-drop remains fully functional — confirms Phase 5a-2
  did not regress normal/unlocked behavior).
- Confirmed the deployed bundle is the new one, directly: inspected the
  live DOM's `Process Name` field and found its rendered `className` now
  contains `disabled:opacity-50 disabled:cursor-not-allowed
  disabled:bg-slate-100` — classes that did not exist on this field before
  Phase 5a-2. The `Rev No.` field's className correctly does *not* carry
  those classes unconditionally (it only gains them when actually locked,
  per its existing Phase 5a-1 ternary) — confirming the new per-field
  static classes and the pre-existing conditional one both behave exactly
  as reviewed.
- Did not close a Revision, save, lock, rename, move, duplicate, or delete
  any real chart. Creating a throwaway test chart to observe live locked-
  state rendering was deliberately avoided: this app's Delete action is
  disabled by design (Phase 0B — no server-side authorization system
  exists yet), so a Production test artifact could not be cleaned up
  afterward and would sit as permanent clutter. The DOM-inspection method
  above proves the new bundle is live without needing to trigger the
  locked state on Production.

### Docs updated

`docs/Master_Plan.html` bumped to v1.23: header status block, module-status
table (M6 now shows Phase 5a-1+5a-2 done/deployed, including a pointer to
the two open low-severity findings), Roadmap Phase 5 entry, and a new
Change Log table row — all added only after this session's fresh
test/build/deploy/live-verification evidence, per the Master Plan update
rule.

### Database Safety Gate / Production statement

- **No Production D1 write occurred.** Verification was strictly read-only
  browsing plus one live DOM/class inspection.
- Push and deploy did occur this round, explicitly authorized by the user
  for each action. This entry and the `docs/Master_Plan.html` update are
  committed and pushed next.

### Next

Phase 5a-1 and 5a-2 are both complete, reviewed, deployed, and live-
verified. Two low-severity, non-blocking findings from Phase 5a-2's review
remain as optional follow-ups (not scheduled). Phase 5b (Before/After
comparison page + Kaizen sheet + export) is the next planning target.

## 2026-08-10 (Update 18 — Claude review + live verification: Phase 5a-2)

### Tool

- Claude Code (Sonnet 5)

### Context

Follow-up to Codex's own entry below ("Codex Phase 5a-2 locked-chart
read-only UI gating") — that entry has this round's full implementation
detail; this entry covers only what Codex's report didn't: Claude's diff
review verdict, two minor findings, and live verification against real
local D1/Pages Dev (Codex's environment cannot run Wrangler).

### Review verdict

Read all 11 changed files in full against the Phase 5a-2 handoff. Scope
matches `REQUIRED SCOPE` exactly; `useChartStore.ts`'s diff is `+1/-0`
(only the `duplicateFile` fix — confirmed no other action changed);
`Module3_CombinationTable.tsx` has zero diff, correctly. Every control
listed in the handoff (HeaderForm's 8 remaining fields, all of M1/M2,
StepTable/LayoutDiagram/SummaryTable, M5's Takt input/benchmark
button/draggable rows, TopBar's Save button) is gated as specified.
Independently re-ran `node --test` (185/185), `npm run lint` (5 errors/15
warnings — traced all 5 to lines that predate this round, using Claude's
own full-file reads from earlier in this session, not just Codex's claim),
and `npm run build` (PASS) — all match Codex's reported numbers exactly.

Two low-severity, non-blocking findings from reading the diff. Neither is a
data-safety issue — nothing can be edited via either path, both are UX
polish:

1. `LayoutDiagram.tsx`'s `onElementPointerDown` guard (`if (isLocked)
   return;`) runs before `setSelectedId`, so a layout element cannot be
   *selected* — not just edited — while locked. `ElementPanel` is therefore
   unreachable on a freshly-opened locked chart (only reachable if an
   element was already selected before the chart got locked).
   `ConnectionPanel` doesn't have this gap — `ConnectionShape`'s `onSelect`
   isn't gated, only its body-drag (`onConnBodyDown`) is, so connections
   stay selectable/inspectable while locked. Optional fix: move the guard
   to after `setSelectedId(el.id); setSelectedConnId(null);`, before
   `dragRef.current = ...`.
2. `Module5_YamazumiChart.tsx`'s `handleOperatorDrop` guard runs before
   `event.preventDefault()` and the `setDraggingRowId(null)` /
   `setDraggingOverOperator(null)` cleanup. Harmless in the vast majority of
   cases since every row's `draggable` is already `false` when locked (no
   in-app drag can start to reach this handler at all), but a stray
   external (non-app) drag dropped on the zone could leave the drop-target
   ring visually stuck. Optional fix: move the guard after those three
   lines.

### Live verification (real local Pages Dev + D1, not mocks)

Hit an unrelated local-only startup crash first: `wrangler pages dev`
defaults to today's system date as its compatibility date, but the
installed workerd binary only supports up to 2026-08-08 — a local
tooling/clock drift, unrelated to any application code. Worked around it by
temporarily adding `--compatibility-date=2026-08-08` to
`.claude/launch.json`'s `mm-chart-pages-dev` entry, then reverted that file
to its original committed state immediately after verification (confirmed
via `git status` — zero diff on `launch.json`). Flagging as a possible
separate, later fix to `wrangler.toml`; not part of this change.

Against the existing local test chart ("Side Step LH, RH (QA renamed)",
`.wrangler` local D1 only — `Resource location: local` confirmed on every
command, `--remote` never used):

- Closed a revision for real (`revNo` set to a fresh value to avoid the
  existing unique-index collision from a prior session's "A" snapshot —
  confirmed that collision itself correctly 409'd first, proving the
  duplicate-revNo guard from Phase 5a-1 still holds). TopBar's Save button
  correctly changed to disabled **"🔒 Locked"**.
- Checked every module's actual rendered DOM (`.disabled` property, not
  just the source diff) via the browser's own JS console: HeaderForm's 8
  fields, M1 (readingCount select, import/push buttons, all per-row
  selects/inputs), M2 (import button, shift inputs, all per-row inputs),
  M4 (both Add Step buttons, StepTable's per-row controls, LayoutDiagram's
  Free Arrow/Connect/palette buttons all disabled, canvas `cursor:
  not-allowed`, zero draggable elements), M5 (Takt input, Update Benchmark
  button, `draggable="false"` on the row bar) — every one reported
  `disabled: true`, zero false negatives. The one "enabled" input each
  sweep initially flagged was always HeaderForm's pre-existing `readOnly`
  Cycle Time field (a different attribute than `disabled`, unrelated to
  this phase, correctly never gated).
- Investigated an apparent styling anomaly (disabled fields showed
  `opacity: 1` instead of the expected `0.5`) before accepting it: traced
  it conclusively to the automated browser tab being backgrounded
  (`document.hidden === true`), which stops CSS transitions from
  completing — proven with an isolated probe element carrying the exact
  same classes, which resolved to `opacity: 0.5` immediately when created
  already-disabled (no transition needed), while a *fresh*
  enabled→disabled transition on another probe stayed stuck at `1` even
  after 300ms in the same hidden tab. This is a testing-tool artifact, not
  an application bug — the `disabled:opacity-50` utility itself is correct
  and would render normally for a real user in a foregrounded tab.
- Clicked **Open New Revision**: local D1 confirmed `lockedAt` back to
  `null`; Process Name and Save both became enabled again in the live DOM.
  Full close → verify-every-module-blocked → open → editable-again cycle
  held, zero console errors introduced by any step in it (the only console
  errors present were leftovers from the unrelated wrangler startup crash
  above, before the workaround took effect).

### Database Safety Gate / Production statement

No Production D1 access of any kind occurred. Every command targeted the
pre-existing **local** `.wrangler` D1 state only (`Resource location:
local` confirmed on every wrangler invocation). No commit, push, or deploy
occurred in this entry.

### Next

Phase 5a-2 is implementation-complete, fully reviewed, and now verified
live end-to-end across every module. The two findings above are optional
follow-ups, not blockers. Still pending: explicit user authorization to
commit + push, and — separately — to deploy (which would ship Phase 5a-1
and 5a-2's application code together, since 5a-1's code was deliberately
held back until this phase was ready). Phase 5b (the Before/After
comparison page) remains separately scoped next.

## 2026-08-10 (Codex Phase 5a-2 locked-chart read-only UI gating)

### Scope / Implementation

- Added `activeFile.lockedAt`-driven disabled/read-only treatment to the eight
  non-Rev-No. HeaderForm fields and all persisted-content editing controls in
  Modules 1, 2, and 5, the M4 StepTable/SummaryTable, and LayoutDiagram.
- LayoutDiagram now blocks locked-chart drag, resize, rotate, connect, palette,
  keyboard-delete, and property-panel mutations while continuing to display the
  selected content. Module 3 was intentionally unchanged.
- TopBar Save is disabled for a locked chart and shows `🔒 Locked`.
- `duplicateFile` now explicitly sets `lockedAt: null`; added one regression test
  proving a locked source remains locked while its copy starts open.
- No calculation library, store setter guard, API/function, schema, Sidebar,
  rename/move action, or Phase 5b comparison page was changed.

### Verification / Safety

- `node --test`: **PASS, 185/185**.
- `npm.cmd run build`: **PASS**; TypeScript compiled and `/`, `/_not-found`,
  and `/editor` generated successfully.
- `npm.cmd run lint`: exit 1 with the known baseline **5 errors / 15 warnings**;
  the reported errors remain the existing StepTable, Sidebar, and TopBar
  baseline findings, with `.wrangler` warnings. No new lint category was added.
- `git diff --check`: **PASS**; Git reports only existing LF/CRLF normalization
  warnings for touched working-copy files.
- Database Safety Gate: **READ-ONLY COMPLETE** for this implementation. No
  local D1 or Production D1 write, migration, reset, seed, commit, push, or
  deploy was run. Production data remains untouched; release and live
  verification require separate authorization.

## 2026-08-07 (Update 17 — Phase 5a-1 Production schema migration)

### Tool

- Claude Code (Sonnet 5)

### Authorization

User explicitly authorized, after reviewing the exact 4 SQL statements
verbatim: (1) a fresh Database Safety Preflight, then (2) running exactly
those statements against Production `mm-chart-db`. User also confirmed the
sequencing recommendation this migration follows: migrate the additive
schema now, but hold application-code deployment until Phase 5a-2 (read-only
UI gating) is ready, so the live team never sees a half-implemented lock UI
while continuing to work in the app.

### Preflight (Prompt 01A)

Read-only inventory of Production found **7 folders (4 roots) / 12 charts**
— growth only versus every prior recorded baseline (a new root folder
`P703SSB` with 4 new charts, created the same day, plus the `Injection`
folder/2 charts already seen earlier this session). All previously-known
folders and charts present by name, zero decrease. Exported the complete
`folders`/`chart_files` rows (with full chart content) and a live-schema
introspection to
`D:\00_LocalFile_WebApp\ManMachineChart_Data_Backups\2026-08-06_091954\`;
re-read the export back and confirmed row counts and JSON validity for all
12 charts. STATUS: `DATA_SAFE_READ_ONLY_COMPLETE`.

**New finding:** beyond the already-documented `folders.parentId` foreign-key
drift, this preflight found that `schema.sql`'s `idx_files_folder` and
`idx_files_updated` indexes on `chart_files` have never actually existed on
Production — `schema.sql` has never been applied there as a complete file.
Not a data-safety risk at current scale, but it meant the migration below
had to run only its own 4 statements, never the full `schema.sql` file
(which would have silently created those two long-missing indexes as an
unplanned side effect).

### Migration

Ran exactly:
`ALTER TABLE chart_files ADD COLUMN lockedAt TEXT DEFAULT NULL;` plus
`CREATE TABLE revision_snapshots (...)` and its two indexes, via
`wrangler d1 execute mm-chart-db --remote --file=...`. Wrangler reported
`success: true`, 4 queries executed. Immediately re-verified: folder/root/
chart counts unchanged (7/4/12), `chart_files.lockedAt` column present and
nullable, `revision_snapshots` present with 0 rows, **0 of the 12 existing
charts have `lockedAt` set** (zero behavior change for any real chart), and
`sqlite_master` confirms only the 4 intended objects were added — the two
long-missing indexes are still absent, exactly as scoped. Full before/after
detail recorded in `MIGRATION_RESULT.md` next to the preflight export.

### Database Safety Gate / Production statement

**This is a Production D1 write** — the schema is now live. It is purely
additive and currently inert: no existing chart is locked, no application
code that reads/writes `lockedAt` or `revision_snapshots` is deployed yet.
Rollback, if ever needed before any real snapshot exists, would be a trivial
additive-only reversal (`ALTER TABLE` cannot drop a column in SQLite, but an
unused nullable column with no reads/writes is harmless indefinitely).
Verified recovery export exists and was checked before the write, per the
Database Safety Gate. No application code was committed, pushed, or
deployed in this entry — that already happened in Update 16/commit
`b982cc3`, separately from this schema step.

## 2026-08-06 (Update 16 — Claude review + fix + local verification: Phase 5a-1)

### Tool

- Claude Code (Sonnet 5)

### Context

Follow-up to Codex's own entry below ("Codex Phase 5a-1 revision snapshot
implementation") — that entry has this round's full implementation detail;
this entry covers only what Codex's report didn't: Claude's diff review
verdict, the one fix applied, and a real local Pages Dev/D1 verification
Codex's environment couldn't run.

### Review verdict

Read every changed file in full (schema.sql, functions/api/revisions.js,
functions/api/files.js, types/index.ts, storage.ts, useChartStore.ts,
HeaderForm.tsx, and all three test files). Logic matches the handoff spec
precisely — guard ordering in `closeRevision`/`openNewRevision`, the
atomic close batch, and `files.js`'s new lock check falling through to
existing behavior exactly when a row doesn't exist. No bugs found.

### Fix applied (Claude, explicit user authorization for this one change)

The one blocker Codex correctly flagged and correctly left alone (out of its
allowed scope): `tests/data-safety.test.cjs`'s own mock D1 didn't recognize
`files.js`'s new `SELECT lockedAt FROM chart_files WHERE id = ?` query,
failing 3 pre-existing `PUT /api/files` tests. Fixed by adding the same
4-line handler Codex had already written in its own
`tests/revisions.test.cjs` mock — a mechanical copy, no design decision.
`node --test`: **184/184 pass**. `npm run build`: PASS (5/5 static routes).
`npm run lint`: 5 errors / 15 warnings, unchanged pre-existing baseline,
zero in any touched file. `git diff --check`: PASS (line-ending warnings
only).

### Local Pages Dev verification (Claude — Codex's environment lacks wrangler)

Applied `schema.sql` to the pre-existing local D1 under `.wrangler/state`
(confirmed the `lockedAt` column was absent beforehand; the additive
migration applied cleanly, 8/8 statements, zero conflict with the existing
local test data — 1 folder, 2 charts, left over from earlier Phase 0B/0C
sessions). Started the existing `mm-chart-pages-dev` launch config
(`wrangler pages dev out`), confirmed `env.DB` bound in **local** mode on
every command (`Resource location: local`, never `--remote`). Against the
existing local test chart ("Side Step LH, RH (QA renamed)"):

- Close Revision → `PUT /api/files` (save) → `GET /api/files` (read-back) →
  `POST /api/revisions`, all 200. Verified directly against D1:
  `revision_snapshots.closedAt` and `chart_files.lockedAt` are byte-identical
  (`2026-08-06T09:01:18.954Z` both places) — the atomic guarantee holds
  against real D1, not just the test mocks.
- Rev No. field became disabled, lock badge appeared, Close Revision was
  replaced by Open New Revision.
- Edited Process Name while locked, clicked Save: blocked entirely
  client-side (zero new network calls, console warning fired), confirmed via
  direct D1 query that the stored content was completely untouched.
- Open New Revision → `PUT /api/revisions` 200; D1 confirmed
  `chart_files.lockedAt` back to `NULL`; the edited-but-unsaved Process Name
  text was still present in the UI, unchanged.
- Saved again: `PUT`/`GET /api/files` succeeded; D1 now shows the edited
  content persisted.
- Zero console errors through the entire cycle.

### Database Safety Gate / Production statement

Every command in this segment (schema apply, Pages Dev, D1 queries) targeted
the pre-existing **local** `.wrangler` D1 state only — `Resource location:
local` confirmed on every wrangler invocation, `--remote` never used, no
Production D1 access of any kind. The local test data present before this
session (1 folder, 2 charts) was preserved and extended, not reset or
replaced. No commit, push, or deploy occurred in this segment.

### Next

Phase 5a-1 is implementation-complete, fully reviewed, and now verified live
end-to-end against a real local D1/Pages Dev environment. Still separately
required before Production: the actual schema migration against Production
D1 needs its own Database Safety preflight and explicit user authorization
— this local verification does not substitute for that. Phase 5a-2
(read-only UI gating beyond HeaderForm) and Phase 5b (the Before/After page)
remain separately scoped next.

## 2026-08-06 (Update 15 — Phase 4 deploy: 4c-1+4c-2 to Production)

### Tool

- Claude Code (Sonnet 5)

### Authorization

User explicitly authorized, via structured choice, deploying the already
committed/pushed Phase 4c-1+4c-2 code (commit `49624fa`) to Cloudflare Pages
Production, and separately chose Phase 5 (M6 Kaizen) as the next planning
focus.

### Actions taken

1. Fresh `npm test` from the working tree at `1c6bfb6`: 163/163 pass. (The
   two "Cloud load failed" / "File cloud load failed" console lines in the
   output are simulated-network-failure test fixtures, not real failures.)
2. Fresh `npm run build`: exit 0, 5/5 static routes.
3. Deployed: `npx wrangler pages deploy out --project-name=man-machine-chart
   --branch=main --commit-dirty=true` -> deployment URL
   `https://7e9c313f.man-machine-chart.pages.dev`.

### Live verification (read-only — no Production D1 write performed)

- Opened `https://man-machine-chart.pages.dev/editor` fresh. Zero console
  errors throughout.
- Folder tree vs. the 4 Aug baseline (3 roots / 5 folders / 6 charts): now 3
  roots / 6 folders / 8 charts — one new folder (`Injection`, under `P703`)
  and two new charts (`Front MudFlaps SV`, `Front MudFlaps`); all six
  previously-known charts still present by name. Growth only, no decrease —
  consistent with real team usage between 4 and 6 Aug, not a regression.
- Opened `BYDSidestep Rev.00` (real production chart with active M1
  time-study rows). M1 renders the "หมวดเวลา" category dropdown per row
  (defaulting to "ปกติ"). M4 StepTable/Timeline/Layout/Summary render
  correctly (Cycle Time 2106s, Worker B — consistent between M4's Line Total
  Summary and M5's per-operator totals). M5 Yamazumi renders **per-job-element
  bar segments** (Phase 4c-1) with real labelled segments (e.g. "Work
  Unloading and Insert nu: 62s", "Cutting scrap: 213s", ...) — this by itself
  confirms the new bundle is live, not a stale cache of the pre-4c build.
- Confirmed via source inspection (`Module5_YamazumiChart.tsx`) that the
  deployed drag-and-drop wiring (`draggable`, `onDragStart`/`onDragEnd`/
  `onDragOver`/`onDrop`, gated behind `hasTimeStudy`) matches the reviewed
  source. Did **not** perform a live drag-and-drop against `BYDSidestep
  Rev.00` itself: this chart has real `timeStudy` rows, so `hasTimeStudy` is
  true and a real drag would call `moveRowToOperator`/`updateTimeStudy`,
  mutating an actual production record's in-memory state for no verification
  benefit beyond what was already proven pre-release. Relied instead on the
  passing `moveRowToOperator` unit tests (part of the 163/163 total) and the
  pre-release simulated-drag verification recorded in the 6 Aug `49624fa`
  commit message (which caught and fixed the dragend-stuck bug).
- No file was created, renamed, moved, duplicated, deleted, saved, or
  categorized against Production during this verification — view-only
  navigation plus one read-only DOM/source inspection.

### Rollback target

The Cloudflare Pages deployment immediately prior to this one (the 4 Aug
Phase 4a+4b release, `https://c121d9b3.man-machine-chart.pages.dev`) in the
project's own deployment history. No schema or data migration accompanied
this release.

### Docs updated

`docs/Master_Plan.html` bumped to v1.21: module-status table (M5 now shows
Phase 4 fully done/deployed), Roadmap Phase 4 entry (tag now "เสร็จแล้ว",
4c-1/4c-2 rows added with dates), header status block, and a new Change Log
table row — all added only after this session's fresh test/build/deploy/
live-verification evidence, per the Master Plan update rule.

### Database Safety Gate / Production statement

- **No Production D1 write occurred.** Verification was strictly read-only
  browsing plus one local source-code read; the one interactive feature that
  could have written data (Drag & Drop) was deliberately not exercised
  against real chart data.
- Commit/push of the application code (`49624fa`) had already happened in a
  prior session; deployment is the only git/release action that occurred in
  this session, explicitly authorized by the user. This session's own
  changes (`docs/Master_Plan.html`, this changelog entry) are docs-only and
  are committed/pushed next.

## 2026-08-06 (Update 14 — New-chat token-efficiency checkpoint rule)

### Tool

- Claude Code (Sonnet 5)

### Session goal

User reported that Claude's token usage was burning fast across 1-2 days of
this Claude-plans/Codex-codes workflow and asked for two things: (1) a
rebalanced verification split so Claude stops re-running checks Codex
already ran (done in a prior session — see the "Verification-depth split,
refined 2026-08-06" note in `docs/AI_PROMPTS/README.md`), and (2) a standing
rule so Claude proactively notices a good moment to start a new chat and
automatically prepares the continuation prompt, instead of the user having
to remember to ask for it every time.

### Root cause / design constraint

Claude cannot poll its own context/token usage mid-conversation, and a
memory/preference note alone cannot trigger automated behavior — the harness
executes hooks, not Claude's own recall. `PreCompact` is the one real,
harness-fired event tied to "this conversation's context has grown large"
(it fires right before the system auto-compacts). The design therefore
splits the request into (a) a genuine automated hook for the detectable
part, and (b) a documented standing behavior for the part that requires
judgment/synthesis and so cannot live in a shell command.

### Actions taken

1. Added `.claude/settings.json` with a `PreCompact` hook (command type,
   PowerShell) that emits a `systemMessage` notifying the user the moment
   auto-compaction is about to run. Pipe-tested the raw command directly and
   via a Node `spawnSync` argv-array invocation (the way a harness actually
   spawns hook commands) before adding it, and validated the resulting
   `settings.json` with `ConvertFrom-Json`.
2. Added a "New-chat / token-efficiency checkpoint" subsection to
   `PROJECT_CONTEXT.md`'s Important Working Rules: when the hook fires, or
   Claude judges a natural phase/milestone boundary was just reached, Claude
   should proactively refresh `docs/AI_PROMPTS/PROMPT_CLAUDE_00B_FRESH_SESSION_CONTINUE.md`'s
   dated sections and offer a new chat, without waiting to be asked.
3. Cross-referenced the new rule in `docs/AI_PROMPTS/README.md` (pointer
   only, next to the existing verification-depth-split notes and the Prompt
   0B listing) to avoid duplicating rule text across files.
4. Filled in Prompt 0B's own "IMMEDIATE QUESTION FOR THE USER" placeholder
   (previously blank) so the file is immediately usable, applying the rule
   just written.
5. Re-verified actual repo state with `git status`/`git log` before touching
   anything, since the conversation had just been compacted and the
   pre-compaction summary's commit claims needed checking against reality
   (they turned out to be accurate: HEAD was already `49624fa`, in sync with
   `origin/main`).

### Files changed

- `.claude/settings.json` (new)
- `PROJECT_CONTEXT.md`
- `docs/AI_PROMPTS/README.md`
- `docs/AI_PROMPTS/PROMPT_CLAUDE_00B_FRESH_SESSION_CONTINUE.md`
- `CHANGELOG_AI.md` (this entry)

### Verification

Docs/config-only session — no `src/`, `functions/`, or test files touched,
so `node --test`/lint/build do not apply. Verified instead by: reading every
edited file back, validating `.claude/settings.json` JSON syntax with
PowerShell `ConvertFrom-Json`, and executing the hook's exact command through
a Node `spawnSync` call to confirm it produces valid parseable JSON when
invoked the way a real hook runner spawns child processes.

### Database Safety Gate / Production statement

No application code, schema, API, or test file was touched. No dev server,
Wrangler, or D1 access of any kind occurred. No commit, push, or deploy of
Phase 4 application code happened in this session — Phase 4 (`49624fa`)
remains pushed but not yet deployed to Production, unchanged from before
this session, pending separate user authorization.

## 2026-08-04 (Update 13 — Phase 4a+4b release: commit, push, deploy)

### Tool

- Claude Code (Sonnet 5)

### Authorization

User explicitly authorized commit + push for both Phase 4a and Phase 4b
(separately, after each was independently reviewed), then explicitly
authorized deployment of both to Cloudflare Pages Production.

### Actions taken

1. Phase 4a: committed `06898ea` ("feat(m5): add Min/Max/Average overlay to
   Yamazumi chart"), pushed `7274db8..06898ea`.
2. Phase 4b: committed `979774a` ("feat(m5): add Periodical/Changeover time
   tiers to Yamazumi chart"), pushed `0a1ae7e..979774a`.
3. Fresh `npm run build` (exit 0, 5/5 static routes) from the pushed
   commit, then deployed:
   `npx wrangler pages deploy out --project-name=man-machine-chart
   --branch=main --commit-dirty=true` → deployment URL
   `https://c121d9b3.man-machine-chart.pages.dev`.

### Live verification (read-only — no Production D1 write performed)

- Opened `https://man-machine-chart.pages.dev/editor` fresh. Folder tree
  matches the known baseline exactly: 3 roots (`581D`, `P703`, `PD6`), 5
  folders (`PD6` → `BlowMold` → `BYD`, depth 3), 6 charts. No decrease.
- Opened `BYDSidestep Rev.00` (real Production data, multiple readings up to
  10 columns, 3 operators). Module 1 renders correctly with the new
  "หมวดเวลา" column present and defaulting to "ปกติ" for every row (none of
  the existing Production data has ever been categorized — expected).
  Module 5 renders the Phase 4a Min/Max/Average treatment correctly (Worker
  A/B/C all show matching Max/Min/Avg, consistent with this chart's actual
  reading data) with no Periodical/Changeover tiers or legend entries —
  correct, since no row is categorized.
- Zero console errors/warnings across every step. No file was created,
  renamed, moved, duplicated, deleted, saved, or categorized against
  Production during this verification — view-only navigation.

### Rollback target

The Cloudflare Pages deployment immediately prior to this one in the
project's own deployment history (same mechanism as the Phase 0C release
entry above). No schema or data migration accompanied this release.

### Database Safety Gate / Production statement

- **No Production D1 write occurred.** Verification was strictly read-only.
- Commit, push, and deploy did occur this round, explicitly authorized by
  the user at each step.

## 2026-08-03 (Codex Phase 4A M5 Yamazumi Min/Max/Avg overlay)

### Tool / Scope

- Codex / GPT implementation-only handoff for Phase 4A M5.
- Implemented Min/Max/Average overlay from M1 time-study rows only. Phase 4B
  and Phase 4C remain out of scope.

### Changes

- `src/lib/time-study.ts`: added `manMin`, `walkMin`, and `idleMin` to each
  operator total. Existing `min`, `max`, `average`, and `rowCount` behavior
  remains unchanged; machine rows remain grouped under the existing `Auto M/C`
  bucket.
- `src/components/modules/Module5_YamazumiChart.tsx`: when M1 rows exist,
  renders solid Min work, a hatched Max overlay, and an Average marker with
  the Max/Average legend entries. With no M1 rows, the existing step-based
  fallback rendering remains unchanged.
- `tests/time-study.test.cjs`: added mixed-kind split/no-leakage coverage and
  literal regression assertions for existing total fields.
- `CHANGELOG_AI.md`: recorded this implementation handoff.

### Verification

- `node --test`: PASS, 156/156 tests.
- `npm.cmd run lint`: expected baseline result, 5 existing errors and 29
  warnings; no errors reported in the Phase 4A files.
- `npm.cmd run build`: PASS, 5/5 static routes generated.
- `npx.cmd tsc --noEmit`: PASS.
- `git diff --check`: PASS; only Git line-ending warnings were emitted.
- Manual local fixture check: M1 data showed Min/Max/Average for two human
  operators and the Max/Average legend; the no-M1 fixture preserved the
  existing fallback and omitted Max/Average. Current fixture-page console was
  clean.

### Handoff / Safety

- The pre-existing `docs/AI_PROMPTS/README.md` modification and untracked
  prompt file were preserved exactly and not edited by this implementation.
- No commit, push, deploy, migration, or Production D1 write was performed.

## 2026-08-03 (Update 12 — Phase 0C release: commit, push, deploy)

### Tool

- Claude Code (Sonnet 5)

### Authorization

User explicitly authorized, via structured choice, after GPT/Codex's Round 5
`PASS`: commit + push to `main`; deploy to Cloudflare Pages Production;
**read-only** live verification only (no Production D1 write authorized).

### Actions taken

1. Staged exactly the 15 files from the agreed release scope (the Phase 0C
   application/API/UI files, their tests, and the review/changelog/master-plan
   documentation) — no broad `git add -A`, nothing else in the working tree
   touched.
2. Committed as `4e19fb0` — "release: close phase 0C save-to-cloud
   persistence safety gaps".
3. Pushed to `origin/main`: `87f9a47..4e19fb0`. Confirmed via `git fetch` +
   `git status` immediately before push that no upstream divergence existed.
4. Ran `npm run build` fresh from the pushed commit (exit 0, 5/5 static
   routes), then deployed:
   `npx wrangler pages deploy out --project-name=man-machine-chart
   --branch=main --commit-dirty=true` → deployment URL
   `https://0040583c.man-machine-chart.pages.dev`.

### Live verification (read-only — no Production D1 write performed)

- Opened `https://man-machine-chart.pages.dev/editor` fresh (new browser
  session, no cached local state). Zero console errors/warnings throughout.
- Folder tree matches the `DATA_SAFE_READ_ONLY_COMPLETE` baseline recorded on
  2026-08-02 exactly: 3 roots (`581D`, `P703`, `PD6`), 5 folders total
  (`PD6` → `BlowMold` → `BYD`, max depth 3), 6 charts
  (`Coverouter581D`; `Inner LH Rev.01 เจ้ก้อยB`; `Inner RH Rev.01 เจ้แป๋ม B`;
  `BYDSidestep Rev.00`; `BYDSidestep Rev.01.`; `5F00_Facestep_#2_R00`). No
  folder, root, or chart count decreased.
- Opened `BYDSidestep Rev.00` (id `1c70da4a-4efb-490d-8b25-a6a97a2bb4a7`) via
  `GET /api/files?id=...` → `200`. Step table and Timeline Visualization
  rendered with the full real dataset (timeline extent 1091s, matching the
  chart's known content). `GET /api/folders` and `GET /api/files` (list) both
  `200`.
- No file was created, renamed, moved, duplicated, deleted, or saved against
  Production during this verification — view-only navigation.

### Rollback target

The deployment immediately prior to this one in Cloudflare Pages' own
deployment history for the `man-machine-chart` project (each `wrangler pages
deploy` creates a new immutable deployment; rollback is a Cloudflare
Pages-level action, not a separate git commit this log can single out with
certainty). No schema or data migration accompanied this release, so rollback
is a pure code revert with no data-shape implications.

### Remaining open items (not part of this release)

- No live Save→PUT→fresh-GET→refresh round trip was run against Production
  this round (explicitly not authorized — read-only verification only). The
  most recent full round-trip evidence remains the local Pages Dev evidence
  recorded in the Round 4/5 entries below.
- Multi-user concurrent-editing safety, server-side authentication/
  authorization, and the `functions/api/folders.js` `meta.changes`
  defense-in-depth gap all remain separately scoped, exactly as every prior
  review round already recorded.

### Database Safety Gate / Production statement

- **No Production D1 write occurred.** Verification was strictly read-only,
  per explicit user choice.
- Commit, push, and deploy **did** occur this round, explicitly authorized by
  the user. This is the first git/deploy mutation of the entire Phase 0C
  workflow — every prior round was code-only with no git action.

## 2026-08-03 (GPT/Codex Phase 0C final code review — Round 5)

### Tool / Decision

- Codex / GPT, code-review-only. The application source was not edited during
  this review. Existing user/AI changes were preserved; no reset, restore,
  delete, commit, push, deploy, remote command, migration, reset, seed, or
  Production D1 write was performed.
- Decision: `PASS` for the current Phase 0C implementation and its reviewed
  local evidence. This means ready for a separately authorized release; it is
  not Production authorization and does not close the live-verification gate.

### What passed

- `useChartStore.ts` now treats `_unconfirmed` files as unverified for
  `openFile()`, `renameFile()`, `moveFile()`, and `duplicateFile()`. The
  explicit `saveActiveFile()` retry path remains available and still requires
  PUT success plus a fresh complete read-back before `saved`.
- `hydrate()` keeps `hydrated:false` until the Cloud result is known, preserves
  cached data for recovery, clears unverified active selections after a
  successful Cloud result, and uses a re-entrancy guard for React Strict Mode.
- The complete payload, `_unsynced` target/parent/folder guards, unloaded
  placeholder guards, nested/four-level folder preservation, and API zero-row
  file PUT behavior remain intact.
- Local Pages Dev evidence records URL
  `http://127.0.0.1:8788/editor`, chart ID
  `7ae7d46a-d3be-4339-ae55-40bd40d29a22`, marker
  `phase0c-round4-browser-smoketest-20260803`, PUT `200` with explicit
  `success/id/updatedAt`, fresh GET `200`, hard refresh/reopen, and zero
  console errors/warnings. This is local evidence only.
- `.claude/launch.json` contains only the additive local Pages Dev launcher;
  it changes no application behavior. It is recorded as tooling scope, not a
  schema/API/business-rule change.

### Verification

- `node --test` → **155/155 pass**.
- `npm.cmd run lint` → 5 existing baseline errors and 23 warnings in this
  workspace. The five errors are unchanged (`StepTable.tsx`, `Sidebar.tsx`,
  `TopBar.tsx`); the warning total includes generated `.wrangler/tmp` bundle
  warnings that vary with local Pages Dev runs. No new persistence/store lint
  error was introduced.
- `npm.cmd run build` → exit 0; Turbopack compiled, TypeScript completed, and
  all 5 static routes generated.
- `git diff --check` → exit 0; only existing LF/CRLF normalization warnings.

### Database Safety Gate / Production statement

- `DATA_SAFE_READ_ONLY_COMPLETE` for this review boundary. No Production D1
  write, `--remote` operation, schema migration, reset, seed, commit, push, or
  deploy occurred.
- Production deployment, live Save/read-back, and tree-preservation checks are
  still pending separate explicit user authorization. A passing local test or
  build is not being treated as proof of Production preservation.

## 2026-08-03 (Update 11 — Phase 0C GPT-review fix round 4)

### Tool

- Claude Code (Sonnet 5)

### Session Goal

Fix the 2 findings from the "GPT/Codex Phase 0C review — Round 4" entry below
(`APPROVED_FOR_CLAUDE_FIX`). No commit, push, or deploy this round; no
Production D1 write; no schema/API/business-rule change. Handoff returns to
GPT for another review round — this phase is not closed by this entry, and
`PASS` is not claimed.

### Findings addressed

1. **P1/blocker — an `_unconfirmed` draft could bypass the same-session
   active/mutation boundary.** Added a `blockUnconfirmedFile(set, actionName,
   file)` helper in `src/store/useChartStore.ts`, matching the existing
   `blockUnloadedFile` helper's style, and applied it to `renameFile`,
   `moveFile`, and `duplicateFile` (never to `saveActiveFile` — Save is the
   explicit retry path an `_unconfirmed` draft needs to stay available for).
   `openFile()`'s immediate-select fast path now also requires
   `!existing._unconfirmed`, so an `_unconfirmed` file forces a fresh Cloud GET
   instead of being trusted from cache; on a failed GET, `activeFileId` is left
   untouched (same pattern as the existing unloaded-placeholder case), so the
   previously active, confirmed file stays shown and the unconfirmed draft's
   content/flag are preserved untouched in `files` for recovery. On a
   successful GET, the entry is fully replaced by the fresh Cloud object,
   which implicitly clears `_unconfirmed` (it's a new object with no such key).
2. **P1/major — local-first hydration rendered an unverified active editor
   while the Cloud read was still pending.** `hydrate()` no longer sets
   `hydrated: true` in its initial synchronous `set()` (which previously ran
   before the Cloud request even started); `hydrated` now only flips once the
   Cloud result — success or failure — is known, matching the editor's
   existing `!hydrated` render gate in `editor/page.tsx`. Local data is still
   loaded into state immediately (so it's ready the instant Cloud resolves,
   and preserved for recovery either way), it just no longer renders as the
   confirmed active document during the pending window. `hydrate()`'s
   post-resolve active-file clearing condition now also checks `_unconfirmed`
   directly (previously relied only on `_loaded === false`, which
   `storage.ts`'s merge happens to also produce for an `_unconfirmed` file,
   but only after going through that specific cross-module conversion — the
   direct check is more robust and self-contained).

### Regression caught and fixed during implementation (not separately named by GPT)

Delaying `hydrated: true` removed its side effect as an implicit re-entrancy
guard. `next.config.ts` has `reactStrictMode: true`, and
`editor/page.tsx`'s `useEffect(() => { hydrate(); }, [])` has no cleanup, so
React's dev-mode double effect-invocation would have started two independent
Cloud hydrations before either could stop the second. Added a module-scoped
`hydrating` boolean in `useChartStore.ts`, checked and set before the local
`loadLocalDatabase()`/`set()` call and cleared after either branch resolves,
so a concurrent second `hydrate()` call while one is in flight is a no-op.
Covered by a dedicated regression test.

### Files changed

- `src/store/useChartStore.ts` — new `blockUnconfirmedFile` helper, applied to
  `renameFile`/`moveFile`/`duplicateFile`; `openFile()`'s fast-path condition
  extended to exclude `_unconfirmed`; `hydrate()` restructured to delay
  `hydrated: true` until the Cloud result is known, its active-file clearing
  condition extended to check `_unconfirmed` directly, and a new module-scoped
  `hydrating` guard added against concurrent calls.
- `tests/store.test.cjs` — 1 existing test (the read-back-mismatch case)
  extended with an explicit `_unconfirmed` assertion; 9 new tests: `openFile`
  forces a fresh GET for an `_unconfirmed` file and does not expose it as
  confirmed on a failed GET (while preserving the draft); `renameFile`/
  `moveFile`/`duplicateFile` are blocked against an `_unconfirmed` file with no
  cloud call; `saveActiveFile` is confirmed NOT blocked by `_unconfirmed` and
  a successful retry clears the flag; `hydrate()` stays `hydrated:false` while
  Cloud is pending; a concurrent second `hydrate()` call makes no duplicate
  fetch; `hydrate()` clears a raw `_unconfirmed` active file even without a
  separate `_loaded:false` reset.
- `.claude/launch.json` — added an `mm-chart-pages-dev` entry
  (`npx wrangler pages dev out --port 8788`) alongside the existing `next dev`
  entry, needed to run the required local Pages Dev browser smoke test through
  the Browser pane tooling (the existing entry has no D1-backed API behind
  it). Tooling-only change, no application behavior affected.
- No change to `src/lib/storage.ts`, `src/app/editor/page.tsx`,
  `functions/api/*.js`, or `schema.sql`.

### Verification

- `git status --short --branch` → working tree matches the pre-session dirty
  state plus this round's edits; no unexpected files.
- `node --test` → **155/155 pass** (146 prior + 9 new).
- `npm run lint` → **5 errors**, byte-identical to the Round 4 review's own
  recorded baseline (`StepTable.tsx` hook/entity issues, `Sidebar.tsx`
  explicit `any`, `TopBar.tsx` helper-order); none in `useChartStore.ts` or
  any file changed this round. Warning count varies with how many stale
  `.wrangler/tmp/bundle-*` directories exist (19 before this round's local
  Pages Dev smoke test, 23 after — each `wrangler` invocation leaves a new
  generated bundle behind, each contributing the same 2 known warnings;
  `.wrangler/` is git-ignored, never committed, and not source code). The 3
  actual source warnings (`ManMachineChart.tsx` ×2, `TopBar.tsx` 'e' ×1) are
  unchanged.
- `npm run build` → exit 0; Turbopack compiled, TypeScript clean, all 5
  static routes generated.
- `git diff --check` → exit 0 on the changed files (only pre-existing
  LF/CRLF-normalization warnings, no new issue).

### Local Pages Dev browser smoke test

Real browser evidence via `mm-chart-pages-dev` (`wrangler pages dev out`,
local D1, `mode: local` confirmed in the server's own binding output — not
Production, not `--remote`):

- **URL**: `http://127.0.0.1:8788/editor`. **Chart**: `Side Step LH, RH`
  (id `7ae7d46a-d3be-4339-ae55-40bd40d29a22`, the same chart used in prior
  rounds' local evidence). **Marker**:
  `phase0c-round4-browser-smoketest-20260803`, typed into Process Name.
- Opened the chart from the sidebar (exercising the fixed `openFile()` path):
  `GET /api/files?id=7ae7d46a-...` → `200`, real content rendered, zero
  console errors.
- Clicked Save: `PUT /api/files` → `200`
  `{"success":true,"id":"7ae7d46a-d3be-4339-ae55-40bd40d29a22","updatedAt":"2026-08-03T04:53:50.855Z"}`,
  immediately followed by the automatic fresh read-back
  `GET /api/files?id=7ae7d46a-...` → `200`, response body confirmed
  `content.header.processName` equals the exact marker, with the pre-existing
  `timeMeasurement`/`timeStudy`/`machineCapacity` module data from earlier
  rounds still intact (corroborating the Round 1 complete-payload fix is
  still in effect). Zero console errors.
- Hard reload (`navigate` with `force:true`) at the same URL: `GET
  /api/folders` + `GET /api/files` re-fired (fresh `hydrate()`), page showed
  "Updated: 8/3/2026" and, confirmed via direct DOM read
  (`input.value`), the Process Name field still held
  `phase0c-round4-browser-smoketest-20260803` — the reopened chart matches
  what was saved. Zero console errors/warnings throughout.
- This is local evidence only, not Production evidence.

### Database Safety Gate / Production statement

- No Production D1 write, remote D1 command, migration, schema change,
  commit, push, or deploy occurred this round. Production data was not
  written or modified. The local Pages Dev smoke test used only the local
  `mm-chart-db` D1 binding in `local` mode.
- The verified `DATA_SAFE_READ_ONLY_COMPLETE` Production baseline and
  external recovery export recorded on 2026-08-02 remain the source-of-truth
  evidence; this round performed no Production or remote database command.

## 2026-08-03 (GPT/Codex Phase 0C review — Round 4)

### Tool / Decision

- Codex / GPT, code-review-only. Application source was not edited. The dirty
  working tree was preserved; no reset, restore, delete, commit, push, deploy,
  remote command, migration, seed, or Production D1 write was performed.
- Decision: `APPROVED_FOR_CLAUDE_FIX` — not `PASS`, not phase closure, and not
  release approval.

### What passed

- `src/lib/storage.ts` has one complete persisted payload definition for
  `header`, `steps`, `layoutDiagram`, `timeMeasurement`, `timeStudy`, and
  `machineCapacity`. `saveActiveFile()` requires an explicit successful PUT,
  a fresh GET, and a complete comparison including the chart identity,
  metadata, and all persisted content before reporting `saved`.
- The reviewed Cloud-mutating store paths guard Cloud readiness and the
  covered `_unsynced` target/parent/folder IDs before calling the API.
  Unloaded placeholders are guarded for the full-payload rename/move/duplicate
  and Save paths. The synthetic nested/four-level folder tree remains intact.
- The recorded local Pages Dev evidence has the required shape: URL
  `http://127.0.0.1:8788/editor`, chart ID
  `7ae7d46a-d3be-4339-ae55-40bd40d29a22`, unique marker
  `phase0c-round2-browser-smoketest-20260802`, explicit PUT `200` response,
  fresh GET response with the marker/module fields, hard refresh/reopen, and
  zero browser console errors/warnings. This is local evidence only.

### Findings remaining

1. **P1 / blocker — an `_unconfirmed` draft can bypass the same-session
   active/mutation boundary.**
   `saveActiveFile()` leaves a failed or mismatched-read-back draft marked
   `_unconfirmed` while retaining `_loaded: true`. `openFile()` in
   `src/store/useChartStore.ts` immediately selects any file where
   `_loaded !== false` and does not exclude `_unconfirmed`; `blockUnloadedFile()`
   also checks only `_loaded === false`. Consequently, rename/move/duplicate
   can send the unconfirmed full payload to Cloud and `mutateWithRollback()`
   can report `saved` after the PUT without a fresh GET. A read-only inline
   reproduction reached `saveFileCloud` once and reported `saved` for such a
   draft. Fix by treating `_unconfirmed` as not confirmed: force a fresh GET
   before selection, and block or re-verify every full-payload mutation against
   it (while retaining the explicit Save retry path). Retest with a failed
   read-back followed by open, rename, move, and duplicate, proving no unsafe
   call or false `saved` state.

2. **P1 / major — local-first hydration renders an unverified active editor
   while the Cloud read is still pending.**
   `hydrate()` sets `hydrated: true` from localStorage before its Cloud request
   resolves, while `src/app/editor/page.tsx` gates rendering only on
   `hydrated`. A paused read therefore exposes a cached `_unconfirmed` or
   `_loaded:false` file through `activeFile()` before the later successful
   hydration clears the selection. The `cloudReady:false`/`syncing` indicator
   is not an active-editor source boundary. Fix by keeping the editor gated
   until the Cloud result is known, or by clearing the active selection during
   the pending state while preserving the cached record for recovery. Retest
   with a paused Cloud load and assert that no unverified file is rendered or
   selectable as the confirmed editor before the result.

### Verification

- `node --test` → **146/146 pass**.
- `npm.cmd run lint` → **5 errors / 19 warnings**, matching the recorded
  baseline; the errors remain the existing `StepTable.tsx` hook/entity issues,
  `Sidebar.tsx` explicit `any`, and `TopBar.tsx` helper-order lint issue. No
  new error was introduced in `storage.ts` or `useChartStore.ts`.
- `npm.cmd run build` → exit 0; Turbopack compiled, TypeScript completed, and
  all 5 static routes generated.
- `git diff --check` → exit 0; only the existing LF/CRLF normalization
  warnings were emitted.
- The two inline probes above were read-only store simulations; they did not
  contact an API or database.

### Database Safety Gate / Production statement

- Review result: `DATA_SAFE_READ_ONLY_COMPLETE` for this review boundary — no
  database command or write was made. No Production D1 write, `--remote`
  operation, schema migration, reset, seed, commit, push, or deploy occurred.
- This does not prove that Production data is preserved after deployment.
  Production deployment and live read-back/tree verification remain pending
  separate explicit user authorization and a later GPT `PASS`.

## 2026-08-03 (Update 10 — Phase 0C GPT-review fix round 3)

### Tool

- Claude Code (Sonnet 5)

### Session Goal

Fix the 4 findings from the "GPT/Codex Phase 0C final review — Round 3" entry
below (`APPROVED_FOR_CLAUDE_FIX`). No commit, push, or deploy this round; no
Production D1 write; no schema/API/business-rule change. Handoff returns to
GPT for another review round — this phase is not closed by this entry.

### Findings addressed

1. **P1/blocker — unloaded placeholders could reach full-payload mutations.**
   `renameFile`, `moveFile`, and `duplicateFile` in `useChartStore.ts` sent a
   file through `saveFileCloud`/`createFileCloud` without checking whether its
   content had actually finished loading (`_loaded === false` means the record
   is still the blank lazy-load placeholder, not real Cloud content). Added a
   `blockUnloadedFile(set, actionName, file)` helper, matching the existing
   `blockCloudMutation` helper's style, and applied it to all three actions
   plus reused it in `saveActiveFile` (which already had an equivalent inline
   check, but silently — see finding 1 continued below).
2. **P1/major — the `_unsynced` parent/folder guard was incomplete.**
   `renameFile`, `duplicateFile`, and `saveActiveFile` sent the file's
   `folderId` to the Cloud API but only passed the file's own `id` into
   `blockCloudMutation`, so a confirmed file attached to a local-only
   (`_unsynced`) folder could still reach the API. All three now also pass
   `file.folderId` into the same guard. `moveFile` (already checked both `id`
   and `newFolderId`) and `createFile` (already checked `folderId`) needed no
   change — confirmed by tracing exactly what each action's Cloud call body
   contains.
3. **P1/major — the active-file source boundary still had two bypasses.**
   (a) `hydrate()` only cleared `activeFileId` when the previously-active file
   had `_loaded === false`; it now also clears it when that file is
   `_unsynced` (local-only, never confirmed by Cloud either). (b) `openFile()`
   set `activeFileId` optimistically before its fresh Cloud GET resolved, and
   left it pointed at the unverified target if that GET failed. It's now
   restructured so `activeFileId` is only set immediately for a file that's
   already loaded or is `_unsynced` (no Cloud row exists to fetch); for
   everything else, `activeFileId` is left completely untouched — retaining
   whatever was previously active — until a fresh GET actually succeeds. Only
   caller in the app is `Sidebar.tsx`'s file-tree `onClick`; traced and
   confirmed nothing depends on the old synchronous assignment.
4. **P2/medium — the explicit PUT identity was not validated.**
   `storage.ts`'s `saveFileCloud()` checked `res.success` and `res.updatedAt`
   but never required `res.id === file.id`; `useChartStore.ts`'s
   `chartContentMatches()` also omitted `id` from its read-back comparison.
   Both now include the id check/field. Confirmed by reading
   `functions/api/files.js`'s PUT handler (read-only, unmodified) that the
   real API already echoes the request's own `id` on every success response —
   this closes a defense-in-depth gap against a malformed/future response, not
   a currently-live bug.

### Files changed

- `src/store/useChartStore.ts` — new `blockUnloadedFile` helper; `renameFile`,
  `moveFile`, `duplicateFile` gained the unloaded-placeholder guard;
  `renameFile`, `duplicateFile`, `saveActiveFile` gained the `folderId`
  argument to `blockCloudMutation`; `saveActiveFile`'s inline unloaded-check
  now goes through the shared helper (so a blocked save now also sets
  `syncStatus:'error'`, closing a silent-no-feedback gap — no existing test
  relied on the old silent behavior); `hydrate()`'s active-file clearing
  condition now also covers `_unsynced`; `openFile()` restructured per finding
  3(b) above; `chartContentMatches()` now includes `id` in its comparison.
- `src/lib/storage.ts` — `saveFileCloud()`'s success condition now also
  requires `res.id === file.id`.
- `tests/store.test.cjs` — 2 existing `openFile` tests extended with
  `activeFileId` assertions; 12 new tests covering all 4 findings (unloaded
  placeholders for rename/move/duplicate/save; `_unsynced`-folder blocking for
  rename/duplicate/save; `hydrate()` clearing an `_unsynced` active file;
  `openFile` retaining a real prior selection on failure, and taking the
  immediate-select fast path for both an already-loaded file and an
  `_unsynced` one; a read-back id mismatch reporting `unconfirmed`).
- `tests/storage.test.cjs` — 1 new test: `saveFileCloud` reports failure when
  the response `id` doesn't match the file being saved.
- No change to `src/types/index.ts`, `functions/api/files.js`,
  `functions/api/folders.js`, `schema.sql`, `Sidebar.tsx`, `TopBar.tsx`, or
  `editor/page.tsx`.

### Known, accepted rough edge — not fixed this round

Blocking `renameFile`/`moveFile`/`duplicateFile` on an unloaded placeholder
(finding 1) means a user who tries to rename/move/duplicate a sidebar file
they've never opened in this session gets only a small TopBar sync-error
indicator, no inline message — the same limited feedback `saveActiveFile`
already had for this case pre-Round-3. Improving that requires touching
`Sidebar.tsx`, which is outside this round's allowed scope. Flagging for a
future round, not a blocker.

### Verification

- `npm test` (`node --test`) → **146/146 pass** (133 prior + 13 new: 12 in
  `tests/store.test.cjs`, 1 in `tests/storage.test.cjs`).
- `npm run lint` → 5 errors / 19 warnings, matching the Round 3 review's own
  baseline exactly (3 in `StepTable.tsx`, 1 in `Sidebar.tsx`, 1 in
  `TopBar.tsx`); none in `useChartStore.ts` or `storage.ts`.
- `npm run build` → exit 0; Turbopack compiled successfully, TypeScript
  clean, all 5 static routes generated.
- `git diff --check` → exit 0 on the 4 changed source/test files.
- No dev server or browser smoke test this round — code/test-only fix, per
  GPT's own Round 3 scope (code-review-only, no application writes). The
  Round 2 browser evidence already on file remains the most recent browser
  verification.

### Database Safety Gate / Production statement

- No Production D1 write, remote D1 command, migration, schema change,
  commit, push, or deploy occurred this round. Production data was not
  written or modified.
- The verified `DATA_SAFE_READ_ONLY_COMPLETE` Production baseline and
  external recovery export recorded on 2026-08-02 remain the source-of-truth
  evidence; this round performed no database command of any kind, local or
  remote.
- `functions/api/folders.js`'s `meta.changes` gap (noted as residual risk in
  the Round 3 review) remains untouched, exactly as that review scoped it —
  a separate, future defense-in-depth change, not part of this round.

## 2026-08-03 (GPT/Codex Phase 0C final review — Round 3)

### Tool / Decision

- Codex / GPT, code-review-only; no application source edits were made.
- Decision: `APPROVED_FOR_CLAUDE_FIX` — not `PASS`, not phase closure, and not
  release approval. No commit, push, deploy, or Production D1 write was
  authorized or performed.

### What passed

- `src/lib/storage.ts` now uses one complete persisted payload definition for
  `header`, `steps`, `layoutDiagram`, `timeMeasurement`, `timeStudy`, and
  `machineCapacity`.
- `saveActiveFile()` requires an explicit successful PUT, a fresh GET, and a
  full-field comparison before `syncStatus: 'saved'`; failed or mismatched
  read-back keeps the draft `_unconfirmed` and retryable.
- The covered store actions block `_unsynced` record IDs and checked parent or
  destination IDs before their Cloud calls. `toggleFolder` is deliberately
  local-only for `_unsynced` folders and makes no API call.
- Hydration turns an `_unconfirmed` or stale file into `_loaded:false`, clears
  an active `_loaded:false` file selection, and preserves the draft data for
  recovery. The synthetic nested folder tree remains intact.
- The recorded local Pages Dev browser evidence meets the required local
  evidence shape: URL `http://127.0.0.1:8788/editor`, chart id
  `7ae7d46a-d3be-4339-ae55-40bd40d29a22`, marker
  `phase0c-round2-browser-smoketest-20260802`, PUT `200` with explicit
  `success/id/updatedAt`, fresh GET `200` with the marker and module fields,
  hard reload/reopen with fresh folder/file GETs, and zero browser console
  errors/warnings. This is local evidence only, not Production evidence.

### Findings remaining

1. **P1 / blocker — unloaded placeholders can reach full-payload mutations.**
   `src/store/useChartStore.ts` symbols `renameFile`, `moveFile`, and
   `duplicateFile` do not require `_loaded:true` before calling
   `saveFileCloud()` or `createFileCloud()`. A metadata-only Cloud row is
   represented by a blank `_loaded:false` placeholder; renaming it can PUT
   blank `steps`/layout/module content over the real chart. Fix by loading and
   confirming the file first, or by using a metadata-only API path that cannot
   serialize placeholder content. Retest with an unloaded placeholder and
   spies proving no destructive full-payload call occurs.
2. **P1 / major — the `_unsynced` parent/folder guard is incomplete.**
   `renameFile`, `duplicateFile`, and `saveActiveFile` pass a file's
   `folderId` to the Cloud API but call `blockCloudMutation()` only with the
   file id. A confirmed file attached to a local-only folder can therefore
   still reach the API. Pass every serialized folder/parent id to the guard
   before the call and add no-call/no-mutation tests for each path.
3. **P1 / major — active-file source boundary still has bypasses.**
   `hydrate()` only tests `_loaded:false`; an `_unsynced` active file whose
   cached content has no false flag can remain selected and render as the
   active editor. Separately, `openFile()` sets `activeFileId` before its
   fresh GET and leaves it selected after a failed load, so placeholder or
   cached draft content can be shown while unverified. Clear/retain the
   previous confirmed selection until the GET succeeds, and treat
   `_unsynced`/`_unconfirmed`/not-confirmed-loaded files as non-active or
   clearly read-only recovery data. Retest hydration and failed-open UI/store
   behavior.
4. **P2 / medium — the explicit PUT identity is not validated.**
   `src/lib/storage.ts:saveFileCloud()` checks `success` and `updatedAt` but
   never requires `res.id === file.id`; `chartContentMatches()` also omits the
   file id. The current API echoes the request id, but the client contract
   must reject a malformed or mismatched success response. Validate the exact
   id and add a mismatch test before allowing `saved`.

### Residual risk noted, not counted as a current store-path blocker

`functions/api/folders.js` still does not check D1 `meta.changes` on a direct
PUT, so a caller that bypasses the guarded store could receive a false success
for an unknown folder id. Current store guards prevent `_unsynced` folder IDs
from reaching it; any defense-in-depth endpoint change should be separately
scoped and reviewed because Phase 0C did not authorize a broader folder API
contract change.

### Verification

- `node --test`: **133/133 passed**.
- `pnpm.cmd test`: could not start because pnpm was denied access to
  `C:\Users\lekmi\AppData\Local\pnpm\config\config.yaml` (`EPERM`); the
  direct Node built-in test runner completed the same repository test suite.
- `npm.cmd run lint`: exit 1, **5 errors / 19 warnings**. The 5 errors are
  the known baseline findings in `StepTable.tsx` (3), `Sidebar.tsx` (1), and
  `TopBar.tsx` (1); source-only lint reports the same 5 errors and 3 existing
  warnings, while the remaining warnings are generated `.wrangler` output.
  No new Phase 0C lint error was identified.
- `npm.cmd run build`: exit 0; Next.js compiled successfully, TypeScript
  completed, and all 5 static routes were generated.
- `git diff --check`: exit 0.

### Database Safety Gate / Production statement

- The verified `DATA_SAFE_READ_ONLY_COMPLETE` Production baseline and external
  recovery export recorded on 2026-08-02 remain the source-of-truth evidence.
  This review performed no Production or local-D1 database command.
- No `--remote`, Production D1 write, migration, schema change, reset, seed,
  commit, push, or deploy occurred. Production data was not written or
  modified. Live deployment and Production-tree verification remain pending
  separate GPT PASS and explicit user authorization.

## 2026-08-02 (Update 9 — fresh-chat handoff)

Added `docs/AI_PROMPTS/PROMPT_NEW_CHAT_PHASE_0C_FINAL_REVIEW_AND_RELEASE.md`.
It separates the immediate GPT/Codex final review from the later Claude
commit/push/deploy chat, carries the current Phase 0C data-safety context, and
requires explicit review and user authorization before any release action.

## 2026-08-02 (Update 8 — Phase 0C GPT-review fix round 2)

### Tool

- Claude Code (Sonnet 5)

### Session Goal

Fix the 2 blockers from `docs/AI_PROMPTS/REPORT_CODEX_GPT_REVIEW_PHASE_0C_ROUND_2_2026-08-02.md`
(`APPROVED_FOR_CLAUDE_FIX`). No commit, push, or deploy this round; no Production
D1 write; no schema/auth/concurrency change. Handoff returns to GPT for another
review round.

### Findings addressed

1. **Blocker — local-only rows remained inside the `cloudReady` mutation state**
   (`storage.ts:90-111`, `useChartStore.ts:201-206` per GPT's line refs) — added
   a `blockCloudMutation(set, state, actionName, ...ids)` helper in
   `src/store/useChartStore.ts` that refuses to proceed (no API call, no local
   mutation, `syncStatus:'error'`) whenever `cloudReady` is false **or** any of
   the given ids — the record itself, or a parent/folder it's being attached
   to — belongs to an `_unsynced` record. Applied to every Cloud-mutating
   action: `createFolder` (checks `parentId`), `renameFolder`, `moveFolder`
   (checks both `id` and `newParentId`), `deleteFolder`, `createFile` (checks
   `folderId`), `renameFile`, `moveFile` (checks both `id` and `newFolderId`),
   `deleteFile`, `duplicateFile`, `saveActiveFile`. `toggleFolder` is the one
   deliberate exception: an `_unsynced` folder still toggles **locally**
   (harmless review-only UI state, same reasoning already applied to
   `cloudReady:false`), but never calls `updateFolderCloud` — no id local to
   Cloud is ever sent either way. A local-only id can now never reach any
   Cloud API call from the app.
2. **Major — an unconfirmed draft was still rendered as the active document
   after hydration** (`editor/page.tsx` renders `activeFile()` immediately;
   `hydrate()` never re-verified it) — `hydrate()` now checks whether the
   file the persisted `activeFileId` points at has `_loaded === false` in the
   merged result (this single flag already covers both `_unconfirmed` drafts
   and stale-updatedAt resets — `loadDatabaseFromCloud`'s merge collapses
   both cases to it). If so, `activeFileId` is cleared to `null` before the
   store's `cloudReady:true` set, so the editor falls back to its existing
   "No Project Selected" state instead of silently showing an unverified
   draft. The file's data is left untouched in `files` for recovery — the
   user re-opens it through `openFile()`'s already-verified Cloud-read path.
   A normal, confirmed, already-loaded active file is unaffected and stays
   active across hydration (verified by a dedicated non-regression test).

### Files changed

- `src/store/useChartStore.ts` — `blockCloudMutation` helper added; applied
  to all 10 Cloud-mutating actions listed above; `hydrate()`'s cloud-success
  branch gets the `activeFileId`-clearing check.
- `tests/store.test.cjs` — 10 new tests: 7 proving `_unsynced` targets block
  every action named above (rename/move/delete/save/create-into/toggle,
  covering both files and folders) with no cloud call and no local mutation;
  3 proving `hydrate()`'s new `activeFileId` handling (unconfirmed-with-
  matching-timestamp cleared, merely-unloaded cleared, confirmed-loaded
  stays active).
- No change to `src/types/index.ts`, `functions/api/files.js`,
  `functions/api/folders.js`, or `schema.sql`.

### Observation — not fixed, flagging for your call

GPT's report cited `functions/api/folders.js:69-70` (the `PUT` handler
doesn't check D1's `meta.changes`, unlike `files.js`'s zero-row guard from
Update 6) as evidence the blocker was real. With the client-side guard above,
the app can no longer send a local-only folder id to this endpoint at all, so
the gap is now unreachable through normal use — but the endpoint itself is
still permissive if called directly (e.g. a stale request, or a future
caller that bypasses the store). Left untouched this round per the
`PLAN_CHANGE_REQUIRED`-before-touching-`folders.js` instruction, since the
client guard is sufficient for the finding as stated. Flagging in case you
want the same `meta.changes` zero-row check ported to `folders.js` for
defense-in-depth in a future round.

### Verification

- `npx tsc --noEmit` → clean.
- `pnpm test` → **133/133 pass** (123 prior + 10 new).
- `pnpm run lint` → 5 errors / 15 warnings, byte-identical line-for-line to
  the Update 6/7 baseline (confirmed by direct diff of the error list) —
  none in code touched this round.
- `pnpm run build` → clean, TypeScript clean, 5/5 pages prerendered.
- `git diff --check` → exit 0 (edits inherited the already-LF-normalized
  files from Update 6; no new normalization pass needed).

### Browser smoke test — local Pages Dev only (`http://127.0.0.1:8788`)

Both automation surfaces that failed in Update 6 were retried; the embedded
Browser pane worked this time (no server crash) and produced genuine
in-browser evidence, captured from the browser's own network log:

- **URL**: `http://127.0.0.1:8788/editor`. **Chart**: `Side Step LH, RH`
  (id `7ae7d46a-d3be-4339-ae55-40bd40d29a22`). **Marker**:
  `phase0c-round2-browser-smoketest-20260802`, typed into the Process Name
  field via the real form input.
- **Save**: clicking the ☁ Save button produced `PUT /api/files → 200 OK`,
  body `{"success":true,"id":"7ae7d46a-...","updatedAt":"2026-08-02T13:56:54.146Z"}`,
  immediately followed by an independent `GET /api/files?id=7ae7d46a-...  →
  200 OK` whose body echoed the marker in `content.header.processName` and
  confirmed `timeStudy`/`machineCapacity` from earlier rounds were still
  intact (not clobbered by this save) — the exact write-then-read-back
  sequence `saveActiveFile()` performs. Sidebar showed no unsynced/unconfirmed
  badge on the file afterward, consistent with a confirmed save.
- **Hard refresh**: `navigate` to `/editor` again produced a genuine full
  reload (`GET /editor → 200 OK` in the network log, plus fresh
  `GET /api/folders` and `GET /api/files`). The file reappeared as the active
  document automatically (Finding 2's non-regression path — a *confirmed*
  save correctly stays active across reload) and
  `document.querySelector('input[placeholder="e.g. Blow Molding"]').value`
  still read `phase0c-round2-browser-smoketest-20260802`.
- **Console**: checked at initial load, after opening the file, after save,
  and after reload — clean every time, zero errors or warnings logged.
- **Network**: every request in the full session log (`/api/folders`,
  `/api/files`, `/editor`, all static chunks) returned 200 — no 4xx/5xx
  anywhere.
- Timestamp: 2026-08-02T13:56:54Z (PUT confirmed) through the post-reload
  check moments later. No Production D1 touched — local Pages Dev D1 only,
  existing state reused (not reset).

## 2026-08-02 (Update 7 — GPT Review of Phase 0C fix round 2)

### Tool / Decision

- Codex / GPT review
- `APPROVED_FOR_CLAUDE_FIX` — not yet `PASS`; no commit, push, or deploy.
- Report: `docs/AI_PROMPTS/REPORT_CODEX_GPT_REVIEW_PHASE_0C_ROUND_2_2026-08-02.md`.

### Verification

- `pnpm.cmd test`: 123/123 passed.
- `pnpm.cmd run build`: passed.
- `pnpm.cmd run lint`: 5 known pre-existing errors and 15 warnings; no new
  Phase 0C error identified.
- `git diff --check`: passed.
- Local API/D1 full-payload Save → GET → repeated GET proof exists; browser
  rendered Save/reopen/console evidence is still missing.
- No Production write, remote D1 command, schema change, commit, push, or deploy.

### Remaining blockers

- `_unsynced` folders/files remain inside the `cloudReady` mutation state. The
  badge is visibility only; mutations can still be attempted, and folder PUT
  does not verify zero affected rows.
- `_unconfirmed` drafts remain the cached `activeFile` after hydration until a
  user explicitly opens them, so the editor can show the draft before a fresh
  Cloud GET and global status is reset to idle.
- These two boundaries and the browser smoke evidence must be fixed/recorded
  before GPT can return `PASS`.

## 2026-08-02 (Update 6 — Phase 0C GPT-review fix round)

### Tool

- Claude Code (Sonnet 5)

### Session Goal

Fix the 6 findings from `docs/AI_PROMPTS/REPORT_CODEX_GPT_REVIEW_PHASE_0C_2026-08-02.md`
(`APPROVED_FOR_CLAUDE_FIX`), per the user's direct authorization. No commit, push,
or deploy this round; no Production D1 write; no schema/auth/concurrency change;
stayed within the existing Phase 0C file boundary. Handoff returns to GPT for
another review round.

### Findings addressed

1. **Incomplete `ChartFile` persisted/compared** — added an exported
   `chartFileContent(file)` in `src/lib/storage.ts` returning the full
   `{header, steps, layoutDiagram, timeMeasurement, timeStudy, machineCapacity}`
   set. `createFileCloud`/`saveFileCloud` now build the save payload from it
   instead of an ad-hoc destructure that silently dropped the 3 module fields.
2. **Save marked "Saved" without a complete comparison** — `chartContentMatches`
   in `src/store/useChartStore.ts` now spreads `chartFileContent()` (plus
   `name`/`folderId`/`updatedAt`) before comparing, so a save can only report
   `'saved'` when every field — not just header/steps/layoutDiagram — matches
   the fresh read-back.
3. **No unconfirmed/dirty contract on read-back failure or mismatch** —
   `saveActiveFile()` now sets `_unconfirmed: true` on the draft *before* the
   optimistic local update, keeps it `true` on any write failure or read-back
   mismatch, and only clears it (`_unconfirmed: false`) after a full-field
   match. `loadDatabaseFromCloud()`'s hydration merge checks `_unconfirmed`
   **before** the `updatedAt`-match check, so a coincidentally-matching
   `updatedAt` can never smuggle an unproven draft through as Cloud-confirmed;
   the draft's data is kept (`_loaded:false`), never discarded.
4. **Local-only records not visibly separated from Cloud-authoritative state**
   — `src/components/layout/Sidebar.tsx` gets a small `unsyncedBadge()` helper
   showing "local only" (`_unsynced`) or "unconfirmed" (`_unconfirmed`) next to
   the folder/file name, with a title tooltip explaining each. (The zero-row
   `409` guard added in Update 4 already prevented an `_unsynced` file's save
   from being falsely reported successful — this fix is visibility, not a new
   safety mechanism.)
5. **No regression test for Save → GET → hard refresh/reopen** — 3 new tests
   in `tests/storage.test.cjs` (complete-payload PUT body, `_unconfirmed`
   survives a matching-`updatedAt` hydration without being trusted, a 3-level
   folder tree survives hydration alongside local-only records) and 1 new test
   in `tests/store.test.cjs` (`saveActiveFile` reports `'unconfirmed'` when
   `machineCapacity` alone is dropped by the read-back).
6. **`git diff --check` failing on CRLF/trailing whitespace** — this repo has
   no `.gitattributes`; with only `core.autocrlf=true` set, the default
   `git diff --check` whitespace ruleset flags any CRLF-terminated *added*
   line regardless of the file's surrounding convention. Fixed by normalizing
   every file touched this round to pure LF and stripping trailing
   `[ \t]+$` from every line (this also caught a pre-existing whitespace-only
   blank line at `TopBar.tsx:28`, unrelated to this round's logic).

### Files changed

- `src/lib/storage.ts` — `chartFileContent()` added; `createFileCloud`/
  `saveFileCloud` use it; `loadDatabaseFromCloud`'s merge gets the
  `_unconfirmed`-first check.
- `src/store/useChartStore.ts` — `chartContentMatches` uses `chartFileContent`;
  `saveActiveFile` rewritten around the `_unconfirmed`-draft-first flow.
- `src/components/layout/Sidebar.tsx` — `unsyncedBadge()` helper + call sites
  for folders and files.
- `functions/api/files.js`, `src/components/layout/TopBar.tsx`,
  `tests/data-safety.test.cjs`, `tests/store.test.cjs` — line-ending
  normalization only (Finding 6), plus `tests/store.test.cjs` also gets the
  new test from Finding 5 and a `chartFileContent` entry added to
  `makeStorageMock()`'s default export (was missing, broke 2 existing tests
  once the store started calling the real implementation).
- `tests/storage.test.cjs` — 3 new tests (Finding 5), plus line-ending
  normalization.
- No change to `src/types/index.ts`, `functions/api/folders.js`, or
  `schema.sql` — `_unsynced`/`_unconfirmed` remain ad-hoc runtime flags
  accessed via casts, not added to the shared types, matching the existing
  Database Safety Gate convention.

### Verification

- `npx pnpm test` → **123/123 pass**.
- `npx pnpm run lint` → 5 errors / 15 warnings — same pre-existing set as
  Update 4/5 (`Sidebar.tsx:88` rules-of-hooks, `Sidebar.tsx:292` x2
  unescaped-entities, `Sidebar.tsx:408` no-explicit-any — all in the
  pre-existing Module Switcher / unrelated code, not the `unsyncedBadge`
  addition — and `TopBar.tsx:29` pre-existing `withPatchedStylesheets`
  hoisting issue); confirmed no new error was introduced.
- `npx pnpm run build` → compiles clean, TypeScript clean, 5/5 pages
  prerendered.
- `git diff --check` → **exit 0** (Finding 6 resolved).
- **Local (not Production) save → GET → reopen proof**, against the existing
  local Pages Dev D1 (`wrangler pages dev out --d1 DB=... --port 8788`,
  state reused, not reset): PUT `http://127.0.0.1:8788/api/files`
  (chart id `7ae7d46a-d3be-4339-ae55-40bd40d29a22`) with a full payload
  including `timeStudy`/`machineCapacity` markers, unique marker
  `phase0c-fixround-verify-1785676831558` → `200 {"success":true,"id":...,
  "updatedAt":"2026-08-02T13:20:31.558Z"}`; independent fresh `GET ?id=` →
  header/timeStudy/machineCapacity markers and `updatedAt` all matched;
  simulated hard-refresh/reopen via 2 further independent fetches (list `GET`
  + single `GET`, new request each time, no client-side cache reused) →
  same markers and `updatedAt` still matched. Server log confirms the exact
  sequence: `PUT /api/files 200 OK` then 3x `GET /api/files 200 OK`.
  Timestamp: 2026-08-02T13:20:31.924Z.

### Known limitation — Finding 4's browser/console portion not completed

GPT's required evidence for Finding 4 also asked for a browser-rendered
hard-refresh/reopen with recorded console output, on top of the server-side
proof above. Two independent browser-automation surfaces were attempted this
round and both failed for environment reasons unrelated to the app:

- The embedded Browser pane crashed the local `wrangler pages dev` server
  mid-load (`status: failed`, page stuck loading, `curl` afterward confirmed
  the server was unreachable) — the 5th time this exact failure has occurred
  across sessions on this project.
- Falling back to the `claude-in-chrome` surface (real Chrome), every
  `navigate` to `http://127.0.0.1:8788/editor` or `/` failed with
  `"Frame with ID 0 is showing error page"` on 3 separate attempts across 2
  URLs, while `curl` confirmed the server returned `200` immediately
  afterward each time — ruling out a server-side cause.

No workaround was found this round. The server-side PUT → GET → reopen proof
above is real and against the actual local API/D1 path the browser would also
use, but it does not include an in-browser "Saved" badge or DevTools console
check. Flagging this transparently for GPT to judge whether it's sufficient
or whether a different verification method is needed next round.

## 2026-08-02 (Update 5 — GPT Review of Phase 0C implementation)

### Tool

- Codex / GPT review

### Decision

- `APPROVED_FOR_CLAUDE_FIX` — the implementation direction is sound, but the
  Phase 0C handoff is not `PASS` and is not approved for commit, push, or deploy.
- Full review report: `docs/AI_PROMPTS/REPORT_CODEX_GPT_REVIEW_PHASE_0C_2026-08-02.md`.

### Verification

- `pnpm.cmd test`: 119/119 passed.
- `pnpm.cmd run build`: passed.
- `pnpm.cmd run lint`: the known 5 pre-existing errors remain; no new error was
  identified in the changed Phase 0C logic.
- `git diff --check`: failed on trailing CRLF markers in added lines; cleanup is
  required in the next Claude round.
- No Production write, remote D1 command, schema change, migration, deploy,
  commit, or push was performed by this review.

### Required next fixes

- Persist and compare the complete `ChartFile` payload, including
  `timeMeasurement`, `timeStudy`, and `machineCapacity`; the current save body
  still sends only `header`, `steps`, and `layoutDiagram`.
- Persist an unconfirmed/dirty marker so an ambiguous draft cannot be trusted
  during the next hydration or silently replace Cloud content.
- Keep local-only files/folders separate from the `cloudReady` authoritative
  state; `_unsynced` alone is currently not enforced by the store/UI.
- Add and evidence the full refresh/reopen sequence, then return the new diff to
  GPT before any release action.

## 2026-08-02 (Update 4 — Phase 0C Save-to-Cloud Persistence, implementation)

### Tool

- Claude Code (Sonnet 5)

### Session Goal

Implement `docs/Master_Plan.html` "Phase 0C · Save-to-Cloud Persistence and
Active-User Safety — GPT plan", per the user's direct authorization and
`docs/AI_PROMPTS/REPORT_CODEX_ACTIVE_USER_SAVE_PERSISTENCE_AUDIT_2026-08-02.md`'s
findings. No Production write, no schema/API-contract/auth/concurrency change, no
deploy — implementation and local verification only; handoff returns to GPT.

### Findings addressed (from Codex's audit)

1. **Save marked successful without Cloud read-back** — `saveActiveFile` now
   performs an independent fresh `GET /api/files?id=` after every write and
   compares the complete `header`/`steps`/`layoutDiagram`/`name`/`folderId`/
   `updatedAt` payload before ever setting `syncStatus:'saved'`.
2. **API returned success on a zero-row update** — `functions/api/files.js`'s
   `PUT` now checks D1's `meta.changes` and returns `409` with no success claim
   when nothing was actually written (a stale/local-only id).
3. **Successful hydration could prefer stale local content** (flagged
   Blocker) — `loadDatabaseFromCloud()`'s merge now only trusts a cached local
   file when its `updatedAt` still matches what Cloud just reported; otherwise
   it's reset to the lazy `_loaded:false` placeholder instead of being served
   as if confirmed. Local-only files/folders absent from Cloud's list are now
   flagged `_unsynced: true` rather than silently folded into a `cloudReady`
   result.
4. **Failed save had no explicit unconfirmed/dirty contract** — new
   `SyncStatus` value `'unconfirmed'`, used specifically when the write call
   itself reported success but the independent read-back failed or didn't
   match — distinct from `'error'` (the write itself failed).
5. **Multi-user version/conflict safety** — explicitly left untouched, per the
   Phase 0C concurrency boundary; no version column, no auth, no conflict
   handling added.

### Files Changed

- `src/lib/storage.ts` — `saveFileCloud` now takes an explicit `updatedAt` and
  returns `SaveFileResult` (`{ok:true,id,updatedAt}` / `{ok:false,error}`)
  instead of `Promise<void>`, and only reports `ok:true` when the API response
  contains an explicit `success` + `updatedAt`. `loadDatabaseFromCloud`'s merge
  logic gets the staleness/`_unsynced` fix described above.
- `src/store/useChartStore.ts` — `saveActiveFile` rewritten around the
  write-then-read-back-then-compare flow; new `chartContentMatches` helper;
  `renameFile`/`moveFile` adapted to `saveFileCloud`'s new signature (both
  already used the Phase 0B `mutateWithRollback` snapshot/restore path, now
  translating the explicit result back into a throw for that shared helper);
  `SyncStatus` gains `'unconfirmed'`.
- `functions/api/files.js` — `PUT` checks `meta.changes`, returns `409` on a
  zero-row update, returns `{success, id, updatedAt}` on a real write.
- `src/components/layout/TopBar.tsx` — one new status-text branch for
  `syncStatus === 'unconfirmed'` (`⚠ Save unconfirmed`). Nothing else touched.
- `tests/store.test.cjs` — fixed 3 existing mocks that assumed the old
  throw-based/`null`-returning contracts (would have broken as soon as any
  test exercised the new read-back path); `makeStorageMock`'s defaults for
  `loadFileFromCloud`/`saveFileCloud` now fail loudly instead of silently
  succeeding with mismatched shape when a test forgets to override them; added
  3 new tests (successful save confirmed by read-back, read-back mismatch →
  `unconfirmed`, save blocked while `cloudReady` is false).
- `tests/data-safety.test.cjs` — 2 new tests against the mock-D1 `files.js`
  handler directly: zero-row `PUT` → 409, real write → confirmed
  `id`/`updatedAt` echoed back.
- `tests/storage.test.cjs` (**new**) — `src/lib/storage.ts` tested directly
  (mocking only the global `fetch`/`localStorage`, not `@/lib/storage`
  itself), since mocking the store's storage import bypasses the exact merge/
  staleness logic this phase needed to prove: stale-local-file reset,
  matching-local-file trusted, local-only file flagged `_unsynced`, network
  failure never throws, `saveFileCloud`/`loadFileFromCloud` explicit-result
  contracts.
- `CHANGELOG_AI.md`.
- No other file touched — `functions/api/folders.js`, `schema.sql`,
  `src/types/index.ts` untouched, matching the approved Phase 0C file boundary
  exactly.

### Verification

- `npx tsc --noEmit` → clean.
- `npm.cmd test` → **119/119 pass** (106 prior + 3 store + 8 storage.test.cjs +
  2 data-safety.test.cjs, all against mocks/in-memory fixtures per the
  data-safety plan — no Production D1, local Pages Dev D1, or the external
  recovery export used as a test fixture).
- `npm.cmd run lint` → 5 errors / 7 warnings, byte-for-byte the same
  pre-existing set as every prior round (`StepTable.tsx`, `Sidebar.tsx:385`,
  `TopBar.tsx` pre-existing `withPatchedStylesheets` hoisting issue — not the
  line this session added) — confirmed by direct comparison; nothing new.
- `npm.cmd run build` → compiles clean, 5/5 pages prerendered.
- **Local (not Production) live save/read-back verification**, against the
  existing local D1 state reused as-is (never reset — same folder/chart
  created in an earlier session): started `wrangler pages dev` bound to the
  existing local D1, then via direct HTTP (curl), not the browser — this
  session's embedded browser tool has a reproducible history of crashing
  `wrangler pages dev` on a real page load; curl-only interaction has been
  100% reliable across every prior session this project —
  1. `PUT /api/files` with a uniquely identifiable marker
     (`phase0c-verify-1785673439`) in `header.processName` and a specific
     `updatedAt` → response `{"success":true,"id":"...","updatedAt":"2026-08-02T18:00:00.000Z"}`.
  2. Immediately followed by a fresh `GET /api/files?id=...` → returned
     content contained the exact marker and the exact `updatedAt` just sent,
     proving a real write-then-read-back round trip through the actual SQL
     path, not just the mocks.
  3. `PUT` to a nonexistent id → `409` with `"no chart row was updated"`, zero
     rows changed.
  - Server logs showed no errors during this sequence; local D1 folder/file
    row counts unchanged (1/1) before and after — only the one file's
    `content`/`updatedAt` changed via the legitimate `PUT` itself, which is
    expected and fine for this explicitly-disposable local test data.
  - Cleaned up: stopped every `wrangler`/`workerd` process this session
    started (including one leftover from an earlier session that was still
    running), `.wrangler/state` left completely untouched otherwise.
- **Did not run a UI/browser smoke test of the new `saveActiveFile` flow this
  round** — beyond the local API-level verification above, a full
  browser-driven check of the Save button showing `saved`/`unconfirmed`
  through a real page load carries the same crash risk documented in the
  2026-08-02 local-D1-seeding session. The `tsc`/lint/build/119-test pass
  plus the direct local API round-trip above are the verification evidence
  for this handoff; recommend a browser-based check as part of GPT review or
  the next session if a visual confirmation is specifically wanted.

### Data Safety Gate

No Production write, no schema change, no `wrangler d1 execute --remote`, no
deploy, no push. The only database mutation this session was a local-only
`PUT`/read-back against the existing, already-disposable local D1 state
(explicitly authorized for this kind of use throughout this project's Database
Safety Gate).

### Notes / Risks

- `saveActiveFile`'s content-match check (`chartContentMatches`) is a
  `JSON.stringify` comparison of the persisted fields — simple and
  deterministic for this app's actual data flow (same object shapes
  throughout), not a general deep-equal library. Flagging in case a future
  field addition needs a smarter comparison.
- The `'unconfirmed'` status only distinguishes "write succeeded but read-back
  didn't confirm it" from "write failed outright" — there's no automatic retry
  yet; the user must press Save again. Not requested in this phase's scope.
- Multi-user conflict/version safety remains explicitly out of scope, per the
  Phase 0C concurrency boundary — unchanged risk, not newly introduced.
- Not committed or pushed. Recommend returning to GPT for review before any
  live Production save/read-back verification or deployment.

## 2026-08-02 (Active-User Continuous Release Gate)

### Tool

- Codex

### Decision

- The user confirmed that this WebApp will have ongoing users while improvements continue.
- Added a mandatory rule that the current Production release remains usable while a replacement is tested.
- Added release requirements for backward-compatible UI/API/chart JSON, a retained rollback target, safe schema sequencing, fail-closed recovery, and explicit GPT/user approval for breaking changes.
- Recorded that multi-user concurrent editing is not considered safe until server-side authentication/authorization, audit identity, optimistic version checks, and conflict handling are designed and reviewed.

### Scope

- Documentation/workflow rules only. No application source, D1 schema, Production data, or deployment was changed in this session.
- Open conditions: API/schema compatibility, real server-side authorization, concurrency conflict handling, rollback verification, and an active-user smoke test remain release gates.

## 2026-08-02 (Save-to-Cloud Persistence Gate)

### Tool

- Codex

### Decision

- The user approved the six-step active-user release workflow and requested an explicit rule for preventing save-related data loss.
- A Save is successful only after the deployed API confirms the exact chart write, a fresh Cloud read-back matches the complete payload, and a refresh/reopen still shows the same data.
- Ambiguous, timed-out, or failed saves must remain unconfirmed, preserve unsaved work for retry, block unsafe overwrite, and never use empty/stale local state to replace Cloud data.

### Scope

- Updated the project context, AI workflow rules, database safety gate, deployment checklist, and Master Plan v1.14.
- No application source, D1 schema, Production data, or deployment was changed while adding this rule.
- The next active-user audit must produce evidence for save response, deployed API read-back, reopen persistence, and the exact chart/version checked.

## 2026-08-02 (Active-User Save Persistence Audit)

### Tool

- Codex

### Result

- Completed a read-only audit of the Save → `/api/files` → D1 → refresh/reopen
  path. No application, D1, Production, or deployment write was performed.
- `pnpm.cmd test` passed 106/106 and `pnpm.cmd run build` passed. Lint remains
  at the known baseline of 5 errors and 7 warnings.
- Persistence is not yet cleared: the client marks Save as Cloud-saved after
  the PUT alone, the API does not validate affected rows or return a canonical
  saved row, and hydration can prefer stale/local-only data after a successful
  Cloud read. No live save/read-back evidence was claimed because the direct
  live HTTP probe closed during receive in this environment.
- Created `docs/AI_PROMPTS/REPORT_CODEX_ACTIVE_USER_SAVE_PERSISTENCE_AUDIT_2026-08-02.md`
  with evidence, blockers, and the required GPT Master Plan scope.

### Next gate

- `NEXT_STATUS: GPT_MASTER_PLAN_REQUIRED`; Claude must not implement the
  persistence changes until GPT approves the save contract, Cloud/local
  reconciliation, recovery-export method, and verification test plan.

## 2026-08-02 (Phase 0C Save-to-Cloud Master Plan)

### Tool

- Codex/GPT

### Plan decision

- Approved the narrow Phase 0C scope: explicit API save acknowledgement,
  affected-row validation, canonical read-back, Cloud-authoritative hydration,
  explicit unconfirmed/dirty handling, and refresh/reopen verification.
- Kept schema migration, Production repair, authentication, authorization,
  audit identity, and concurrent-edit conflict handling outside this phase.
- Defined the Claude allowed-file boundary, stop conditions, test cases, live
  verification evidence, and rollback requirements in `docs/Master_Plan.html`.

### Authorization

- The user authorized the six-step workflow, including implementation after this
  GPT plan, review, retest, commit/push, deploy, and live persistence verification.
- Claude must still follow the approved file boundary and return
  `PLAN_CHANGE_REQUIRED` if the save contract requires schema/API expansion.

## 2026-08-02 (Release Gate — Phase 0B PASS and Continuous Usability)

### Tool

- Codex

### Decision

- GPT/Codex reviewed Claude's final Phase 0B fix round and returned `PASS`.
- Verified `106/106` tests, clean TypeScript/build output, no new lint errors,
  and the reported local visual smoke test with zero browser console errors.
- The user explicitly authorized commit, push, and deployment of the approved
  application version to `man-machine-chart.pages.dev`.

### Release rule added

- Local development and Production remain separate for data safety, but the
  deployed WebApp must remain usable while improvements continue.
- A safety guard may block only the unsafe operation; existing chart viewing and
  normal chart work must remain available.
- Commit `4c7dacf` was pushed to `main`; Cloudflare Pages Dashboard confirmed a
  successful Git deployment for `man-machine-chart`.
- Live verification completed at `https://man-machine-chart.pages.dev/editor`:
  the existing multi-level tree and representative charts loaded, the chart
  table rendered 24 body rows with 4 SVG graph surfaces, and the browser
  console reported zero errors.
- The direct API probe was not counted as a pass because the browser client
  blocked the `/api/*` navigation; no D1 migration, reset, seed, delete, or
  Production data write was executed.

## 2026-08-02 (Phase 0A/0B Data Safety Plan)

### Tool

- Codex

### Session Goal

Review Claude's read-only Production preflight, record the verified baseline,
and authorize a narrow runtime data-safety guard phase without touching
Production D1 or the live schema.

### Evidence Reviewed

- Status: `DATA_SAFE_READ_ONLY_COMPLETE`.
- External recovery directory:
  `D:\00_LocalFile_WebApp\ManMachineChart_Data_Backups\2026-08-02_082002\`.
- Verified 5 folder rows, 3 root folders, 6 chart-file rows, maximum folder
  nesting depth 3, zero database writes, readable JSON, and matching content
  checksums.
- Recorded live schema drift: Production `folders.parentId` exists but is not
  protected by the self-referencing foreign key declared in `schema.sql`.

### Approved Phase 0B Scope

- Fail-closed cloud hydration and an explicit cloud-unavailable state.
- No optimistic local delete/move/rename before server success; preserve local
  state on failed requests.
- Server-side folder parent existence, self-parent, and descendant-cycle checks.
- Refuse deletion of folders that still contain child folders or chart files;
  do not recursively delete or repair the live schema.
- Deny privileged structural/destructive actions until a real server-side
  account/session/approval design is separately approved. The browser Admin PIN
  is not security and must not be used as one.

### Files Added / Changed

- `docs/Master_Plan.html` → v1.10, Phase 0A result and Phase 0B scope.
- `PROJECT_CONTEXT.md` → verified data-safety baseline and phase boundary.
- `docs/AI_PROMPTS/README.md` → Phase 0B prompt order.
- `docs/AI_PROMPTS/PROMPT_CLAUDE_02A_DATA_SAFETY_RUNTIME_GUARDS.md` → exact
  Claude implementation and verification instructions.

### Explicit Non-Goals

- No `schema.sql` change or Production migration.
- No Production write, reset, seed, delete, recovery restore, deployment, or
  push.
- No authentication/session/audit implementation in this phase.

### Next Gate

Claude may use Prompt 02A only for the allowed local/runtime guard files. The
handoff must return to GPT/Codex for code review before any phase closure or
normal feature implementation.

## Standing Rules For Every AI Session

- Read `PROJECT_CONTEXT.md` and `CHANGELOG_AI.md` before starting edits.
- Inspect actual files from disk before patching.
- Do not rely on chat history alone.
- Avoid multiple AI tools editing the same file at the same time.
- If using OneDrive, wait for sync to finish before starting work.
- If a conflict copy appears, stop and compare before continuing.
- After every work session, update `CHANGELOG_AI.md`.
- If architecture, schema, deployment, workflow, or important rules change, update `PROJECT_CONTEXT.md`.

## 2026-08-02 (Update 3 — Prompt 04 fix round on GPT's Phase 0B review)

### Tool

- Claude Code (Sonnet 5)

### Session Goal

Fix the 3 findings from GPT's `APPROVED_FOR_CLAUDE_FIX` review of the Phase 0B
handoff, per `docs/AI_PROMPTS/PROMPT_CLAUDE_04_FIX_RETEST.md`. Targeted fixes only —
no redesign, no schema/Production/auth/deployment changes.

### GPT findings addressed

1. **`toggleFolder` was not cloudReady-gated.** It called `updateFolderCloud`
   unconditionally and swallowed any failure as "non-critical", so it could attempt
   a Production write while the cloud wasn't confirmed ready, and a failed write
   left the locally-toggled `expanded` state standing uncorrected.
   - Fix: while `cloudReady` is false, the toggle is now local-only (no
     `updateFolderCloud` call at all) — allowed, since expand/collapse against
     cached data is harmless for review. While `cloudReady` is true, it now goes
     through the same `mutateWithRollback` snapshot/restore path as the other
     structural actions, so a failed cloud update rolls the `expanded` flag back.
2. **`openFile`/`loadFileFromCloud` could get stuck in `syncing` forever.**
   `loadFileFromCloud` caught its own errors internally and returned `null` — the
   same bug class already fixed in `loadDatabaseFromCloud` during Phase 0B, just in
   a sibling function that phase didn't touch. `openFile`'s `try/catch` around it
   could therefore never see a real failure; on a failed load, `full` was `null`,
   the success branch was skipped, and `syncStatus` simply stayed `'syncing'`.
   - Fix: `loadFileFromCloud` now returns the same explicit `{ok:true,file}` /
     `{ok:false,error}` shape as `loadDatabaseFromCloud` (`FileLoadResult`).
     `openFile` now has a real failure branch: sets `syncStatus:'error'`, and
     deliberately leaves `files` untouched — `_loaded` stays `false` and no blank
     content is substituted, so `saveActiveFile`'s existing `_loaded===false` guard
     keeps blocking a save until a real load succeeds.
3. **No regression test proving `saveActiveFile` behaves correctly on failure.**
   The Phase 0B behavior (gate on `cloudReady`, never claim `saved` on a failed
   `saveFileCloud`) was implemented but untested.
   - Added a test creating a folder/file, editing draft content, forcing
     `saveFileCloud` to reject, and asserting `syncStatus:'error'` plus that the
     draft edits are still exactly present afterward (not reverted, not lost).

### Files Read

`PROJECT_CONTEXT.md`, `CHANGELOG_AI.md`, `docs/Master_Plan.html`, `package.json`,
`docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md`, plus the exact current content of
`src/store/useChartStore.ts` and `src/lib/storage.ts` (its only caller, confirmed by
grep — no other file uses `loadFileFromCloud`).

### Files Changed

- `src/lib/storage.ts` — `loadFileFromCloud` return type.
- `src/store/useChartStore.ts` — `toggleFolder`, `openFile`.
- `tests/store.test.cjs` — 5 new tests (2 for `toggleFolder`, 2 for `openFile`
  success/failure, 1 for `saveActiveFile` failure).
- `CHANGELOG_AI.md`.
- No other file touched.

### Commands / Results

- `npx tsc --noEmit` → clean.
- `npm.cmd test` → **106/106 pass** (101 from Phase 0B + 5 new).
- `npm.cmd run lint` → 5 errors / 7 warnings, byte-for-byte the same pre-existing
  set as the Phase 0B baseline (`StepTable.tsx`, `Sidebar.tsx:385` Module Switcher,
  `TopBar.tsx`, plus `.wrangler/tmp/**` build scratch noise) — nothing from the 3
  files this round touched appears in the list.
- `npm.cmd run build` → compiles clean, 5/5 pages prerendered.
- **Local smoke test** on `next dev` (still no Functions API there, so this is a
  real cloud-unavailable run, not a simulation): seeded one folder + one chart into
  `localStorage`, clicked the folder's expand/collapse arrow — toggled and persisted
  locally (`expanded: false` confirmed directly in `localStorage`), UI updated
  (▾ → ▸, children hidden), re-expanded successfully, opened the chart (renders
  fully — Module 4, step table, layout diagram). `read_console_messages`
  (errors only) was clean through every step. Cleared the seeded `localStorage`
  afterward.

### Pre-existing vs new failures

No new test/lint/build failures. The 12 lint problems present before this round are
identical after it, confirmed by direct comparison.

### Scope change discovered

None. All 3 fixes stayed within `src/lib/storage.ts`, `src/store/useChartStore.ts`,
and `tests/store.test.cjs` — the same file set Phase 0B already touched.

### Database Safety Gate

No database command was run this session (no `wrangler d1`/`wrangler pages`
invocation at all). `.wrangler/state` mtime is unchanged from before this task.
No Production write, schema change, deploy, or push.

### Notes / Risks

- Same remaining risks as Phase 0B: no real server-side authentication yet, and
  Production's `folders.parentId` FK drift is unresolved (compensated for at the
  API layer only). Neither is in scope for this fix round.
- Not committed or pushed. Recommend returning to GPT for another review pass
  before any phase closure.

## 2026-08-02 (Update 2 — Phase 0B Runtime Data-Safety Guards)

### Tool

- Claude Code (Sonnet 5)

### Session Goal

Implement `docs/Master_Plan.html` "Phase 0B · Runtime Data-Safety Guards — approved
scope" per `docs/AI_PROMPTS/PROMPT_CLAUDE_02A_DATA_SAFETY_RUNTIME_GUARDS.md`: make the
runtime fail safely when cloud persistence is unavailable or a structural operation
could damage the folder/chart hierarchy. No Production writes, schema change, or
deployment — implementation only, handoff returns to GPT for review.

### Completed

- **`src/lib/storage.ts`**: `loadDatabaseFromCloud()` now returns an explicit
  `CloudLoadResult` (`{ok:true, db}` or `{ok:false, error, fallback}`) instead of
  silently catching its own failure and returning a local database indistinguishable
  from a real cloud read. Also dropped an `any` cast this touched directly (now
  `ChartFile & {_loaded?: boolean}`).
- **`src/store/useChartStore.ts`**:
  - New `cloudReady: boolean` state, true only after a confirmed cloud hydration.
    `hydrated` still flips true on failure too (so the loading spinner clears and
    cached data can be reviewed), but `cloudReady` stays false and `syncStatus`
    becomes `'error'` instead of the previous `'idle'`.
  - New `mutateWithRollback()` helper: snapshots folders/files/activeFileId before a
    structural change, applies it optimistically, and restores the exact
    pre-mutation snapshot if the paired cloud call rejects — instead of leaving an
    unconfirmed local-only change standing in for what the user believes was saved.
    Applied to `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`,
    `createFile`, `renameFile`, `moveFile`, `deleteFile`, `duplicateFile` — all 9
    now also refuse to run at all while `cloudReady` is false.
  - `saveActiveFile()` gated the same way; also fixed the pre-existing bug where the
    idle-status timeout fired even after a failed save, silently clearing the error.
  - Dropped the `useChartStore.ts:387` `any` cast this touched directly.
- **`functions/api/folders.js`**:
  - `GET`: removed the hidden self-healing `ALTER TABLE ... ADD COLUMN parentId` —
    a GET handler must not perform a schema write. Now selects named columns (not
    `SELECT *`), so a database missing the column fails loudly with a clear
    `409 schema-unavailable` response instead of silently omitting the field or
    self-healing.
  - `POST`/`PUT`: `parentId` must be `null` or reference an existing folder row.
    `PUT` additionally rejects a folder becoming its own parent and rejects moving a
    folder into its own descendant, via a new bounded (max 100 hops) parent-chain
    walk — bounded so a corrupt/cyclic chain already in the database can't hang the
    request.
  - `DELETE`: now refuses to delete a folder that still has child folders or chart
    files (`409`, zero rows deleted), because live Production has no
    self-referencing FK on `folders.parentId` (confirmed via the Phase 0A preflight)
    — nothing at the database level would stop a delete from silently orphaning
    everything underneath. No recursive delete or cascade repair added.
- **`functions/api/files.js`**: found and fixed a real pre-existing bug while
  implementing this: `moveFile` in the store has always sent `folderId` in the `PUT`
  body, but the handler destructured only `{id, name, updatedAt, content}` and
  silently dropped it — every "move chart to another folder" action was reporting
  `success: true` without ever actually persisting the move. `folderId` is now
  accepted and applied via the same `COALESCE` pattern as the other fields, and
  validated to reference an existing folder (`POST` too).
- **`src/components/layout/Sidebar.tsx`**: removed `ADMIN_PIN` / `requireAdminPin` —
  a client-side `window.prompt()` compared to a value shipped in the JS bundle
  looked like security but never was one. Delete (folder + chart) and move
  (folder + chart) now show a clear "not available until server-side authorization
  ships" message and perform no mutation; the underlying `moveFolder`/`moveFile`/
  `deleteFolder`/`deleteFile` store actions are no longer imported here since
  nothing in this component calls them anymore. Added a small amber banner at the
  top of the folder tree when `cloudReady` is false. Create and rename remain
  available (protected by the new cloudReady gate + rollback, not additionally
  denied — they're not destructive or a hierarchy change).

### Files Added / Changed

- `src/lib/storage.ts`, `src/store/useChartStore.ts`
- `functions/api/folders.js`, `functions/api/files.js`
- `src/components/layout/Sidebar.tsx`
- `tests/store.test.cjs` (extended), `tests/data-safety.test.cjs` (new)
- `CHANGELOG_AI.md`
- No other file touched. No Production writes, no schema/migration, no deploy, no push.

### Verification

- `npx tsc --noEmit` → clean.
- `npm test` → **101/101 pass** (baseline 83 + 5 new store-level tests + 13 new
  `tests/data-safety.test.cjs` tests covering: cloud-failure state, blocked actions
  while not ready, failed-delete/failed-move rollback, a synthetic multi-level tree
  surviving hydration, folder parent/self-parent/descendant-cycle rejection
  (including a corrupt-cycle-in-the-database case, to prove the walk is bounded),
  non-empty-folder deletion refusal (child-folder case and chart-file case, each
  independently), a genuinely-empty folder still deletes, the `GET` schema-unavailable
  path, and the `files.js` `folderId` move-regression fix). All new tests use an
  in-memory mock D1 / mock storage module — no Production D1, local Pages Dev D1, or
  the external recovery export was used as a fixture.
- `npx eslint .` → 5 errors / 7 warnings, all **pre-existing and unrelated**
  (`StepTable.tsx` hooks-order + unescaped entities, `Sidebar.tsx:385`
  `setActiveModule(m as any)` in the unrelated Module Switcher, `TopBar.tsx`
  hooks-order/immutability) — confirmed by re-running lint before any edit in this
  session. The `storage.ts:51` and `useChartStore.ts:387` `any` casts flagged in the
  2026-08-01 read-only audit are now gone, as a direct side effect of typing the
  exact lines this session's rewrite touched. `.wrangler/tmp/**` also shows up in a
  whole-project lint pass (pre-existing build scratch files, not source, not touched).
- `npm run build` → compiles clean, 5/5 pages prerendered.
- **Local smoke test** on `next dev` (port 3456, no Cloudflare Functions there — this
  naturally exercises the cloud-unavailable path without needing to break anything):
  seeded one folder + one chart into `localStorage` only, reloaded, and confirmed in
  the real rendered DOM: the amber "⚠ Cloud unavailable" banner appears in the
  sidebar; the existing `TopBar` already shows "⚠ Sync Error" from `syncStatus`
  without any `TopBar.tsx` change; clicking "Delete folder" shows the denial message
  and `localStorage` still has 1 folder afterward; attempting "New Root Folder"
  silently does not add a folder (blocked by `cloudReady`) with no console error;
  opening the existing chart still fully renders (Module 4, step table, layout
  diagram) — "the chart can still be reviewed" holds. `read_console_messages`
  (errors only) was clean through every step. Cleared the seeded `localStorage`
  afterward. Did not touch `.wrangler/` or local D1 state at any point (confirmed:
  `.wrangler/state` mtime unchanged from before this session).

### Notes / Risks

- **Confirmed no Production writes, no schema/migration, no deploy, no push** —
  this session only ran read-only `git status`/`rg --files` against the repo and
  local `node --test`/`eslint`/`next build`/`next dev`; no `wrangler d1`/`wrangler
  pages` command was run at all in this task.
- Pre-existing lint errors in `StepTable.tsx`, `Sidebar.tsx` (Module Switcher), and
  `TopBar.tsx` were left untouched — out of the approved Phase 0B file list.
- **Remaining risk — authentication**: delete/move are now honestly *denied*, not
  fake-secured, but there is still no real account/session/approval system. That is
  explicitly out of scope for Phase 0B per the Master Plan and needs its own
  GPT-reviewed plan before implementation.
- **Remaining risk — live schema drift**: Production `folders.parentId` still has no
  self-referencing foreign key (confirmed live via the Phase 0A `sqlite_master`
  export). The new folder DELETE guard compensates for this at the API layer, but
  the underlying drift between `schema.sql` and the real Production schema is
  unresolved and untouched, per the explicit non-goal in this phase.
- Did not add a per-action error toast for the "create blocked while cloud isn't
  ready" case beyond the top-of-sidebar banner — kept to "minimum related UI state"
  per the allowed-files note; happy to add one if GPT/the user wants louder
  per-action feedback.
- Not committed or pushed. Recommend returning this to GPT/Codex for review
  (`PROMPT_GPT_03_REVIEW_CLAUDE_HANDOFF.md`) before the phase is marked closed in
  `docs/Master_Plan.html`.

## 2026-08-02 (Data Safety Gate)

### Tool

- Codex

### Session Goal

Prevent a repeat of the Local D1 confusion where the local `.wrangler/` database
was recreated with one sample folder/chart while the real Production D1 still
contained the user's existing four-level folder tree.

### Completed

- Added the canonical `docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md`.
- Added `PROMPT_CLAUDE_01A_DATABASE_SAFETY_PREFLIGHT_READ_ONLY.md` for the next
  Claude session: identify environments, inventory Production read-only, create
  and verify an external recovery export, and stop before any code/database write.
- Updated `PROJECT_CONTEXT.md`, `docs/Master_Plan.html` v1.9,
  `docs/Deployment_Checklist.md`, `.gitignore`, and all workflow prompts with:
  - Production D1 as the real source of truth;
  - Local Pages Dev, localhost/localStorage, and `.wrangler/` as separate test/cache state;
  - preservation of every folder `parentId` relationship, the existing four-level tree,
    chart files, and chart content;
  - no reset/seed/delete/migration/remote write without explicit authorization and a
    verified recovery export outside the repository;
  - pre/post counts, tree, IDs, and content checksums as a release gate;
  - fail-closed behavior when cloud loading fails.
- User verified that the real Production tree and existing data are still present.

### Files Changed

- `PROJECT_CONTEXT.md`
- `CHANGELOG_AI.md`
- `.gitignore`
- `docs/Master_Plan.html`
- `docs/Deployment_Checklist.md`
- `docs/AI_PROMPTS/README.md`
- `docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md`
- `docs/AI_PROMPTS/PROMPT_CLAUDE_00_START_HERE_READ_ONLY.md`
- `docs/AI_PROMPTS/PROMPT_CLAUDE_01A_DATABASE_SAFETY_PREFLIGHT_READ_ONLY.md`
- `docs/AI_PROMPTS/PROMPT_GPT_01_PROJECT_AUDIT_AND_MASTER_PLAN.md`
- `docs/AI_PROMPTS/PROMPT_CLAUDE_02_IMPLEMENT_APPROVED_PLAN.md`
- `docs/AI_PROMPTS/PROMPT_GPT_03_REVIEW_CLAUDE_HANDOFF.md`
- `docs/AI_PROMPTS/PROMPT_CLAUDE_04_FIX_RETEST.md`

### Verification

- `npm.cmd test` → **83/83 passed**.
- `npm.cmd run build` → compiled successfully; all 5 static pages generated.
- `Master_Plan.html` tag-balance check → **PASS**.
- `git diff --check` for the documentation/config changes → no errors. The
  existing `StepTable.tsx` CRLF/trailing-whitespace warnings remain from the
  prior Claude implementation and were not touched in this documentation task.

### Notes / Risks

- No application source code or database was changed in this session.
- The external recovery export has not yet been created; it is the next
  read-only Claude preflight and must be verified before data-related coding.
- `.wrangler/` remains local-only and must not be committed.

## 2026-08-02

### Tool

- Claude Code (Sonnet 5)

### Session Goal

Implement the "Chart readability requirement" GPT/Codex approved in `docs/Master_Plan.html` v1.8
(section `#security-capacity-gate`): the Start → End column was eating space until it pushed the
Timeline Visualization graph out of view, so the step table and the graph could not be used
together. Scope authorized via `docs/AI_PROMPTS/PROMPT_CLAUDE_02_IMPLEMENT_APPROVED_PLAN.md`,
limited to that layout problem only — no other module touched.

### Completed

- **`src/components/editor/StepTable.tsx`**:
  - **Start → End column is now collapsible**, off by default (`showStartEnd` state) — its numbers
    already print on the bar ends via `TimelineRow`'s `showTimes`, so hiding it by default frees
    the space instead of duplicating information. New toolbar button `🕐 Show/Hide Start→End`.
  - Fixed a real colgroup bug: the column had no `<col>` entry at all (auto-sized, unbounded,
    header/body count mismatched the `<colgroup>`). It now has an explicit `w-24` (96px) `<col>`
    in both table modes, only rendered when shown, with header/body/footer/empty-state cell counts
    kept in sync (verified by hand for all 4 combinations of `hideInputs` × `showStartEnd`).
  - **Timeline width is now computed from actual available space** instead of the old hardcoded
    `600` / `1200`. Measured via `containerRef` + `useLayoutEffect` (synchronous
    `getBoundingClientRect` read on mount, so the graph is sized correctly on first paint) with a
    `ResizeObserver` layered on top for live updates on later resizes/sidebar toggles. Clamped to
    `[480, 1800]px` so the graph never shrinks below readable or grows absurdly wide.
  - The `<table>` needed an **explicit pixel width** (`fixedColsWidth + timelineWidth`) for
    `table-layout: fixed` to actually honour every `<col>`'s declared width — found this the hard
    way in verification (see Notes/Risks): removing the old `w-full` class without replacing it
    let the browser shrink columns toward content instead, silently invalidating the whole
    available-space calculation.

### Files Added / Changed

- `src/components/editor/StepTable.tsx`
- `CHANGELOG_AI.md`
- No other module, business-rule, schema, API, or dependency file touched.

### Verification

- `npx tsc --noEmit` → clean.
- `npx eslint src/components/editor/StepTable.tsx` → 3 problems, all **pre-existing** (unchanged
  from the read-only audit dated 2026-08-01: 2× `react/no-unescaped-entities` on the "No steps yet"
  string, 1× `react-hooks/rules-of-hooks` on `handleChange`'s `useCallback` sitting after the
  `if (!activeFile) return null` guard). New hooks added this session were placed before that guard
  and introduced zero new lint errors.
- `npm test` → 83/83 pass, no regressions.
- `npm run build` → compiles clean, 5/5 pages prerendered.
- **Manual verification on the real dev server** (port 3456) with seed data matching the project's
  standard BYD Side Step fixture (10 steps, Worker A + Auto M/C), measured via DOM/computed-width
  inspection rather than a pixel screenshot (the screenshot tool could not composite a frame in
  this session — see Notes/Risks):
  - 1920px viewport, compact mode (`hideInputs=true`), Start→End hidden: timeline computed to
    918px, table 1524px inside a 1545px container → **`needsHorizontalScroll: false`** — table and
    graph fit together with no scrolling, the actual goal of this task.
  - Same width, Start→End toggled on: column renders at exactly 96px, timeline reflows to 822px,
    **still `needsHorizontalScroll: false`**.
  - 1440px and 1024px viewports: fixed columns alone (1170px in expanded / 604px in compact mode)
    can exceed the available container width; timeline correctly clamps to the 480px floor and the
    existing `overflow-x-auto` scroll takes over — expected, graceful degradation, not a regression
    (the approved requirement is specifically about the Start→End area, not a guarantee that the
    full 13-column input view never scrolls).
  - Empty-file state (`0` steps) renders "No steps yet…" with the corrected `colSpan` in all 4
    `hideInputs`×`showStartEnd` combinations, no console warnings.
  - `read_console_messages` (errors only) clean across every reload/resize/toggle in this session.
  - Cleared the seeded `mm_chart_db_v2` localStorage test data afterward.

### Notes / Risks

- **Tooling limitation, not a code defect**: `computer{action:"screenshot"}` failed every attempt
  this session ("the Browser pane is not displayed, so the page is not compositing frames"). While
  debugging why the timeline stayed at its static fallback width, a manually-created
  `ResizeObserver` on the same element also never delivered even its guaranteed *initial* callback
  — strong evidence that this specific preview pane suspends rendering-pipeline-tied callbacks when
  not visually composited. `window.innerWidth` and `getBoundingClientRect()` (pure layout, not
  paint) worked fine throughout, which is why the fix uses a synchronous `useLayoutEffect` read for
  the value that matters on first paint, with `ResizeObserver` purely as a live-update layer on top.
  **The live-resize path (dragging the window, or toggling the sidebar without a reload) could not
  be empirically exercised in this session** — verified instead by reloading at each target width,
  which re-runs the synchronous measurement. `ResizeObserver` is a standard, widely-supported API;
  there is no reason to expect it to misbehave for a real user in a normally-rendering browser tab,
  but this specific code path does not have direct proof from this session the way the others do.
- Did not touch the 3 pre-existing ESLint errors (unescaped entities, hooks-order) — flagged in the
  2026-08-01 read-only audit, out of scope for this task per the authorized scope.
- Did not update `docs/Master_Plan.html`. Per
  `docs/AI_PROMPTS/README.md`'s role split, GPT/Codex owns that document; this session only had
  user + in-prompt authorization to implement the already-approved chart-readability item, not to
  close the phase. Recommend routing this CHANGELOG entry back through the GPT review step
  (`PROMPT_GPT_03_REVIEW_CLAUDE_HANDOFF.md`) before `docs/Master_Plan.html` is updated.
- Not committed or pushed — the user's authorization this session covered implementation only.

## 2026-08-01

### Tool

- Codex

### Session Goal

Convert the Claude read-only onboarding report into the next Master Plan gate.

### Completed

- Reviewed `docs/AI_PROMPTS/REPORT_CLAUDE_00_READ_ONLY_ONBOARDING_2026-08-01.md`.
- Updated `docs/Master_Plan.html` to version 1.8 with the approved planning inputs:
  - two shifts; 720 gross minutes per shift, minus 60 lunch and 20 pre-OT = 640 net minutes per shift;
  - 1,280 net minutes / 76,800 seconds for two shifts per day;
  - in-app account authentication and server-side authorization, independent of company IT;
  - approval and audit requirements for destructive or structural changes;
  - Combination Table wrap boundary `max(Cycle Time, Takt Time)`.
  - chart readability requirement: Start -> End must remain compact/collapsible and must not hide the timeline graph; Claude must perform real visual smoke testing before handoff.

### Files Changed

- `docs/Master_Plan.html`
- `docs/AI_PROMPTS/PROMPT_CLAUDE_02_IMPLEMENT_APPROVED_PLAN.md`
- `CHANGELOG_AI.md`

### Notes / Risks

- No application source, schema, API, dependency, or deployment files were changed.
- Coding remains blocked until the security bootstrap/admin design and the revised Master Plan are explicitly approved by the user.

## 2026-07-08

### Tool

- Codex

### Session Goal

Create a safe shared project memory system for multi-device and multi-AI-tool work.

### Completed

- Inspected the root project structure and the main `mm-chart-app` structure.
- Checked whether `PROJECT_CONTEXT.md` and `CHANGELOG_AI.md` already existed.
- Confirmed both files were absent at the project root.
- Created `PROJECT_CONTEXT.md` as the canonical shared context file for this project.
- Created `CHANGELOG_AI.md` as the canonical AI session log.
- Documented project purpose, tech stack, important files, folder structure, current features, API/data sources, business rules, run/test instructions, working rules, multi-device workflow, multi-AI workflow, OneDrive/Git conflict rules, high-risk files, known risks, and suggested improvements.
- Added required safety rules for Codex, Claude Code, Antigravity, and other AI tools.

### Files Added / Changed

- Added `PROJECT_CONTEXT.md`
- Added `CHANGELOG_AI.md`

### Tests / Checks Run

- `rg --files`
- `Test-Path PROJECT_CONTEXT.md; Test-Path CHANGELOG_AI.md`
- Read key files:
  - `package.json`
  - `mm-chart-app/package.json`
  - `mm-chart-app/README.md`
  - `mm-chart-app/schema.sql`
  - `mm-chart-app/wrangler.toml`
  - `mm-chart-app/src/lib/chart-utils.ts`
  - `mm-chart-app/src/lib/storage.ts`
  - `mm-chart-app/src/store/useChartStore.ts`
  - `mm-chart-app/src/types/index.ts`
  - `mm-chart-app/tests/chart-utils.test.cjs`
  - `Codex_Multi_Device_Blueprint.md`

### Notes / Risks

- The root directory did not respond as a normal git repository to `git status`, even though a `.git` folder is visible.
- `mm-chart-app` appears to be the main runnable app; root-level `src` and config files look like a secondary copy.
- Several existing files contain mojibake/encoding-corrupted comments or older text. This session did not rewrite them.
- OneDrive/machine-specific files exist, including `*-Alex_PREDATOR.*` and `~$Sample.xlsx`; inspect before deleting or merging.

### Next Step

- On the next AI-assisted code change, start by reading `PROJECT_CONTEXT.md` and this changelog.
- If changing app behavior, update or add tests under `mm-chart-app/tests`.
- If changing schema, deployment, persistence, or cycle-time business logic, update `PROJECT_CONTEXT.md` in the same session.

## 2026-07-17

### Tool

- Antigravity

### Session Goal

Expand layout width, implement unlimited nested folders (4-layer structure), and add Admin PIN authorization for deleting and moving files/folders.

### Completed

- Updated `schema.sql` to add `parentId` to `folders` table (self-referencing FK).
- Updated Cloudflare API (`functions/api/folders.js`) POST/PUT to support `parentId`.
- Updated `ChartFolder` type and `useChartStore` to include `moveFolder` and `moveFile` actions.
- Completely rewrote `Sidebar.tsx` to recursively render folder trees.
- Added `move` capability for files and folders inside the Sidebar.
- Added an Admin PIN prompt (`window.prompt` checked against `NEXT_PUBLIC_ADMIN_PIN`) before any folder/file is deleted or moved to prevent unauthorized structural changes.
- Expanded `page.tsx` editor layout by removing `max-w-[1500px]` limit to `w-full`.
- Verified TypeScript builds successfully.

### Files Added / Changed

- `mm-chart-app/src/app/editor/page.tsx`
- `mm-chart-app/schema.sql`
- `mm-chart-app/functions/api/folders.js`
- `mm-chart-app/src/types/index.ts`
- `mm-chart-app/src/store/useChartStore.ts`
- `mm-chart-app/src/components/layout/Sidebar.tsx`

### Notes / Risks

- D1 database schema was updated locally in `schema.sql`. Note that when deploying this to Cloudflare, an `ALTER TABLE folders ADD COLUMN parentId TEXT DEFAULT NULL;` migration must be run manually or via Wrangler on the production database.
- Admin PIN is currently client-side and relies on a hardcoded or environment variable check. This is adequate for a basic utility app to prevent accidental edits by general users but is not a full-security authentication system.

## 2026-07-17 (Update 2)

### Tool

- Antigravity

### Session Goal

Refine UI styling for the sidebar, step table, and main layout based on user feedback.

### Completed

- `Sidebar.tsx`: Changed folder icons and text colors to be level-based (Yellow Factory for PD, Green Gears for Dept, Blue Box for Model, Clipboard for File) instead of process-type based.
- `StepTable.tsx`: Added a color-coded left border tab (orange, blue, green, purple) to clearly group rows by Operator (Worker A, B, C, D, Auto M/C).
- `page.tsx`: Expanded the Workstation Layout Diagram to be full-width and moved the Line Total Summary table directly below it.

### Files Added / Changed

- `mm-chart-app/src/components/layout/Sidebar.tsx`
- `mm-chart-app/src/components/editor/StepTable.tsx`
- `mm-chart-app/src/app/editor/page.tsx`

### Next Step

- Push to GitHub for Cloudflare Pages deployment.

## 2026-07-17 (Update 3)

### Tool

- Antigravity

### Session Goal

Increase the width and height of the Workstation Layout Diagram canvas.

### Completed

- `LayoutDiagram.tsx`: Changed SVG and grid rect fixed widths (`CANVAS_W = 680`) to `100%` so the canvas dynamically expands to fill the entire container.
- Increased the SVG rendered height to `600px` for more drawing room.
- Expanded the logical coordinate bounds to 2000x1000 pixels so dragged items don't hit the clamp boundary too early.

### Files Added / Changed

- `mm-chart-app/src/components/layout-diagram/LayoutDiagram.tsx`

## 2026-07-17 (Update 4)

### Tool

- Antigravity

### Session Goal

Finalize the full Light Theme migration across all editor components (StepTable, SummaryTable, LayoutDiagram) to match the Modern Light theme provided in the project slide deck. Update project documentation.

### Completed

- `StepTable.tsx`: Replaced dark background colors (slate-900/800) with white/slate-50. Updated inputs and SVG timeline lines to use lighter borders (slate-200/300) and text colors (slate-800).
- `SummaryTable.tsx`: Transitioned the main totals table to Light Theme, swapping dark headers with light backgrounds and dark text.
- `LayoutDiagram.tsx`: Updated the Workstation Layout diagram SVG container, palette, grid lines, and property panels to the Light Theme. Adjusted empty states and helper text to match the new color scheme.

### Files Added / Changed

- `mm-chart-app/src/components/editor/StepTable.tsx`
- `mm-chart-app/src/components/editor/SummaryTable.tsx`
- `mm-chart-app/src/components/layout-diagram/LayoutDiagram.tsx`
- `CHANGELOG_AI.md`

### Next Step

- Diagnose any reported issues with data saving or sync status.

## 2026-07-18

### Tool

- Antigravity

### Session Goal

Recover "disappeared" user charts from browser local storage, fix database schema mismatch causing folder nesting level regression on production, and implement guards to prevent future data overwrites.

### Completed

- **Database Recovery Forensics**: 
  - Explored Chrome LevelDB binary files (`.ldb`) and extracted historical records containing `mm_chart_db_v2`.
  - Recovered `Side Step LH, RH` (10 steps) from `localhost:3001` local storage state.
  - Confirmed the 4 "disappeared" files (`5F00_Facestep_#2_R00`, `Coverouter581D`, `Inner RH Rev.01 เจ้แป๋ม B`, `Inner LH Rev.01 เจ้ก้อยB`) had empty steps in all local history records, indicating they were either never saved or worked on from a different device.
- **Production D1 Schema Migration**:
  - Modified `functions/api/folders.js` (`onRequestGet`) to run a self-healing schema migration (`ALTER TABLE folders ADD COLUMN parentId TEXT DEFAULT NULL`) to add the missing `parentId` column to the production D1 database.
  - Verified that the migration successfully executed in production and the folders API now returns folder nesting details.
- **Data Protection & Overwrite Prevention**:
  - `storage.ts`: Rewrote `loadDatabaseFromCloud` to merge fetched folders/files metadata with locally-saved store files (preserving steps/layouts of already loaded local files) and keeping unsynced local files.
  - `useChartStore.ts`: Guarded `saveActiveFile()` to block saves if the file has not finished lazy loading (`_loaded === false`), preventing client-side overwrite of cloud database rows with empty step arrays.
- **Verification**:
  - Run the local build check using `npm run build` and verified that compiling and page pre-rendering succeeds with zero errors.
  - Committed and pushed changes to GitHub branch `main`, triggering automated deployment on Cloudflare Pages.

### Files Added / Changed

- `mm-chart-app/functions/api/folders.js`
- `mm-chart-app/src/lib/storage.ts`
- `mm-chart-app/src/store/useChartStore.ts`
- `Deploymen_checklist.md`
- `PROJECT_CONTEXT.md`
- `CHANGELOG_AI.md`

### Next Step

- Monitor user usage and check if any git merge conflict issues occur.

## 2026-07-19

### Tool

- Antigravity

### Session Goal

Synchronize root-level src directory and config files with the latest mm-chart-app codebase (16 files) and initialize/commit them to the root Git repository to ensure consistent codebase alignment.

### Completed

- **Root Codebase Synchronization**:
  - Compared root-level `src` folder with `mm-chart-app/src` and verified exactly 16 files were different (root-level files were obsolete copies from July 7th).
  - Copied all latest code from `mm-chart-app/src` and `mm-chart-app/functions` to the root folder.
  - Copied `package.json`, `tsconfig.json`, `postcss.config.mjs`, `next.config.ts`, `schema.sql`, `wrangler.toml`, `tailwind.config.ts`, and `.gitignore` to the root folder.
- **Git Cleanup**:
  - Removed the mistakenly created `.git` folder at the root directory per user instruction.
  - Confirmed that all code modifications (15+ files) are already safely committed and pushed to the main `mm-chart-app` GitHub repository (latest commit hash: `1dd314b`).

### Files Added / Changed

- `src/` (16 source files updated)
- `functions/` (api functions updated)
- `.gitignore` (updated)
- `package.json` (updated)
- `tsconfig.json` (updated)
- `postcss.config.mjs` (updated)
- `next.config.ts` (updated)
- `schema.sql` (updated)
- `wrangler.toml` (updated)
- `tailwind.config.ts` (updated)
- `CHANGELOG_AI.md` (updated)

### Next Step

- Await user verification of the synced workspace and clean Git status.

## 2026-07-31

### Tool

- Claude Code (Opus 5)

### Session Goal

Sidebar "Project Files" tree แสดงชื่อโฟลเดอร์/ชื่อไฟล์ไม่เต็ม (ถูกตัดด้วย `truncate` เป็น `...`)
ทำให้ผู้ใช้อ่านรายละเอียดชื่อไม่ครบ — ต้องการให้ชี้เมาส์แล้วเด้ง tooltip ชื่อเต็ม

### Completed

- `Sidebar.tsx`: เพิ่ม state `nameTip` + helper `showNameTip()` / `hideNameTip()` สำหรับ tooltip ชื่อเต็ม
  - เด้งเฉพาะเมื่อชื่อถูกตัดจริง (ตรวจด้วย `scrollWidth > clientWidth`) — ชื่อสั้นที่แสดงครบอยู่แล้วจะไม่เด้ง
  - ใช้ `position: fixed` + พิกัดจาก `getBoundingClientRect()` เพื่อไม่ให้ tooltip ถูก sidebar
    (`overflow-hidden` / `overflow-y-auto`) ตัดขอบ
  - พลิกไปแสดงด้านบนอัตโนมัติเมื่อรายการอยู่ใกล้ขอบล่างจอ
  - ซ่อน tooltip เมื่อ scroll tree (`onScroll={hideNameTip}`) กัน tooltip ค้างผิดตำแหน่ง
- ผูก `onMouseEnter` / `onMouseLeave` เข้ากับทั้งชื่อโฟลเดอร์และชื่อไฟล์ chart

### Files Added / Changed

- `src/components/layout/Sidebar.tsx`
- `CHANGELOG_AI.md`
- `PROJECT_CONTEXT.md` (แก้ path ให้ตรงความจริง: ไม่มีโฟลเดอร์ `mm-chart-app` แล้ว)

### Verification

- รัน dev server (port 3456) แล้วทดสอบบน DOM จริง:
  - ชื่อยาว (โฟลเดอร์ + ไฟล์ ทั้งภาษาไทย/อังกฤษ) → tooltip เด้งพร้อมข้อความเต็ม, ออกจากชื่อ → tooltip หาย
  - ชื่อสั้น (`Short.01`) → ไม่เด้ง ตามที่ออกแบบไว้
- `npx tsc --noEmit` ผ่าน (ไม่มี error)
- `npx eslint src/components/layout/Sidebar.tsx` → เหลือเฉพาะ error เดิมที่มีอยู่ก่อนแล้ว (`setActiveModule(m as any)`) ไม่ใช่โค้ดที่แก้รอบนี้
- `npm run build` ผ่าน (Compiled successfully, prerender 5/5 หน้า)

### Notes / Risks

- **โครงสร้าง repo เปลี่ยนไปจากที่ PROJECT_CONTEXT.md เดิมระบุ**: ไม่มีโฟลเดอร์ `mm-chart-app` แล้ว
  ตัวแอปจริงอยู่ที่ root ของ repo (`src/`, `functions/`, `tests/`) — แก้ PROJECT_CONTEXT.md ให้ตรงแล้ว
- ยังมีไฟล์ `*-Alex_PREDATOR.*` ค้างที่ root (eslint.config, next-env.d, package, tsconfig)
  ตามกติกาความปลอดภัยไม่ได้ลบหรือ merge ให้ — รอผู้ใช้ตัดสินใจ
- `npm run lint` ทั้งโปรเจกต์ยัง fail อยู่จาก error เดิม (ส่วนใหญ่มาจาก `_Backup_scratch_OneDriveMigration_20260719/`
  และ `tests/*.cjs` ที่ใช้ `require()`) — ไม่เกี่ยวกับงานรอบนี้ แต่ควรใส่ ignore ให้ eslint ในอนาคต
- localStorage ของ `localhost:3456` ถูกใช้ seed ข้อมูลทดสอบชั่วคราวระหว่างตรวจงาน และล้างออกแล้ว

## 2026-07-31 (Update 2)

### Tool

- Claude Code (Opus 5)

### Session Goal

จัดระเบียบโครงสร้างโฟลเดอร์ที่ root ของ repo และตั้งชื่อไฟล์/โฟลเดอร์ให้สื่อความหมาย
เพื่อให้ค้นหาและใช้งานง่ายขึ้น (root เดิมมี 35 รายการ ปนกันทั้งไฟล์ config, เอกสาร, ไฟล์ซ้ำ, ไฟล์ตาย)

### Completed

- **ลบไฟล์ซ้ำ/ไฟล์ตาย** (ผู้ใช้อนุมัติ — ยังกู้คืนได้จาก git history ที่ commit `976203f`):
  - `eslint.config-Alex_PREDATOR.mjs`, `next-env.d-Alex_PREDATOR.ts`,
    `package-Alex_PREDATOR.json`, `tsconfig-Alex_PREDATOR.json`
    (diff แล้ว = สำเนาเก่าของ config ตัวจริง ต่างกันแค่การจัดรูปแบบ/บรรทัดเดียว ไม่มีเนื้อหาใหม่)
  - `setup.ps1` — ใช้ไม่ได้แล้ว ชี้ไปที่ `G:\My Drive\Antigravity\...\mm-chart-app`
    ซึ่งทั้ง path และโฟลเดอร์ `mm-chart-app` ไม่มีอยู่จริงแล้ว
- **สร้าง `docs/` รวมเอกสารโปรเจกต์** (ใช้ `git mv` เพื่อรักษา history):
  - `Deploymen_checklist.md` → `docs/Deployment_Checklist.md` (แก้ typo ในชื่อไฟล์ด้วย)
  - `user_manual.html` → `docs/User_Manual.html`
  - `Codex_Multi_Device_Blueprint.md` → `docs/Codex_Multi_Device_Blueprint.md`
- **เปลี่ยนชื่อโฟลเดอร์เอกสารอ้างอิง**: `Doc.Support_Standardized_Work/` → `Docs_StandardWork_Reference/`
  (คงไว้ที่ root ตามที่ผู้ใช้เลือก เพราะเปิดใช้จาก File Explorer บ่อย)
- **`eslint.config.mjs`**: เพิ่ม ignore `_Backup_scratch_OneDriveMigration_20260719/**`
  และ `tests/**/*.cjs` — โฟลเดอร์ backup ไม่ใช่ source code และ test ใช้ `require()` โดยตั้งใจ
- **`.gitignore`**: commit บรรทัด ignore โฟลเดอร์ backup ที่ค้างมาจาก session ก่อน
- **`PROJECT_CONTEXT.md`**: อัปเดตให้ตรงโครงสร้างจริงทั้งไฟล์
  - ลบ prefix `mm-chart-app/` ที่ไม่มีอยู่จริงออกจากทุก path (Important Files / High-Risk Files / Tech Stack / Deployment)
  - เขียนหัวข้อ Important Files และ Folder Structure ใหม่ พร้อมกติกาว่าอะไรต้องอยู่ root อะไรย้ายเข้า `docs/`
  - ลบอ้างอิงไฟล์ที่ไม่มีแล้ว (`Sample.xlsx`) และอัปเดต Known Risks

### Files Added / Changed

- ลบ: `eslint.config-Alex_PREDATOR.mjs`, `next-env.d-Alex_PREDATOR.ts`, `package-Alex_PREDATOR.json`,
  `tsconfig-Alex_PREDATOR.json`, `setup.ps1`
- ย้าย/เปลี่ยนชื่อ: `docs/*` (3 ไฟล์), `Docs_StandardWork_Reference/*` (4 ไฟล์)
- แก้ไข: `eslint.config.mjs`, `.gitignore`, `PROJECT_CONTEXT.md`, `CHANGELOG_AI.md`

### Verification

- `npm run build` ผ่าน (Compiled successfully, prerender 5/5 หน้า)
- `npm test` ผ่าน 23/23 tests
- `npm run lint`: ปัญหาลดจาก 77 (61 errors) → 11 (7 errors) เพราะ backup folder และ tests
  ไม่ถูก lint แล้ว — error ที่เหลือทั้งหมดเป็นของเดิมใน source (`StepTable.tsx`, `TopBar.tsx`,
  `storage.ts`, `useChartStore.ts`, `Sidebar.tsx`) ไม่ได้เกิดจากการจัดโฟลเดอร์รอบนี้
- ไม่มีโค้ดไฟล์ไหนอ้างถึงเอกสารที่ย้าย (ตรวจด้วย grep ก่อนย้าย) — มีแต่ไฟล์ .md ที่อ้างถึงกันเอง

### Notes / Risks

- ไฟล์ที่ต้องอยู่ root ต่อไปเพราะ framework/tool บังคับ: `src/`, `public/`, `functions/`, `tests/`,
  config ทั้งหมด, `schema.sql`, `wrangler.toml` และ `PROJECT_CONTEXT.md` / `CHANGELOG_AI.md`
  (AI workflow prompt อ่านสองไฟล์นี้ที่ root)
- โฟลเดอร์ที่ยังเห็นใน File Explorer แต่ไม่ได้อยู่ใน git (ignored ทั้งหมด, ลบทิ้งได้ถ้าอยากให้โล่ง):
  `.next/`, `out/`, `node_modules/`, `_Backup_scratch_OneDriveMigration_20260719/`, `tsconfig.tsbuildinfo`
- error ของ eslint ที่เหลือ 7 ข้อยังไม่ได้แก้ ถือเป็นงานแยกรอบ (โดยเฉพาะ
  `StepTable.tsx` ที่เรียก `useCallback` แบบมีเงื่อนไข = ผิดกติกา React Hooks จริง ควรแก้)

## 2026-07-31 (Update 3)

### Tool

- Claude Code (Opus 5)

### Session Goal

อ่าน blueprint PDF และไฟล์ Excel ต้นฉบับอย่างละเอียด เพื่อตรวจสอบว่า Module M1-M5 ตรงกับเอกสารจริงหรือไม่
แล้วจัดทำแผนแม่บท (Master Plan) เป็น HTML ให้ผู้ใช้อนุมัติ — **รอบนี้ยังไม่แก้โค้ดแอป**

### Completed

- **อ่าน `Antigravity_WebApp_Development_Blueprint_(2).pdf` ครบ 13 หน้า**
  - PDF เป็นสไลด์แบบรูปภาพ ไม่มี text layer และเครื่องนี้ไม่มี poppler/python
  - เขียน Node script แปลง image XObject (FlateDecode + PNG predictor 15) เป็นไฟล์ PNG โดยห่อ deflate stream
    เข้า IDAT chunk ตรงๆ แล้วอ่านทีละหน้า (script อยู่ใน scratchpad ไม่ได้ commit)
- **แกะสูตรจาก Excel** (unzip xlsx แล้วอ่าน sheet XML ด้วย Node)
  - `3 TEN SET Line SUV_Rev.01.xlsx` (32 ชีต) และ `แบบฟอร์มตารางจับเวลา 1.xlsx` (6 ชีต)
  - ชีต `JOB_C CAP_1`: `Min=MIN(C:G)`, `Max=MAX(C:G)`, `Aver=AVERAGE(C:G)`,
    `TOTAL=SUM(C8:C44)-C25` → **ยอดรวมหักแถวเครื่องจักรออก**
  - ชีต `Machine Capacity Sheet`: `Completion Time = SUM(Basic Time:Auto Time)`
  - ชีต `std.com table`: คอลัมน์ คน/เครื่อง/เดิน + เวลาสะสม `=H11+G11+E11`
  - ชีต `kaizen`: มีบล็อก BEFORE/AFTER + Problem + มาตรการ + ผู้รับผิดชอบ จริง
  - มีชีต `MIFC 1`, `MIFC 2` (Material & Information Flow Chart) อยู่แล้ว
- **ยืนยันว่า M1 ตีความผิดจริง**: สไลด์วาดเป็น iPad ปุ่ม LAP แต่ชื่อโมดูลคือ "ตารางจับเวลา"
  และฟอร์ม Excel เป็นตาราง key-in → นาฬิกาจับเวลาไม่ควรอยู่ใน WebApp
- **วิเคราะห์ M3 vs M4 ตามหลัก TPS**: M3 = แกนเวลา (Standardized Work Combination Table),
  M4 = แกนพื้นที่ (Standardized Work Chart) → **ไม่ควรยุบรวม** เป็นเอกสารคนละใบในระบบ TPS
  ผลคือ kaizen ไม่ต้องเบียดเข้า M5 แต่แยกเป็น M6
- **สร้าง `docs/Master_Plan.html`** — แผนแม่บท 13 หัวข้อ: วิสัยทัศน์ / หลักการ TPS / M3-M4 /
  สถานะโมดูล / สถาปัตยกรรมข้อมูล / สูตรมาตรฐาน / Kaizen loop + Before-After /
  Roadmap 8 เฟส / TPS Activity 4M / กติกาการทำงาน / Decision log / คำถามค้าง / Change log
- **`PROJECT_CONTEXT.md`**: เพิ่ม Master_Plan.html เข้า Important Files + Folder Structure
  และเพิ่มกติกา 2 ข้อ (Master Plan update rule, M1 เป็นตารางไม่ใช่นาฬิกา)

### Files Added / Changed

- `docs/Master_Plan.html` (ใหม่)
- `PROJECT_CONTEXT.md`
- `CHANGELOG_AI.md`
- ไม่มีการแก้ไฟล์โค้ดแอปในรอบนี้

### Verification

- เปิด `docs/Master_Plan.html` ใน browser จริง ตรวจ DOM: section ครบ 13 หัวข้อ,
  ลิงก์สารบัญไม่มีอันไหนเสีย (0 broken anchors), badge ทุกอันมี class ถูกต้อง,
  ไม่มี horizontal overflow ทั้งจอ desktop (1280px) และ mobile (375px),
  ตารางทุกอันอยู่ใน container ที่ scroll แนวนอนได้

### Notes / Risks

- **กติกาใหม่จากผู้ใช้**: อัปเดต `docs/Master_Plan.html` ได้ก็ต่อเมื่อโค้ดผ่านการทดสอบจริงแล้วเท่านั้น
  (build + test + เปิดหน้าจอจริงไม่มี error) ห้ามอัปเดตแผนจากโค้ดที่ยังไม่ได้ทดสอบ
- **คำถามค้างที่ต้องได้คำตอบก่อนเริ่ม Phase 2**: สูตร `=39*8.66` ในชีต Machine Capacity
  ยังไม่ทราบที่มาของเลข 39 และ 8.66 และยังไม่ทราบเวลาทำงาน 1 กะ (หักพักแล้ว) ของโรงงาน
- ในระบบนี้ไม่มี skill ของ Toyota Production System ติดตั้งอยู่ (ตามที่ผู้ใช้ขอให้ใช้)
  จึงวิเคราะห์ด้วยความรู้ TPS ตรงๆ แทน
- M4 ไม่ถูกแตะต้องตามคำสั่งผู้ใช้ — งานเสริมเลื่อนไป Phase 6

## 2026-07-31 (Update 4) — Phase 1

### Tool

- Claude Code (Opus 5)

### Session Goal

Phase 1 ตาม Master Plan: เปลี่ยน Module 1 จากนาฬิกาจับเวลาเป็น **ตาราง key-in** ตามฟอร์ม
Time Measurement Sheet และเชื่อมข้อมูลกับ M4 ทั้งสองทาง เพื่อให้เห็นความสัมพันธ์ของตัวเลขข้ามโมดูล

### Completed

- **`src/types/index.ts`**: เพิ่ม `TimeStudy`, `TimeStudyRow`, `TimeStudyKind`, `TimeStudyRowStats`
  และ field `timeStudy?` ใน `ChartFile` — คง `timeMeasurement` (laps) ไว้เพื่อ backward compatibility
- **`src/lib/time-study.ts` (ใหม่)**: logic ทั้งหมดของ M1
  - `computeRowStats` = MIN / MAX / AVERAGE / Fluctuation ตามสูตร Excel (ช่องว่างถูกข้าม)
  - `computeTotals` = `=SUM(column)-<แถวเครื่อง>` — เวลาเครื่องไม่ถูกนับเป็นภาระคน
  - `computeOperatorTotals` = สรุปรายคน แยกเครื่องออกเป็น Auto M/C
  - `timeStudyFromSteps` / `stepsFromTimeStudy` = สะพานแปลงข้อมูลกับ M4
    **ผ่าน `getCalculatedSteps` เสมอ** เพราะ M4 เก็บ "เวลาหยุด" ส่วน M1 เก็บ "ระยะเวลา"
  - `parsePastedGrid` = รองรับวางบล็อกจาก Excel (tab/newline)
- **`src/store/useChartStore.ts`**: เพิ่ม `updateTimeStudy`, `importTimeStudyFromSteps`,
  `pushTimeStudyToSteps(basis)` — push จะคำนวณ cycleTime ใหม่ให้ด้วย
- **`src/components/modules/Module1_TimeMeasurement.tsx`**: เขียนใหม่ทั้งไฟล์
  - ตาราง: Seq · Job Element · Worker (A–J / Auto M/C) · ประเภท (คน/เครื่อง/เดิน/รอ) ·
    1st–10th · Min · Max · Fluc · Aver
  - แถวเครื่องจักรไฮไลต์เหลืองอัตโนมัติและไม่ถูกนับใน TOTAL
  - เพิ่ม/ลบ/เลื่อนแถวได้ไม่จำกัด · สลับจำนวนรอบ 5/10 · วางจาก Excel ได้ (ขยายแถวอัตโนมัติ)
  - ปุ่ม "ดึงข้อมูลจาก M4" และ "ส่งข้อมูลไป M2–M5" พร้อมกล่องยืนยันที่ระบุจำนวนแถวที่จะถูกเขียนทับ
  - แผงสรุปรายคนสำหรับทวนสอบตัวเลขข้ามโมดูล
- **แก้บั๊ก `Module5_YamazumiChart.tsx`**: เดิมบวก `manualTime + walkingTime + idleTime` ซึ่งเป็น
  **เวลาหยุด** ไม่ใช่ระยะเวลา ทำให้แท่งสูงเกินจริง (Worker B ขึ้น 53s ทั้งที่ M1/M4 ได้ 33s)
  เปลี่ยนไปใช้ `getCalculatedSteps` แล้วตัวเลขตรงกับ M1 และ M4
- **`TopBar.tsx`**: เปลี่ยนป้ายแท็บ "1: Lapping" → "1: Time Sheet" ให้ตรงกับของจริง
- **`tests/time-study.test.cjs` (ใหม่)**: 15 เทสต์ ทวนสอบกับตัวเลขจริงจากไฟล์ Excel
- **`tests/store.test.cjs`**: เพิ่ม module mapping ให้ `@/lib/time-study`
- **`docs/Master_Plan.html`**: อัปเดตเป็น v1.1 — สถานะโมดูล, Roadmap Phase 1, Decision Log, Change Log

### Files Added / Changed

- ใหม่: `src/lib/time-study.ts`, `tests/time-study.test.cjs`
- แก้: `src/types/index.ts`, `src/store/useChartStore.ts`,
  `src/components/modules/Module1_TimeMeasurement.tsx`,
  `src/components/modules/Module5_YamazumiChart.tsx`,
  `src/components/layout/TopBar.tsx`, `tests/store.test.cjs`,
  `docs/Master_Plan.html`, `CHANGELOG_AI.md`

### Verification

- `npm test` → **37/37 ผ่าน** (เดิม 22 + ใหม่ 15) รวมเทสต์เทียบกับตัวเลขจริงในชีต JOB_C CAP_1:
  แถว "เดินไปที่ rack" Min 1.50 / Max 2.00 / Aver 1.73 และแถวเครื่อง 46.99 / 48.72 / 47.83
- `npx tsc --noEmit` ไม่มี error · `npm run build` ผ่าน
- `npx eslint` บนไฟล์ที่แก้: ไม่มี error ใหม่ (เหลือเฉพาะของเดิมใน TopBar และ `any` เดิมใน store)
- **ทดสอบบนเบราว์เซอร์จริง** ด้วยข้อมูลจำลอง BYD Side step (6 step, 2 คน + 1 เครื่อง):
  - ดึงจาก M4 → ได้ระยะเวลา 12 / 4 / 14 / 48 / 20 / 13 ถูกต้อง (แปลงจากเวลาหยุด 12/16/30/48/20/33)
  - ประเภทถูกจำแนกเอง: คน / เดิน / เครื่อง
  - TOTAL = 63.00 ตัดแถวเครื่อง 48s ออก — ตรงกับ Line Total ใน M4
  - กรอกรอบที่ 2 → Min/Max/Fluc/Aver อัปเดตทันที (12/14/2/13)
  - วางบล็อก 2×3 จาก Excel → ลงถูกช่อง TOTAL เปลี่ยนเป็น Min 63.00 / Max 67.50 / Aver 65.48
  - ส่งไป M2–M5 → step กลับมาเป็นเวลาหยุดชุดเดิมเป๊ะ cycle time 48s
  - M4 หลัง push: man 59 / walk 4 / line total 63 / CT 48 เท่าเดิมทุกตัว
  - M5 หลังแก้บั๊ก: Worker A 30s · Worker B 33s ตรงกับ M1 และ M4
  - ไฟล์เก่าที่มีแต่ `laps` และไม่มี `timeStudy` → เปิดได้ปกติ ไม่ crash ข้อมูลเดิมยังอยู่ครบ
  - console ไม่มี error
- ล้างข้อมูลทดสอบใน localStorage ของ localhost:3456 แล้ว

### Notes / Risks

- ปุ่ม "ส่งข้อมูลไป M2–M5" **เขียนทับ step ทั้งหมดใน M4** จึงมีกล่องยืนยันที่ระบุจำนวนแถวเสมอ
  ยังเป็นแบบกดเอง (manual push) ตามที่ตกลงไว้ ส่วน auto-sync อยู่ในแผนระยะถัดไป
- ค่าที่ส่งต่อใช้ **Min** เป็นเวลามาตรฐานตาม blueprint (`stepsFromTimeStudy` รองรับ average/max แล้ว
  แต่ยังไม่เปิดให้เลือกบน UI)
- M2 และ M3 ยังเป็นหน้าว่าง — ปุ่มส่งข้อมูลจึงมีผลกับ M4/M5 ก่อน
- **ยังต้องรอคำตอบก่อนเริ่ม Phase 2**: เลข 39 และ 8.66 ในสูตร `=39*8.66` ของชีต Machine Capacity
  และเวลาทำงาน 1 กะ (หักพักแล้ว) ของโรงงาน

## 2026-08-01 — Deploy Phase 1 ขึ้น production

### Tool

- Claude Code (Opus 5)

### Session Goal

ผู้ใช้แจ้งว่าเว็บจริงยังเป็นหน้าเดิม (นาฬิกาจับเวลา) ทั้งที่ Phase 1 เสร็จและ push แล้ว — หาสาเหตุและแก้

### Completed

- **หาสาเหตุ**: ไม่ใช่แคชเบราว์เซอร์ และไม่ใช่ build ค้าง
  - ยืนยันโค้ดขึ้น GitHub แล้ว (`git ls-remote origin` → `main = da9d8e0`)
  - ดึงไฟล์ JS ที่ production เสิร์ฟจริงมาตรวจ: เจอข้อความ `Continuous Lapping UI` (โค้ดเก่า)
    ไม่เจอ `Time Sheet` เลย และชื่อไฟล์บันเดิลไม่เปลี่ยนตลอด 13 ชั่วโมง
  - สรุป: **Cloudflare Pages ไม่ได้ auto-deploy จาก GitHub** ไม่มี deployment ใหม่เกิดขึ้นเลย
- **Deploy เอง** (ผู้ใช้อนุมัติ): `npm run build` แล้ว
  `npx wrangler pages deploy out --project-name=man-machine-chart --branch=main --commit-dirty=true`
  → อัปโหลด 55 ไฟล์ สำเร็จ
- **บันทึกกติกาใหม่**: เพิ่มหัวข้อ deploy ใน `docs/Master_Plan.html` และ `PROJECT_CONTEXT.md`
  ว่า git push อย่างเดียวไม่พอ ต้องสั่ง deploy เองและตรวจเว็บจริงซ้ำทุกครั้ง

### Files Added / Changed

- `docs/Master_Plan.html` (เพิ่มหัวข้อ Deploy ในกติกาการทำงาน)
- `PROJECT_CONTEXT.md` (เพิ่มกฎ deployment เป็น manual)
- `CHANGELOG_AI.md`
- ไม่มีการแก้โค้ดแอปในรอบนี้

### Verification

- ตรวจ production หลัง deploy: บันเดิลเก่าหายหมด (`old: []`) เหลือแต่ `0vw67_zsttwh5.js` ที่มีโค้ดใหม่
- เปิด https://man-machine-chart.pages.dev/editor แล้วเปิดไฟล์ BYDSidestep Rev.00 จาก D1 จริง:
  - แท็บเปลี่ยนเป็น **1: Time Sheet** แล้ว
  - หัวตารางครบ: Seq · Job Element · Worker · ประเภท · 1st–10th · Min. · Max. · Fluc. · Aver.
  - ปุ่ม "ดึงข้อมูลจาก M4" และ "ส่งข้อมูลไป M2–M5" แสดงครบ
  - ไม่มีร่องรอยนาฬิกาจับเวลาเหลืออยู่

### Notes / Risks

- **ยังไม่ได้แก้ที่ต้นเหตุ** — Git integration ของ Cloudflare Pages ยังไม่ทำงาน ต้องเข้า Dashboard
  ไปดูว่าไม่ได้ผูก repo ไว้ หรือ build ล้มเหลว จนกว่าจะแก้ ทุกครั้งที่จบงานต้อง deploy เอง
- wrangler เตือนว่า `wrangler.toml` ไม่มีฟิลด์ `pages_build_output_dir` — ยังไม่ได้เพิ่มให้
  เพราะอยู่นอกขอบเขตที่ขอ ถ้าเพิ่มจะสั่ง deploy ได้สั้นลงและไม่มี warning
- `curl` บนเครื่องนี้ fail ด้วย TLS revocation error (`CRYPT_E_NO_REVOCATION_CHECK`)
  ทำให้สคริปต์ polling ที่ใช้ curl รายงานผลเชื่อไม่ได้ — ให้ตรวจผ่าน browser tool แทน

## 2026-08-01 (Update 2)

### Tool

- Claude Code (Opus 5)

### Session Goal

เพิ่มปุ่ม Insert แทรกแถวใน M1 ให้เหมือน M4 · เอาโลโก้ Antigravity ออก ·
และยกระดับกฎ deploy ให้เป็นขั้นตอนบังคับใน checklist ท้าย session

### Completed

- **`Module1_TimeMeasurement.tsx`**: เพิ่มคอลัมน์ **Insert** พร้อมปุ่ม `+▲` / `+▼`
  (หน้าตาและตำแหน่งเดียวกับ M4)
  - `insertRow(index, 'above' | 'below')` แทรกแถวเปล่าแล้ว renumber Seq ใหม่ทั้งตาราง
  - แถวใหม่รับค่า Worker จากแถวข้างเคียง เพื่อลดการคลิกเวลากรอกงานของคนเดิมติดกันยาวๆ
  - แก้ `colSpan` ของ empty state (`readingCount + 9` → `+10`) และของแถว TOTAL (`4` → `5`)
    ให้ตรงกับจำนวนคอลัมน์ที่เพิ่มขึ้น
- **`TopBar.tsx`**: ลบบล็อกโลโก้ "A / Antigravity / Full System" ออกจากแถบบนสุด
  และเอาเส้นคั่น `border-l` ของ breadcrumb ออกเพราะกลายเป็นอิลิเมนต์แรกแล้ว
- **`PROJECT_CONTEXT.md`**: เขียนหัวข้อ Important Working Rules ใหม่ เพิ่ม
  **Mandatory end-of-session checklist 6 ขั้น** โดยใส่ **Deploy เป็นขั้นที่ 3**
  และ "ทวนสอบตัวเลขข้ามโมดูล" เป็นขั้นที่ 2 พร้อมเหตุผลว่าทำไมข้ามไม่ได้
  รวมถึงบันทึกว่า `curl` บนเครื่องนี้ fail TLS revocation จึงห้ามใช้ตรวจ deploy
- **`docs/Master_Plan.html` → v1.2**: เพิ่ม Deploy เข้าไปในลำดับกติกา (จาก 6 ขั้นเป็น 8 ขั้น)
  พร้อมกล่องเตือนว่างานที่ commit แต่ไม่ deploy จะดูเหมือนไม่มีอะไรเกิดขึ้น

### Files Added / Changed

- `src/components/modules/Module1_TimeMeasurement.tsx`
- `src/components/layout/TopBar.tsx`
- `PROJECT_CONTEXT.md`
- `docs/Master_Plan.html`
- `CHANGELOG_AI.md`

### Verification

- `npm test` → 37/37 ผ่าน · `npx tsc --noEmit` ไม่มี error · `npm run build` ผ่าน
- `npx eslint` ไฟล์ที่แก้: ไม่มี error ใหม่ (เหลือของเดิมใน TopBar เรื่อง `withPatchedStylesheets`)
- **ทดสอบบน dev server จริง**:
  - แทรกแถวด้านบนแถวที่ 2 → แถวเปล่าเข้าที่ตำแหน่ง 2 และ Seq เรียงใหม่เป็น 1-4 ถูกต้อง
  - แทรกด้านล่างแถวสุดท้าย → ได้แถวที่ 5 ถูกต้อง
  - แถวใหม่รับ Worker จากแถวข้างเคียงตามที่ออกแบบ
  - TOTAL ยังคำนวณถูกหลังแทรก: 216.00 (65 + 151, ตัดแถวเครื่อง 450 ออก)
  - โลโก้หายจาก header แล้ว (header เริ่มด้วยชื่อไฟล์)
  - console ไม่มี error
- **Deploy ขึ้น production แล้ว** (`wrangler pages deploy` อัปโหลด 55 ไฟล์) และเปิดเว็บจริงตรวจซ้ำ:
  โลโก้หายไปแล้ว และหัวตาราง M1 มีคอลัมน์ `Insert` ขึ้นจริง
- ตรวจ `Master_Plan.html` ด้วย tag-balance checker: 0 unclosed, 0 mismatch, 13 sections
- ล้างข้อมูลทดสอบใน localStorage แล้ว

### Notes / Risks

- ยังเหลือคำว่า "Antigravity" อีก 2 จุดที่ **ไม่ได้แตะ** เพราะผู้ใช้ระบุเฉพาะโลโก้:
  ข้อความตอนโหลด `Loading Antigravity System…` (`src/app/editor/page.tsx:31`)
  และบรรทัดใต้ชื่อโมดูล `ANTIGRAVITY FULL SYSTEM` (`src/app/editor/page.tsx:77`)
- ต้นเหตุ Cloudflare auto-deploy ยังไม่ได้แก้ ต้องเข้า Dashboard ตรวจ Git integration

## 2026-08-01 (Update 3) — Phase 2

### Tool

- Claude Code (Opus 5)

### Session Goal

Phase 2: สร้าง Module 2 ใบแสดงความสามารถของเครื่องจักร · เปลี่ยนชื่อแอปเป็น
"Machine-Chart Man-STD-Operation" · เอาคำว่า Antigravity ออกทุกจุด

### Completed

- **`src/lib/machine-capacity.ts` (ใหม่)**: สูตรมาตรฐาน TPS
  - `netShiftSeconds` = (เวลาต่อกะ − เวลาพัก) × 60 · ค่าตั้งต้น 540 − 80 = 460 นาที = 27,600 วินาที
  - `computeCapacityRow`: Completion = Manual + Auto ·
    Tool change ต่อชิ้น = เวลาเปลี่ยน ÷ จำนวนชิ้นต่อครั้ง ·
    **Capacity = เวลาทำงานสุทธิ ÷ (Completion + Tool change ต่อชิ้น)**
  - `computeCapacitySummary`: หาคอขวด (ค่าต่ำสุด) · Takt Time = เวลาสุทธิ ÷ ยอดที่ต้องผลิต ·
    % ภาระ · ธง shortfall เมื่อผลิตไม่ทัน
  - `machineCapacityFromTimeStudy`: ดึงแถวเครื่องจักรจาก M1 มาเป็นกระบวนการ (Auto Time = ค่า Min)
- **`Module2_MachineCapacity.tsx` (ใหม่)**: ตารางตามฟอร์ม Excel (หัวตาราง 2 ชั้น Basic Time /
  Tool Change) · ตั้งค่าเวลากะและยอดที่ต้องผลิต · แถวคอขวดไฮไลต์แดง ·
  Donut แสดง % ภาระ · Bottleneck Alert · ปุ่มดึงข้อมูลจาก M1
- **`useChartStore.ts`**: เพิ่ม `updateMachineCapacity`, `importMachineCapacityFromTimeStudy`
- **`types/index.ts`**: เพิ่ม `MachineCapacity`, `MachineCapacityRow` และ field `machineCapacity?`
- **`editor/page.tsx`**: ต่อ M2 เข้าหน้าจอ (placeholder เหลือแค่ M3) และเอาบรรทัด
  "Antigravity Full System" ใต้ชื่อโมดูลออก · เปลี่ยนข้อความตอนโหลดเป็น "กำลังโหลดระบบ…"
- **`TopBar.tsx`**: ใส่ชื่อแอป **Machine-Chart Man-STD-Operation** ที่มุมซ้ายบน
- **`tests/machine-capacity.test.cjs` (ใหม่)**: 15 เทสต์

### Files Added / Changed

- ใหม่: `src/lib/machine-capacity.ts`, `src/components/modules/Module2_MachineCapacity.tsx`,
  `tests/machine-capacity.test.cjs`
- แก้: `src/types/index.ts`, `src/store/useChartStore.ts`, `src/app/editor/page.tsx`,
  `src/components/layout/TopBar.tsx`, `tests/store.test.cjs`,
  `docs/Master_Plan.html` (v1.3), `CHANGELOG_AI.md`

### Verification

- `npm test` → **52/52 ผ่าน** (เดิม 37 + M2 15) · `npx tsc --noEmit` ไม่มี error · `npm run build` ผ่าน
- `npx eslint` ไฟล์ใหม่/ที่แก้: ไม่มี error ใหม่
- **ทดสอบบน dev server จริง**:
  - ดึงจาก M1 → ได้ 2 เครื่อง Blow molding (Auto 46.99 = ค่า Min) และ Crusher (60.00)
  - ใส่ Manual 4.13 → Completion **51.12** ถูกต้อง
  - Tool change 300 วิ ต่อ 100 ชิ้น → **3.00** วิ/ชิ้น → Capacity **509.98** ชิ้น/กะ
    (27,600 ÷ 54.12) ถูกต้อง
  - Crusher Capacity **460.00** (27,600 ÷ 60) เป็นคอขวด ไฮไลต์แดงถูกต้อง
  - ใส่ยอดที่ต้องผลิต 500 → Takt **55.20** วิ/ชิ้น และแจ้งเตือน "ขาดอีก 40 ชิ้น" ถูกต้อง
  - console ไม่มี error
- **Deploy ขึ้น production แล้ว** และเปิดเว็บจริงตรวจซ้ำ: ชื่อแอปใหม่ขึ้นแล้ว ·
  ไม่มีคำว่า Antigravity เหลือ · M2 แสดงผลครบ · เวลาทำงานสุทธิ 460 นาที
- ตรวจ `Master_Plan.html`: 0 unclosed, 0 mismatch, v1.3

### Notes / Risks

- **สูตร `=39*8.66` ในไฟล์ Excel ไม่ถูกนำมาใช้** — ให้ผล 337.74 ซึ่งไม่สอดคล้องกับ
  Completion Time 50.67 วินาทีในแถวเดียวกันไม่ว่าจะแทนเวลากะแบบใด ผู้ใช้ยืนยันให้ใช้
  สูตรมาตรฐาน TPS แทน
- **ค่าตั้งต้นเวลาต่อกะ 540 นาที เป็นสมมติฐาน** ผู้ใช้ระบุแค่เวลาพัก 80 นาที
  (เที่ยง 60 + ก่อน OT 20) ถ้ากะจริงไม่ใช่ 540 นาที แก้ได้ที่ช่อง "เวลาต่อกะ" ในหน้า M2
- Manual Time ตอนดึงจาก M1 ตั้งเป็น 0 เสมอ เพราะตารางจับเวลาไม่ได้ระบุว่างานของคนคนไหน
  ผูกกับเครื่องไหน — ต้องกรอกเอง

## 2026-08-01 (Update 4) — Phase 3

### Tool

- Claude Code (Opus 5)

### Session Goal

Phase 3: สร้าง Module 3 ตารางงานมาตรฐานผสม (Standardized Work Combination Table)
วาดกราฟแกนเวลาจากข้อมูล M1 พร้อม Rule 1/2/3 ตาม blueprint

### Completed

- **`src/lib/combination-table.ts` (ใหม่)**: โมเดลเวลาและกฎการวาด
  - **โมเดลเวลา**: คนแต่ละคนมีนาฬิกาของตัวเอง งานของคนเดินต่อกันบนนาฬิกานั้น ·
    เครื่องเริ่มนับเมื่อ**งานก่อนหน้าจบ** (คือคนโหลดเสร็จ) แล้วทำงานขนานไป
    **ไม่ดันนาฬิกาของคน** เพราะคนเดินไปทำงานอื่นต่อได้ — ความขนานตรงนี้คือหัวใจของกราฟ
    (ตรงกับสูตร `=H11+G11+E11` ในชีต std.com table)
  - **Rule 1**: `segmentsFor()` ตัดแถบที่เกิน Takt แล้ววนกลับไปเริ่มที่ 0
  - **Rule 2**: คำนวณเวลารอถึง Takt รายคน และธง `overTakt` เมื่อเกิน
  - **Rule 3**: เครื่องหลายตัวอยู่คนละแถวอยู่แล้ว · cycle ของ Auto M/C ใช้ค่า**สูงสุด**
    ไม่ใช่ผลรวม เพราะเครื่องแต่ละตัวไม่ได้ต่อคิวกัน
  - `axisTicks()`: หาช่วงสเกลกลมๆ และจบที่ค่าที่ครอบคลุมช่วงเสมอ
- **`Module3_CombinationTable.tsx` (ใหม่)**: กราฟ SVG
  - เส้นทึบ = คน · เส้นประ = เครื่อง · เส้นคลื่น = เดิน (วาดด้วย quadratic path)
  - เส้นแดง Takt + ป้าย T.T. · เส้นน้ำเงิน Cycle + ป้าย C.T.
  - สัญลักษณ์ ↩ ตรงจุดที่แถบวนกลับ · การ์ดสรุปเวลารอ/เกิน Takt รายคน
  - Takt ดึงจาก M2 อัตโนมัติ (เวลาสุทธิ ÷ ยอดที่ต้องผลิต) กรอกทับเองได้ และกดกลับไปใช้ค่า M2 ได้
  - ถ้ายังไม่มีข้อมูลใน M1 จะขึ้นข้อความบอกให้ไปกรอกที่ M1 ก่อน
- **`editor/page.tsx`**: ต่อ M3 เข้าหน้าจอ — **ตอนนี้ไม่มีหน้า placeholder 🚧 เหลือแล้ว**
- **`tests/combination-table.test.cjs` (ใหม่)**: 17 เทสต์

### Files Added / Changed

- ใหม่: `src/lib/combination-table.ts`, `src/components/modules/Module3_CombinationTable.tsx`,
  `tests/combination-table.test.cjs`
- แก้: `src/app/editor/page.tsx`, `docs/Master_Plan.html` (v1.4), `CHANGELOG_AI.md`

### Verification

- `npm test` → **69/69 ผ่าน** (เดิม 52 + M3 17) · `npx tsc --noEmit` ไม่มี error ·
  `npx eslint` ไฟล์ใหม่: **ไม่มี error หรือ warning เลย** · `npm run build` ผ่าน
- **ทดสอบบน dev server จริง** ด้วยข้อมูล 6 งาน (2 คน + 1 เครื่อง):
  - Takt 460.00 วิ ดึงจาก M2 อัตโนมัติถูกต้อง (27,600 ÷ 60)
  - Worker A = 235.00 วิ (65 + 150 + 20) · Worker B = 255.00 วิ (235 + 20) ·
    Auto M/C = 385.00 วิ → Cycle Time = 385.00 ถูกต้อง
  - เวลารอ: Worker A 225.00 · Worker B 205.00 ถูกต้อง
  - **ทดสอบ Rule 1**: ปรับ Takt เป็น 300 → สถานะเปลี่ยนเป็น "เกิน Takt" ·
    มีสัญลักษณ์วนกลับ 1 จุด (แถบเครื่องจบที่ 450 > 300) ·
    ป้าย "เกิน Takt 85.00 วิ" ของ Auto M/C ถูกต้อง (385 − 300)
  - **ทดสอบ Rule 2**: เวลารอปรับเป็น 65.00 / 45.00 ถูกต้อง (300 − 235 / 300 − 255)
  - ปุ่ม "ใช้ค่าจาก M2" กลับไปเป็น 460.00 ถูกต้อง
  - เส้น T.T. และ C.T. ถูกวาดใน SVG · console ไม่มี error
- **Deploy ขึ้น production แล้ว** และเปิดเว็บจริงตรวจซ้ำ: M3 แสดงผล ไม่มี placeholder เหลือ
- ตรวจ `Master_Plan.html`: 0 unclosed, 0 mismatch, v1.4

### Notes / Risks

- โมเดล "เครื่องเริ่มเมื่องานก่อนหน้าจบ" ตั้งอยู่บนสมมติฐานว่า**ลำดับแถวใน M1 คือลำดับการทำงานจริง**
  ถ้าเรียงแถวสลับ กราฟจะเพี้ยน — ใช้ปุ่มเลื่อนขึ้น/ลงใน M1 จัดลำดับให้ตรงกับหน้างาน
- ยังไม่ได้ทำการเชื่อม M3 ↔ M4 (คลิกแถบแล้วไฮไลต์ตำแหน่งในผัง) ตามที่ระบุไว้ในแผน
- M5 ยังใช้ข้อมูลจาก steps ของ M4 อยู่ ยังไม่ได้เปลี่ยนไปใช้ Min จาก M1 โดยตรง (Phase 4)

## 2026-08-01 (Update 5) — แก้สูตร Cycle Time

### Tool

- Claude Code (Opus 5)

### Session Goal

ผู้ใช้แจ้งว่า Cycle Time ของ BYD Side Step ควรเป็น 450 ไม่ใช่ 385 —
เพราะ Worker A ต้องปลดชิ้นงานออกจากเครื่อง ซึ่งทำได้ก็ต่อเมื่อ Blow molding จบ
และขอให้ปรับลูกศร/การแสดงผลให้ชัดและแข็งแรงขึ้น

### Completed

- **`src/lib/chart-utils.ts` — `computeCycleTime()` แก้ตรรกะ**
  - เดิม: สายของเครื่อง = **ผลรวมเวลาที่เครื่องทำงาน** → BYD ได้ 385
  - ใหม่: สายของเครื่อง = **เวลาที่เครื่องหยุด (calcEnd)** ซึ่งรวมเวลาโหลดที่อยู่ข้างหน้า
    → BYD ได้ 450 (โหลด 65 + เครื่องทำงาน 385)
  - สายของคนยังใช้ผลรวมเวลาของตัวเองเหมือนเดิม เพื่อไม่ให้ Start Time ที่กรอกช้า
    ไปดันค่า Cycle Time (กฎเดิมที่ยังคงไว้)
- **`src/lib/combination-table.ts`**: ปรับ M3 ให้ใช้กฎเดียวกัน — cycle ของ Auto M/C
  ใช้ค่า end สูงสุด ไม่ใช่ duration สูงสุด เพื่อให้ M3 กับ M4 ตอบตรงกัน
- **`StepTable.tsx` — ปรับการแสดงผลตามที่ขอ**
  - เพิ่ม **เส้นแดงแนวตั้งลากผ่านทุกแถว** ที่ตำแหน่ง Cycle Time พร้อมแรเงาพื้นที่ที่เลยรอบไปแล้ว
  - ลูกศรวัดรอบด้านล่าง: เส้นหนา 4px หัวลูกศรทึบใหญ่ขึ้น มีเสาปิดหัวท้าย
    และป้ายชิปสีแดง "CYCLE TIME 450s" อ่านง่ายขึ้นมาก (เดิมเป็นเส้นบาง 2px ตัวอักษร 8px)
- **เทสต์**: เพิ่มเคส BYD จริงใน `chart-utils.test.cjs` และเคสเครื่องใน `combination-table.test.cjs`
  ปรับเทสต์เดิม 2 ข้อที่ยึดนิยามเก่า

### Files Added / Changed

- `src/lib/chart-utils.ts`, `src/lib/combination-table.ts`,
  `src/components/editor/StepTable.tsx`
- `tests/chart-utils.test.cjs`, `tests/combination-table.test.cjs`, `tests/store.test.cjs`
- `PROJECT_CONTEXT.md` (แก้กฎ Cycle Time), `docs/Master_Plan.html` (v1.5), `CHANGELOG_AI.md`

### Verification

- `npm test` → **71/71 ผ่าน** · `npx tsc --noEmit` ไม่มี error · `npm run build` ผ่าน
- **ทดสอบด้วยข้อมูล BYD จริงบน dev server** (โหลด 65 → Blow molding 385 → งาน Worker A ต่อ):
  - **Cycle Time = 450s** ถูกต้องตามที่ผู้ใช้ระบุ (เดิม 385)
  - Worker A = 356 วิ (79% ของ 450) · Worker B = 285 · Auto M/C = 385 (86%)
  - เส้นแดงแนวตั้งอยู่ตรงจุดที่แถบ Auto จบพอดี · ลูกศร "CYCLE TIME 450s" แสดงชัด
  - console ไม่มี error
- **Deploy ขึ้น production แล้ว** และเปิดเว็บจริงตรวจซ้ำ: ไฟล์ BYDSidestep Rev.01 บนคลาวด์
  Cycle Time เปลี่ยนจาก 385 → **445** และเส้นแดง/ลูกศรใหม่แสดงครบ

### Notes / Risks

- **ทำไมไฟล์จริงบนคลาวด์ได้ 445 ไม่ใช่ 450**: ไม่ใช่บั๊กของสูตร แต่เป็นเรื่องข้อมูลในไฟล์
  - แถว `Blow molding` ในไฟล์นั้น **Start Time = 0** (ไม่ได้กรอก) ระบบจึงวาดเครื่องเริ่มที่ 0 จบที่ 385
  - แถว `Crusher` machineTime = 445 ต่อคิวจาก Blow molding จึงจบที่ 445 → กลายเป็นตัวกำหนด CT
  - ถ้าอยากได้ 450 ต้องกรอก Start Time = 65 ที่แถว Blow molding (ในสไลด์ที่ผู้ใช้ส่งมามีกรอกไว้)
- **ทางเลือกที่ยังไม่ได้ทำ**: ให้แถวเครื่องต่อคิวจาก "งานก่อนหน้า" อัตโนมัติเหมือนที่ M3 ทำ
  จะได้ไม่ต้องกรอก Start Time เอง แต่เป็นการเปลี่ยนโมเดลหลักของ M4 ที่กระทบไฟล์เดิมทั้งหมด
  จึงยังไม่แตะ รอผู้ใช้ตัดสินใจ

## 2026-08-01 (Update 6) — Cycle Time = รอบของคน

### Tool

- Claude Code (Opus 5)

### Session Goal

ผู้ใช้ชี้ว่ายังเข้าใจ Cycle Time ผิด: **Cycle คือรอบของ Worker A** ไม่ใช่ระยะจากซ้ายสุด
ถึงขวาสุดของกราฟ (กราฟแสดงแค่ shot แรกหลังเริ่มเดินเครื่อง) และ **Crusher ของ Worker D
เป็นเครื่องบดเศษ ไม่ใช่เครื่องจักรหลัก** จึงไม่ควรมากำหนดรอบของสาย

### Completed

- **`getCalculatedSteps()` — แถวเครื่องเริ่มนับต่อจากคนที่โหลด**
  - เดิม: แถว Auto M/C ต่อคิวกับ "เครื่องตัวก่อนหน้า" (actorLastEnd['Auto M/C'])
    ทำให้ Crusher ถูกดันไปเริ่มที่ 385 ทั้งที่เป็นคนละเครื่อง
  - ใหม่: แถว Auto M/C เริ่มจาก `lastOperatorEnd` = งานของคนที่อยู่เหนือมัน
    → Crusher เริ่มที่ 135 (หลัง Worker D ตัดเศษเสร็จ) · เครื่อง 2 ตัวใต้งานโหลดเดียวกันเริ่มพร้อมกัน
- **`computeCycleDetail()` (ใหม่) — Cycle Time = รอบของคนที่ยาวที่สุด**
  - `รอบของคน = max(เวลางานของตัวเองรวม, เวลาที่เครื่องที่คนนั้นโหลดหยุด)`
  - เวลาเครื่องถูกคิดให้เฉพาะ **คนที่โหลดเครื่องนั้น** เครื่องที่ไม่มีใครรอจึงไม่กำหนดรอบ
  - คืนค่า `driver` (ใครกำหนดรอบ) และ `waitForMachine` (รอเครื่องกี่วินาที) ด้วย
  - `computeCycleTime()` เหลือเป็น wrapper บาง ๆ
- **`combination-table.ts` (M3)**: ใช้กฎเดียวกัน — ผูกเครื่องกับคนที่โหลด และ
  Cycle Time คิดจากรอบของคนเท่านั้น
- **`time-study.ts`**: แก้ `stepsFromTimeStudy()` ให้สร้างเวลาหยุดของเครื่องตามการต่อคิวแบบใหม่
  ไม่งั้น round trip M1 → M4 → M1 จะเพี้ยน
- **`StepTable.tsx`**: ป้ายเปลี่ยนเป็น
  `CYCLE TIME 450s · Worker A (งาน 347s + รอเครื่อง 103s)`

### Files Added / Changed

- `src/lib/chart-utils.ts`, `src/lib/combination-table.ts`, `src/lib/time-study.ts`,
  `src/components/editor/StepTable.tsx`
- `tests/chart-utils.test.cjs`, `tests/combination-table.test.cjs`, `tests/time-study.test.cjs`
- `PROJECT_CONTEXT.md`, `docs/Master_Plan.html` (v1.6), `CHANGELOG_AI.md`

### Verification

- **เทียบข้อมูลจริงทีละแถวก่อนแก้** — ดึง step ทั้งหมดจาก D1 ผ่าน `/api/files` แล้วรันทั้ง
  โมเดลเก่าและใหม่เทียบกัน (มี 2 ไฟล์ที่มีข้อมูล อีก 4 ไฟล์ว่าง)
  - แถวที่เปลี่ยนมีเฉพาะแถวเครื่อง: Rev.00 `Blow molding` 0→62 (dur 450→388) ·
    Rev.01 `Blow molding` 0→70 (385→315) และ `Crusher` 385→135
  - แถวของคนทุกแถว **ไม่เปลี่ยนเลย** ทั้ง 2 ไฟล์
- `npm test` → **73/73 ผ่าน** · `npx tsc --noEmit` clean · `npm run build` ผ่าน
- `npx eslint` ไฟล์ที่แก้: ไม่มี error ใหม่ (เหลือของเดิมใน StepTable)
- **ทดสอบด้วยข้อมูล Rev.00 จริงบน dev server**:
  `CYCLE TIME 450s · Worker A (งาน 347s + รอเครื่อง 103s)` ·
  Worker A 347 (77%) · B 283 · C 280 · Blow molding แสดง 388s เริ่มหลังงาน Unloading · ไม่มี console error
- **Deploy ขึ้น production แล้ว** เปิดเว็บจริงตรวจทั้ง 2 ไฟล์:
  Rev.00 = `450s · Worker A (งาน 347s + รอเครื่อง 103s)` ✅

### Notes / Risks

- **Rev.01 ยังได้ 445 และขึ้นว่ากำหนดโดย Worker D (รอเครื่อง 190s)** — ไม่ใช่บั๊กของสูตร
  แต่เป็น **ข้อมูลค้าง**: ช่อง Machine ของแถว `Crusher` เก็บค่า 445 ซึ่งกรอกไว้ตอนที่ระบบยัง
  ต่อคิว Crusher หลัง Blow molding · ค่าที่ถูกต้องคือ **195** (เริ่ม 135 + บด 60)
  แก้ค่าเดียวนี้แล้ว CT จะกลายเป็น 385 กำหนดโดย Worker A
  - ยังไม่แก้ข้อมูลของผู้ใช้บนคลาวด์เอง รอผู้ใช้ยืนยัน
  - ป้ายใหม่ช่วยให้เห็นข้อมูลผิดได้ทันที เพราะมันบอกตรงๆ ว่า "Worker D รอเครื่อง 190s"
- ไฟล์ที่มีแถวเครื่องแล้วกรอก Start Time ไว้เอง จะไม่ได้รับผลกระทบ เพราะ Start Time ที่ระบุ
  ยังมาก่อนการต่อคิวอัตโนมัติเสมอ

## 2026-08-01 (Update 7) — M4 เปลี่ยนเป็นโมเดลระยะเวลา

### Tool

- Claude Code (Opus 5)

### Session Goal

ผู้ใช้ชี้ว่ากรอก Manual 100 แต่ Count ขึ้น 95 เพราะระบบเอาไปลบกับแถวบน — ผิดหลัก
ต้องเป็น **"กรอกเท่าไร คิดเท่านั้น"** และ **Count คือช่องที่ใช้คำนวณ Cycle Time**
(ผู้ใช้อนุมัติแผนแล้วเลือกทางเลือก B: ไม่แปลงข้อมูลเดิม เพื่อให้ทีมงานเข้าใจง่าย)

### Completed

- **`getCalculatedSteps()` — เปลี่ยนจากโมเดล stop-time เป็นโมเดลระยะเวลา**
  - เดิม: `duration = max(manual,machine,walk,idle) − start` (ต้องกรอกยอดสะสม)
  - ใหม่: `duration = manual + walk + idle` (แถวคน) หรือ `machine` (แถวเครื่อง) — **ไม่มีการลบ**
  - `startTime` ที่กรอกเองแค่เลื่อนตำแหน่งแท่ง ไม่ถูกเอาไปหักออกจากเวลาที่กรอก
  - เวลาเครื่องที่กรอกบนแถวของคน ยังเป็น track ขนาน ไม่ทำให้เวลาของคนยาวขึ้น
  - การต่อคิว (คนต่อจากคนคนเดิม · เครื่องต่อจากงานของคนที่อยู่เหนือ) ยังเหมือนเดิม
- **`computeCycleDetail()`**: Count ของคน = manual+walk+idle · รอบของคน = max(ผลรวม Count,
  เวลาที่เครื่องที่คนนั้นโหลดหยุด) · Cycle Time = รอบที่ยาวที่สุด — **กฎเครื่อง-คน ยังอยู่ครบ**
- **`stepsFromTimeStudy()`**: ง่ายลงมาก ไม่ต้องแปลงหน่วยแล้ว เพราะ M1 กับ M4 เก็บระยะเวลาทั้งคู่
- **`StepTable.tsx`**: เก็บคอลัมน์ Count ไว้ (เป็นช่องคำนวณ Cycle Time ตามที่ผู้ใช้ระบุ) ·
  เพิ่มคอลัมน์ **Start → End** · ส่ง `showTimes` ให้กราฟ
- **`TimelineRow.tsx`**: เพิ่ม prop `showTimes` เขียนระยะเวลากลางแท่ง และเวลาเริ่ม-จบที่หัวท้ายแท่ง
- **`seed-data.ts`**: ไม่ต้องแก้ เพราะเขียนเป็นระยะเวลาอยู่แล้วตั้งแต่แรก (เพิ่งจะทำงานถูกจริง)
- **เทสต์**: เขียน `chart-utils.test.cjs` ใหม่ทั้งไฟล์ด้วย fixture แบบระยะเวลา (20 ข้อ) ·
  ปรับ `time-study.test.cjs` และ `store.test.cjs`

### Files Added / Changed

- `src/lib/chart-utils.ts`, `src/lib/time-study.ts`,
  `src/components/editor/StepTable.tsx`, `src/components/chart/TimelineRow.tsx`
- `tests/chart-utils.test.cjs` (เขียนใหม่), `tests/time-study.test.cjs`, `tests/store.test.cjs`
- `PROJECT_CONTEXT.md`, `docs/Master_Plan.html` (v1.7),
  `docs/Plan_M4_Duration_Model.html` (เอกสารแผนที่ผู้ใช้อนุมัติ), `CHANGELOG_AI.md`

### Verification

- `npm test` → **83/83 ผ่าน** · `npx tsc --noEmit` clean · `npm run build` ผ่าน
- **ทดสอบด้วยข้อมูล Rev.01 จริงบน dev server** (ไม่แปลงค่า ตามทางเลือก B):
  - กรอก walk 5 → Count **5s** · manual 100 → **100s** (เดิม 95s) ·
    machine 385 → **385s** (เดิม 315s) · manual 220 → **220s** (เดิม 120s) ✅
  - คอลัมน์ Start → End: `0 → 5`, `5 → 105`, `70 → 455`, `105 → 325` ถูกต้อง
  - ตัวเลขบนแท่งกราฟขึ้นครบทุกแท่ง (100s, 385s, 220s, …)
  - console ไม่มี error
- **Deploy ขึ้น production แล้ว** เปิดเว็บจริงตรวจซ้ำ: หัวตารางมี Count (s) และ Start → End ·
  แถว Blow molding `75 → 460` ระยะเวลา 385s ตามที่กรอก

### Notes / Risks

- **ข้อมูลเดิมไม่ถูกแปลง** ตามที่ผู้ใช้เลือก — ตัวเลขที่เคยกรอกแบบยอดสะสมจะกลายเป็นระยะเวลาทันที
  ทำให้ Cycle Time ของ Rev.01 พุ่งเป็น ~1,166 s จนกว่าจะไล่กรอกใหม่
  วิธีที่เร็วที่สุดคือกรอกที่ M1 แล้วกด "ส่งข้อมูลไป M2–M5" มาทับ
- ไม่มีการเขียนทับฐานข้อมูลจริง — การเปลี่ยนแปลงเกิดตอนแสดงผลเท่านั้น จนกว่าผู้ใช้จะกด Save
- ไฟล์ Rev.00 ก็ได้รับผลเดียวกัน (ตัวเลขเดิมเป็นยอดสะสม) ต้องกรอกใหม่เช่นกัน

## 2026-08-03 (Codex Phase 4B M1 time categories and M5 three-tier Yamazumi)

### Tool / Scope

- Codex / GPT implementation-only handoff for Phase 4B.
- Phase 4C Drag & Drop remains out of scope.

### Changes

- Changed exactly these files: `src/types/index.ts`, `src/lib/time-study.ts`,
  `src/components/modules/Module1_TimeMeasurement.tsx`,
  `src/components/modules/Module5_YamazumiChart.tsx`,
  `tests/time-study.test.cjs`, and `CHANGELOG_AI.md`.
- Added the optional `TimeStudyRow.category` field with only
  `'periodical' | 'changeover'`; an absent or undefined value means regular
  work.
- Scoped operator `min`, `max`, `average`, `manMin`, `walkMin`, `idleMin`,
  and `rowCount` to regular rows. This is intentional: categorized time is
  shown in its own M5 tier and must not be counted again in the regular tier.
  Added `periodicalMin` and `changeoverMin` per operator. M5 now stacks
  Regular, Periodical diagonal hatch, and Changeover grid hatch in that order;
  the Phase 4A Max/Average treatment remains on Regular only.
- Added the M1 `หมวดเวลา` dropdown with `ปกติ`, `ทำเป็นรอบ`, and `เปลี่ยนรุ่น`.

### Verification

- `git status --short --branch`: clean before implementation (`## main...origin/main`).
- `node --test`: PASS, 159/159 tests.
- `node --test tests/time-study.test.cjs`: PASS, 18/18 tests.
- `npm run lint`: blocked by the machine PowerShell execution policy for
  `npm.ps1`; equivalent `npm.cmd run lint` ran and reported only the known
  baseline 5 errors plus warnings, with no error in any Phase 4B file.
- `npm run build`: blocked by the same PowerShell execution policy;
  equivalent `npm.cmd run build`: PASS, 5/5 static routes generated.
- `git diff --check`: PASS; only existing LF/CRLF normalization warnings.
- Manual browser verification was blocked by local tooling state: Next dev at
  `localhost:3000` had no API/fixture chart; Pages Dev could not start because
  `wrangler` is not installed and `npx` could not access its registry cache;
  the existing Chrome production tab was still the Phase 4A bundle and was not
  written to. A local in-memory fixture proxy was prepared but the Browser URL
  policy rejected its port, so categorized and uncategorized visual smoke
  results remain open for review.

### Handoff / Safety

- `rowCount` is regular-only so Module 1's `N งาน` label matches the regular
  summary meaning; M5 detects operator presence independently so category-only
  operators are not hidden.
- No commit, push, deploy, migration, remote operation, or Production D1 write
  occurred.

## 2026-08-05 (Codex Phase 4C-1 verification continuation)

### Tool / Status

- Codex / GPT implementation-only verification of the existing Phase 4C-1
  working-tree implementation.
- **STATUS: IMPLEMENTED** for the scoped code and automated checks; visual
  browser smoke remains **BLOCKED** by local Pages-Functions tooling.

### Scope confirmation

- The only implementation scope present before this session was exactly
  `src/lib/time-study.ts`, `src/components/modules/Module5_YamazumiChart.tsx`,
  `tests/time-study.test.cjs`, and `CHANGELOG_AI.md`.
- No drag, drop, pointer tracking, reassignment, Phase 4C-2 work, or unrelated
  source/test changes were introduced.

### Verification

- `npm.cmd test`: **PASS, 161/161**.
- `npm.cmd run lint`: exit 1 with the known baseline **5 errors / 23
  warnings**; no error was reported in any Phase 4C-1 file.
- `npm.cmd run build`: **PASS**, all 5 static routes generated and TypeScript
  completed successfully.
- `git diff --check`: **PASS**; only existing LF/CRLF normalization warnings.
- `npm.cmd run dev -- -p 3000` served `/editor`, but Next dev does not serve
  the Cloudflare Pages Functions: `/api/folders` returned 404. The editor
  therefore showed Cloud unavailable with no chart to open. Pages Dev could
  not be used because `wrangler` is not installed locally; no chart segment,
  tooltip, bar-height, overlay, average-marker, or clean-console comparison
  could be completed.

### Handoff / Safety

- The helper remains the single general `rowsForOperatorByCategory()` design;
  tests cross-check regular, periodical, and changeover row Min sums against
  the existing aggregate totals exactly.
- No commit, push, deploy, migration, remote operation, or Production D1 write
  occurred. Next action: return this handoff to Claude for review; do not
  proceed to Phase 4C-2 or release action.

## 2026-08-04 (Codex Phase 4C-1 M5 per-row job-element segments)

### Tool / Scope

- Codex / GPT implementation-only handoff for the Phase 4C-1 rendering prerequisite.
- This is not the Phase 4C-2 drag interaction; no drag, drop, pointer tracking,
  or reassignment behavior was added.

### Changes

- Changed exactly these files: `src/lib/time-study.ts`,
  `src/components/modules/Module5_YamazumiChart.tsx`,
  `tests/time-study.test.cjs`, and `CHANGELOG_AI.md`.
- Added the exported general helper
  `rowsForOperatorByCategory(study, operator, category)` rather than three
  separate category functions. It reuses the private `rowCategory()` default,
  applies the same `isMachineRow()` bucket rule as `computeOperatorTotals()`,
  and sorts `man`, then `walk`, then `idle`, preserving `seq` order within a kind.
- Refactored only M5's `hasTimeStudy` branch so Regular, Periodical, and
  Changeover tiers contain one DOM segment per non-zero-Min job element, with
  `data-row-id` and per-element Min tooltips. Aggregate totals still control
  tier heights, Max overlay, Average marker, and scale; the no-`timeStudy`
  fallback path was not changed.

### Verification

- `git status --short --branch`: clean before implementation
  (`## main...origin/main`).
- `node --test tests/time-study.test.cjs`: PASS, 20/20 tests.
- `node --test`: PASS, 161/161 tests.
- `npm run lint`: blocked by the machine PowerShell execution policy for
  `npm.ps1`; equivalent `npm.cmd run lint` reported the known baseline 5
  errors and 23 warnings, with zero errors in touched files.
- `npm run build`: blocked by the same PowerShell execution policy; equivalent
  `npm.cmd run build`: PASS, all 5 static routes generated.
- `git diff --check`: PASS; only 4 LF/CRLF normalization warnings.
- The new tests cross-check per-row Min sums against `min`,
  `manMin + walkMin + idleMin`, `periodicalMin`, and `changeoverMin` for both
  operators; all passed exactly.
- Manual browser verification was blocked: the local read-only fixture proxy
  returned HTTP 200 to PowerShell, but both the in-app Browser and Chrome kept
  the editor on the hydration screen and did not issue the API hydration
  requests. No M5 segment/tooltip/height comparison or clean app-console check
  could therefore be completed.

### Handoff / Safety

- No commit, push, deploy, migration, remote operation, or Production D1 write
  occurred.

## 2026-08-05 (Codex Phase 4C-2 M5 native HTML5 drag/drop)

### Tool / Scope

- Codex / GPT implementation-only handoff for the Phase 4C-2 M5 operator
  reassignment interaction. No schema, API, Module 4, store-action, or
  drag-library change was introduced.
- Changed exactly these implementation files plus this changelog:
  `src/lib/time-study.ts`, `src/components/modules/Module5_YamazumiChart.tsx`,
  `tests/time-study.test.cjs`, and `CHANGELOG_AI.md`.

### Changes

- Added pure `moveRowToOperator(study, rowId, newOperator)`. It changes only
  the matching row's `operator`, preserves every other row and field, and
  safely returns the original study for a missing row or same-operator move.
- Added native HTML5 drag/drop to all Module 5 time-study row segments
  (Regular, Periodical, and Changeover). Drop uses the existing
  `updateTimeStudy()` local action only; it does not change Module 4 steps or
  push to the cloud.
- During a drag, every `ALL_WORKERS` operator is rendered. Operators with no
  current work receive a dashed empty drop-target placeholder; placeholders
  disappear when the drag ends. The existing no-`timeStudy` fallback remains
  unchanged.
- Added helper tests covering target-only mutation, preservation of row
  fields/other rows, missing-row no-op behavior, and source/destination
  aggregate rebalance.

### Verification

- `npm.cmd test`: **PASS, 163/163**.
- `npm.cmd run lint`: exit 1 with the known baseline **5 errors / 7 warnings**;
  no error was reported in any Phase 4C-2 file. Existing baseline errors remain
  in `StepTable.tsx`, `Sidebar.tsx`, and `TopBar.tsx`.
- `npm.cmd run build`: **PASS**, TypeScript completed and all 5 static routes
  generated.
- `git diff --check`: **PASS**; only LF/CRLF normalization warnings.
- Local browser check reached `http://localhost:3000/editor`, but Next dev
  does not serve the Cloudflare Pages Functions: `/api/folders` returned 404.
  The editor showed Cloud unavailable with no chart ID/data, so no safe
  drag/drop, PUT, fresh GET, hard-refresh, or chart-console acceptance claim
  is made. Pages Dev was not available because local `wrangler` is absent.

### Handoff / Safety

- Review status: return to Claude for review; do not close Phase 4C-2 or
  release from this local-only evidence.
- No commit, push, deploy, migration, remote operation, or Production D1 write
  occurred.

## 2026-08-05 (Codex Phase 4C-2 targeted drag-state fix)

### Tool / Scope

- Codex / GPT targeted bug-fix and retest only. The fix scope changed exactly
  these two files: `src/components/modules/Module5_YamazumiChart.tsx` and
  `CHANGELOG_AI.md`. The existing Phase 4C-2 changes in the other files and
  the pre-existing prompt/document changes were preserved.

### Finding / Root Cause

- After a successful cross-operator drop, React moved the dragged segment to
  the destination before native `dragend` fired on the source. The detached
  source therefore never reached `handleRowDragEnd()`, leaving
  `draggingRowId` set and permanently showing placeholders/drag styling.

### Fix

- Added `setDraggingRowId(null);` directly inside `handleOperatorDrop`, next
  to the existing `setDraggingOverOperator(null);`. This clears both drag
  state values at drop time while retaining `handleRowDragEnd()` for no-op,
  cancelled, and outside-target drags.

### Retest

- `node --test`: **PASS, 163/163**.
- `npm run lint`: blocked by the machine PowerShell execution policy for
  `npm.ps1`; equivalent `npm.cmd run lint`: exit 1 with the known baseline
  **5 errors / 11 warnings**, with no error in the two changed files.
- `npm run build`: blocked by the same PowerShell execution policy;
  equivalent `npm.cmd run build`: **PASS**, TypeScript completed and the
  static routes generated successfully (`/`, `/_not-found`, `/editor`).
- `git diff --check`: **PASS**; only LF/CRLF normalization warnings.
- Manual browser verification was not possible for this retest: local
  `wrangler`/Pages Dev is unavailable, and Next dev does not serve the Pages
  Functions fixture (`/api/folders` returns 404). No real drag sequence or
  post-drop DOM inspection is claimed; Claude will independently re-verify.

### Handoff / Safety

- STATUS: **FIXED**. Return to Claude for independent re-verification before
  any commit, push, deploy, or Phase 4C-2 closure.
- No commit, push, deploy, or Production D1 write occurred.

## 2026-08-06 (Codex Phase 5a-1 revision snapshot implementation)

### Scope / Implementation

- Implemented Phase 5a-1 of Phase 5 (M6 Kaizen + Before/After): additive
  revision snapshots, server-side chart locking, cloud storage clients, store
  actions, the minimal Rev No. UI controls, and direct/storage/store tests.
- Added to `schema.sql` exactly:
  `ALTER TABLE chart_files ADD COLUMN lockedAt TEXT DEFAULT NULL;`, the
  `revision_snapshots` table with `id`, `chartFileId`, `revNo`, `content`, and
  `closedAt`, the unique `(chartFileId, revNo)` index, and the
  `chartFileId` lookup index. Existing folder/chart_files definitions and
  indexes were not changed.
- Added `/api/revisions`: GET by snapshot id returns parsed full content; GET
  by chartFileId returns metadata ordered by `closedAt DESC`; POST copies the
  existing raw chart content and atomically inserts the snapshot plus sets
  `chart_files.lockedAt`; PUT clears the lock. Missing, locked, duplicate, and
  already-unlocked cases return explicit 4xx responses.
- Added the `lockedAt`, `RevisionSnapshotContent`, `RevisionSnapshotMeta`, and
  `RevisionSnapshot` types; `closeRevisionCloud`, `openRevisionCloud`, and
  `listRevisionSnapshotsCloud`; `blockLockedFile`; `closeRevision`; and
  `openNewRevision`. `saveActiveFile` now refuses locked files before any PUT.
- `HeaderForm.tsx` now disables only the Rev No. field while locked and shows
  the locked timestamp/Open New Revision control or Close Revision control;
  no Phase 5a-2 field gating or Phase 5b page was added.

### Verification / Handoff

- `tests/revisions.test.cjs`, `tests/storage.test.cjs`, and
  `tests/store.test.cjs` pass, including atomic close, duplicate protection,
  locked PUT rejection, complete content preservation, save confirmation
  gating, open/close actions, and hydrate lock persistence.
- Full `node --test`: **TESTS_FAILED, 181/184 passed**. The three failures are
  the pre-existing direct `tests/data-safety.test.cjs` mock's PUT cases: that
  out-of-scope mock does not recognize the new required
  `SELECT lockedAt FROM chart_files WHERE id = ?` lookup, so it returns the
  mock's 500 instead of exercising the existing unlocked behavior. The mock
  was intentionally not edited because the prompt's allowed scope explicitly
  excludes `tests/data-safety.test.cjs`; this is the remaining handoff blocker.
- `npm.cmd run lint`: exit 1 with the known baseline 5 errors and 15 warnings;
  no new error was reported in a Phase 5a-1 source file.
- `npm.cmd run build`: **PASS**; TypeScript completed and `/`, `/_not-found`,
  and `/editor` generated successfully.
- `git diff --check`: **PASS**; only LF/CRLF normalization warnings.
- Local Pages Dev/manual close -> blocked Save -> Open New Revision -> Save
  verification was unavailable because `wrangler` is not installed and the
  project has no Pages Dev script. No local D1 or Production D1 write was
  attempted.
- Phase 5a-2 (read-only UI gating beyond HeaderForm) and Phase 5b
  (Before/After page) remain separately scoped. Return this handoff to Claude
  for review and direction on the out-of-scope test-harness conflict.
- No commit, push, deploy, migration, `--remote` operation, or Production D1
  write occurred.

## 2026-08-10 (Codex Phase 5b-1 M6 Before/After comparison implementation)

### Scope / Implementation

- Implemented Phase 5b-1 of Phase 5b (M6 Kaizen page): a read-only client
  comparison of two closed Revision snapshots. Phase 5b-2 (the Kaizen
  problem/countermeasure form) remains separately scoped next.
- Changed exactly these files, matching the prompt's REQUIRED SCOPE:
  `src/lib/kaizen-compare.ts`, `src/lib/storage.ts`,
  `src/store/useChartStore.ts`, `src/components/modules/Module6_Kaizen.tsx`,
  `src/components/layout/TopBar.tsx`, `src/app/editor/page.tsx`,
  `tests/kaizen-compare.test.cjs`, `tests/storage.test.cjs`, and
  `CHANGELOG_AI.md`.
- Added `getRevisionSnapshotCloud(id)` with the exact contract:
  `Promise<{ ok: true; snapshot: RevisionSnapshot } | { ok: false; error: string }>`.
  It calls `GET /api/revisions?id=...`, requires `id`, `chartFileId`, string
  `revNo`, `closedAt`, and full `content`, and fails closed on malformed/API/
  network responses.
- Added the pure `kaizen-compare.ts` API: `OperatorBar`,
  `OperatorComparisonRow`, `RevisionMetrics`, `ComparisonResult`,
  `computeRevisionMetrics(content)`, and
  `buildComparison(before, after)`. It uses Module 1 Min totals when a
  time-study has rows, falls back to calculated Module 4 steps otherwise,
  keeps Cycle Time on the existing step-based longest-operator-loop rule,
  excludes `Auto M/C`, preserves `ALL_WORKERS` order, and returns a null
  reduction percentage for a zero baseline. `capacityPerShift` uses the real
  `CapacitySummary.bottleneckCapacity` field; no field-name deviation was
  required.
- Added the sixth `Kaizen` navigator tab and Module 6 UI with two closed-
  Revision pickers, cached snapshot reads, metric change direction colours,
  and a shared-axis overlaid Manual/Walk/Idle Yamazumi chart. It never reads
  or compares the live editable active-file content and adds no Phase 5b-2
  persistence.

### Verification / Handoff

- `git status --short --branch`: implementation files listed above were the
  only new source/test changes; pre-existing documentation changes remained
  untouched.
- `node --test`: **PASS, 193/193**.
- `npm run lint`: blocked by the machine PowerShell execution policy for
  `npm.ps1`; equivalent `npm.cmd run lint`: exit 1 with the known baseline
  **5 errors / 11 warnings** (StepTable, Sidebar, and TopBar only); zero new
  errors in Phase 5b-1 files.
- `npx tsc --noEmit`: blocked by the same policy for `npx.ps1`; equivalent
  `npx.cmd tsc --noEmit`: **PASS**.
- `npm run build`: blocked by the same policy for `npm.ps1`; equivalent
  `npm.cmd run build`: **PASS**, all 5 static routes generated.
- `git diff --check`: **PASS**; only existing LF/CRLF normalization warnings.
- Best-effort manual check: Next dev served `/editor`, and the in-app Browser
  confirmed the visible `6: Kaizen` tab with no console errors. Next dev does
  not serve the Cloudflare Pages Functions, so `/api/folders` and `/api/files`
  returned 404; the UI correctly showed Cloud unavailable and no active chart
  was available from cached state. Therefore this environment had **no chart
  with 2+ closed Revisions** to render against; pickers, metrics, and the
  overlaid chart could not be exercised with real snapshot data. The local
  dev server was stopped after the check.
- Final UI consistency pass kept snapshot selection tied to the active chart
  and treated a zero-baseline Cycle Time change as not applicable/neutral;
  these are client-only safeguards and do not alter the comparison contract.
- No commit, push, deploy, schema change, API/function change, migration,
  Production D1 read/write, or other Production change occurred. This phase
  only adds a new read-only client module and its tests.
- **Next action:** return this handoff to Claude for full diff and live-data
  review. Do not proceed to Phase 5b-2 or any release/migration action here.

## 2026-08-10 (Codex Phase 5b-1 M6 infinite render-loop fix)

### Scope / Root Cause / Fix

- Fixed the infinite render loop found by Claude during live Phase 5b-1
  verification when two distinct closed Revision snapshots were selected.
- Root cause: `snapshotCache` was React state and was both a dependency of the
  snapshot-loading effect and written by that same effect; spreading it always
  created a new object reference, retriggering the effect indefinitely.
- Changed only the cache mechanism in
  `src/components/modules/Module6_Kaizen.tsx`: `useState` → `useRef`, reset/
  reads/writes use `snapshotCacheRef.current`, and the cache was removed from
  the effect dependency array. Picker behavior, metrics, chart rendering,
  snapshot fetch semantics, and all other files remain unchanged.

### Verification / Handoff

- `node --test`: **PASS, 193/193**.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build`: direct PowerShell
  wrappers were blocked by the machine execution policy; equivalent
  `npm.cmd run lint` reported the known baseline **5 errors / 11 warnings**,
  `npx.cmd tsc --noEmit` **PASS**, and `npm.cmd run build` **PASS**.
- `git diff --check`: **PASS**; only existing LF/CRLF normalization warnings.
- Manual local Next dev check reached `/editor`, showed the `6: Kaizen` tab,
  and had no console errors. Plain Next dev returned 404 for Pages Functions,
  so no chart with two closed Revisions was available; the infinite-loop
  reproduction could not be reached in this environment. Claude should rerun
  the real local Pages Dev + D1 reproduction.
- No commit, push, deploy, Production/schema/API change, or git-mutating
  command occurred. Return this fix handoff to Claude for review and
  re-verification; do not proceed to Phase 5b-2 or release work.
