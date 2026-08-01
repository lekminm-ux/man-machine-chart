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
- Backend API: Cloudflare Pages Functions under `functions/api`
- Database: Cloudflare D1 / SQLite schema in `schema.sql`
- Tests: Node.js built-in test runner, TypeScript transpiled in test harness
- Package manager: pnpm lockfile exists; npm scripts are also used

## Important Files

All paths below are relative to the repository root.

Project memory / documentation:

- `PROJECT_CONTEXT.md`: shared project memory and working rules for all AI tools.
- `CHANGELOG_AI.md`: AI work log. Update after every AI-assisted session.
- `README.md`: repository readme.
- `docs/Master_Plan.html`: **แผนแม่บท** — vision, TPS module mapping, roadmap, decision log, open questions. Read this before starting any module work.
- `docs/User_Manual.html`: user-facing manual/reference.
- `docs/Deployment_Checklist.md`: deployment steps and pre-deploy checks.
- `docs/Codex_Multi_Device_Blueprint.md`: older multi-device guidance; appears mojibake/encoding-corrupted, so use `PROJECT_CONTEXT.md` as the current clean source of truth.
- `Docs_StandardWork_Reference/`: non-code reference material for standard work (pptx / xlsx / pdf). Not used by the app at runtime.

Application code:

- `package.json`: app scripts and dependencies.
- `pnpm-lock.yaml`: dependency lockfile.
- `src/app/editor/page.tsx`: main editor screen.
- `src/store/useChartStore.ts`: central Zustand store, local/cloud persistence actions, cycle time recalculation.
- `src/lib/chart-utils.ts`: core Man-Machine Chart calculation logic.
- `src/lib/storage.ts`: localStorage + API client helpers.
- `src/types/index.ts`: shared domain types.
- `src/components/editor/StepTable.tsx`: operation steps and integrated timeline table.
- `src/components/editor/HeaderForm.tsx`: process/header form and cycle time display.
- `src/components/editor/SummaryTable.tsx`: worker/machine summary.
- `src/components/chart/ManMachineChart.tsx`: chart visualization.
- `src/components/layout-diagram/LayoutDiagram.tsx`: workstation layout editor.
- `src/components/layout/Sidebar.tsx`: folder/file tree actions.
- `src/components/layout/TopBar.tsx`: save/export controls.
- `functions/api/files.js`: Cloudflare API for chart files.
- `functions/api/folders.js`: Cloudflare API for folders.
- `schema.sql`: D1 schema.
- `wrangler.toml`: Cloudflare D1 binding.
- `tests/*.test.cjs`: unit tests.

## Folder Structure

Reorganized 2026-07-31. Rule of thumb: only build-tool config and the framework's expected
folders stay at the root; every human-readable document lives under `docs/` (project docs) or
`Docs_StandardWork_Reference/` (non-code reference material).

```text
.
|-- PROJECT_CONTEXT.md            # project memory (must stay at root)
|-- CHANGELOG_AI.md               # AI work log (must stay at root)
|-- README.md
|-- docs/                         # project documentation
|   |-- Master_Plan.html          # roadmap / decisions / open questions
|   |-- User_Manual.html
|   |-- Deployment_Checklist.md
|   `-- Codex_Multi_Device_Blueprint.md
|-- Docs_StandardWork_Reference/  # pptx / xlsx / pdf reference material (not used by the app)
|-- src/                          # application source (the real app)
|   |-- app/
|   |-- components/
|   |-- lib/
|   |-- store/
|   `-- types/
|-- functions/api/                # Cloudflare Pages Functions
|   |-- files.js
|   `-- folders.js
|-- public/
|-- tests/                        # *.test.cjs, node --test
|-- package.json / pnpm-lock.yaml / pnpm-workspace.yaml
|-- next.config.ts / tailwind.config.ts / postcss.config.mjs / eslint.config.mjs / tsconfig.json
|-- schema.sql                    # D1 schema
`-- wrangler.toml                 # Cloudflare D1 binding
```

