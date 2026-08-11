# Prompt — Codex Implementation: Phase 5b-2, M6 Kaizen Sheet Form

Paste this whole block into Codex / GPT-5.6 Luna Max. This is an
IMPLEMENT_ONLY handoff written by Claude, the second sub-phase of Phase 5b
(M6 Kaizen page). Phase 5b-1 (the Before/After Revision comparison view) is
already implemented, fixed, reviewed, live-verified, and deployed to
Production — do not modify `kaizen-compare.ts` or the existing comparison
section of `Module6_Kaizen.tsx` in any way. This phase adds a new,
independent section to the SAME file: an editable Kaizen problem/
countermeasure form that lives on the active (current, editable) chart, the
same way HeaderForm/M1/M2 data does. Do not redesign the approach, do not
expand scope. When done, report back to **Claude** (not the user directly)
using the REQUIRED HANDOFF OUTPUT format at the end.

```text
ROLE: Codex / GPT-5.6 Luna Max — implementation only
MODE: IMPLEMENT_ONLY — build exactly the plan below; do not redesign, do not
expand scope. Do NOT touch kaizen-compare.ts, the existing Revision
comparison section/pickers already in Module6_Kaizen.tsx, or any Phase 5b-1
behavior. Do NOT implement photo/image attachment for the Before/After
fields — they are plain text for this phase; photo support is a separately
scoped future phase (Phase 5b-3), noted but not built here.

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Phase 5b-1 shipped the read-only "compare two closed Revisions" half of
Module 6. This phase builds the other half: the actual Kaizen paperwork —
Problem, Solution, a repeatable list of improvement details with a
priority rating and the response taken for each, an overall result, and
one responsible person + due date for the whole sheet. Unlike 5b-1 (which
only ever reads frozen Revision snapshots), this section edits the live,
currently-open chart, exactly the way HeaderForm/M1/M2 already do — it is
part of `ChartFile.content`, dirtied by editing, and persisted only when
the user clicks the existing global "☁ Save" button in TopBar. There is no
new save button and no new API endpoint.

Claude inspected the actual source Excel "kaizen" sheet directly (both
`Docs_StandardWork_Reference/3 TEN SET Line SUV_Rev.01.xlsx` and
`Docs_StandardWork_Reference/แบบฟอร์มตารางจับเวลา 1.xlsx` — both blank
company-standard templates, identical structure) since the machine has no
working Python interpreter to run `openpyxl`/`pandas` (confirmed again this
session; worked around it by parsing the `.xlsx` zip/XML directly). The
real sheet is laid out as:
- Header boilerplate (Line / Day / Process / Report) — not reproduced here,
  it duplicates `ChartHeader` fields the app already has.
- **BEFORE** / **AFTER** — two large blank boxes, most likely meant for a
  photo or diagram of the work station, not numbers (the numeric Before/
  After already exists via Phase 5b-1's Revision comparison). This phase
  ships them as plain multi-line text description fields only.
- **Problem :** and **Solution :** — two separate single-purpose text
  fields.
- A **Detail** table, 7 printed rows on paper (this web form must NOT cap
  it at 7 — make it an unlimited add/delete list, matching every other
  table in this app): each row is a free-text Detail description, a 1-5
  numbered rating (the paper form's exact meaning isn't determinable from
  a blank template — treat it neutrally as a priority/effectiveness rating
  1-5, selectable, optional/nullable), a RESPONSE text field, and an EVA
  (evaluation) text field.
- One overall **RESULT** text box at the end of the table (not one per
  row).

Master_Plan.html's original section-6 summary said this form also has a
"ผู้รับผิดชอบ" (responsible person) and "กำหนดเสร็จ" (due date) field —
those are genuinely NOT on the physical sheet, but the user explicitly
confirmed keeping them anyway (standard Kaizen action-tracking practice),
as **one shared pair for the whole Kaizen sheet**, not per Detail row.

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- src/types/index.ts
- src/lib/storage.ts
- src/store/useChartStore.ts
- src/components/modules/Module6_Kaizen.tsx
- tests/store.test.cjs
- tests/revisions.test.cjs
- tests/storage.test.cjs
- CHANGELOG_AI.md

AMENDMENT (added after an earlier attempt correctly stopped at
PLAN_CHANGE_REQUIRED): the original draft of this prompt omitted
`src/lib/storage.ts` from scope, wrongly assuming a new optional
`ChartFile` field would flow through Cloud save/read-back/Revision-close
automatically. It does not — `storage.ts` has a single canonical helper,
`chartFileContent()`, that both `createFileCloud`/`saveFileCloud`'s
payload AND `useChartStore.ts`'s save read-back check
(`chartContentMatches`, which spreads `...chartFileContent(f)`) already
funnel through, specifically to prevent silently dropping a field the way
`timeMeasurement`/`timeStudy`/`machineCapacity` were once dropped (see the
comment directly above `chartFileContent` in storage.ts). Revision-close
itself (`functions/api/revisions.js`) needs no change — it copies the
already-saved `chart_files.content` column server-side with zero client
involvement, so once `chartFileContent()` correctly includes `kaizen`,
Revision snapshots correctly inherit it for free. `src/lib/storage.ts` is
now in scope for exactly one addition (Implementation step 1 below) — the
FORBIDDEN list's ban on touching `functions/api/*.js`/`schema.sql` is
unchanged and still correct, do not touch those.

READ FIRST — exact paths, in this order
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
   — "Business Rules สำคัญ" and "High-Risk Files" (both `src/types/index.ts`
   and `src/store/useChartStore.ts` are listed there — narrow, additive
   patches only)
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
   (latest entries — Updates 20-21, the Phase 5b-1 fix + release)
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/types/index.ts
   (full file — especially `ChartFile`, `RevisionSnapshotContent`, and how
   `machineCapacity`/`timeStudy` were added as optional fields to both)
3a. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts
   (full file — especially `chartFileContent()` around line 166-185 and its
   comment block, `createFileCloud`, `saveFileCloud`; this is the single
   place a new `ChartFile` content field must be registered or it silently
   never reaches Cloud)
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
   (full file — especially `updateMachineCapacity` and
   `importMachineCapacityFromTimeStudy`'s `emptyMachineCapacity()` seed
   pattern around line 760-785: this is the exact convention
   `updateKaizen`/`emptyKaizenSheet()` must mirror — replace-whole-object
   action, `updatedAt` bump, `persistLocal`, no lock check inside the store
   action itself, since Phase 5a-2 enforces locking at the UI/`disabled`
   level, not the store level; also read `chartContentMatches` around line
   139-154, which spreads `...chartFileContent(f)` — confirms fixing
   `storage.ts`'s helper alone is sufficient, do not add a second, separate
   field list here)
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module2_MachineCapacity.tsx
   (full file — the closest structural match: a scalar-fields-plus-
   repeatable-rows form with add/delete-row buttons and the exact
   `const isLocked = Boolean(activeFile.lockedAt);` + `disabled={isLocked}`
   pattern on every input/button, which every new Kaizen Sheet control in
   this phase must use identically)
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module6_Kaizen.tsx
   (full file — the existing Phase 5b-1 comparison section you are adding
   a new section to, NOT modifying; match its `'use client'`,
   `useChartStore(s => s.activeFile())`, Tailwind styling conventions,
   `w-full max-w-6xl space-y-6` container rhythm)
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
   section 6 ("Kaizen Loop และหน้าสรุป Before / After") for the narrative
   framing already agreed
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/store.test.cjs
   and D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/revisions.test.cjs
   (existing test patterns — how store action tests and revision-snapshot-
   content tests are structured, to keep new tests consistent)

PREFLIGHT
- Run: git status --short --branch
- Preserve all existing uncommitted/untracked files exactly as found. Do not
  reset, checkout, restore, delete, or run any broad cleanup.
- If anything unexpected is already in the working tree beyond this
  project's normal documentation churn, stop and report before touching
  anything.

FORBIDDEN
- Do not edit any file outside the list in REQUIRED SCOPE. In particular, do
  not touch `src/lib/kaizen-compare.ts`, `functions/api/*.js`, or
  `schema.sql` — this phase is a purely additive JSON field inside the
  existing `content` blob already round-tripped by the existing files/
  revisions endpoints. No API or schema change is needed or allowed.
- Do not modify the existing Phase 5b-1 comparison section, its pickers, or
  any of its rendering logic in `Module6_Kaizen.tsx` — only add a new,
  clearly separate section (place it above the existing "Kaizen Before /
  After Comparison" header, in the same returned JSX tree).
- Do not implement photo/image upload, attachment, or storage of any kind
  for the Before/After fields — plain multi-line text only this phase.
- Do not cap the Detail list at 7 rows — unlimited add/delete, like every
  other row-based table in this app (M1, M2, M4).
- Do not add per-row responsible/due-date fields — exactly one shared pair
  for the whole sheet, not one per Detail row.
- Do not add a dedicated Save button or any new persistence path for this
  section — it must dirty the active file and save through the existing
  global TopBar "☁ Save" flow only, exactly like HeaderForm/M1/M2 fields.
- Do not add a lock check inside the new store action — follow
  `updateMachineCapacity`'s exact convention (no lock check in the store;
  the UI disables inputs instead).
- If this turns out to require touching a file outside REQUIRED SCOPE, or
  changing any existing endpoint's response shape, existing module's
  behavior, or the Phase 5b-1 comparison section, STOP and report
  `PLAN_CHANGE_REQUIRED` with the specific reason.
- Do not commit, push, deploy, or run any git-mutating command.

IMPLEMENTATION PLAN

1. src/lib/storage.ts — after step 2 adds `kaizen` to `ChartFile`, add
   exactly one line to `chartFileContent()`'s returned object literal:
   `kaizen: file.kaizen,` alongside the existing `timeStudy`/
   `machineCapacity` lines. Nothing else in this file changes — do not
   touch `createFileCloud`, `saveFileCloud`, or any other function; they
   already call `chartFileContent(file)` and need no direct edit.

2. src/types/index.ts — add, near `MachineCapacity`/before `ChartFile`:
   ```ts
   // ── Module 6: Kaizen Sheet (ใบ Kaizen) ──────────────────────────────────
   export interface KaizenDetailRow {
     id: string;
     detail: string;
     /** 1-5 priority/effectiveness rating from the paper form's numbered
      * columns; the team's own convention decides what it means. */
     priority: number | null;
     response: string;
     eva: string;
   }

   export interface KaizenSheet {
     problem: string;
     solution: string;
     /** Free-text description of the before/after work-station state.
      * Photo/image attachment is a planned future addition (Phase 5b-3),
      * not implemented here. */
     beforeNote: string;
     afterNote: string;
     details: KaizenDetailRow[];
     /** One overall result, not per Detail row. */
     result: string;
     /** One owner + one due date for the whole sheet, not per row. */
     responsiblePerson: string;
     dueDate: string; // ISO date string, same convention as ChartHeader.issueDate
   }
   ```
   Then extend `ChartFile` with `kaizen?: KaizenSheet;` (optional, same as
   `timeStudy`/`machineCapacity`) and extend the `RevisionSnapshotContent`
   `Pick<ChartFile, ...>` union to include `'kaizen'`, so closing a
   Revision freezes the Kaizen sheet content exactly like every other
   module's data.

3. src/store/useChartStore.ts — mirror `emptyMachineCapacity()` and
   `updateMachineCapacity` exactly:
   - Add `emptyKaizenSheet(): KaizenSheet` returning all-empty-string
     fields, `details: []`.
   - Add `updateKaizen: (kaizen: KaizenSheet) => void;` to the store
     interface and implement it identically to `updateMachineCapacity`
     (replace `f.kaizen` with the given object, bump `updatedAt`,
     `persistLocal`, no lock check).
   - Do not add any import/export/seed helper beyond what this needs.

4. src/components/modules/Module6_Kaizen.tsx — add a new section, above the
   existing "Kaizen Before / After Comparison" `<header>`, inside the same
   top-level `<div className="w-full max-w-6xl space-y-6">` the component
   already returns:
   - Compute `const isLocked = Boolean(activeFile.lockedAt);` (this
     component does not currently have this constant — add it once, near
     the top of the component body, after the existing `if (!activeFile)`
     guard).
   - Read `const kaizen = activeFile.kaizen ?? emptyKaizenSheet();` (import
     `emptyKaizenSheet` from the store) so existing charts without the
     field render an empty form instead of crashing.
   - A local helper `const patchKaizen = (partial: Partial<KaizenSheet>) =>
     updateKaizen({ ...kaizen, ...partial });` to keep each field's
     `onChange` handler a one-liner, matching this project's terse update-
     handler style elsewhere.
   - Card 1: "Problem" and "Solution" — two labeled `<textarea>`s,
     side-by-side on wide screens (reuse the existing 2-column grid
     pattern already visible in the comparison section's metrics table
     styling), each `disabled={isLocked}`.
   - Card 2: "Before" and "After" — two labeled `<textarea>`s, side-by-
     side, each with placeholder text noting these are text notes (e.g.
     "Describe the before state — photo attachment coming in a later
     phase."), each `disabled={isLocked}`.
   - Card 3: "Kaizen Details" — a table with columns Detail (text input),
     Priority (a `<select>` with options "—", 1, 2, 3, 4, 5, storing
     `null` for "—"), Response (text input), Eva (text input), and a
     delete-row button per row (`disabled={isLocked}`), plus an
     "+ Add Detail" button below the table (`disabled={isLocked}`) that
     appends a new `KaizenDetailRow` with a fresh `uuidv4()` id and empty
     fields. Adding/removing/editing a row calls `patchKaizen({ details:
     ... })` with the updated array — do not call `updateKaizen` directly
     from row-level handlers, always go through `patchKaizen` for
     consistency.
   - Card 4: "Result" — one labeled `<textarea>`, plus "Responsible
     Person" (text input) and "Due Date" (date input, same `<input
     type="date">` convention `ChartHeader.issueDate` already uses
     elsewhere in this app) on the same row, all `disabled={isLocked}`.
   - Match this component's and Module2's existing Tailwind conventions
     exactly (rounded-xl border shadow-sm cards, slate color palette,
     text-sm labels) — do not invent a new visual style.

5. Tests:
   - tests/storage.test.cjs: add a test asserting `chartFileContent()`
     includes a populated `kaizen` object in its returned object, and that
     a `ChartFile` with no `kaizen` field produces a `content` object
     without crashing (mirror however `timeStudy`/`machineCapacity` are
     already covered there, if at all — if `chartFileContent` itself has no
     existing direct test, add one; do not skip this).
   - tests/store.test.cjs: add tests for `updateKaizen` mirroring whatever
     test already exists for `updateMachineCapacity` (if none exists for
     `updateMachineCapacity`, mirror `updateHeader`'s test instead) —
     cover: updating a file with no prior `kaizen` field sets it correctly,
     updating again replaces it wholesale, `updatedAt` changes, no lock
     check blocks it at the store level (that's a UI-level concern, out of
     scope for this store-level test).
   - tests/revisions.test.cjs: extend whatever test already asserts which
     fields `RevisionSnapshotContent`/`closeRevision` carries into a
     snapshot (mirror the existing assertion style for `timeStudy`/
     `machineCapacity`) to also assert a populated `kaizen` object survives
     into the closed snapshot's `content`, and that a chart with no
     `kaizen` field closes cleanly without error (snapshot's `content.kaizen`
     is simply `undefined`, not a crash).

ACCEPTANCE CRITERIA
1. `ChartFile.kaizen` is optional; every existing chart (which has no
   `kaizen` field) still opens, renders, and saves without error — the new
   section renders an empty form via `emptyKaizenSheet()`, not a crash.
2. `chartFileContent()` in `storage.ts` includes `kaizen`, so it actually
   reaches Cloud on Save, survives the save's own read-back comparison
   (`chartContentMatches`), and — since Revision-close copies the
   already-saved `chart_files.content` column server-side — closing a
   Revision includes `kaizen` (when present) in the frozen snapshot too,
   verified by tests at both layers, without changing `closeRevision`'s
   existing guard/ordering behavior for any other field.
3. Every new input/button in the new section is `disabled` exactly when
   `activeFile.lockedAt` is truthy, matching the identical pattern already
   used by every other module (verify by reading Module2's pattern, not by
   inventing a new one).
4. The Kaizen Details list has no row-count cap; add/delete both work and
   editing any field of any row leaves every other row untouched.
5. No dedicated save button, API call, or new persistence path exists for
   this section — editing any field only changes in-memory/local state
   (dirties the file) exactly like HeaderForm/M1/M2; the existing global
   Save button in TopBar is what actually persists it (do not add a test
   that expects a network call from this section — there isn't one).
6. The existing Phase 5b-1 comparison section (`kaizen-compare.ts`,
   pickers, metrics table, overlaid chart) is byte-for-byte unchanged in
   behavior — diff review must show only additive changes to
   `Module6_Kaizen.tsx`, nothing removed or altered in the existing
   comparison code path.
7. Every existing test continues to pass unmodified.
8. `node --test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
   `git diff --check` all pass. Lint shows only the known pre-existing
   baseline (5 errors as of the last recorded baseline) — zero new errors
   in any file you touched.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npx tsc --noEmit
