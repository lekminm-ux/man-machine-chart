# Report — Claude Read-Only Project Onboarding

Generated: 2026-08-01
Mode: `READ_ONLY_ONBOARDING` per [`PROMPT_CLAUDE_00_START_HERE_READ_ONLY.md`](PROMPT_CLAUDE_00_START_HERE_READ_ONLY.md)
Author: Claude Code (Opus 5)

This is the completed handoff report for GPT/Codex to use as input to
[`PROMPT_GPT_01_PROJECT_AUDIT_AND_MASTER_PLAN.md`](PROMPT_GPT_01_PROJECT_AUDIT_AND_MASTER_PLAN.md).
No project files were edited, created, deleted, renamed, installed, or deployed
while producing this report — only read-only inspection (`rg --files`, `git
status`, `git log`, `npm test`, `npx eslint .`, `npx tsc --noEmit`, `npm run
build`) was run.

---

## 1. STATUS

**READ_ONLY_COMPLETE.**

## 2. Files and folders actually read

**Docs:** `PROJECT_CONTEXT.md`, `CHANGELOG_AI.md` (all 18 entries, 2026-07-08 →
2026-08-01), `README.md`, `docs/Master_Plan.html` (current, v1.7),
`docs/User_Manual.html`, `docs/Deployment_Checklist.md`,
`docs/Codex_Multi_Device_Blueprint.md` (noted as legacy per its own file),
`docs/AI_PROMPTS/*.md` (5 files, was untracked in git at read time — see §11).

**Config:** `package.json`, `pnpm-lock.yaml` (header + dependency graph),
`pnpm-workspace.yaml`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`,
`postcss.config.mjs`, `eslint.config.mjs`, `wrangler.toml`, `schema.sql`,
`.claude/launch.json`.

**Source — every file under `src/`:** `app/page.tsx`, `app/layout.tsx`,
`app/globals.css`, `app/editor/page.tsx`; `components/chart/ManMachineChart.tsx`,
`components/chart/TimelineRow.tsx`; `components/editor/HeaderForm.tsx`,
`components/editor/StepTable.tsx`, `components/editor/SummaryTable.tsx`;
`components/layout-diagram/LayoutDiagram.tsx`; `components/layout/Sidebar.tsx`,
`components/layout/TopBar.tsx`; `components/modules/Module1_TimeMeasurement.tsx`,
`Module2_MachineCapacity.tsx`, `Module3_CombinationTable.tsx`,
`Module5_YamazumiChart.tsx`; `lib/chart-utils.ts`, `lib/combination-table.ts`,
`lib/layout-utils.ts`, `lib/machine-capacity.ts`, `lib/seed-data.ts`,
`lib/storage.ts`, `lib/time-study.ts`; `store/useChartStore.ts`;
`types/index.ts`.

**Backend:** `functions/api/files.js`, `functions/api/folders.js`.

**Tests — all 6:** `tests/chart-utils.test.cjs` (20),
`tests/combination-table.test.cjs` (19), `tests/layout-utils.test.cjs` (11),
`tests/machine-capacity.test.cjs` (15), `tests/store.test.cjs` (4),
`tests/time-study.test.cjs` (14) — 83 total.

**Reference evidence (`Docs_StandardWork_Reference/`)** — extracted via
throwaway Node scripts in the scratchpad, since these are binary Office
formats not directly readable:

- `Antigravity_WebApp_Development_Blueprint_(2).pdf` — all 13 slides
  (image-only, rendered to PNG and read visually).
- `3 TEN SET Line SUV_Rev.01.xlsx` — `JOB_C CAP_1`,
  `Machine Capacity Sheet_C CAP`, `std.com table`, `YAMAZUMI Data Base`
  sheets (of 32).
- `แบบฟอร์มตารางจับเวลา 1.xlsx` — blank Time Measurement Sheet form.
- `งานมาตรฐาน.pptx` — **all 45 slides**, full text extraction (first time
  this file was opened in the project's AI session history).
- `2026_06Jun_Injection_PD5,6.xlsx` — all 5 sheets (`DataBase`, `MC List`,
  `Part List`, `List_validation`, `Sheet1`) (also opened for the first time).

**Inspection commands run:** `rg --files` (full listing), `git status --short
--branch`, `git log --oneline` (43 commits total), `npm test`, `npx eslint .`,
`npx tsc --noEmit`, `npm run build`.

## 3. Architecture and runtime stack

Next.js 16 **App Router**, statically exported (`next.config.ts`:
`output: 'export'`, `images.unoptimized: true`) — the frontend ships as pure
static HTML/JS, no Next.js server runtime in production. React 19 +
TypeScript (strict) + Tailwind CSS v4. State: Zustand (single store,
`useChartStore.ts`, ~790 lines). Backend: Cloudflare Pages Functions
(`functions/api/files.js`, `folders.js`) talking to Cloudflare D1 (binding
`DB`, database `mm-chart-db`) via raw SQL. Offline/cache: browser
`localStorage` key `mm_chart_db_v2`. Export: `html2canvas` + `jsPDF`,
dynamically imported. Package manager: pnpm (lockfile present, `node_modules`
installed); `npm` scripts are also used interchangeably per project
convention.

Deployment is **manual** — `PROJECT_CONTEXT.md` documents (verified
2026-08-01) that pushing to GitHub does not trigger a Cloudflare Pages build;
every session ends with a hand-run `wrangler pages deploy out`.

## 4. Routes / screens / workflows

Single route: `/` redirects to `/editor` (`app/page.tsx`). `/editor` is the
entire app surface (`app/editor/page.tsx`), gated by `Sidebar` (folder/file
tree, admin-PIN-gated move/delete, module switcher) + `TopBar` (save/export/
module nav). Inside, five tabs driven by `useChartStore.activeModule` (1–5):
Module 1 (Time Sheet), Module 2 (Capacity), Module 3 (Gantt/Combination),
Module 4 (the original `HeaderForm` + `StepTable` + `LayoutDiagram` +
`SummaryTable` screen — still the default `activeModule: 4`), Module 5
(Yamazumi). Export (PNG/PDF) captures the whole `#chart-export-region` DOM
node regardless of which module tab is active.

