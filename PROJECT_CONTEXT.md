# PROJECT_CONTEXT

Last updated: 2026-07-31

## Project Name

Man-Machine Chart (Standard Operation)

Repository root: `D:\00_LocalFile_WebApp\ManMachineChart_StandardOperation`

Primary app folder: the repository root itself (`src/`, `functions/`, `tests/`, `package.json` are all at root).

Important note (updated 2026-07-31): the old `mm-chart-app/` sub-folder no longer exists. It was flattened into the repository root during the OneDrive migration. Any path written as `mm-chart-app/<x>` elsewhere in this document should be read as `<x>` relative to the repository root.

## Purpose / เป้าหมายของระบบ

This project is a web application for creating, editing, saving, visualizing, and exporting Man-Machine Charts for standard operation work.

เป้าหมายหลัก:

- สร้าง Dashboard / Editor สำหรับ Man-Machine Chart
- จัดการ folder และ chart file แยกตาม process type
- บันทึกข้อมูล header, operation steps, timeline, worker summary, และ workstation layout
- คำนวณ cycle time, timeline duration, worker/manual/walk/idle/machine time ให้ถูกต้อง
- เชื่อมต่อ cloud data ผ่าน Cloudflare Pages Functions + Cloudflare D1 และมี localStorage fallback
- Export chart เป็น PNG / PDF สำหรับใช้งานเอกสารหรือการอนุมัติ

## Tech Stack

- Framework: Next.js 16 App Router
- UI: React 19, TypeScript, Tailwind CSS (Modern Light Theme)
- State management: Zustand
- IDs: uuid
- Export: html2canvas, jsPDF
- Icons: lucide-react is installed, though some UI still uses text/emoji symbols
- Backend API: Cloudflare Pages Functions under `mm-chart-app/functions/api`
- Database: Cloudflare D1 / SQLite schema in `mm-chart-app/schema.sql`
- Tests: Node.js built-in test runner, TypeScript transpiled in test harness
- Package manager: pnpm lockfile exists; npm scripts are also used

## Important Files

- `PROJECT_CONTEXT.md`: shared project memory and working rules for all AI tools.
- `CHANGELOG_AI.md`: AI work log. Update after every AI-assisted session.
- `mm-chart-app/package.json`: main app scripts and dependencies.
- `mm-chart-app/pnpm-lock.yaml`: dependency lockfile.
- `mm-chart-app/src/app/editor/page.tsx`: main editor screen.
- `mm-chart-app/src/store/useChartStore.ts`: central Zustand store, local/cloud persistence actions, cycle time recalculation.
- `mm-chart-app/src/lib/chart-utils.ts`: core Man-Machine Chart calculation logic.
- `mm-chart-app/src/lib/storage.ts`: localStorage + API client helpers.
- `mm-chart-app/src/types/index.ts`: shared domain types.
- `mm-chart-app/src/components/editor/StepTable.tsx`: operation steps and integrated timeline table.
- `mm-chart-app/src/components/editor/HeaderForm.tsx`: process/header form and cycle time display.
- `mm-chart-app/src/components/editor/SummaryTable.tsx`: worker/machine summary.
- `mm-chart-app/src/components/chart/ManMachineChart.tsx`: chart visualization.
- `mm-chart-app/src/components/layout-diagram/LayoutDiagram.tsx`: workstation layout editor.
- `mm-chart-app/src/components/layout/Sidebar.tsx`: folder/file tree actions.
- `mm-chart-app/src/components/layout/TopBar.tsx`: save/export controls.
- `mm-chart-app/functions/api/files.js`: Cloudflare API for chart files.
- `mm-chart-app/functions/api/folders.js`: Cloudflare API for folders.
- `mm-chart-app/schema.sql`: D1 schema.
- `mm-chart-app/wrangler.toml`: Cloudflare D1 binding.
- `mm-chart-app/tests/*.test.cjs`: unit tests.
- `Sample.xlsx`: sample spreadsheet/reference data.
- `user_manual.html`: user-facing manual/reference.
- `Codex_Multi_Device_Blueprint.md`: older multi-device guidance; appears mojibake/encoding-corrupted, so use this file as the current clean source of truth.

## Folder Structure

```text
.
|-- PROJECT_CONTEXT.md
|-- CHANGELOG_AI.md
|-- Codex_Multi_Device_Blueprint.md
|-- Sample.xlsx
|-- user_manual.html
|-- src/                         # root-level copy; not the primary app unless confirmed
|-- mm-chart-app/
    |-- package.json
    |-- pnpm-lock.yaml
    |-- next.config.ts
    |-- eslint.config.mjs
    |-- tsconfig.json
    |-- schema.sql
    |-- wrangler.toml
    |-- functions/api/
    |   |-- files.js
    |   `-- folders.js
    |-- tests/
    |-- public/
    `-- src/
        |-- app/
        |-- components/
        |-- lib/
        |-- store/
        `-- types/