Generated / local-only, never committed (all git-ignored): `.next/`, `out/`, `node_modules/`,
`tsconfig.tsbuildinfo`, `next-env.d.ts`, `_Backup_scratch_OneDriveMigration_20260719/`.

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
- Database id is in `wrangler.toml`.

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

- `wrangler.toml`
- `schema.sql`
- `functions/api/*.js`

## Important Working Rules

- Every AI must read `PROJECT_CONTEXT.md` and `CHANGELOG_AI.md` before starting code changes.
- For any work on modules M1-M6, also read `docs/Master_Plan.html` first — it holds the agreed scope, the TPS reasoning behind each module, the decision log, and the questions that must be answered before a phase starts.
- **Master Plan update rule (user requirement, 2026-07-31):** update `docs/Master_Plan.html` only AFTER the change has been verified for real — `npm run build` passes, `npm test` passes, and the screen was exercised in a running dev server with no console errors. Never update the plan on the strength of "the code looks right". Order: fix code -> verify -> update Master Plan -> update CHANGELOG_AI.md -> commit -> push.
- **Deployment is manual (verified 2026-08-01):** pushing to GitHub does NOT publish the site. A push sat for 13 hours with no Cloudflare Pages build, so Git integration is either off or its builds fail. To publish: `npm run build`, then `npx wrangler pages deploy out --project-name=man-machine-chart --branch=main --commit-dirty=true`, then re-check the live bundle. wrangler is already authenticated on this machine. Never report a change as live without checking production itself.
- Module 1 is a key-in time-measurement table, not a stopwatch. The stopwatch UI was a misreading of the blueprint slide; timing is done with a real stopwatch on the shop floor and the readings are typed in.
- Always inspect real files from disk before patching.
- Do not rely on chat history alone.
- Avoid having multiple AI tools edit the same file at the same time.
- After every AI work session, update `CHANGELOG_AI.md`.
- If changing architecture, schema, deployment, workflow, or important rules, update `PROJECT_CONTEXT.md`.
- Before editing calculation logic, read `src/lib/chart-utils.ts`, related tests, and all UI consumers.
- Before editing persistence, read `src/store/useChartStore.ts`, `src/lib/storage.ts`, API functions, and schema.
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
- Temporary Office lock files like `~$<name>.xlsx` inside `Docs_StandardWork_Reference/` should not be treated as source files.
- Note: the repository now lives on a local drive (`D:\00_LocalFile_WebApp\`), not OneDrive. Git is the sync mechanism; the OneDrive rules above only apply if the project is ever moved back into a synced folder.

## High-Risk Files

Be careful before editing:

- `src/lib/chart-utils.ts`
  - Core time, cycle, summary, and segment logic.
- `src/store/useChartStore.ts`
  - Central state, persistence, file/folder actions, cycle recalculation.
- `src/types/index.ts`
  - Shared data contracts; schema/storage/UI depend on this.
- `schema.sql`
  - Database shape; migration/backward compatibility risk.
- `functions/api/files.js`
  - Full chart persistence and JSON content handling.
- `functions/api/folders.js`
  - Folder persistence and delete behavior.
- `src/lib/storage.ts`
  - Cloud/local fallback behavior.
- `src/components/editor/StepTable.tsx`
  - Main data-entry workflow and integrated timeline.
- `src/components/editor/SummaryTable.tsx`
  - Production summary calculations/user-facing numbers.
- `src/components/layout-diagram/LayoutDiagram.tsx`
  - Interactive SVG behavior; easy to break drag/connect/delete flows.
- `src/components/layout/TopBar.tsx`
  - Save/export behavior; html2canvas/jsPDF quirks.
- `pnpm-lock.yaml`
  - Dependency reproducibility.

## Known Risks / Notes

- Some comments/text in existing files show mojibake/encoding corruption, especially older Thai comments. Avoid broad encoding rewrites unless explicitly requested.
- Resolved 2026-07-31: the duplicate `*-Alex_PREDATOR.*` config files and the obsolete `setup.ps1` (it pointed at a Google Drive path that no longer exists) were deleted. They remain recoverable from git history at commit `976203f`. If new `*-Alex_PREDATOR.*` files reappear, they are OneDrive/conflict artifacts — inspect before deleting or merging.
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
