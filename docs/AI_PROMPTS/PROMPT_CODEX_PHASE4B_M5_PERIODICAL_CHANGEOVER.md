# Prompt — Codex Implementation: Phase 4b, M5 Periodical/Changeover Tiers

Paste this whole block into Codex / GPT-5.6 Luna Max. This is an
IMPLEMENT_ONLY handoff written by Claude after reading the real source files
AND the original PDF blueprint
(`Docs_StandardWork_Reference/Antigravity_WebApp_Development_Blueprint_(2).pdf`,
page 10, "Advanced Yamazumi Rendering Logic"). Do not redesign the approach,
do not expand scope beyond what's listed below. When done, report back to
**Claude** (not the user directly) using the REQUIRED HANDOFF OUTPUT format
at the end.

```text
ROLE: Codex / GPT-5.6 Luna Max — implementation only
MODE: IMPLEMENT_ONLY — build exactly the plan below; do not redesign, do not
expand scope, do not start Phase 4c (Drag & Drop)

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Phase 4a (M5 Min/Max/Average overlay) shipped and is live in main (commit
06898ea). This is Phase 4b: adding a "time category" classification per job
element in Module 1, so Module 5 can stack THREE tiers per operator instead
of one:

  (top)    Changeover Time  — grid/checker shading
           Periodical Work  — diagonal shading
  (bottom) Regular work     — the existing Manual/Walk/Idle stack + the
                               Phase 4a Min/Max/Average overlay, UNCHANGED

This exact 3-tier stacking order and the two shading patterns come directly
from the PDF blueprint page 10 (title: "Advanced Yamazumi Rendering Logic")
— read that page yourself (or ask for it) before starting if anything below
is unclear; it is the authoritative visual spec, not a paraphrase.

ROOT CAUSE
Nothing in the data model currently distinguishes "this job element happens
every single cycle" (regular work) from "this happens periodically, not
every cycle" (Periodical) or "this is model-changeover setup time"
(Changeover). All rows are implicitly treated as regular work today. Module 1
needs a way to mark a row as one of these 3 categories, and both the
per-operator calculation (`computeOperatorTotals`) and Module 5's rendering
need to respect that classification.

IMPORTANT — this is not purely additive. Once a row is marked Periodical or
Changeover, its time must be EXCLUDED from the existing Regular-work
min/max/average calculation (otherwise that time gets counted twice: once in
the regular stack, once in its own new tier). This deliberately changes what
the EXISTING `min`/`max`/`average`/`manMin`/`walkMin`/`idleMin` fields mean
(they become "regular-work only"), and therefore changes what Module 1's own
existing per-worker summary cards show once any row is categorized — this is
intentional and correct, not a regression: Module 1's own UI text already
says its Min value "is exactly the bar height that appears in Module 5," so
the two must stay in lockstep. For any file where no row has ever been
categorized (every existing chart today), this produces byte-identical
output to before — that is the backward-compatibility guarantee to protect,
not "nothing about these fields' meaning may ever change."

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- src/types/index.ts (one new optional field only — see below)
- src/lib/time-study.ts
- src/components/modules/Module1_TimeMeasurement.tsx
- src/components/modules/Module5_YamazumiChart.tsx
- tests/time-study.test.cjs
- CHANGELOG_AI.md

READ FIRST — exact paths, in this order
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md (latest entries, especially the Phase 4a one)
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/Antigravity_WebApp_Development_Blueprint_(2).pdf
   — page 10 specifically ("Advanced Yamazumi Rendering Logic"); this is the
   visual spec this whole prompt implements
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/types/index.ts
   (`TimeStudyRow` — this is what you're extending)
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/time-study.ts
   (full file — `computeRowStats`, `computeOperatorTotals`, `isMachineRow`;
   this already has the Phase 4a `manMin`/`walkMin`/`idleMin` split you'll be
   building on top of)
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module1_TimeMeasurement.tsx
   (full file — find where the existing "ประเภท" (`kind`) dropdown per row
   is rendered and wired via `commit`/`updateTimeStudy`; the new category
   dropdown follows the exact same pattern, as a new column)
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module5_YamazumiChart.tsx
   (full file, post-Phase-4a — this is what you're extending with 2 more
   stacked tiers)
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/time-study.test.cjs
   (existing test patterns, including the Phase 4a mixed-kind test to model
   your new tests on)

PREFLIGHT
- Run: git status --short --branch
- Preserve all existing uncommitted/untracked files exactly as found. Do not
  reset, checkout, restore, delete, or run any broad cleanup.
- If anything unexpected is already in the working tree, stop and report
  before touching anything.

FORBIDDEN
- Do not edit any file outside the 6 listed in REQUIRED SCOPE.
- Do not touch `useChartStore.ts`, `schema.sql`, `functions/api/*`, or any
  test file other than `tests/time-study.test.cjs`.
- Do not add the category field to `ChartStep` (Module 4) or to the M1⇄M4
  bridge functions (`timeStudyFromSteps`/`stepsFromTimeStudy`) — this
  classification is scoped to Module 1 / Module 5 only for this phase; do
  not attempt round-trip fidelity through Module 4.
- Do not implement Drag & Drop (Phase 4c) — not even a partial/stub version.
- Do not add a Max/Average overlay to the Periodical or Changeover tiers —
  per the PDF mockup, those two tiers are flat single-color blocks. Only the
  Regular-work tier keeps the Phase 4a Min/Max/Average treatment.
- Do not commit, push, deploy, or run any git-mutating command.
- Do not write to Production D1, use `--remote`, run a migration, reset, or
  seed anything.
- If implementing this plan turns out to require touching a file outside
  scope, or you find the PDF page 10 spec meaningfully disagrees with this
  prompt, STOP and report `PLAN_CHANGE_REQUIRED` with the specific reason —
  do not improvise around it.

IMPLEMENTATION PLAN

1. `src/types/index.ts`: add ONE new optional field to `TimeStudyRow`:
   `category?: 'periodical' | 'changeover';`
   Absent/undefined means "regular work" (the default for every existing and
   new row unless the user explicitly changes it). Do not add a `'regular'`
   literal value — regular is represented by the field being absent, exactly
   like how other optional `ChartFile` fields already work in this codebase.

2. `src/lib/time-study.ts`:
   - Add a small helper, e.g. `rowCategory(row: TimeStudyRow): 'regular' |
     'periodical' | 'changeover'` returning `row.category ?? 'regular'`.
   - In `computeOperatorTotals()`: scope the existing `min`, `max`, `average`,
     `manMin`, `walkMin`, `idleMin` calculations to ONLY rows where
     `rowCategory(row) === 'regular'` (machine-row grouping under `Auto M/C`
     stays exactly as today, just additionally filtered to regular-category
     rows within that bucket).
   - Add two new fields to `OperatorTotal` and compute them the same way as
     `manMin`/`walkMin`/`idleMin` (sum of `computeRowStats(row).min` per
     operator), but filtered by category instead of kind:
     `periodicalMin` (rows where `rowCategory(row) === 'periodical'`) and
     `changeoverMin` (rows where `rowCategory(row) === 'changeover'`).
   - `rowCount` should also become regular-only, to stay meaningful next to
     the now-regular-only min/max/average in Module 1's summary cards — but
     confirm this against Module 1's actual usage of `rowCount` before
     assuming; if changing it would visibly break Module 1's existing
     "N งาน" label in a way that reads as wrong once you actually look at it
     rendered, use your judgment and note what you chose and why in the
     handoff output instead of guessing silently.

3. `src/components/modules/Module1_TimeMeasurement.tsx`: add a new dropdown
   column, e.g. labeled "หมวดเวลา" (time category), next to the existing
   "ประเภท" (`kind`) dropdown for each row. Options: "ปกติ" (regular — this
   is what an empty/undefined value displays as), "ทำเป็นรอบ" (periodical),
   "เปลี่ยนรุ่น" (changeover). Wire it through the same `commit`/
   `updateTimeStudy` pattern already used for the other per-row dropdowns —
   read the existing `kind` dropdown's exact wiring and mirror it structurally
   for `category`.

4. `src/components/modules/Module5_YamazumiChart.tsx`: when `hasTimeStudy`,
   after the existing Regular-work stack (Manual/Walk/Idle to `totalMin`,
   Max overlay, Average marker — all unchanged from Phase 4a), stack two
   more segments directly on top, in this order (bottom to top, matching the
   PDF): a Periodical segment sized by `periodicalMin * pxPerSec` with a
   diagonal-hatch fill, then a Changeover segment sized by
   `changeoverMin * pxPerSec` with a grid/checker-hatch fill (both distinct
   from each other and from the existing Phase 4a Max-overlay hatch — use a
   different angle or pattern so all three hatched elements are visually
   distinguishable, not just from the solid colors but from each other).
   Recompute the Y-axis scale (`maxTotalTime`/`Y_MAX`) to include
   `totalMax + periodicalMin + changeoverMin` (or the equivalent fallback
   total when `hasTimeStudy` is false) so nothing clips. Add legend entries
   for "Periodical" and "Changeover". The no-`timeStudy` fallback path must
   remain completely unchanged.

5. `tests/time-study.test.cjs`: add tests proving:
   - A row marked `category: 'periodical'` or `'changeover'` is excluded from
     that operator's `min`/`max`/`average`/`manMin`/`walkMin`/`idleMin`, and
     counted instead in `periodicalMin`/`changeoverMin` respectively.
   - A fixture with NO row ever setting `category` (all undefined) produces
     byte-identical `min`/`max`/`average`/`manMin`/`walkMin`/`idleMin` values
     to what Phase 4a's existing tests already lock in — an explicit
     backward-compatibility regression test, not just an assumption.
   - Mixed fixture: one operator with a mix of regular + periodical +
     changeover rows, proving all three buckets are computed correctly and
     independently, with no leakage across operators (mirror the Phase 4a
     "split mixed work kinds without leaking across operators" test
     structure).

ACCEPTANCE CRITERIA
1. `TimeStudyRow.category` is optional, additive, and defaults to
   "regular" behavior when absent.
2. `computeOperatorTotals()` correctly excludes categorized rows from the
   regular-work totals and correctly sums `periodicalMin`/`changeoverMin`,
   proven by tests, including an explicit no-categorization
   backward-compatibility check.
3. Module 1 has a working dropdown to set a row's category, defaulting to
   "ปกติ" for every row that hasn't been changed.
4. Module 5, for a chart with categorized rows, shows 3 visually distinct
   stacked tiers per operator in the PDF's order (Regular incl. Phase 4a
   overlay/marker, then Periodical, then Changeover), with a legend
   explaining all of them.
5. A chart with `timeStudy` data but NO row ever categorized renders
   IDENTICALLY to current Phase 4a behavior — no Periodical/Changeover tier
   appears, no changed numbers, no console error.
6. `node --test`, `npm run lint`, `npm run build`, `git diff --check` all
   pass. Lint shows only the known baseline 5 errors — zero new errors in
   any file you touched.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npm run build
- git diff --check
- Start the dev server, open a chart with Module 1 data, mark one row
  Periodical and another Changeover for an operator who also has regular
  rows, switch to Module 5, visually confirm all 3 tiers render in the
  correct stacked order with distinct patterns and the legend updates,
  confirm Module 1's own summary cards now reflect regular-only numbers for
  that operator, check the console is clean. Then open/create a chart with
  timeStudy data but no categorization and confirm it renders exactly like
  Phase 4a (no new tiers, same numbers as before this change).

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries) recording:
files changed, the new field and its default semantics, the regular-work
recalculation scoping and why it's intentional, and the verification results
above.

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Exact files read
- Exact files changed (must match the 6 allowed files exactly)
- Confirmation that regular-work fields are now correctly scoped and that
  the no-categorization backward-compatibility test passes
- What you decided about `rowCount` (regular-only vs. all rows) and why
- Exact test/lint/build/diff-check output
- Manual browser verification result for both the categorized case and the
  no-categorization fallback case, including console result and whether
  Module 1's summary cards updated as expected
- Any scope question or ambiguity you hit and how you resolved it, or why
  you stopped instead
- Explicit statement: no commit, push, deploy, or Production D1 write
  occurred
- Next action: return this handoff to Claude for review. Do not proceed to
  Phase 4c or any release action yourself.
```