- npm run build
- git diff --check
- Best-effort manual check: start the app locally (`npm run dev` is enough
  — this phase makes no new API/D1 call, it only changes local/persisted
  JSON content the existing save path already handles) and open any chart.
  Confirm the new Kaizen Sheet section renders above the comparison
  section, typing in each field works, Add/Delete Detail row works, and
  the browser console shows no error. If the chart is locked, confirm
  every new control is visibly disabled instead. State plainly what you
  were and were not able to check in your environment — Claude will do the
  full live D1 save/reload/revision-close round-trip check afterward, the
  same way prior UI-facing phases were verified.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries) recording:
files changed, the exact `KaizenSheet`/`KaizenDetailRow` shape as actually
implemented (note any deliberate deviation from this prompt's draft and
why), the `updateKaizen`/`emptyKaizenSheet` contract, and the verification
results above. Explicitly state this is Phase 5b-2 of Phase 5b (M6 Kaizen
page), that photo/image attachment for Before/After is intentionally
deferred to a future phase, and that no schema, API, or Production change
of any kind occurred (this phase only extends the existing JSON content
shape already round-tripped by existing endpoints).

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Exact files read
- Exact files changed (must match REQUIRED SCOPE exactly)
- The exact final `KaizenSheet`/`KaizenDetailRow` shape and
  `updateKaizen`/`emptyKaizenSheet` contracts (confirm they match the plan
  or note any deliberate deviation and why)
- Exact test/lint/tsc/build/diff-check output
- Manual verification result, stating plainly what you were and were not
  able to check in your environment
- Any scope question or ambiguity you hit and how you resolved it, or why
  you stopped instead
- Explicit statement: no commit, push, deploy, or Production/schema/API
  change occurred
- Next action: return this handoff to Claude for review. Do not proceed to
  any further phase or release/migration action yourself.
```
