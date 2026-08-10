# Prompt — Codex Implementation: Phase 5b-1, M6 Before/After Comparison

Paste this whole block into Codex / GPT-5.6 Luna Max. This is an
IMPLEMENT_ONLY handoff written by Claude, the first sub-phase of Phase 5b
(M6 Kaizen page). Do not build the Kaizen problem/countermeasure form
(Phase 5b-2) — that is separately scoped after this ships and is reviewed,
and will be added to the SAME `Module6_Kaizen.tsx` file this prompt
creates. Do not redesign the approach, do not expand scope. When done,
report back to **Claude** (not the user directly) using the REQUIRED
HANDOFF OUTPUT format at the end.

```text
ROLE: Codex / GPT-5.6 Luna Max — implementation only
MODE: IMPLEMENT_ONLY — build exactly the plan below; do not redesign, do not
expand scope. Do NOT implement Phase 5b-2 (the Kaizen problem/countermeasure
form: Problem text, countermeasures list, responsible person, due date) —
that is separately scoped after this ships and is reviewed. Do NOT allow
comparison against the live/unsaved current chart state — only two CLOSED
Revision snapshots may be compared (explicit user decision).

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Phase 5a-1 (schema + snapshot/lock mechanism) and Phase 5a-2 (read-only UI
gating) are both implemented, reviewed, and deployed to Production. Every
closed Revision now has a full, immutable snapshot of that chart's M1-M5
content sitting in the `revision_snapshots` table, reachable via the
already-existing `GET /api/revisions?chartFileId=...` (metadata list) and
`GET /api/revisions?id=...` (single snapshot with full content) endpoints —
but nothing in the client has ever fetched a single snapshot's content, and
there is no UI that reads more than one Revision at a time.

This is the point of the whole Kaizen Loop this project has been building
toward (see docs/Master_Plan.html section 6, "Kaizen Loop และหน้าสรุป
Before/After"): a user measures time (M1), analyzes (M2-M5), makes a Kaizen
improvement, re-measures under a new Revision, closes it, and only then can
prove the improvement actually worked by comparing the two frozen
snapshots side by side. That comparison view — M6 — has never existed.
Per the project's Decision Log (31 Jul 2026, "ชีต kaizen ไปอยู่ไหน"), M6 is
its own module, matching the 6th sheet of the source Excel workbook, and
belongs in the same module-tab pattern as M1-M5 (TopBar's module navigator,
`activeModule` in the store).

Master_Plan.html section 6 specifies the comparison must show: Cycle Time
before/after with % change, worker count before/after, walk/idle time
before/after, capacity per shift before/after, and an overlaid Yamazumi
chart. This prompt builds exactly that. The user explicitly decided
comparison is between two CLOSED (locked, snapshotted) Revisions only —
never against the live, still-editable current chart state — because the
whole point of "always re-measure after Kaizen" is comparing two frozen,
trustworthy numbers, not a moving target.

ROOT CAUSE
There is no client function to fetch a single Revision snapshot's content
(`src/lib/storage.ts` has `closeRevisionCloud`/`openRevisionCloud`/
`listRevisionSnapshotsCloud` but no `getRevisionSnapshotCloud` — Phase
5a-1's own handoff deliberately deferred it here: "Phase 5b will add that
when it builds the comparison page that actually needs snapshot content").
There is no module 6, no comparison calculation logic, and `activeModule`
in the store is typed `1 | 2 | 3 | 4 | 5`, with no slot for it.

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- src/lib/kaizen-compare.ts (new file)
- src/lib/storage.ts
- src/store/useChartStore.ts
- src/components/modules/Module6_Kaizen.tsx (new file)
- src/components/layout/TopBar.tsx
- src/app/editor/page.tsx
- tests/kaizen-compare.test.cjs (new file)
- tests/storage.test.cjs
- CHANGELOG_AI.md

READ FIRST — exact paths, in this order
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
   — especially "Business Rules สำคัญ" (the DURATION MODEL, Cycle Time
   definition, `ALL_WORKERS` vs `Auto M/C` exclusion) and "High-Risk Files"
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
   (latest entries — Phase 5a-1/5a-2's rounds, Updates 16-19)
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/types/index.ts
   (full file — `RevisionSnapshot`, `RevisionSnapshotMeta`,
   `RevisionSnapshotContent`, `ChartStep`, `TimeStudy`, `OperatorTotal`'s
   home module, `MachineCapacity`, `ALL_WORKERS`, `OperatorType`)
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/chart-utils.ts
   (full file — `computeCycleTime`, `getActiveWorkers`, `buildSummary`,
   `getCalculatedSteps`)
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/time-study.ts
   (full file — `computeOperatorTotals` and its `OperatorTotal` shape,
   `isMachineRow`)
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/machine-capacity.ts
   (full file — `computeCapacitySummary`, `CapacitySummary` shape)
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts
   (full file — especially `apiFetch`, and the exact `closeRevisionCloud`/
   `openRevisionCloud`/`listRevisionSnapshotsCloud` implementations at the
   bottom third of the file, whose Result-type/try-catch style
   `getRevisionSnapshotCloud` must match exactly)
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/revisions.js
   (full file — confirms `GET ?id=...`'s exact response shape:
   `{...row, content: JSON.parse(row.content)}` where `row` includes `id`,
   `chartFileId`, `revNo`, `content`, `closedAt`)
9. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module5_YamazumiChart.tsx
   (full file — this is the visual/colour vocabulary the new overlaid
   chart must match: stacked bar colours `bg-slate-800` manual /
   `bg-emerald-500` walk / `bg-red-500` idle, the `hasTimeStudy` fallback
   pattern, and the `CHART_HEIGHT`/`pxPerSec` scaling technique)
10. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
    (full file — especially `activeModule`/`setActiveModule`, and
    `activeFile()`, to see exactly what "the active file" gives you)
11. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/layout/TopBar.tsx
    and D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/app/editor/page.tsx
    (full files — the module-tab list and the `activeModule === N` render
    switch you are extending to `6`)
12. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/storage.test.cjs
    and D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/time-study.test.cjs
    (existing test patterns — how storage tests fake `fetch`, and how
    time-study tests build fixture `TimeStudy`/`ChartStep` data, to keep
    your new tests consistent)

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
- Do not edit any file outside the list in REQUIRED SCOPE.
- Do not implement Phase 5b-2 (the Kaizen problem/countermeasure form) or
  any persistence for it. This round is read-only comparison of existing
  snapshot data — it writes nothing new to `chart_files` or
  `revision_snapshots`.
- Do not allow comparing against the live/current `activeFile` state —
  both sides of the comparison must be fetched Revision snapshots. If
  fewer than 2 closed Revisions exist for the active chart, show an empty/
  prompt state instead of comparing anything.
- Do not replicate Module 5's Min/Max/Average-overlay or Periodical/
  Changeover-tier rendering in the new overlaid chart. Use each operator's
  MIN-based total only (the same "standard time" convention Cycle Time and
  every other headline metric in this app already uses) — this keeps the
  comparison chart reading as one clear number per bar instead of a second
  copy of Module 5's full complexity.
- Do not change `schema.sql` or any other `functions/api/*.js` file — the
  `GET ?id=...` endpoint this phase depends on already exists and returns
  exactly what's needed.
- Do not change the behavior of any existing module (M1-M5) or any existing
  store action other than the two named in IMPLEMENTATION PLAN step 3
  (`activeModule`'s type, `setActiveModule`'s signature) — this is a purely
  additive new module.
- Do not add a `getRevisionSnapshotCloud` caller anywhere except the new
  Module6_Kaizen.tsx — no other file needs it in this round.
- If this turns out to require touching a file outside REQUIRED SCOPE, or
  changing any existing endpoint's response shape or existing module's
  behavior, STOP and report `PLAN_CHANGE_REQUIRED` with the specific
  reason.
- Do not commit, push, deploy, or run any git-mutating command.

IMPLEMENTATION PLAN

1. src/lib/storage.ts — add, near the other three revision functions and
   following their exact style (Result type, try/catch around `apiFetch`,
   defensive shape-checking of the response before trusting it):
   ```ts
   export type GetRevisionSnapshotResult =
     | { ok: true; snapshot: RevisionSnapshot }
     | { ok: false; error: string };

   export async function getRevisionSnapshotCloud(id: string): Promise<GetRevisionSnapshotResult> {
     try {
       const res = await apiFetch(`/api/revisions?id=${encodeURIComponent(id)}`);
       if (!res?.id || !res?.chartFileId || typeof res?.revNo !== 'string' || !res?.closedAt || !res?.content) {
         return { ok: false, error: 'get revision snapshot did not return an explicit confirmed response' };
       }
       return {
         ok: true,
         snapshot: {
           id: res.id, chartFileId: res.chartFileId, revNo: res.revNo,
           closedAt: res.closedAt, content: res.content,
         },
       };
     } catch (err) {
       return { ok: false, error: err instanceof Error ? err.message : String(err) };
     }
   }
   ```
   Add `RevisionSnapshot` to the existing `import type { RevisionSnapshotContent,
   RevisionSnapshotMeta } from '@/types';` line at the top of the file.

2. src/lib/kaizen-compare.ts (new file) — pure calculation, no React, no
   fetch. Mirror this project's existing `src/lib/*.ts` convention (see
   time-study.ts/machine-capacity.ts: typed inputs/outputs, no side
   effects, thoroughly commented on the *why* where the logic isn't
   obvious from the code, same as those files' headers).
   ```ts
   import type { OperatorType, RevisionSnapshotContent } from '@/types';
   import { ALL_WORKERS } from '@/types';
   import { computeCycleTime, getActiveWorkers, buildSummary, getCalculatedSteps } from './chart-utils';
   import { computeOperatorTotals } from './time-study';
   import { computeCapacitySummary } from './machine-capacity';

   export interface OperatorBar {
     manual: number;
     walk: number;
     idle: number;
     total: number;
   }

   export interface OperatorComparisonRow {
     operator: OperatorType;
     before: OperatorBar | null; // null = this operator had no work in this revision
     after: OperatorBar | null;
   }

   export interface RevisionMetrics {
     cycleTime: number;
     workerCount: number;
     walkTimeTotal: number;
     idleTimeTotal: number;
     /** null when this revision's machineCapacity has no rows. */
     capacityPerShift: number | null;
   }

   export interface ComparisonResult {
     before: RevisionMetrics;
     after: RevisionMetrics;
     /** null when before.cycleTime is 0 (nothing to compare against). */
     cycleTimeReductionPercent: number | null;
     /** One row per operator that has work in either revision, in ALL_WORKERS order. */
     operatorRows: OperatorComparisonRow[];
   }

   function operatorBars(content: RevisionSnapshotContent): Partial<Record<OperatorType, OperatorBar>> {
     // Prefer timeStudy (Module 1) exactly the way Module5_YamazumiChart.tsx
     // already does, falling back to steps only when no timeStudy rows exist.
     const hasTimeStudy = (content.timeStudy?.rows?.length ?? 0) > 0;
     const bars: Partial<Record<OperatorType, OperatorBar>> = {};
     if (hasTimeStudy) {
       for (const total of computeOperatorTotals(content.timeStudy!)) {
         if (total.operator === 'Auto M/C') continue;
         bars[total.operator] = {
           manual: total.manMin, walk: total.walkMin, idle: total.idleMin,
           total: total.manMin + total.walkMin + total.idleMin,
         };
       }
       return bars;
     }
     const calc = getCalculatedSteps(content.steps);
     for (const worker of getActiveWorkers(content.steps)) {
       const rows = calc.filter(s => s.operator === worker);
       const manual = rows.reduce((a, s) => a + s.calcManual, 0);
       const walk = rows.reduce((a, s) => a + s.calcWalk, 0);
       const idle = rows.reduce((a, s) => a + s.calcIdle, 0);
       bars[worker] = { manual, walk, idle, total: manual + walk + idle };
     }
     return bars;
   }

   export function computeRevisionMetrics(content: RevisionSnapshotContent): RevisionMetrics {
     const bars = operatorBars(content);
     const workerCount = Object.keys(bars).length;
     const walkTimeTotal = Object.values(bars).reduce((a, b) => a + (b?.walk ?? 0), 0);
     const idleTimeTotal = Object.values(bars).reduce((a, b) => a + (b?.idle ?? 0), 0);
     const capacityPerShift = content.machineCapacity && content.machineCapacity.rows.length > 0
       ? computeCapacitySummary(content.machineCapacity).bottleneckCapacity
       : null;
     return { cycleTime: computeCycleTime(content.steps), workerCount, walkTimeTotal, idleTimeTotal, capacityPerShift };
   }

   export function buildComparison(before: RevisionSnapshotContent, after: RevisionSnapshotContent): ComparisonResult {
     const beforeMetrics = computeRevisionMetrics(before);
     const afterMetrics = computeRevisionMetrics(after);
     const beforeBars = operatorBars(before);
     const afterBars = operatorBars(after);
     const operators = ALL_WORKERS.filter(w => beforeBars[w] || afterBars[w]);
     return {
       before: beforeMetrics,
       after: afterMetrics,
       cycleTimeReductionPercent: beforeMetrics.cycleTime > 0
         ? Math.round(((beforeMetrics.cycleTime - afterMetrics.cycleTime) / beforeMetrics.cycleTime) * 1000) / 10
         : null,
       operatorRows: operators.map(operator => ({
         operator, before: beforeBars[operator] ?? null, after: afterBars[operator] ?? null,
       })),
     };
   }
   ```
   (This is a starting point, not a literal-only spec — keep the exact
   field names and behavior, but you may adjust internal structure if the
   files you actually read differ slightly from what's summarized above;
   if `OperatorTotal`'s field names or `CapacitySummary`'s field names
   differ from what's used here, use the real ones and note the deviation
   in your handoff report.)

3. src/store/useChartStore.ts — two small, additive changes only:
   - `activeModule: 1 | 2 | 3 | 4 | 5;` → `activeModule: 1 | 2 | 3 | 4 | 5 | 6;`
   - `setActiveModule: (m: 1 | 2 | 3 | 4 | 5) => void;` → add `| 6` to that
     union, in both the interface declaration and the implementation's
     parameter type.
   Nothing else in this file changes.

4. src/components/modules/Module6_Kaizen.tsx (new file) — follow the same
   `'use client'`, `useChartStore(s => s.activeFile())`, empty-state-when-
   no-file structure every other module file uses (see
   Module1_TimeMeasurement.tsx's opening ~60 lines for the exact
   convention: activeFile guard, `say`/flash-message helper pattern for
   transient errors).
   - On mount and whenever `activeFile.id` changes, call
     `listRevisionSnapshotsCloud(activeFile.id)` and store the resulting
     `RevisionSnapshotMeta[]` (already sorted `closedAt DESC` by the API)
     in local component state.
   - If fewer than 2 snapshots exist, render a friendly empty state
     explaining at least 2 closed Revisions are needed before there's
     anything to compare (do not render pickers or attempt any fetch).
   - Otherwise render two `<select>` pickers, "Before" and "After", each
     option labelled with `revNo` + a formatted `closedAt` date. Default
     `after` to the most recent snapshot (index 0) and `before` to the
     second most recent (index 1) — the most immediately useful default
     without the user having to pick anything. Do not allow the same
     snapshot id to be selected for both (disable that option in the
     other picker, or show a clear inline message — your call on the
     exact mechanism).
   - Whenever both selections resolve to two different, actually-selected
     ids, fetch each with `getRevisionSnapshotCloud` (skip re-fetching a
     snapshot whose content you already have cached in state), then call
     `buildComparison(before.content, after.content)` from
     `kaizen-compare.ts`.
   - Render, while a fetch is pending: a simple loading state (matching
     this project's existing spinner/loading conventions — see
     `editor/page.tsx`'s `!hydrated` branch or TopBar's `syncing` spinner
     for the visual language already in use). On fetch failure: a clear
     inline error message (do not throw, do not leave a blank screen).
   - Render the comparison, once both snapshots are loaded, in two parts:
     - **Metrics table**: rows for Cycle Time (with the % change,
       formatted like `-15.3%`), Worker Count, Walk Time Total, Idle Time
       Total, Capacity/Shift (`—` when `null`). Columns: Before / After /
       Change. Colour the Change cell green when the metric moved in the
       improving direction (Cycle Time, Worker Count, Walk Time, Idle Time
       DOWN is good; Capacity/Shift UP is good) and red when it moved the
       wrong way; grey/neutral when unchanged or when either side is
       `null`/not applicable.
     - **Overlaid Yamazumi chart**: one group per `operatorRows` entry,
       two adjacent bars per group (Before | After), each stacked
       bottom-to-top exactly like Module 5's bars — `bg-slate-800`
       manual, `bg-emerald-500` walk, `bg-red-500` idle — sharing one Y
       axis scaled to the max `total` across every bar on screen (both
       sides, all operators), with the operator name below each pair and
       each bar's own total time (e.g. `347s`) labelled above it. A
       missing side (`null`) renders as an empty/dashed placeholder bar
       instead of being skipped, so a worker who existed only in one
       revision is still visually obvious. Include a small legend (Manual
       / Walk / Idle) matching Module 5's existing legend styling.
   - Page heading text inside the component: `MODULE 6: KAIZEN —
     BEFORE/AFTER COMPARISON` is set by editor/page.tsx (step 6), not
     inside this component — this component starts directly with its own
     toolbar/content the same way Module1-5 do.

5. src/components/layout/TopBar.tsx — add one entry to the module
   navigator array: `{ id: 6, name: '6: Kaizen' }`, using the exact same
   button rendering already in place for entries 1-5 (no new styling).

6. src/app/editor/page.tsx —
   - Add `activeModule === 6 && 'MODULE 6: KAIZEN — BEFORE/AFTER
     COMPARISON'` to the existing heading text switch (alongside the
     MODULE 1-5 lines).
   - Add `{activeModule === 6 && <Module6_Kaizen />}` alongside the
     existing `{activeModule === 1 && <Module1_TimeMeasurement />}` etc.
     lines, and import `Module6_Kaizen` from
     `'@/components/modules/Module6_Kaizen'` at the top with the other
     module imports.

