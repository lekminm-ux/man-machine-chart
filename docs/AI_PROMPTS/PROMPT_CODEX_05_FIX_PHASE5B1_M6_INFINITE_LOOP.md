# Prompt — Codex Fix: Phase 5b-1, M6 Infinite Render Loop

Paste this whole block into Codex / GPT-5.6 Luna Max. This is a targeted
FIX_ONLY follow-up to the Phase 5b-1 handoff
(`PROMPT_CODEX_PHASE5B1_BEFORE_AFTER_COMPARISON.md`), found by Claude during
live verification against a real local D1 chart with two closed Revisions —
the automated test suite cannot catch this class of bug (it's a React
rendering-behavior issue, not a calculation-logic issue), which is exactly
why this project's process requires live browser verification for new
interactive UI before release. Report back to **Claude**, not the user.

```text
ROLE: Codex / GPT-5.6 Luna Max — fix only
MODE: FIX_ONLY — fix exactly the bug below. Do not refactor unrelated code,
do not touch any file outside REQUIRED SCOPE, do not add new test
infrastructure (no jsdom/React Testing Library) — this project currently has
no React component-rendering tests, and introducing that stack is a separate,
unscoped decision. Manual/live verification is how this gets proven fixed,
matching how the rest of Phase 5b-1 was verified.

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Phase 5b-1 (`src/components/modules/Module6_Kaizen.tsx`) is otherwise a clean,
well-built implementation — Claude's diff review found the scope, the
`kaizen-compare.ts` calculation logic, and every other file exactly correct,
and `node --test`/lint/build all pass. But Claude's live verification against
a real local Pages Dev + D1 chart that already had two closed Revisions
("A" and "TEST-5A2") found that the moment a user selects two valid,
different snapshots to compare — the entire point of this feature — the
component enters an infinite React re-render loop that never stops on its
own.

Proof: Claude temporarily instrumented the effect with a counter
(`window.__m6EffectRuns`, incremented once per effect invocation) and
measured **7,398 effect runs in approximately 4 seconds** (~1,850/sec) after
selecting two distinct closed Revisions, with no sign of it settling. This
does not throw a visible "Maximum update depth exceeded" error (that specific
React safety check is for synchronous same-render-phase loops; this is an
async, effect-driven loop across separate commits, which React does not
guard against) — it silently pegs a CPU core and would drain battery/degrade
the whole tab's responsiveness for as long as the user stays on the Kaizen
tab with a valid comparison loaded. It also does not cause duplicate network
calls (confirmed via the browser's network log — exactly one
`GET ?chartFileId=` and one `GET ?id=` per snapshot were sent), which is why
this was invisible to Codex's own environment-limited manual check and would
also be easy to miss without instrumenting or watching CPU usage.

ROOT CAUSE
In the second `useEffect` (the one that fetches both selected snapshots and
calls `buildComparison`), `snapshotCache` is BOTH a dependency of the effect
AND written by that same effect:

```tsx
const nextCache = { ...snapshotCache };
for (const id of [beforeId, afterId]) {
  if (nextCache[id]) continue;
  const result = await getRevisionSnapshotCloud(id);
  ...
  nextCache[id] = result.snapshot;
}
if (cancelled) return;
setSnapshotCache(nextCache);   // <-- always a NEW object reference
setComparison(buildComparison(nextCache[beforeId].content, nextCache[afterId].content));
setContentLoading(false);
```
```tsx
}, [activeFileId, revisionFileId, beforeId, afterId, snapshotCache]);
```

`{ ...snapshotCache }` produces a new object reference on every single call,
even when both ids were already cached and nothing was actually fetched (the
`continue` skips the fetch, but the function still reaches
`setSnapshotCache(nextCache)` unconditionally afterward). React compares
`snapshotCache` by reference for the dependency array, so this "new but
equivalent" object always counts as a change — which re-triggers the same
effect — which spreads the cache into ANOTHER new object and calls
`setSnapshotCache` again — forever. `setComparison` also gets called with a
freshly-built (but value-equivalent) object every iteration for the same
reason, though it isn't itself a dependency.

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly this file, nothing else
- src/components/modules/Module6_Kaizen.tsx

READ FIRST
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module6_Kaizen.tsx
   (full file, as it exists right now — this is what you are fixing)

PREFLIGHT
- Run: git status --short --branch
- Confirm the only relevant pending change is the untracked Phase 5b-1 files
  from the prior round (Module6_Kaizen.tsx, kaizen-compare.ts,
  kaizen-compare.test.cjs) plus whatever unrelated documentation files are
  already sitting in the tree — do not touch any of those, and do not treat
  their presence as something to fix or clean up.

FORBIDDEN
- Do not touch any file other than Module6_Kaizen.tsx.
- Do not change the two `useState` calls for `comparison` or `contentError`/
  `contentLoading` unless the fix genuinely requires it — it should not.
- Do not add new test files or new testing dependencies/infrastructure.
- Do not change the picker/default-selection behavior, the metrics table, or
  the overlaid chart rendering — this is a pure internal-state-management fix
  with zero visible behavior change once fixed (the comparison should render
  exactly as it already does today, just without looping forever afterward).
- Do not commit, push, deploy, or run any git-mutating command.

FIX
Replace the `snapshotCache` `useState` with a `useRef`. It is never read
directly in the component's JSX — it exists purely to avoid re-fetching a
snapshot the component already has — so it does not need to trigger a
re-render on its own, and it must not be a dependency of the effect that
also writes it.

1. Change:
   ```tsx
   const [snapshotCache, setSnapshotCache] = useState<Record<string, RevisionSnapshot>>({});
   ```
   to:
   ```tsx
   const snapshotCacheRef = useRef<Record<string, RevisionSnapshot>>({});
   ```

2. In the first `useEffect` (the one that resets state when `activeFileId`
   changes), replace `setSnapshotCache({});` with
   `snapshotCacheRef.current = {};`.

3. In the second `useEffect`, remove `snapshotCache` from the dependency
   array entirely — it becomes `[activeFileId, revisionFileId, beforeId,
   afterId]`. Inside `loadSelectedSnapshots`, replace every read/write of
   `snapshotCache` with `snapshotCacheRef.current`:
   ```tsx
   const nextCache = { ...snapshotCacheRef.current };
   for (const id of [beforeId, afterId]) {
     if (nextCache[id]) continue;
     const result = await getRevisionSnapshotCloud(id);
     if (!result.ok) {
       if (!cancelled) {
         setContentLoading(false);
         setContentError(result.error);
         setComparison(null);
       }
       return;
     }
     nextCache[id] = result.snapshot;
   }

   if (cancelled) return;
   snapshotCacheRef.current = nextCache;
   setComparison(buildComparison(nextCache[beforeId].content, nextCache[afterId].content));
   setContentLoading(false);
   ```
   Assigning `snapshotCacheRef.current = nextCache` does not trigger a
   re-render and is not a dependency of anything, so the effect now runs
   exactly once per genuine `beforeId`/`afterId`/`activeFileId`/
   `revisionFileId` change, fetches only what it doesn't already have cached,
   and stops.

4. Add `useRef` to the existing `import React, { useEffect, useState } from
   'react';` line (`useRef` joins that same import).

5. Double check there is no other place in the file that reads `snapshotCache`
   as state (there shouldn't be — it's only used inside this one effect) —
   if you find one, use `snapshotCacheRef.current` there too rather than
   reintroducing a state dependency.

ACCEPTANCE CRITERIA
1. `snapshotCache` no longer exists as `useState` anywhere in the file; it is
   a `useRef` that is read and written only inside the two effects.
2. The second effect's dependency array does not include the cache in any
   form.
3. Selecting two valid, distinct closed Revisions triggers exactly one
   fetch per not-yet-cached snapshot (0, 1, or 2 network calls depending on
   what's already cached) and the effect does not re-invoke itself once
   `comparison`/`contentLoading` settle — no unbounded loop.
4. Re-selecting a snapshot that's already cached (e.g. swapping Before/After
   back and forth between two previously-loaded ids) must not re-fetch it,
   and must still update `comparison` correctly for the new pairing — the
   caching behavior itself must not regress.
5. Every other part of Module6_Kaizen.tsx's behavior (picker defaults,
   mutual-exclusion between the two selects, empty state, loading state,
   error state, metrics table, overlaid chart) is unchanged.
6. `node --test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
   `git diff --check` all pass, with zero new errors in this file.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npx tsc --noEmit
