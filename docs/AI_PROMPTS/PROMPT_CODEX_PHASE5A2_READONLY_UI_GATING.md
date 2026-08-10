# Prompt — Codex Implementation: Phase 5a-2, Read-Only UI Gating

Paste this whole block into Codex / GPT-5.6 Luna Max. This is an
IMPLEMENT_ONLY handoff written by Claude, the second sub-phase of Phase 5
(M6 Kaizen + Before/After). Do not build the Before/After page (Phase 5b) —
that is separately scoped after this ships and is reviewed. Do not redesign
the approach, do not expand scope. When done, report back to **Claude** (not
the user directly) using the REQUIRED HANDOFF OUTPUT format at the end.

```text
ROLE: Codex / GPT-5.6 Luna Max — implementation only
MODE: IMPLEMENT_ONLY — build exactly the plan below; do not redesign, do not
expand scope. Do NOT implement Phase 5b (the Before/After comparison page) —
that is separately scoped after this ships and is reviewed.

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Phase 5a-1 (commit b982cc3, already merged to main) shipped the lock/snapshot
mechanism: closing a Revision snapshots M1-M5 content and sets
`chart_files.lockedAt`; `saveActiveFile` and `closeRevision` refuse to run
against a locked file (`blockLockedFile` in useChartStore.ts); and
HeaderForm.tsx gates exactly one field — its own Rev No. input — plus adds
the Close/Open Revision buttons. Phase 5a-1's own handoff explicitly deferred
everything else: "the REST of the form's fields stay exactly as they are
today and are NOT touched — that's Phase 5a-2", and separately, "Do NOT
implement Phase 5a-2 (making M1/M2/M4/M5 input fields visually/functionally
read-only when locked, beyond the one Rev No. field specified below)".

Today, every other input in the app — the rest of HeaderForm (Process Name,
Part Number, Part Name, Model, Mold No., Issue Date, Prepared By, Approved
By), all of M1 (Module1_TimeMeasurement.tsx), M2 (Module2_MachineCapacity.tsx),
M4 (StepTable.tsx + LayoutDiagram.tsx + SummaryTable.tsx), and M5
(Module5_YamazumiChart.tsx) — stays fully interactive regardless of
`activeFile.lockedAt`. The only thing actually stopping a locked chart's
edits from reaching Cloud is `saveActiveFile`'s existing `blockLockedFile`
guard, which fires only at Save time — silently (a `console.warn` plus the
generic "⚠ Sync Error" badge in TopBar) — often after the user has already
spent real time editing fields that looked completely normal. That confusing
half-locked experience is exactly why the user held Phase 5a-1's application
code back from Production deployment (see docs/Master_Plan.html v1.22 and
CHANGELOG_AI.md's Phase 5a-1 entries).

This prompt closes that gap: every input, button, and drag interaction that
can mutate a locked chart's content must become visibly and functionally
inert the moment `activeFile.lockedAt` is set — mirroring exactly the pattern
HeaderForm.tsx already ships for Rev No. (`const isLocked =
Boolean(activeFile.lockedAt)`, then `disabled={isLocked}` plus a greyed
style). Read-only DISPLAY of a locked chart must never be affected — locking
hides nothing, it only stops further edits. Once this ships, reviews, and is
verified, the already-committed Phase 5a-1 application code and this phase's
code deploy to Production together as one release (a separate, later step —
not part of this task).

Module 3 (Module3_CombinationTable.tsx) is deliberately excluded from this
phase. Confirmed by reading it: its only interactive control, the Takt Time
override field, is local component `useState` (`taktOverride`) that never
calls a store action or reads/writes `activeFile` — M3 has no write path into
persisted chart content at all, so there is nothing in it to gate.

ROOT CAUSE
Every "local only — auto-saved on saveActiveFile" action in
useChartStore.ts — `updateHeader`, `updateTimeMeasurement`, `updateTimeStudy`,
`importTimeStudyFromSteps`, `pushTimeStudyToSteps`, `updateMachineCapacity`,
`importMachineCapacityFromTimeStudy`, `addStep`, `updateStep`, `deleteStep`,
`reorderSteps`, `insertStep`, `updateOperatorPosition`, `addLayoutElement`,
`updateLayoutElement`, `deleteLayoutElement`, `addLayoutConnection`,
`updateLayoutConnection`, `deleteLayoutConnection` — mutates Zustand state
directly and was written before the lock concept existed; none of them check
`lockedAt`. That is intentional and STAYS intentional in this round (see
FORBIDDEN below): `saveActiveFile` is the only path any of this ever reaches
Cloud through, and it already blocks a locked file, so the real data-safety
property — a locked revision's *stored* content can never actually change —
already holds. What's missing is purely the UI layer: nothing today tells
these components to stop rendering their controls as editable once a chart
is locked.

Separately, while tracing every place `lockedAt` flows, a real latent
inconsistency was found in `duplicateFile` (useChartStore.ts): it spreads
`...file` into the new duplicated file object, which copies `lockedAt`
verbatim if the source chart was locked. But `functions/api/files.js`'s
`onRequestPost` (the endpoint `duplicateFile` calls via `createFileCloud`)
never references `lockedAt` in its `INSERT INTO chart_files (id, name,
folderId, createdAt, updatedAt, content) VALUES (...)` — the new D1 row is
always created with `lockedAt = NULL` (the column's schema default),
regardless of what the client sent. The result: a chart duplicated from a
locked source shows as locked in the browser (Rev No. disabled, lock badge
visible) with no snapshot ever created for it and no way to unlock it via
"Open New Revision" (the server correctly returns 409 "this chart is not
currently locked", since its real row genuinely isn't) — a dead-end stuck
state, only escapable by navigating away and reopening the file so a fresh
Cloud GET overwrites the wrong local guess. This is fixed in step 9 below as
a one-line client-side correction; no schema or API change is needed.

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- src/components/editor/HeaderForm.tsx
- src/components/modules/Module1_TimeMeasurement.tsx
- src/components/modules/Module2_MachineCapacity.tsx
- src/components/editor/StepTable.tsx
- src/components/layout-diagram/LayoutDiagram.tsx
- src/components/editor/SummaryTable.tsx
- src/components/modules/Module5_YamazumiChart.tsx
- src/components/layout/TopBar.tsx
- src/store/useChartStore.ts (ONLY the one-line `duplicateFile` fix in step 9
  — no other action in this file may change)
- tests/store.test.cjs (one new test for the `duplicateFile` fix only)
- CHANGELOG_AI.md

READ FIRST — exact paths, in this order
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
   — especially "Important Working Rules" and "High-Risk Files"
   (LayoutDiagram and StepTable are both listed there)
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
   (latest entries — Phase 5a-1's rounds, Updates 15-17)
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/types/index.ts
   (full file — `ChartFile.lockedAt`, and every content shape this phase's
   components read: `ChartHeader`, `TimeStudy`/`TimeStudyRow`,
   `MachineCapacity`/`MachineCapacityRow`, `ChartStep`, `LayoutElement`,
   `LayoutConnection`)
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
   (full file — especially `blockLockedFile`, `saveActiveFile`,
   `closeRevision`, `duplicateFile`, and every action listed in ROOT CAUSE
   above, so it's clear which of them this phase must NOT touch)
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/editor/HeaderForm.tsx
   (full file — the existing `isLocked` pattern is the canonical precedent
   every other file in this phase must match)
6. Each of the 7 remaining files in REQUIRED SCOPE above (full file each)
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/files.js
   (`onRequestPost` only — confirms the `duplicateFile` root cause: `lockedAt`
   is absent from the INSERT column list)
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/store.test.cjs
   — read the existing `test('duplicateFile deep-copies steps and remaps
   layout connections', ...)` (around line 167) and the `freshReadyStore()`
   helper it uses, to match style for the one new test in step 10

PREFLIGHT
- Run: git status --short --branch
- Preserve all existing uncommitted/untracked files exactly as found. Do not
  reset, checkout, restore, delete, or run any broad cleanup.
- If anything unexpected is already in the working tree, stop and report
  before touching anything — note it if it's clearly just documentation
  (e.g. only CHANGELOG_AI.md or files under docs/AI_PROMPTS/ are pending)
  and proceed with the actual code task; only hard-stop if something in
  src/, tests/, schema.sql, or functions/ is unexpectedly modified.

FORBIDDEN
- Do not edit any file outside the list in REQUIRED SCOPE. In particular, do
  not touch Module3_CombinationTable.tsx — see CONTEXT for why there is
  nothing in it to gate.
- Do not add `blockLockedFile` (or any new guard) to any store action in
  useChartStore.ts other than the one `duplicateFile` fix in step 9. The
  existing `saveActiveFile`/`closeRevision` guards already make a locked
  chart's *stored* content unwritable; adding guards to the 18 "local only"
  setters listed in ROOT CAUSE would be redundant once their UI callers are
  disabled, and risks regressions in functions with existing passing tests
  that this phase does not need to touch.
- Do not change schema.sql or any file under functions/api/ — this phase is
  100% frontend. (Step 9's fix is a client-side object-construction change
  only; the server already ignores `lockedAt` on create, as confirmed in
  READ FIRST item 7.)
- Do not change what data is DISPLAYED for a locked chart. Every number, bar,
  label, and computed total must render identically whether locked or not —
  only the ability to CHANGE something may differ. Do not hide, blank, or
  conditionally-not-render any read-only value because a chart is locked.
- Do not add a new "locked" banner/indicator component anywhere. HeaderForm's
  existing lock badge (🔒 Locked + timestamp, next to Rev No.) is already
  rendered above every module's content on every tab — confirmed in
  src/app/editor/page.tsx, where `<HeaderForm />` renders once, unconditionally,
  above the `activeModule === N` switch — and remains the single shared
  indicator. This phase only adds per-control disabled states inside each
  module; it does not repeat the badge.
- Do not implement Phase 5b (the Before/After comparison page).
- Do not touch src/components/layout/Sidebar.tsx or the `renameFile`/
  `moveFile` store actions. Renaming a chart file or moving it between
  folders is file-organization metadata, unrelated to the frozen M1-M5
  content, and correctly stays available regardless of lock state.
- Do not modify any calculation/derivation library: src/lib/chart-utils.ts,
  time-study.ts, machine-capacity.ts, combination-table.ts, layout-utils.ts.
- Do not change the visual treatment or behavior of HeaderForm's existing
  Rev No. field, lock badge, or Close/Open Revision buttons — those already
  shipped in Phase 5a-1 and are out of scope here.
- If this turns out to require touching a file outside REQUIRED SCOPE, or
  changing any existing function's behavior for an UNLOCKED file, STOP and
  report `PLAN_CHANGE_REQUIRED` with the specific reason.
- Do not commit, push, deploy, or run any git-mutating command.

STYLE CONVENTION — apply this throughout every step below
For every `<input>` / `<select>` / `<button>` this plan lists, add the
`disabled` attribute driven by `isLocked` (combine with `||` into any
existing disabled condition already on that element — e.g. StepTable's
Position field already has `disabled={isMachine}`; it becomes
`disabled={isMachine || isLocked}`, keep using its *existing*
`disabled:opacity-55 disabled:bg-slate-100` Tailwind classes rather than
inventing a second styling convention in the same file). Where an element has
no existing `disabled:` styling, append
`disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100` (or
the closest equivalent given that element's existing className, e.g. a
transparent-background table-cell input should dim and show not-allowed
without also gaining an opaque background that breaks the row's own
striping/highlight colour). The visual result in every file must read the
same way HeaderForm's Rev No. field already reads when locked: greyed out,
not-allowed cursor, unclickable. `isLocked` must be computed the same way in
every file: `const isLocked = Boolean(activeFile.lockedAt);` placed right
after that component's existing `if (!activeFile) return ...;` guard.

IMPLEMENTATION PLAN

1. HeaderForm.tsx — `isLocked` already exists (line ~19). Add
   `disabled={isLocked}` (plus the STYLE CONVENTION) to the 8 fields that are
   NOT Rev No. and NOT the already-`readOnly` Cycle Time field: Process Name,
   Part Number, Part Name, Model, Mold No., Issue Date, Prepared By, Approved
   By. Do not touch the Rev No. field, the lock badge, or the Close/Open
   Revision buttons — those are unchanged.

2. Module1_TimeMeasurement.tsx — add `isLocked`. Gate:
   - the reading-count `<select>` (`setReadingCount`)
   - "ดึงข้อมูลจาก M4" button (`handleImport`) and "ส่งข้อมูลไป M2–M5" button
     (`handlePush`) — disable both; `handlePush` in particular overwrites M4
     steps, so it must never fire against a locked chart
   - per-row Insert ▲ / ▼ buttons (`insertRow`)
   - the Job Element text input (`patchRow` on `jobElement`)
   - the Worker `<select>` and ประเภท(kind) `<select>` and หมวดเวลา(category)
     `<select>` (all three call `patchRow`)
   - every reading `<input type="number">` cell (`setReading`) — also guard
     its `onPaste` handler (`handlePaste`) with an `if (isLocked) return;` at
     its top, since paste can populate multiple rows/cells in one action
   - per-row move-up / move-down / delete buttons (`moveRow`, `deleteRow`)
   - the "เพิ่มแถว" add-row button at the bottom (`addRow`)

3. Module2_MachineCapacity.tsx — add `isLocked`. Gate:
   - "ดึงข้อมูลจาก M1" button (`handleImport`)
   - the 3 shift-setting inputs (shiftGrossMinutes / breakMinutes /
     requiredPerShift — the `.map()` block that calls `commit({ ...mc,
     [f.key]: num(...) })`)
   - per-row Process Name and Machine No. text inputs, manualTime/autoTime
     inputs, and changeQty/changeTime inputs (all via `patchRow`)
   - per-row delete button
   - the "เพิ่มแถว" add-row button at the bottom (`addRow`)

4. StepTable.tsx — add `isLocked`. Gate:
   - both "+ Add Step" buttons (top-left and top-right toolbar — both call
     `addStep`)
   - per-row Insert ▲ / ▼ buttons (`insertStep`)
   - per-row Move up / down buttons (`reorderSteps` via the local
     `moveUp`/`moveDown` helpers) — combine with each button's existing
     `disabled={i === 0}` / `disabled={i === steps.length - 1}`
   - per-row Delete button (`deleteStep`)
   - the Description text input, Operator `<select>`, Start Time input, and
     the 4 time columns (Manual/Machine/Walk/Idle) — all via `handleChange`
   - the Position input — combine with its existing `disabled={isMachine}`
   Leave the "Hide Inputs" / "Show Start→End" toggle buttons untouched: they
   only flip local view state and never call a store action.

5. SummaryTable.tsx — add `isLocked`. Gate the one interactive control: the
   Position text input (`updateOperatorPosition`). Every other cell in this
   table is already a read-only computed value.

6. LayoutDiagram.tsx — add `isLocked`. This file has no native per-element
   `disabled` state (it's an SVG canvas with mouse/touch-driven drag, resize,
   rotate, and connect interactions, plus a keyboard delete shortcut), so
   gating here is both functional (early-return guards) and visual
   (disabled buttons + a canvas-level style change):
   - Functional: add `if (isLocked) return;` as the first line of each of:
     `onElementPointerDown`, `onResizeStart`, `onRotateStart`, `onLinkStart`,
     `onConnEndpointDown`, `onConnBodyDown`, `addFreeArrow`, `addFromPalette`,
     and the `keydown` handler inside the existing `useEffect` (right after
     its current `INPUT`/`TEXTAREA` tag check). `handleMove`/`endPointer`
     need no separate guard: with every *Start* handler blocked, their
     `dragRef`/`resizeRef`/`rotateRef`/`connDragRef`/`linking` state never
     gets set in the first place.
   - Visual, buttons: add `disabled={isLocked}` (+ STYLE CONVENTION) to the
     "➘ Free Arrow" button, the "↔ Connect boxes" button, and every palette
     button (both the Equip. row and the Shapes row).
   - Visual, canvas: on the `<svg>` element's existing inline `style` object
     (currently `{ background: '#f8fafc', border: ..., cursor: 'default',
     touchAction: 'none' }`), change `cursor` to
     `isLocked ? 'not-allowed' : 'default'` and add `opacity: isLocked ? 0.7
     : 1` — this is the visible signal for the drag/resize/rotate/connect
     interactions that have no `disabled` attribute of their own.
   - `ElementPanel` and `ConnectionPanel` (and the `Swatches` sub-component
     they both use): add a `disabled: boolean` prop to all three, threaded
     from the parent as `disabled={isLocked}` at their two call sites (the
     `<ElementPanel .../>` and `<ConnectionPanel .../>` JSX near the bottom
     of the main component). Apply that prop to every interactive control
     inside them per the STYLE CONVENTION: the Label input, the Swatches
     preset buttons and the native `<input type="color">`, the Font size
     `<select>` and Bold button, the Size width/height inputs, the Rotate
     slider and Reset button, and both panels' own Delete button, plus
     ConnectionPanel's Line/Arrow/Path segmented-control buttons. Do not
     hide these panels while locked — a selected element/connection's
     properties must remain visible and readable, only uneditable, matching
     the "locking never hides data" rule in FORBIDDEN.

7. Module5_YamazumiChart.tsx — add `isLocked`. Gate:
   - the Takt Time `<input type="number">` and the "Update Benchmark" button
     (`handleSaveTaktTime`, which calls `updateTimeMeasurement`)
   - all three draggable row-bar blocks (regularRows, periodicalRows,
     changeoverRows): change `draggable={hasTimeStudy}` to
     `draggable={hasTimeStudy && !isLocked}` on each, and change their
     `cursor-grab` class to `cursor-not-allowed` when `isLocked` (keep the
     existing `cursor-grabbing`/`opacity-60` behavior for the row actually
     mid-drag — that can only happen when not locked, since dragging can no
     longer start)
   - add `if (isLocked) return;` as the first line of `handleOperatorDrop`
     (defense-in-depth alongside the `draggable` change, matching this
     file's own existing early-return style already used in
     `handleOperatorDragOver`'s `if (!hasTimeStudy) return;`)

8. TopBar.tsx — the Save button currently has
   `disabled={!activeFile || syncStatus === 'syncing'}` and shows
   `syncStatus === 'saved' ? '✓ Saved' : '☁ Save'`. Change to also disable
   when the active file is locked, with a distinct label so a locked chart
   never shows the generic "⚠ Sync Error" as the first thing the user sees
   when Save does nothing:
   ```tsx
   const isLocked = Boolean(activeFile?.lockedAt);
   // ...
   disabled={!activeFile || syncStatus === 'syncing' || isLocked}
   // ...
   {isLocked ? '🔒 Locked' : syncStatus === 'saved' ? '✓ Saved' : '☁ Save'}
   ```
   Leave the Export PNG/PDF buttons untouched — exporting a locked chart's
   current (frozen) view is not an edit and must keep working.

9. useChartStore.ts — `duplicateFile` only. In the `duplicatedFile` object
   construction (the object passed to `createFileCloud`), add
   `lockedAt: null,` explicitly (place it near `id`/`name`, matching where
   `lockedAt` sits in the `ChartFile` interface). This makes the local
   optimistic copy match what the server will actually store — see ROOT
   CAUSE for the full explanation. No other line of `duplicateFile`, and no
   other action in this file, may change.

10. tests/store.test.cjs — add one new test near the existing
    `'duplicateFile deep-copies steps and remaps layout connections'` test
    (around line 167), following the same `freshReadyStore()` pattern:
    create a file, set it `lockedAt` to a real ISO timestamp via
    `store.setState(...)` (or close a revision through the store's own
    `closeRevision` flow if that fixture is easier to reuse — your call),
    call `duplicateFile`, then assert the *new* file (not the original) has
    `lockedAt` equal to `null`. Also assert the ORIGINAL file's `lockedAt` is
    unchanged (still locked) — duplicating must never affect the source.

ACCEPTANCE CRITERIA
1. `isLocked` is computed identically (`Boolean(activeFile.lockedAt)`) in
   HeaderForm.tsx, Module1_TimeMeasurement.tsx, Module2_MachineCapacity.tsx,
   StepTable.tsx, LayoutDiagram.tsx, SummaryTable.tsx,
   Module5_YamazumiChart.tsx, and TopBar.tsx.
2. Every control listed in IMPLEMENTATION PLAN steps 1-8 is disabled/inert
   when `isLocked` is true and behaves exactly as it does today (zero
   behavior change) when `isLocked` is false.
3. Module3_CombinationTable.tsx has zero diff.
4. No read-only display anywhere (SummaryTable's computed cells, M3 entirely,
   M5's bars/labels/totals, StepTable's timeline SVG and footer, LayoutDiagram's
   canvas contents, every computed total in M1/M2) changes appearance or
   value because a chart is locked — only interactivity changes.
5. `duplicateFile` always produces a new file with `lockedAt: null`,
   regardless of whether the source was locked, without changing the
   source's own `lockedAt` — covered by the new test in step 10.
6. No store action other than `duplicateFile` changed in useChartStore.ts —
   diff the file and confirm every other export is byte-identical to before
   this task.
7. Every existing test continues to pass unmodified.
8. `node --test`, `npm run lint`, `npm run build`, `npx tsc --noEmit`,
   `git diff --check` all pass. Lint shows only the known pre-existing
   baseline (5 errors as of the last recorded baseline) — zero new errors in
   any file touched.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npx tsc --noEmit
- npm run build
- git diff --check
- Best-effort manual check: start the app locally (`npm run dev` is enough
  for this — Cloudflare Pages Dev is not required just to see disabled
  styling) and open any chart. Since nothing in your environment can
  actually close a real Revision against local D1, temporarily verify the
  disabled/greyed rendering by editing that one chart's `lockedAt` field
  directly in the browser's localStorage entry (`mm_chart_db_v2`) via
  DevTools, or by adding a throwaway `console.log`/temporary hardcoded
  `isLocked = true` while checking, then reverting it — whichever is faster
  in your environment. Confirm at least one field per file visually greys
  out and refuses input, and that read-only values (e.g. M5's bars, M2's
  Capacity numbers) are still fully visible. This does not need to be
  exhaustive per-field — Claude will do the full close→verify-every-
  module→open cycle against a real local Pages Dev + D1 environment
  afterward, the same way Phase 5a-1's HeaderForm gating was verified. State
  clearly in your report which parts you were and were not able to check
  given your environment's constraints.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries) recording:
files changed, a summary of which controls were gated in each file, the
`duplicateFile` fix and its new test, and the verification results above.
Explicitly state this is Phase 5a-2 of Phase 5 (M6 Kaizen + Before/After),
that Phase 5b (the Before/After page) is separately scoped next, and that no
schema, API, or Production change of any kind occurred (this phase is
frontend-only).

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Exact files read
- Exact files changed (must match REQUIRED SCOPE exactly)
- A short per-file confirmation of which controls were gated (matching
  IMPLEMENTATION PLAN steps 1-8), so Claude's diff review has a checklist
- Confirmation that no store action other than `duplicateFile` changed in
  useChartStore.ts, and the exact diff of that one change
- Exact test/lint/tsc/build/diff-check output
- Manual verification result, stating plainly which files you were able to
  visually check locked-state rendering for and which you could not, and why
- Any scope question or ambiguity you hit and how you resolved it, or why
  you stopped instead
- Explicit statement: no commit, push, deploy, schema change, or API change
  occurred
- Next action: return this handoff to Claude for review. Do not proceed to
  Phase 5b or any release/migration action yourself.
```
