# Prompt — Codex Fix: Phase 5b-3, M1/M6 Photo-Upload Lost-Update Race

Paste this whole block into Codex / GPT-5.6 Luna Max. This is a targeted
FIX_ONLY follow-up to the Phase 5b-3 + M1 PIC implementation already sitting
uncommitted in the working tree (`wrangler.toml`, `functions/api/photos.js`,
the `photoKey`/`beforePhotoKey`/`afterPhotoKey` fields, `PhotoSlot.tsx`, and
the M1/M6 wiring). Report back to **Claude**, not the user.

```text
ROLE: Codex / GPT-5.6 Luna Max — fix only
MODE: FIX_ONLY — fix exactly the bug below. Do not refactor unrelated code,
do not touch any file outside REQUIRED SCOPE, do not change the upload
endpoint, storage helpers, types, or PhotoSlot component — none of those are
implicated in this bug.

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Claude found this by reading the actual current source in this session —
not by reproducing it live in a browser yet (this machine has not run a
local Pages Dev + R2 simulation against this code at all so far). Treat the
ROOT CAUSE below as a high-confidence static-analysis finding, not a
confirmed live reproduction — Codex's own fix must still pass this
project's normal test suite, and Claude will attempt real live
verification (concurrent Before/After upload in M6, concurrent two-row
upload in M1) after this fix lands, the same way every other UI-facing
phase this project has shipped was verified.

ROOT CAUSE (verified directly against the real files on disk)
`src/components/modules/Module6_Kaizen.tsx` currently defines, near the top
of the component body:
```tsx
const updateKaizen = useChartStore(s => s.updateKaizen);
...
const kaizen = activeFile.kaizen ?? emptyKaizenSheet();
const patchKaizen = (partial: Partial<KaizenSheet>) => updateKaizen({ ...kaizen, ...partial });
```
`patchKaizen` closes over `kaizen`, a snapshot taken at render time. The two
`PhotoSlot`s added for Phase 5b-3 call
`onChange={key => patchKaizen({ beforePhotoKey: key })}` (and the
`afterPhotoKey` equivalent) — but `PhotoSlot`'s `onChange` only fires later,
after `uploadPhotoCloud`'s network round trip resolves (confirmed in
`src/components/shared/PhotoSlot.tsx`'s `handleFileChange`). If the OTHER
photo slot's upload resolves first and calls `updateKaizen(...)` in
between, the store's real `kaizen` has moved on — but the still-pending
closure has no way to know that. When it finally fires, it calls
`updateKaizen({ ...STALE_kaizen, afterPhotoKey: key })`, and the store's
`updateKaizen` action (confirmed in `src/store/useChartStore.ts`) does a
full, unconditional replace of `f.kaizen` with whatever object it's handed:
```tsx
updateKaizen(kaizen) {
  set(s => ({ ...s, files: s.files.map(f => f.id === s.activeFileId ? { ...f, kaizen, updatedAt: ... } : f) }));
}
```
— it never merges against the CURRENT `f.kaizen`, it trusts the caller
already did that. The stale closure's merge was against outdated data, so
the earlier, already-committed `beforePhotoKey` write gets silently
overwritten back to whatever it was before either upload started. This is a
classic stale-closure-over-async-state lost update, and it is fully
deterministic given this code shape — it does not depend on network timing
being unusually slow, only on two uploads' resolution order overlapping at
all.

`src/components/modules/Module1_TimeMeasurement.tsx` has the identical
shape, confirmed directly:
```tsx
const study = activeFile?.timeStudy ?? emptyStudy();
const updateTimeStudy = useChartStore(s => s.updateTimeStudy);
const commit = (next: TimeStudy) => updateTimeStudy(next);
const patchRow = (id: string, patch: Partial<(typeof study.rows)[number]>) =>
  commit({ ...study, rows: study.rows.map(r => (r.id === id ? { ...r, ...patch } : r)) });