## 5. M1–M6 status and data flow

| Module | Status | Data source |
|---|---|---|
| M1 Time Sheet | Implemented | Own `timeStudy` field on `ChartFile`; can pull from M4 (`importTimeStudyFromSteps`) or push to M4 (`pushTimeStudyToSteps`, basis min/avg/max) |
| M2 Machine Capacity | Implemented | Own `machineCapacity` field; can seed from M1's machine rows |
| M3 Combination Table | Implemented | Reads M1's `timeStudy` directly; Takt pulled from M2 or overridden locally |
| M4 Step Table/Layout | Implemented (oldest, most mature) | Own `steps`/`layoutDiagram`; the de facto "main" screen |
| M5 Yamazumi | Implemented but **not yet wired to M1** (see §10.6) | Reads M4's `steps`, not M1's Min column |
| M6 Kaizen | Not started | Referenced only in `docs/Master_Plan.html` roadmap |

M1↔M4 is the only bridge that goes through a shared, tested conversion layer
(`time-study.ts`, `getCalculatedSteps`). M2, M3, M5 each read independently;
there is no single "current source of truth" enforced across all five —
`Master_Plan.html` documents this as an intentional manual-push design
("กดปุ่มส่งเอง") with auto-sync deferred.

## 6. Business-rule summary (as implemented, `src/lib/chart-utils.ts`)

**Duration model (2026-08-01, current):** every number typed into
Manual/Machine/Walk/Idle is a raw duration — nothing is subtracted. Machine
rows start when the *operator element directly above them* finishes (a
person must load a machine); operator rows chain from their own previous
element. An explicit non-zero `startTime` only relocates the bar, never
shortens it.

**Cycle Time (`computeCycleDetail`):** the longest **operator loop** =
`max(operator's own manual+walk+idle sum, the stop time of the machine(s)
that operator loads)`. A machine nobody waits for (e.g. a scrap crusher)
never sets the cycle. This has gone through three corrections this project
history (naive stop-time model → "any machine's end" → correctly
machine-tender-scoped), each with a regression test pinned to real BYD Side
Step production data.

