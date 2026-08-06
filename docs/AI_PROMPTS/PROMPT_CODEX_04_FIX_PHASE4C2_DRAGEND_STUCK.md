# Prompt — Codex Fix: Phase 4c-2 drag state stuck after a successful cross-operator move

Paste this whole block into Codex / GPT-5.6 Luna Max. This is a targeted
FIX_RETEST handoff — one bug found during Claude's independent review of the
Phase 4c-2 implementation. Fix only this; do not touch anything else, do not
redesign the drag feature.

```text
ROLE: Codex / GPT-5.6 Luna Max — targeted bug fix, retest only
MODE: FIX_RETEST — fix exactly the one finding below, nothing else

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CLAUDE'S FINDING (verified by direct DOM inspection after simulating a real
drag-and-drop sequence, not just reading the code)

Bug: after a successful drag that moves a job element to a DIFFERENT
operator, the drag UI state never resets. The "No work yet" placeholder
columns (meant to appear only while a drag is in progress) stay visible
permanently, and the just-moved segment stays stuck with
`opacity-60 cursor-grabbing` styling forever, until the user navigates away
from Module 5 and back.

Root cause: `handleOperatorDrop` in `Module5_YamazumiChart.tsx` calls
`updateTimeStudy(moveRowToOperator(...))`, which causes an immediate
re-render that moves the dragged segment's DOM node to a different position
in the tree (under the destination operator instead of the source). By the
time the browser's native `dragend` event fires on the original source
element, that element has already been detached from the document by
React's re-render — so the event never bubbles up to React's root listener,
and `handleRowDragEnd()` (which is the ONLY place that calls
`setDraggingRowId(null)`) never runs. This reproduces on every successful
cross-operator move — the primary use case of the whole feature — not on a
same-operator drop (which returns early before calling `updateTimeStudy`,
so no re-render/detachment happens, so `dragend` fires normally in that
case).

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- src/components/modules/Module5_YamazumiChart.tsx
- CHANGELOG_AI.md

READ FIRST
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md (the Phase 4c-2 entry you wrote)
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module5_YamazumiChart.tsx
   — specifically `handleOperatorDrop`, `handleRowDragEnd`, and the
   `draggingRowId`/`draggingOverOperator` state declarations

PREFLIGHT
- Run: git status --short --branch
- Confirm the working tree still has exactly your Phase 4c-2 changes to
  these files (nothing else should have moved in the meantime).

FORBIDDEN
- Do not edit any file outside the 2 listed above.
- Do not change the drag/drop feature's design, the placeholder-column
  behavior, `moveRowToOperator`, or anything in time-study.ts.
- Do not commit, push, deploy, or run any git-mutating command.
- Do not write to Production D1, use `--remote`, run a migration, reset, or
  seed anything.

THE FIX
In `handleOperatorDrop`, clear BOTH pieces of drag state from inside the
drop handler itself — do not rely solely on `onDragEnd` firing on the source
element, since it's unreliable exactly when the move actually succeeds (see
root cause above). Add `setDraggingRowId(null);` alongside the existing
`setDraggingOverOperator(null);` in `handleOperatorDrop`, so drag state is
always fully cleared the moment a drop is handled — regardless of whether
the native `dragend` event on the (possibly-by-then-detached) source element
ever fires. `handleRowDragEnd` can stay exactly as it is (it's still needed
to correctly clear state for the same-operator no-op case, and for a
drag that's cancelled/dropped outside any valid target, where the source
element is never detached and `dragend` fires normally).

RETEST
- Run: node --test
- Run: npm run lint
- Run: npm run build
- Run: git diff --check
- If you have a working local browser environment: reproduce the exact bug
  Claude found — drag a job element from an operator with 2+ rows onto a
  DIFFERENT operator (ideally one with zero existing rows, to also confirm
  the placeholder column disappears correctly), and confirm that
  immediately after the drop: (a) no "No work yet" placeholder columns
  remain visible, and (b) the moved segment (now under its new operator) no
  longer has `opacity-60`/`cursor-grabbing` classes applied. If your
  environment cannot run a browser (as in every prior round), say so
  explicitly — Claude will independently re-verify the exact same way it
  found this bug (dispatching a real DragEvent sequence and inspecting the
  resulting DOM state directly), so do not claim this is visually confirmed
  if you could not actually check it.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit the existing Phase 4c-2
entry) recording: the bug, its root cause, the one-line fix, and the retest
results above.

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: FIXED / TESTS_FAILED / BLOCKED
- Exact files changed (must be exactly the 2 allowed files)
- The exact diff of the fix
- Exact test/lint/build/diff-check output
- Manual browser verification result if possible, or an explicit statement
  that it wasn't possible in your environment
- Explicit statement: no commit, push, deploy, or Production D1 write
  occurred
- Next action: return to Claude for independent re-verification before
  anything is committed, pushed, or the phase is closed.
```