7. Tests:
   - tests/kaizen-compare.test.cjs (new): test `computeRevisionMetrics`
     and `buildComparison` directly with fixture `RevisionSnapshotContent`
     objects (build fixtures the same way tests/time-study.test.cjs does).
     Cover: cycle time from steps; worker count/walk/idle preferring
     timeStudy when present vs. falling back to steps when timeStudy is
     absent or has zero rows (mirror Module 5's own fallback, which you
     read in step 9 of READ FIRST); capacityPerShift is `null` when
     machineCapacity is absent or has zero rows, and a real number
     otherwise; cycleTimeReductionPercent is `null` when before.cycleTime
     is 0, and correctly signed/rounded otherwise (a reduction from 100 to
     80 must read as a positive ~20, an increase must read negative);
     operatorRows includes an operator present in only one side with the
     other side `null`, and excludes `Auto M/C` entirely; operatorRows
     preserves `ALL_WORKERS` order regardless of the order operators
     appear in the input data.
   - tests/storage.test.cjs: add tests for `getRevisionSnapshotCloud` —
     success shape (mirror `closeRevisionCloud`'s success-shape test), and
     failure/malformed-response/network-error shapes (mirror the existing
     failure tests for the other three revision functions exactly).

ACCEPTANCE CRITERIA
1. A 6th "Kaizen" tab appears in the module navigator and renders
   `Module6_Kaizen` without touching any existing module's rendering or
   behavior.
2. With fewer than 2 closed Revisions for the active chart, M6 shows an
   empty/prompt state and makes no snapshot-content fetch.
3. With 2+ closed Revisions, selecting two different ones fetches both
   snapshots' full content and renders: a metrics table (Cycle Time + %
   change, Worker Count, Walk Time, Idle Time, Capacity/Shift) and an
   overlaid Before/After Yamazumi chart, both computed only from
   `kaizen-compare.ts`'s pure functions (no duplicate calculation logic
   inline in the component).