```

## Current Features / หน้าจอหรือ Workflow หลัก

- `/` redirects to `/editor`.
- `/editor` is the main work surface (supports layout routing for Modules 1-5).
- Sidebar workflow:
  - create/rename/delete folders
  - choose process type
  - create/rename/delete/duplicate chart files
  - open chart files with lazy cloud loading
- Header workflow:
  - edit process name, part number, part name, model, mold number, revision, prepared/approved fields
  - cycle time is auto-calculated
- Step workflow:
  - add, insert, delete, reorder steps
  - edit description, operator/machine, position, start time, manual/machine/walk/idle stop-time fields
  - view calculated count and integrated timeline
- Summary workflow:
  - show worker man time, walk time, idle time, line total, utilization
  - show Auto M/C machine time
- Layout workflow:
  - add and edit machines/equipment/workers/shapes
  - drag elements
  - draw/delete connectors and free arrows
- Export workflow:
  - save active file to cloud
  - export visible chart region to PNG or PDF

## Database / Data Source / API

Primary persistence layers:

- Cloud: Cloudflare Pages Functions + Cloudflare D1
- Offline/cache: browser `localStorage` key `mm_chart_db_v2`

D1 schema:

- `folders`
  - `id`, `parentId`, `name`, `processType`, `expanded`, `createdAt`
- `chart_files`
  - `id`, `name`, `folderId`, `createdAt`, `updatedAt`, `content`
  - `content` stores JSON: `{ header, steps, layoutDiagram }`

API endpoints:

- `GET /api/folders`: list folders
- `POST /api/folders`: create folder
- `PUT /api/folders`: update folder name/expanded
- `DELETE /api/folders?id=...`: delete folder and related files
- `GET /api/files`: list chart file metadata
- `GET /api/files?id=...`: load one file with full content
- `POST /api/files`: create file
- `PUT /api/files`: save file
- `DELETE /api/files?id=...`: delete file

Cloudflare binding:

- D1 binding name: `DB`
- Database name: `mm-chart-db`
- Database id is in `mm-chart-app/wrangler.toml`.

## Business Rules สำคัญ

- Step time fields (`manualTime`, `machineTime`, `walkingTime`, `idleTime`) are treated as stop/end readings, not raw durations.
- Actual step duration = selected stop time - calculated start time.
- Start time is explicit `startTime` when provided and non-zero; otherwise it falls back to the previous end time for the same actor.
- The active category is the category whose stop-time value is the maximum among manual/machine/walk/idle.
- `computeTotalDuration(steps)` means timeline axis extent: maximum calculated end time across all steps.
- `computeCycleTime(steps)` means actual cycle time: maximum total calculated duration per actor, including Worker A-J and Auto M/C.
- Do not replace cycle time with timeline end. Late explicit starts can extend the chart axis without increasing the cycle.
- Auto M/C is included in `OperatorType` but excluded from `ALL_WORKERS`.
- Worker summary includes manual + walk as line total; idle is displayed separately in the summary table.
- Duplicating a file must clone step IDs, layout element IDs, and remap connector IDs.
- Layout connectors may attach to elements or use free points (`fromPt`, `toPt`).
- Empty charts should usually fall back to a 60 second header cycle time in the store UI, while calculation utilities may return 0 for empty inputs.

## Deployment / Run / Test Instructions

Work from the repository root:

```powershell
cd "D:\00_LocalFile_WebApp\ManMachineChart_StandardOperation"
```

Install dependencies:

```powershell
pnpm install
```

If PowerShell blocks `npm.ps1`, use `npm.cmd`:

```powershell
npm.cmd run dev -- -p 3000
npm.cmd run test
npm.cmd run lint
npm.cmd run build
```

Development URL:

```text
http://localhost:3000/editor
```

Cloudflare/D1 deployment details live in:

- `mm-chart-app/wrangler.toml`
- `mm-chart-app/schema.sql`
- `mm-chart-app/functions/api/*.js`

## Important Working Rules

- Every AI must read `PROJECT_CONTEXT.md` and `CHANGELOG_AI.md` before starting code changes.
- Always inspect real files from disk before patching.
- Do not rely on chat history alone.
- Avoid having multiple AI tools edit the same file at the same time.
- After every AI work session, update `CHANGELOG_AI.md`.
- If changing architecture, schema, deployment, workflow, or important rules, update `PROJECT_CONTEXT.md`.
- Before editing calculation logic, read `mm-chart-app/src/lib/chart-utils.ts`, related tests, and all UI consumers.
- Before editing persistence, read `mm-chart-app/src/store/useChartStore.ts`, `mm-chart-app/src/lib/storage.ts`, API functions, and schema.
- Prefer narrow patches. Do not refactor unrelated code during bug fixes.
- Keep user data and chart JSON backward-compatible where possible.
- Never overwrite local storage loaded files during hydration. Always merge files and keep unsynced local changes to prevent data loss.
- Always guard cloud save operations (saveActiveFile) to prevent overwriting cloud data with empty steps/layouts if lazy-loading has not completed (_loaded === false).

## Multi-Device Workflow

Recommended workflow when switching machines:

1. Wait until OneDrive sync is complete.
2. Confirm there are no conflict copies or duplicate machine-specific files.
3. Open the project folder from the synced location.
4. Read `PROJECT_CONTEXT.md` and `CHANGELOG_AI.md`.
5. Inspect current files from disk before making changes.
6. Run relevant checks after changes.
7. Update `CHANGELOG_AI.md`.
8. Let OneDrive finish syncing before opening the project on another machine.

## Multi-AI Tool Workflow สำหรับ Codex, Claude Code, Antigravity

Standard rule for all tools:

- Read `PROJECT_CONTEXT.md`.
- Read `CHANGELOG_AI.md`.
- Inspect the actual files that will be touched.
- Summarize intended files before editing.
- Make one coherent set of changes.
- Run available checks.
- Update `CHANGELOG_AI.md`.

Tool-specific notes:

- Codex:
  - Use terminal inspection and `apply_patch` style edits.
  - Prefer `rg`/`rg --files` for discovery.
  - Update changelog before final response.
- Claude Code:
  - Start by reading both memory files, then list affected files before editing.
  - Avoid rewriting large files unless needed.
- Antigravity:
  - Use the same project-memory files as source of truth.
  - Avoid concurrent edits with Codex/Claude Code.
  - If using an agent plan, include changelog update as the final task.

## OneDrive / Git / Sync Conflict Rules

- OneDrive is acceptable for cross-device sync, but it is not a substitute for Git history.
- If using OneDrive, wait for sync to finish before starting work.
- If a conflict copy appears, stop and compare before continuing.
- Do not edit conflict copies directly until deciding which version is canonical.
- Avoid running multiple AI tools against the same synced files simultaneously.
- Prefer Git for version control when available.
- This root may not behave as a normal git repository in every environment, even though a `.git` folder may appear. Verify with `git status` from the exact directory before assuming Git is active.
- Machine-specific duplicate files such as `*-Alex_PREDATOR.*` may be OneDrive/conflict artifacts. Inspect before deleting or merging.
- Temporary Office lock files like `~$Sample.xlsx` should not be treated as source files.

## High-Risk Files

Be careful before editing:

- `mm-chart-app/src/lib/chart-utils.ts`
  - Core time, cycle, summary, and segment logic.
- `mm-chart-app/src/store/useChartStore.ts`
  - Central state, persistence, file/folder actions, cycle recalculation.
- `mm-chart-app/src/types/index.ts`
  - Shared data contracts; schema/storage/UI depend on this.
- `mm-chart-app/schema.sql`
  - Database shape; migration/backward compatibility risk.
- `mm-chart-app/functions/api/files.js`
  - Full chart persistence and JSON content handling.
- `mm-chart-app/functions/api/folders.js`
  - Folder persistence and delete behavior.
- `mm-chart-app/src/lib/storage.ts`
  - Cloud/local fallback behavior.
- `mm-chart-app/src/components/editor/StepTable.tsx`
  - Main data-entry workflow and integrated timeline.
- `mm-chart-app/src/components/editor/SummaryTable.tsx`
  - Production summary calculations/user-facing numbers.
- `mm-chart-app/src/components/layout-diagram/LayoutDiagram.tsx`
  - Interactive SVG behavior; easy to break drag/connect/delete flows.
- `mm-chart-app/src/components/layout/TopBar.tsx`
  - Save/export behavior; html2canvas/jsPDF quirks.
- `mm-chart-app/pnpm-lock.yaml`
  - Dependency reproducibility.

## Known Risks / Notes

- Some comments/text in existing files show mojibake/encoding corruption, especially older Thai comments. Avoid broad encoding rewrites unless explicitly requested.
- There are duplicate root-level app files and `mm-chart-app` files. Confirm target before editing.
- Some OneDrive-generated or machine-specific files exist, for example files with `Alex_PREDATOR` in the name.
- Cloud API currently has limited schema validation and may expose raw error messages in JSON responses.
- localStorage fallback can hide cloud failures; check `syncStatus` and console logs when debugging persistence.
- html2canvas can fail on modern color functions; `TopBar` includes stylesheet patching for OKLCH/LAB.
- Background dev server startup from sandboxed AI sessions may not persist; foreground `npm.cmd run dev -- -p 3000` has been verified.

## Suggested Next Improvements

- Add schema validation for API request bodies and chart `content`.
- Add migration/version metadata inside saved chart content.
- Add integration tests for API functions with D1-compatible mocks.
- Add Playwright tests for create/open/save/export workflows.
- Improve encoding of mojibake comments/UI text in a controlled pass.
- Add conflict-detection script for OneDrive duplicate files.
- Add a real README for this specific app instead of the default Next.js README.
- Consider moving shared calculation tests to TypeScript/Vitest if the project later adds a richer test stack.
- Clarify whether root-level `src` is obsolete, backup, or a separate deployment target.