```
closing over `study`, with `commit` → `updateTimeStudy` also doing an
unconditional full replace (confirmed in `useChartStore.ts`). Two rows'
`PhotoSlot`s racing (or any other `patchRow` call racing a pending upload)
reproduces the same class of loss.

This is a new risk, not a pre-existing one: every OTHER caller of
`patchKaizen`/`patchRow` (typing in a text field, changing a dropdown) is a
synchronous event handler with no `await` in between — there was never a
window for the store to change out from under the closure before this
phase. `PhotoSlot` is the first consumer that commits a value from inside
an async callback, and it exposed a latent unsafety in how `patchKaizen`/
`patchRow` are built. This codebase already has the SAFE version of this
pattern elsewhere in the very same store — `updateTimeMeasurement` (also
confirmed directly, `useChartStore.ts` around line 693) merges `partial`
against `f.timeMeasurement` read fresh from `s` INSIDE the `set()` updater,
never from an outer closure variable:
```tsx
updateTimeMeasurement(partial) {
  set(s => {
    if (!s.activeFileId) return s;
    const next = { ...s, files: s.files.map(f =>
      f.id === s.activeFileId
        ? { ...f, timeMeasurement: { ...(f.timeMeasurement || { laps: [], minTime: 0, maxTime: 0, avgTime: 0, fluctuation: 0, taktTime: 0 }), ...partial }, updatedAt: new Date().toISOString() }
        : f
    )};
    persistLocal(next);
    return next;
  });
},
```
The fix below brings `kaizen`/`timeStudy` row updates onto this same
already-established safe pattern, since `set()`'s updater callback always
receives the true current state at the moment it actually runs, immune to
how long ago the caller was created.

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- src/store/useChartStore.ts
- src/components/modules/Module1_TimeMeasurement.tsx
- src/components/modules/Module6_Kaizen.tsx
- tests/store.test.cjs
- CHANGELOG_AI.md

READ FIRST
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
   (full file — especially `updateTimeMeasurement` as the pattern to
   mirror, `updateKaizen`/`updateTimeStudy` as the unsafe pattern being
   replaced, `emptyKaizenSheet()`, and wherever the store's action types
   are declared)
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module1_TimeMeasurement.tsx
   (full file — `patchRow`'s definition and every call site: jobElement
   input, the PIC `PhotoSlot`, operator select, kind select, category
   select)
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module6_Kaizen.tsx
   (full file — `patchKaizen`'s definition, `patchDetail`/`addDetail`/
   `deleteDetail`, and every field that calls `patchKaizen` directly,
   including the two `PhotoSlot`s)
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/store.test.cjs
   (existing test patterns for store actions, to keep new tests consistent)

PREFLIGHT
- Run: git status --short --branch
- The Phase 5b-3 implementation (wrangler.toml, functions/api/photos.js,
  src/types/index.ts, src/lib/storage.ts, PhotoSlot.tsx, and the two module
  files) is already sitting uncommitted in the working tree — this fix
  builds directly on top of it, in place. Do not revert, discard, or
  re-implement any of it.
- `docs/Master_Plan.html` and `docs/AI_PROMPTS/PROMPT_CLAUDE_00B_FRESH_SESSION_CONTINUE.md`
  may also show as modified — leave them exactly as found; they are
  unrelated in-progress documentation work.
- If anything else unexpected is in the working tree, stop and report
  before touching anything.

FORBIDDEN
- Do not touch functions/api/photos.js, src/lib/storage.ts,
  src/types/index.ts, src/components/shared/PhotoSlot.tsx, or wrangler.toml.
- Do not change `patchDetail`/`addDetail`/`deleteDetail` in
  Module6_Kaizen.tsx, or `addRow`/`insertRow`/`deleteRow`/`moveRow`/
  `setReading`/`setReadingCount`/`handlePaste` in Module1_TimeMeasurement.tsx
  — none of these have an async gap, none of them are broken, do not add
  risk by touching them.
- Do not remove the `updateKaizen`/`updateTimeStudy` store actions
  themselves — they are still correct, general-purpose whole-object-replace
  actions and existing tests may depend on them. Only stop using
  `updateKaizen` as `patchKaizen`'s implementation inside
  `Module6_Kaizen.tsx` specifically (see FIX).
- Do not introduce a second, differently-named "safe" patch helper that
  callers must remember to choose correctly — the whole point of this fix
  is that `patchKaizen`/`patchRow` become unconditionally safe for every
  caller, sync or async, with zero call-site changes required elsewhere in
  either file.
- If this turns out to require touching a file outside REQUIRED SCOPE, STOP
  and report `PLAN_CHANGE_REQUIRED` with the specific reason.
- Do not commit, push, deploy, or run any git-mutating command.

FIX

1. src/store/useChartStore.ts — add two new actions, mirroring
   `updateTimeMeasurement`'s exact pattern (merge inside `set()`, reading
   the current file's state fresh, not a passed-in pre-merged object). Add
   their signatures alongside the other action declarations (near
   `updateKaizen`/`pushTimeStudyToSteps`):
   ```ts
   patchKaizen: (partial: Partial<KaizenSheet>) => void;
   patchTimeStudyRow: (rowId: string, patch: Partial<TimeStudyRow>) => void;
   ```
   Implement, near `updateKaizen`:
   ```ts
   patchKaizen(partial) {
     set(s => {
       if (!s.activeFileId) return s;
       const next = {
         ...s,
         files: s.files.map(f =>
           f.id === s.activeFileId
             ? { ...f, kaizen: { ...(f.kaizen ?? emptyKaizenSheet()), ...partial }, updatedAt: new Date().toISOString() }
             : f
         ),
       };
       persistLocal(next);
       return next;
     });
   },
   ```
   Implement, near `updateTimeStudy`:
   ```ts
   patchTimeStudyRow(rowId, patch) {
     set(s => {
       if (!s.activeFileId) return s;
       const next = {
         ...s,
         files: s.files.map(f => {
           if (f.id !== s.activeFileId || !f.timeStudy) return f;
           return {
             ...f,
             timeStudy: { ...f.timeStudy, rows: f.timeStudy.rows.map(r => (r.id === rowId ? { ...r, ...patch } : r)) },
             updatedAt: new Date().toISOString(),
           };
         }),
       };
       persistLocal(next);
       return next;
     });
   },
   ```
   Both read the file/kaizen/row to merge against from `s` — the state
   Zustand's `set` callback receives at the moment it actually runs — never
   from an outer-scope variable. This is what makes them safe regardless of
   how long an async caller waited before calling them.

2. src/components/modules/Module6_Kaizen.tsx — change ONLY how `patchKaizen`
   is obtained/implemented, not any of its call sites:
   ```tsx
   const patchKaizen = useChartStore(s => s.patchKaizen);
   ```
   replacing the existing:
   ```tsx
   const updateKaizen = useChartStore(s => s.updateKaizen); // this selector line
   ...
   const patchKaizen = (partial: Partial<KaizenSheet>) => updateKaizen({ ...kaizen, ...partial }); // this local definition
   ```
   Remove the now-unused `updateKaizen` selector from this file (confirm
   nothing else in the file calls it directly — it should not). Keep
   `const kaizen = activeFile.kaizen ?? emptyKaizenSheet();` exactly as-is —
   it is still needed for reading current values into every field's
   `value={...}`. Every existing call site (`patchKaizen({ problem: ... })`,
   `patchDetail`, the two `PhotoSlot` `onChange` handlers, etc.) needs no
   change — the new `patchKaizen` has the same
   `(partial: Partial<KaizenSheet>) => void` signature.

3. src/components/modules/Module1_TimeMeasurement.tsx — change ONLY
   `patchRow`'s body, not its call sites:
   ```tsx
   const patchTimeStudyRow = useChartStore(s => s.patchTimeStudyRow);
   const patchRow = (id: string, patch: Partial<(typeof study.rows)[number]>) =>
     patchTimeStudyRow(id, patch);
   ```
   replacing the existing closure-based body. Every existing call site
   (`patchRow(row.id, { jobElement: ... })`, the operator/kind/category
   selects, the PIC `PhotoSlot`) needs no change. `commit`/`updateTimeStudy`
   remain used by every other function in this file (`addRow`, `insertRow`,
   `deleteRow`, `moveRow`, `setReading`, `setReadingCount`,
   `handlePaste`) — leave all of those untouched.

4. Tests — tests/store.test.cjs: add tests proving the new actions merge
   against the store's actual current state rather than a caller-supplied
   snapshot (this is what actually matters — it does not require
   simulating real async timing, since the fix works precisely by removing
   the closure dependency; two sequential calls against the live store
   already exercise the exact mechanism that was broken):
   - A test that calls `patchKaizen({ beforePhotoKey: 'a' })` then
     `patchKaizen({ afterPhotoKey: 'b' })` on the same file and asserts
     BOTH keys are present afterward (this is the exact scenario that would
     silently lose `beforePhotoKey` under the old closure-based
     implementation).
   - A test that calls `patchKaizen` when the file has no prior `kaizen` at
     all, confirming it seeds from `emptyKaizenSheet()` correctly (mirror
     whatever the existing `updateKaizen`-from-empty test already covers).
   - A test that calls `patchTimeStudyRow` on two different row ids in the
     same file and asserts both rows' patches are present afterward, and
     that unrelated fields on either row are untouched.

ACCEPTANCE CRITERIA
1. `useChartStore.ts` has `patchKaizen`/`patchTimeStudyRow` actions that
   merge against state read inside their `set()` callback, matching
   `updateTimeMeasurement`'s existing pattern.
2. `updateKaizen`/`updateTimeStudy` still exist, unchanged, and still work
   for any other existing caller/test.
3. `Module6_Kaizen.tsx`'s `patchKaizen` and `Module1_TimeMeasurement.tsx`'s
   `patchRow` are the ONLY things that changed in either file — same name,
   same signature, zero call-site edits anywhere else in either file.
4. The new store-level tests pass and directly demonstrate the lost-update
   scenario is fixed (two sequential partial patches to different fields
   both survive).
5. Every existing test continues to pass unmodified.
6. `node --test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
   `git diff --check` all pass, zero new errors in any file you touched.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npx tsc --noEmit