4. `computeRevisionMetrics`/`buildComparison` prefer `timeStudy` over
   `steps` exactly the way Module 5 already does, verified by a test
   fixture where the two sources would disagree if the wrong one were
   used.
5. `cycleTimeReductionPercent` is `null` (not `NaN`/`Infinity`) when
   `before.cycleTime` is 0.
6. `Auto M/C` never appears in `operatorRows`; a worker present in only
   one revision appears with the other side `null`, not omitted.
7. No existing module, store action (other than `activeModule`'s type),
   or API endpoint changed behavior. Comparison never reads or writes the
   live `activeFile` content — only fetched Revision snapshots.
8. Every existing test continues to pass unmodified.
9. `node --test`, `npm run lint`, `npm run build`, `git diff --check` all
   pass. Lint shows only the known pre-existing baseline (5 errors as of
   the last recorded baseline) — zero new errors in any file you touched.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npx tsc --noEmit
- npm run build
- git diff --check
- Best-effort manual check: start the app locally (`npm run dev` is
  enough — this phase makes no new write/mutation, only reads existing
  `/api/revisions` data, so real Cloudflare Pages Dev is not required
  just to see it render) and open any chart that already has 2+ closed
  Revisions if your local/cached data has one (check `localStorage`'s
  `mm_chart_db_v2`, or note if none is available in your environment).
  Confirm the Kaizen tab renders, the pickers populate, and the
  metrics table/chart render without a console error. If your
  environment has no chart with 2+ closed Revisions available, state that
  plainly instead of guessing — Claude will do the full live-data check
  afterward the same way prior UI-facing phases were verified.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries) recording:
files changed, the exact `kaizen-compare.ts` API surface as actually
implemented, the `getRevisionSnapshotCloud` contract, and the verification
results above. Explicitly state this is Phase 5b-1 of Phase 5b (M6 Kaizen
page), that Phase 5b-2 (the Kaizen problem/countermeasure form) is
separately scoped next, and that no schema, API, or Production change of
any kind occurred (this phase only adds a new read-only client module).

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Exact files read
- Exact files changed (must match REQUIRED SCOPE exactly)
- The exact final `kaizen-compare.ts` and `getRevisionSnapshotCloud`
  contracts (confirm they match the plan or note any deliberate deviation
  and why — e.g. if `OperatorTotal`'s or `CapacitySummary`'s real field
  names differed from this prompt's draft)
- Exact test/lint/tsc/build/diff-check output
- Manual verification result, stating plainly whether your environment had
  a chart with 2+ closed Revisions to actually render against, and what
  you were and were not able to check
- Any scope question or ambiguity you hit and how you resolved it, or why
  you stopped instead
- Explicit statement: no commit, push, deploy, or Production/schema/API
  change occurred
- Next action: return this handoff to Claude for review. Do not proceed to
  Phase 5b-2 or any release/migration action yourself.
```
