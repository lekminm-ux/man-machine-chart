# Prompt — Codex Implementation: Phase 4c-1, M5 Per-Job-Element Bar Segments

Paste this whole block into Codex / GPT-5.6 Luna Max. This is an
IMPLEMENT_ONLY handoff written by Claude, a **prerequisite** step before the
real Phase 4c goal (Drag & Drop). Do not add any drag interaction in this
round — that is Phase 4c-2, separately scoped after this ships and is
reviewed. Do not redesign the approach, do not expand scope. When done,
report back to **Claude** (not the user directly) using the REQUIRED HANDOFF
OUTPUT format at the end.

```text
ROLE: Codex / GPT-5.6 Luna Max — implementation only
MODE: IMPLEMENT_ONLY — build exactly the plan below; do not redesign, do not
expand scope, do not implement any drag/drop interaction (that is Phase 4c-2)

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Phase 4a (commit 06898ea) and Phase 4b (commit 979774a) shipped and are live.
Both changed Module 5's time-study-driven rendering to build each tier
(Regular/Periodical/Changeover) from AGGREGATE per-operator sums
(`manMin`/`walkMin`/`idleMin`/`periodicalMin`/`changeoverMin` from
`computeOperatorTotals()`) — one solid-colored block per kind, not one block
per job element.

The eventual Phase 4c goal (per the PDF blueprint page 9,
"Interactive UX: สามารถ Drag & Drop ย้าย Job Element ข้ามแท่งเพื่อ Balance
งานบนหน้าได้ทันที") is to let the user drag an individual JOB ELEMENT
(a single Module 1 row) from one operator's bar to another. That requires
each job element to be its own DOM segment with its own identity — which
does not exist today; the aggregate blocks have no way to identify or target
one specific row. This prompt is purely that prerequisite restructuring: turn
the aggregate blocks back into one segment per job element, with NO change
to any computed number and NO drag capability yet.

ROOT CAUSE
`Module5_YamazumiChart.tsx`'s `hasTimeStudy` branch renders exactly 5 fixed
blocks per operator (manMin, walkMin, idleMin, periodicalMin, changeoverMin).
There is no per-row DOM node, so there is nothing a future drag handler could
attach to or identify.

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- src/lib/time-study.ts
- src/components/modules/Module5_YamazumiChart.tsx
- tests/time-study.test.cjs
- CHANGELOG_AI.md

READ FIRST — exact paths, in this order
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md (latest entries, especially the Phase 4a and 4b ones)
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/time-study.ts
   (full file, post-4b — `computeRowStats`, `computeOperatorTotals`,
   `rowCategory`, `isMachineRow`; you are adding one new function here)
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module5_YamazumiChart.tsx
   (full file, post-4b — this is what you're restructuring)
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/time-study.test.cjs
   (existing test patterns, especially the Phase 4b category tests, to model
   your new tests on)

PREFLIGHT
- Run: git status --short --branch
- Preserve all existing uncommitted/untracked files exactly as found. Do not
  reset, checkout, restore, delete, or run any broad cleanup.
- If anything unexpected is already in the working tree, stop and report
  before touching anything — including files Claude may have left staged
  from a prior planning step. Do not treat that alone as a hard blocker if
  it's clearly just documentation (e.g. only CHANGELOG_AI.md or files under
  docs/AI_PROMPTS/ are pending) — note it in your report and proceed with the
  actual code task; only stop if something in src/, tests/, or types
  is unexpectedly modified.

FORBIDDEN
- Do not edit any file outside the 4 listed in REQUIRED SCOPE.
- Do not touch `useChartStore.ts`, `types/index.ts`, `schema.sql`,
  `functions/api/*`, `Module1_TimeMeasurement.tsx`, or any test file other
  than `tests/time-study.test.cjs`.
- Do not implement any drag, drop, pointer-tracking, or reassignment
  interaction. This round is rendering-only.
- Do not change any computed total. Every operator's stacked bar must be the
  exact same total height, in the exact same tier order, as before this
  change — only the internal composition of the Regular/Periodical/Changeover
  tiers changes from "N fixed aggregate blocks" to "one block per job
  element that sums to the same aggregate."
- Do not touch the no-`timeStudy` fallback rendering path at all.
- Do not commit, push, deploy, or run any git-mutating command.
- Do not write to Production D1, use `--remote`, run a migration, reset, or
  seed anything.
- If this turns out to require touching a file outside scope, or changing
  any existing computed value, STOP and report `PLAN_CHANGE_REQUIRED` with
  the specific reason — do not improvise around it.

IMPLEMENTATION PLAN

1. `src/lib/time-study.ts`: add a new exported function, e.g.
   `regularRowsForOperator(study: TimeStudy, operator: OperatorType):
   TimeStudyRow[]`. It should:
   - Group rows by operator using the exact same convention
     `computeOperatorTotals` already uses (machine-kind rows bucket under
     `'Auto M/C'` regardless of their own `operator` field — reuse
     `isMachineRow`).
   - Filter to only rows where `rowCategory(row) === 'regular'` (reuse the
     existing private `rowCategory` helper, or export it if that's cleaner —
     your call, note which you did).
   - Sort the result so rows of the same `kind` stay grouped together, in
     this order: `'man'`, then `'walk'`, then `'idle'` — within the same
     kind, preserve original `seq` order. This preserves the exact visual
     grouping the current aggregate blocks already produce (all Manual
     together, then Walking, then Idle) — you are just making each group's
     internal rows individually visible instead of pre-summed.
   - Add a parallel function (or a second return value / overload — your
     call, keep it simple and consistent with this file's existing style)
     for periodical and changeover rows, OR a single more general helper
     parameterized by category — whichever reads more clearly given what's
     already in this file. Document your choice in the handoff output.

2. `src/components/modules/Module5_YamazumiChart.tsx`, in the `hasTimeStudy`
   branch only:
   - Replace the 3 fixed `manMin`/`walkMin`/`idleMin` blocks (the base stack
     up to `totalMin`) with a loop over `regularRowsForOperator(activeFile.timeStudy!, op)`.
     For each row, compute its own `computeRowStats(row).min`, skip it if
     that's 0, and render one segment sized to exactly that height. Color by
     `row.kind` using the same 3 colors as today (`bg-slate-800` for man,
     `bg-emerald-500` for walk, `bg-red-500` for idle). Tooltip should now
     show the actual `row.jobElement` name and its Min value, e.g.
     `` `${row.jobElement}: ${rowMin}s` `` — richer than today's generic
     "Manual Min: Xs".
   - Do the same for the Periodical and Changeover tiers: replace the single
     `periodicalMin`/`changeoverMin` block with a loop over that operator's
     periodical/changeover rows respectively, each its own segment with its
     own tooltip.
   - The Max-overlay and Average-marker calculations and positions are
     UNCHANGED — they still come from `computeOperatorTotals()`'s aggregate
     `totalMax`/`totalAverage`, not from summing the new per-row segments
     (though the two must still agree numerically, which the existing tests
     already guarantee).
   - Add a `data-row-id={row.id}` attribute (or similar — your call on the
     exact attribute name, just make it discoverable) to each per-row
     segment. It has no behavior yet, it's the hook Phase 4c-2 will attach
     drag handlers to later — do not build anything that uses it yet.
   - Total stacked height per tier per operator must be pixel-identical to
     before this change.

3. `tests/time-study.test.cjs`: add tests for the new function(s) proving:
   - Rows are correctly filtered to one operator and one category (regular /
     periodical / changeover), with machine-kind rows correctly bucketed
     under `'Auto M/C'`.
   - Ordering is `man` rows first (by `seq`), then `walk`, then `idle`.
   - The sum of individual rows' Min values returned by your new function(s)
     equals the corresponding aggregate field
     (`manMin+walkMin+idleMin === min`, `periodicalMin`, `changeoverMin`)
     already returned by `computeOperatorTotals()` for the same fixture —
     an explicit cross-check between the two, not just testing the new
     function in isolation.

ACCEPTANCE CRITERIA
1. New time-study.ts function(s) correctly group/filter/sort rows, proven by
   tests, including the sum-matches-aggregate cross-check.
2. Module 5's Regular/Periodical/Changeover tiers render as one segment per
   job element, correctly colored and grouped, with per-element tooltips.
3. Every operator's total bar height, Max-overlay position, and
   Average-marker position are pixel-identical to Phase 4b's current
   behavior — this is a pure internal refactor, not a visual redesign.
4. The no-`timeStudy` fallback path is completely unaffected.
5. `node --test`, `npm run lint`, `npm run build`, `git diff --check` all
   pass. Lint shows only the known baseline 5 errors — zero new errors in
   any file you touched.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npm run build
- git diff --check
- Start the dev server, open a chart with Module 1 data for an operator who
  has multiple regular rows of the same kind (e.g. 2+ "man" rows), confirm
  each renders as its own segment with its own tooltip showing the correct
  job element name, and confirm the total bar height/Max overlay/Average
  marker position all look identical to how they rendered before this
  change (compare against a chart you haven't touched, or note the exact
  numbers). Check the console is clean.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries) recording:
files changed, the new function(s) added and the design choice you made for
the periodical/changeover variant, and the verification results above.
Explicitly note this is a prerequisite for Phase 4c-2 (drag interaction),
not the drag feature itself.

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Exact files read
- Exact files changed (must match the 4 allowed files exactly)
- The exact new function name(s) added to time-study.ts and why you chose
  that shape (one general function vs. separate per-category functions)
- Confirmation that per-row sums match the existing aggregate fields exactly
- Exact test/lint/build/diff-check output
- Manual browser verification result, including console result and a
  before/after comparison of bar heights for at least one operator
- Any scope question or ambiguity you hit and how you resolved it, or why
  you stopped instead
- Explicit statement: no commit, push, deploy, or Production D1 write
  occurred
- Next action: return this handoff to Claude for review. Do not proceed to
  Phase 4c-2 (drag interaction) or any release action yourself.
```