- npm run build
- git diff --check
- Manual check, best effort given your environment's known constraints (no
  local `wrangler`/Pages Dev, per the prior round's report): if you cannot
  reach a real browser state, say so plainly rather than guessing — do not
  claim a live reproduction you did not actually run. Claude will run the
  real live reproduction (concurrent Before/After upload in M6, concurrent
  two-row upload in M1, against real local Pages Dev + D1 + R2 simulation)
  to confirm both are fixed.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries): state
plainly that this is a fix for a lost-update race Claude identified by
reading the Phase 5b-3 implementation's source (a static-analysis finding,
not a live reproduction — be explicit about that distinction, do not claim
live verification that did not happen), name the fix (new `patchKaizen`/
`patchTimeStudyRow` store actions that merge against fresh state inside
`set()`, mirroring the already-existing `updateTimeMeasurement` pattern),
and record the verification results above exactly as they actually ran —
do not describe any check, browser interaction, or verification step that
was not actually performed in this round.

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Confirm the exact diff matches the FIX section above (or note any
  deliberate deviation and why)
- Exact test/lint/tsc/build/diff-check output
- Manual verification result — whether you were able to reach a real
  browser state, or why not; do not claim a check you did not run
- Explicit statement: no commit, push, deploy, or Production/schema/API
  change occurred
- Next action: return this handoff to Claude for review and re-verification.
  Do not proceed to any further phase or release action yourself.
```