- npm run build
- git diff --check
- Manual check, best effort given your environment's known constraints
  (no Cloudflare Pages Functions in plain `npm run dev`, so `/api/revisions`
  will 404 and there is likely no local chart with 2+ closed Revisions
  available to you): if you can reach a state with two distinct snapshots
  selected (real data, or by temporarily faking `getRevisionSnapshotCloud`'s
  response in your own throwaway test harness — your call, but do not leave
  any such scaffolding in the final diff), re-run the same kind of counter
  check Claude used (a temporary `console.log`/counter inside the effect,
  removed before you finish) and confirm the run count stays low and stable
  instead of climbing continuously. If your environment genuinely cannot
  reach that state at all, say so plainly — Claude will re-run the exact
  live D1 reproduction from this bug report to confirm the fix.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries): state this
is a fix for the infinite render loop Claude found in Phase 5b-1 live
verification, name the root cause (state used as both an effect dependency
and an effect side-effect target) and the fix (state → ref), and record the
verification results above.

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Confirm the exact diff matches the FIX section above (or note any
  deliberate deviation and why)
- Exact test/lint/tsc/build/diff-check output
- Manual verification result — whether you were able to reproduce a
  two-snapshot-selected state and confirm the loop is gone, or why not
- Explicit statement: no commit, push, deploy, or Production/schema/API
  change occurred
- Next action: return this handoff to Claude for review and re-verification.
  Do not proceed to Phase 5b-2 or any release action yourself.
```