**Machine Capacity (`machine-capacity.ts`):** `capacity = netShiftSeconds /
(manualTime + autoTime + changeTime/changeQty)`, default shift 540 min gross
− 80 min breaks = 460 min net. This is a deliberate replacement of a broken
hard-coded Excel cell (`=39*8.66`), confirmed correct against the reference
training deck (§9).

**Combination Table (`combination-table.ts`):** solid=man, dashed=machine,
wave=walk; wraps bars that exceed Takt back to zero. **See §10, Major finding
#5 — the wrap boundary is not fully correct per the source material.**

## 7. Persistence / API / data-loss risks

D1 schema (`schema.sql`): `folders` (self-referencing FK for nesting) and
`chart_files` (JSON blob `content`). API functions have minimal validation,
return raw error messages (`{ error: err.message }`), and `folders.js` runs a
defensive self-healing `ALTER TABLE ... ADD COLUMN parentId` on every `GET`
wrapped in a swallowed try/catch (works, but re-runs the DDL on every folder
list request forever — cheap on SQLite but inelegant).

Data-loss guard: `hydrate()` merges cloud metadata with any locally-loaded
full content and marks unloaded files `_loaded: false`; `saveActiveFile()`
refuses to save while `_loaded === false`. **This guard is load-bearing but
untyped** — see Major finding #3.

`duplicateFile` correctly remaps step IDs, layout element IDs, and connector
`fromId`/`toId` (free-floating `fromPt`/`toPt` ends pass through untouched,
correctly).

## 8. Test / build / lint / deploy baseline

- `npm test` → **83/83 pass**, 0 failures.
- `npx tsc --noEmit` → **clean**, exit 0.
- `npm run build` → **clean**, static export completes, 5/5 pages
  prerendered.
