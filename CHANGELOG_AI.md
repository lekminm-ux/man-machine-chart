# CHANGELOG_AI

This file is the shared AI work log for Codex, Claude Code, Antigravity, and any other AI tool working on this project.

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
- Deployment is pending the final release verification in this session. No D1
  migration, reset, seed, delete, or Production data write is authorized.

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