- `npx eslint .` → **11 problems (7 errors, 4 warnings)**, all pre-existing
  (none introduced while producing this report):
  - `StepTable.tsx:56` — `react-hooks/rules-of-hooks` **error** (see §10
    Major #1)
  - `TopBar.tsx:29` — hoisting/`react-hooks/immutability` **error** (see §10
    Minor #9)
  - `Sidebar.tsx:404`, `storage.ts:51`, `useChartStore.ts:387` —
    `@typescript-eslint/no-explicit-any` **errors**
  - `StepTable.tsx:236` — unescaped `"` **error** (×2,
    `react/no-unescaped-entities`)
  - `ManMachineChart.tsx:5,7`, `folders.js:17`, `TopBar.tsx:151` —
    unused-variable **warnings**
- No CI config found in the repo; deployment is the documented manual
  `wrangler pages deploy` step.

## 9. Reference-document relevance

- **PDF blueprint (13 slides):** original vision doc for the M1–M5
  architecture, already fully absorbed into `docs/Master_Plan.html`.
- **`งานมาตรฐาน.pptx` (45 slides, opened for the first time this session)** —
  the authoritative Toyota-style "how to make" training deck for all five
  paper forms. Highly relevant, and it **both confirms and corrects**
  current code:
  - Confirms "Lapping" = physical stopwatch technique, not an app feature
    (validates the M1-is-not-a-stopwatch decision).
  - Confirms "use the Min column" is the correct rule for selecting the
    standard time (matches `pushBasis: 'min'` default).
  - Confirms the exact Production Capacity formula and a worked example (1
    shift = 460 min = 27,600 s) that matches `machine-capacity.ts`'s
    defaults precisely — strong validation of the 2026-08-01 formula
    decision.
  - Confirms Module 5's construction rule (Min base bar → Max overlay →
    Average dot) exactly matches the already-planned Phase 4 backlog.
  - **Reveals a wrap-boundary rule for Module 3 (slide 29) that current code
    does not fully implement** — see §10.
  - Reveals that the *paper* Machine Capacity Sheet includes a small drawn
    timeline in a "remarks" column (STEP 7) that Module 2 does not
    currently render.
- **`3 TEN SET Line SUV_Rev.01.xlsx`:** real production data, already used
  extensively to derive and regression-test the current Cycle Time model.
- **`แบบฟอร์มตารางจับเวลา 1.xlsx`:** blank Time Measurement Sheet,
  structurally matches Module 1's UI.
- **`2026_06Jun_Injection_PD5,6.xlsx` (opened for the first time this
  session):** **not** a Standard Work template — it is a live daily
  OEE/downtime-tracking database (dozens of downtime reason codes) plus
  master lookup tables (machine list, part list with per-station headcount,
  and an employee/machine validation list with **real employee names and ID
  numbers**, and many broken external-workbook links producing `#VALUE!`
  errors). It has no structural relationship to the M1–M5 data model; it's
  evidence for the *future* "TPS Activity 4M" (Management/Man pillars)
  roadmap already recorded in project memory, not for the current app
  scope. See Major finding #7 on the PII it contains.

## 10. Findings

**Major**

1. **`src/components/editor/StepTable.tsx:56`** — `useCallback` is called
   *after* a conditional early return (`if (!activeFile) return null;` at
   line 50). Confirmed by ESLint as a `react-hooks/rules-of-hooks`
   **error**, not a style nit. Currently masked because the parent
   (`editor/page.tsx`) only mounts `StepTable` while `activeFile` is
   truthy — but the guard inside `StepTable` itself means any future code
   path that keeps this component mounted while `activeFile()` transitions
   to `null` (e.g. deleting the active file/folder without an intervening
   unmount) risks React's "rendered fewer hooks than expected" crash.
2. **`src/components/layout/Sidebar.tsx:19-26`** — the "Admin PIN" gating
   folder/file delete and move (`ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN
   || '1234'`) is a `NEXT_PUBLIC_` variable, meaning it ships in the client
   JS bundle in plaintext, and defaults to the literal string `'1234'` if
   unset (nothing in `wrangler.toml` or elsewhere sets it). This provides no
   real access control — anyone can read the value from devtools, or the
   deployed app is simply gated by `'1234'`.
3. **`_loaded` flag** (`src/lib/storage.ts:51`,
   `src/store/useChartStore.ts:169,387`) is the sole mechanism preventing
   the documented data-loss bug (overwriting cloud content with an empty
   lazy-loaded file), but it is not part of the `ChartFile` type in
   `src/types/index.ts` — it is smuggled through 3 separate `as any` casts
   (also flagged individually by ESLint). A future edit to `ChartFile` or
   the hydration flow could silently break this guard with no type error to
   catch it.
4. **`docs/User_Manual.html`** is stale relative to the current app: it
   documents only the original single-screen workflow (header + step table
   + layout + summary + export) and never mentions Modules 1/2/3/5 or the
   module switcher at all. It also links to `http://localhost:3001`, which
   matches neither `.claude/launch.json`'s actual dev port (`3456`) nor the
   README's implied default (`3000`). Since
   `docs/AI_PROMPTS/PROMPT_GPT_01...md` explicitly cites this file as
   authoritative for "terminology the implementation must preserve," this
   is a real source-of-truth conflict for the plan to resolve.
5. **`src/lib/combination-table.ts` `segmentsFor()` (Rule 1 wrap
   boundary)** always wraps a bar at `taktTime`. The authoritative training
   deck (`งานมาตรฐาน.pptx`, slide 29, "Smart Logic: Combination Table Edge
   Cases") specifies two distinct cases: when C.T. < T.T., wrap at the
   **T.T.** line; when C.T. > T.T., wrap at the **C.T.** line — i.e., the
   boundary is `max(cycleTime, taktTime)`, not always Takt. The current
   code only ever uses Takt, so it draws incorrectly in exactly the
   overloaded case (C.T. > T.T.) that this rule exists to visualize.
6. **Module 5 (`Module5_YamazumiChart.tsx`) still sources bars from Module
   4's `steps`**, not Module 1's Min column, contradicting both the
   training deck (slide 39, explicit "use minimum total cycle time from
   time measurement table") and the project's own `docs/Master_Plan.html`
   Phase-4 backlog wording. Already tracked as planned work, not new —
   flagged here with confirming source evidence for scoping.
7. **`Docs_StandardWork_Reference/2026_06Jun_Injection_PD5,6.xlsx`**
   (`List_validation` sheet) contains real employee full names paired with
   Thai employee ID numbers, tracked in git. Not app-code related, but
   worth surfacing as a data-governance item; not reproduced here.

**Minor**

8. Stale Cycle-Time comments describing the pre-2026-08-01 model (still
   functionally correct, since they just describe intent above a call to
   the fixed function): `useChartStore.ts` ~112-115, `HeaderForm.tsx:17`,
   `SummaryTable.tsx:15`.
9. `src/lib/time-study.ts:167-175` — a stale "Module 4 stores STOP
   readings" comment block sits ~50 lines above a correct, current comment
   ("Both modules store durations now") in the same file.
10. `src/components/chart/ManMachineChart.tsx` is unreferenced dead code
    (confirmed via search — nothing imports it) that still mislabels the
    timeline axis extent as "Cycle Time" (the exact bug already fixed in
    the live `StepTable.tsx` footer). ESLint also flags two now-unused
    imports there.
11. `functions/api/files.js:2` doc comment claims a `?all=1` query param
    controls listing; the implementation never checks it (harmless —
    default behavior already lists everything).
12. `functions/api/folders.js:17` — unused `migErr` catch binding.
13. `package.json`'s `"start": "next start"` is inconsistent with
    `next.config.ts`'s `output: 'export'` (a static export has no server
    for `next start` to run).
14. Three different local dev ports appear across docs/config: README
    (implied 3000), `docs/User_Manual.html` (3001), `.claude/launch.json`
    (3456, the one actually used).
15. `Sidebar.tsx:404` — avoidable `any` cast
    (`setActiveModule(m as any)`).
16. `TopBar.tsx` — `withPatchedStylesheets` is declared inside the
    component body after the `useCallback`s that reference it; works via
    function hoisting but trips `react-hooks/immutability` and is recreated
    every render for no benefit.
17. Module 3's waiting-time (Rule 2) and Module 2's paper-form "remarks
    column" mini-timeline (pptx slide 14, STEP 7) are shown as text/number
    summaries rather than the on-chart drawn arrow/line the source material
    specifies — presentational fidelity gap only, numbers are correct.
18. Test-harness inconsistency: `tests/layout-utils.test.cjs` still uses
    `vm.runInNewContext` + manual JSON normalization, while the other five
    test files use an in-realm `new Function(...)` loader (adopted
    mid-project to fix `deepStrictEqual` cross-realm failures).
19. Machine Capacity Sheet: the training deck computes capacity "**per
    day**"; the app computes and labels it "**ต่อกะ (per shift)**."
    Identical at a single-shift plant, diverges at multi-shift — flagged as
    a question, not a bug.

## 11. Questions GPT must answer before Phase 4/5/6 planning

1. Module 3 Rule 1 wrap boundary: adopt `max(cycleTime, taktTime)` per
   slide 29, or keep Takt-only? (Major finding #5 has concrete before/after
   behavior implications.)
2. Module 2 "capacity per day" vs. current "capacity per shift" — confirm
   this plant is single-shift, or the label/formula needs a shift-count
   multiplier.
3. `docs/User_Manual.html`: rewrite for the current M1–M5 structure now, or
   explicitly demote it to "legacy, superseded by in-app labels" the way
   `Codex_Multi_Device_Blueprint.md` already is?
4. The `docs/AI_PROMPTS/` folder (5 workflow files + this report) was
   untracked in git at the time this report was written — should it be
   committed as part of this phase's output, and does its existence change
   how future sessions should be kicked off?
5. Disposition of the Admin PIN (Major #2): remove it, replace with real
   server-side auth, or explicitly document it as "UX friction only, not
   security" so nobody relies on it?
6. `_loaded` (Major #3): worth promoting into the `ChartFile` type now, or
   defer to whenever persistence is next touched?

## 12. Recommended next action

Return this report to GPT/Codex for Master Plan authorship. No code should
be written until GPT returns `APPROVED_FOR_USER_CODING_AUTHORIZATION` per
`docs/AI_PROMPTS/PROMPT_GPT_01_PROJECT_AUDIT_AND_MASTER_PLAN.md`, and the
user gives an explicit go-ahead to code.

---

ONBOARDING_STATUS: READ_ONLY_COMPLETE
