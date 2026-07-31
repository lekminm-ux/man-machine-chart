# CHANGELOG_AI

This file is the shared AI work log for Codex, Claude Code, Antigravity, and any other AI tool working on this project.

## Standing Rules For Every AI Session

- Read `PROJECT_CONTEXT.md` and `CHANGELOG_AI.md` before starting edits.
- Inspect actual files from disk before patching.
- Do not rely on chat history alone.
- Avoid multiple AI tools editing the same file at the same time.
- If using OneDrive, wait for sync to finish before starting work.
- If a conflict copy appears, stop and compare before continuing.
- After every work session, update `CHANGELOG_AI.md`.
- If architecture, schema, deployment, workflow, or important rules change, update `PROJECT_CONTEXT.md`.

## 2026-07-08

### Tool

- Codex

### Session Goal

Create a safe shared project memory system for multi-device and multi-AI-tool work.

### Completed

- Inspected the root project structure and the main `mm-chart-app` structure.
- Checked whether `PROJECT_CONTEXT.md` and `CHANGELOG_AI.md` already existed.
- Confirmed both files were absent at the project root.
- Created `PROJECT_CONTEXT.md` as the canonical shared context file for this project.
- Created `CHANGELOG_AI.md` as the canonical AI session log.
- Documented project purpose, tech stack, important files, folder structure, current features, API/data sources, business rules, run/test instructions, working rules, multi-device workflow, multi-AI workflow, OneDrive/Git conflict rules, high-risk files, known risks, and suggested improvements.
- Added required safety rules for Codex, Claude Code, Antigravity, and other AI tools.

### Files Added / Changed

- Added `PROJECT_CONTEXT.md`
- Added `CHANGELOG_AI.md`

### Tests / Checks Run

- `rg --files`
- `Test-Path PROJECT_CONTEXT.md; Test-Path CHANGELOG_AI.md`
- Read key files:
  - `package.json`
  - `mm-chart-app/package.json`
  - `mm-chart-app/README.md`
  - `mm-chart-app/schema.sql`
  - `mm-chart-app/wrangler.toml`
  - `mm-chart-app/src/lib/chart-utils.ts`
  - `mm-chart-app/src/lib/storage.ts`
  - `mm-chart-app/src/store/useChartStore.ts`
  - `mm-chart-app/src/types/index.ts`
  - `mm-chart-app/tests/chart-utils.test.cjs`
  - `Codex_Multi_Device_Blueprint.md`

### Notes / Risks

- The root directory did not respond as a normal git repository to `git status`, even though a `.git` folder is visible.
- `mm-chart-app` appears to be the main runnable app; root-level `src` and config files look like a secondary copy.
- Several existing files contain mojibake/encoding-corrupted comments or older text. This session did not rewrite them.
- OneDrive/machine-specific files exist, including `*-Alex_PREDATOR.*` and `~$Sample.xlsx`; inspect before deleting or merging.

### Next Step

- On the next AI-assisted code change, start by reading `PROJECT_CONTEXT.md` and this changelog.
- If changing app behavior, update or add tests under `mm-chart-app/tests`.
- If changing schema, deployment, persistence, or cycle-time business logic, update `PROJECT_CONTEXT.md` in the same session.

## 2026-07-17

### Tool

- Antigravity

### Session Goal

Expand layout width, implement unlimited nested folders (4-layer structure), and add Admin PIN authorization for deleting and moving files/folders.

### Completed

- Updated `schema.sql` to add `parentId` to `folders` table (self-referencing FK).
- Updated Cloudflare API (`functions/api/folders.js`) POST/PUT to support `parentId`.
- Updated `ChartFolder` type and `useChartStore` to include `moveFolder` and `moveFile` actions.
- Completely rewrote `Sidebar.tsx` to recursively render folder trees.
- Added `move` capability for files and folders inside the Sidebar.
- Added an Admin PIN prompt (`window.prompt` checked against `NEXT_PUBLIC_ADMIN_PIN`) before any folder/file is deleted or moved to prevent unauthorized structural changes.
- Expanded `page.tsx` editor layout by removing `max-w-[1500px]` limit to `w-full`.
- Verified TypeScript builds successfully.

### Files Added / Changed

- `mm-chart-app/src/app/editor/page.tsx`
- `mm-chart-app/schema.sql`
- `mm-chart-app/functions/api/folders.js`
- `mm-chart-app/src/types/index.ts`
- `mm-chart-app/src/store/useChartStore.ts`
- `mm-chart-app/src/components/layout/Sidebar.tsx`

### Notes / Risks

- D1 database schema was updated locally in `schema.sql`. Note that when deploying this to Cloudflare, an `ALTER TABLE folders ADD COLUMN parentId TEXT DEFAULT NULL;` migration must be run manually or via Wrangler on the production database.
- Admin PIN is currently client-side and relies on a hardcoded or environment variable check. This is adequate for a basic utility app to prevent accidental edits by general users but is not a full-security authentication system.

## 2026-07-17 (Update 2)

### Tool

- Antigravity

### Session Goal

Refine UI styling for the sidebar, step table, and main layout based on user feedback.

### Completed

- `Sidebar.tsx`: Changed folder icons and text colors to be level-based (Yellow Factory for PD, Green Gears for Dept, Blue Box for Model, Clipboard for File) instead of process-type based.
- `StepTable.tsx`: Added a color-coded left border tab (orange, blue, green, purple) to clearly group rows by Operator (Worker A, B, C, D, Auto M/C).
- `page.tsx`: Expanded the Workstation Layout Diagram to be full-width and moved the Line Total Summary table directly below it.

### Files Added / Changed

- `mm-chart-app/src/components/layout/Sidebar.tsx`
- `mm-chart-app/src/components/editor/StepTable.tsx`
- `mm-chart-app/src/app/editor/page.tsx`

### Next Step

- Push to GitHub for Cloudflare Pages deployment.

## 2026-07-17 (Update 3)

### Tool

- Antigravity

### Session Goal

Increase the width and height of the Workstation Layout Diagram canvas.

### Completed

- `LayoutDiagram.tsx`: Changed SVG and grid rect fixed widths (`CANVAS_W = 680`) to `100%` so the canvas dynamically expands to fill the entire container.
- Increased the SVG rendered height to `600px` for more drawing room.
- Expanded the logical coordinate bounds to 2000x1000 pixels so dragged items don't hit the clamp boundary too early.

### Files Added / Changed

- `mm-chart-app/src/components/layout-diagram/LayoutDiagram.tsx`

## 2026-07-17 (Update 4)

### Tool

- Antigravity

### Session Goal

Finalize the full Light Theme migration across all editor components (StepTable, SummaryTable, LayoutDiagram) to match the Modern Light theme provided in the project slide deck. Update project documentation.

### Completed

- `StepTable.tsx`: Replaced dark background colors (slate-900/800) with white/slate-50. Updated inputs and SVG timeline lines to use lighter borders (slate-200/300) and text colors (slate-800).
- `SummaryTable.tsx`: Transitioned the main totals table to Light Theme, swapping dark headers with light backgrounds and dark text.
- `LayoutDiagram.tsx`: Updated the Workstation Layout diagram SVG container, palette, grid lines, and property panels to the Light Theme. Adjusted empty states and helper text to match the new color scheme.

### Files Added / Changed

- `mm-chart-app/src/components/editor/StepTable.tsx`
- `mm-chart-app/src/components/editor/SummaryTable.tsx`
- `mm-chart-app/src/components/layout-diagram/LayoutDiagram.tsx`
- `CHANGELOG_AI.md`

### Next Step

- Diagnose any reported issues with data saving or sync status.

## 2026-07-18

### Tool

- Antigravity

### Session Goal

Recover "disappeared" user charts from browser local storage, fix database schema mismatch causing folder nesting level regression on production, and implement guards to prevent future data overwrites.

### Completed

- **Database Recovery Forensics**: 
  - Explored Chrome LevelDB binary files (`.ldb`) and extracted historical records containing `mm_chart_db_v2`.
  - Recovered `Side Step LH, RH` (10 steps) from `localhost:3001` local storage state.
  - Confirmed the 4 "disappeared" files (`5F00_Facestep_#2_R00`, `Coverouter581D`, `Inner RH Rev.01 เจ้แป๋ม B`, `Inner LH Rev.01 เจ้ก้อยB`) had empty steps in all local history records, indicating they were either never saved or worked on from a different device.
- **Production D1 Schema Migration**:
  - Modified `functions/api/folders.js` (`onRequestGet`) to run a self-healing schema migration (`ALTER TABLE folders ADD COLUMN parentId TEXT DEFAULT NULL`) to add the missing `parentId` column to the production D1 database.
  - Verified that the migration successfully executed in production and the folders API now returns folder nesting details.
- **Data Protection & Overwrite Prevention**:
  - `storage.ts`: Rewrote `loadDatabaseFromCloud` to merge fetched folders/files metadata with locally-saved store files (preserving steps/layouts of already loaded local files) and keeping unsynced local files.
  - `useChartStore.ts`: Guarded `saveActiveFile()` to block saves if the file has not finished lazy loading (`_loaded === false`), preventing client-side overwrite of cloud database rows with empty step arrays.
- **Verification**:
  - Run the local build check using `npm run build` and verified that compiling and page pre-rendering succeeds with zero errors.
  - Committed and pushed changes to GitHub branch `main`, triggering automated deployment on Cloudflare Pages.

### Files Added / Changed

- `mm-chart-app/functions/api/folders.js`
- `mm-chart-app/src/lib/storage.ts`
- `mm-chart-app/src/store/useChartStore.ts`
- `Deploymen_checklist.md`
- `PROJECT_CONTEXT.md`
- `CHANGELOG_AI.md`

### Next Step

- Monitor user usage and check if any git merge conflict issues occur.

## 2026-07-19

### Tool

- Antigravity

### Session Goal

Synchronize root-level src directory and config files with the latest mm-chart-app codebase (16 files) and initialize/commit them to the root Git repository to ensure consistent codebase alignment.

### Completed

- **Root Codebase Synchronization**:
  - Compared root-level `src` folder with `mm-chart-app/src` and verified exactly 16 files were different (root-level files were obsolete copies from July 7th).
  - Copied all latest code from `mm-chart-app/src` and `mm-chart-app/functions` to the root folder.
  - Copied `package.json`, `tsconfig.json`, `postcss.config.mjs`, `next.config.ts`, `schema.sql`, `wrangler.toml`, `tailwind.config.ts`, and `.gitignore` to the root folder.
- **Git Cleanup**:
  - Removed the mistakenly created `.git` folder at the root directory per user instruction.
  - Confirmed that all code modifications (15+ files) are already safely committed and pushed to the main `mm-chart-app` GitHub repository (latest commit hash: `1dd314b`).

### Files Added / Changed

- `src/` (16 source files updated)
- `functions/` (api functions updated)
- `.gitignore` (updated)
- `package.json` (updated)
- `tsconfig.json` (updated)
- `postcss.config.mjs` (updated)
- `next.config.ts` (updated)
- `schema.sql` (updated)
- `wrangler.toml` (updated)
- `tailwind.config.ts` (updated)
- `CHANGELOG_AI.md` (updated)

### Next Step

- Await user verification of the synced workspace and clean Git status.

## 2026-07-31

### Tool

- Claude Code (Opus 5)

### Session Goal

Sidebar "Project Files" tree แสดงชื่อโฟลเดอร์/ชื่อไฟล์ไม่เต็ม (ถูกตัดด้วย `truncate` เป็น `...`)
ทำให้ผู้ใช้อ่านรายละเอียดชื่อไม่ครบ — ต้องการให้ชี้เมาส์แล้วเด้ง tooltip ชื่อเต็ม

### Completed

- `Sidebar.tsx`: เพิ่ม state `nameTip` + helper `showNameTip()` / `hideNameTip()` สำหรับ tooltip ชื่อเต็ม
  - เด้งเฉพาะเมื่อชื่อถูกตัดจริง (ตรวจด้วย `scrollWidth > clientWidth`) — ชื่อสั้นที่แสดงครบอยู่แล้วจะไม่เด้ง
  - ใช้ `position: fixed` + พิกัดจาก `getBoundingClientRect()` เพื่อไม่ให้ tooltip ถูก sidebar
    (`overflow-hidden` / `overflow-y-auto`) ตัดขอบ
  - พลิกไปแสดงด้านบนอัตโนมัติเมื่อรายการอยู่ใกล้ขอบล่างจอ
  - ซ่อน tooltip เมื่อ scroll tree (`onScroll={hideNameTip}`) กัน tooltip ค้างผิดตำแหน่ง
- ผูก `onMouseEnter` / `onMouseLeave` เข้ากับทั้งชื่อโฟลเดอร์และชื่อไฟล์ chart

### Files Added / Changed

- `src/components/layout/Sidebar.tsx`
- `CHANGELOG_AI.md`
- `PROJECT_CONTEXT.md` (แก้ path ให้ตรงความจริง: ไม่มีโฟลเดอร์ `mm-chart-app` แล้ว)

### Verification

- รัน dev server (port 3456) แล้วทดสอบบน DOM จริง:
  - ชื่อยาว (โฟลเดอร์ + ไฟล์ ทั้งภาษาไทย/อังกฤษ) → tooltip เด้งพร้อมข้อความเต็ม, ออกจากชื่อ → tooltip หาย
  - ชื่อสั้น (`Short.01`) → ไม่เด้ง ตามที่ออกแบบไว้
- `npx tsc --noEmit` ผ่าน (ไม่มี error)
- `npx eslint src/components/layout/Sidebar.tsx` → เหลือเฉพาะ error เดิมที่มีอยู่ก่อนแล้ว (`setActiveModule(m as any)`) ไม่ใช่โค้ดที่แก้รอบนี้
- `npm run build` ผ่าน (Compiled successfully, prerender 5/5 หน้า)

### Notes / Risks

- **โครงสร้าง repo เปลี่ยนไปจากที่ PROJECT_CONTEXT.md เดิมระบุ**: ไม่มีโฟลเดอร์ `mm-chart-app` แล้ว
  ตัวแอปจริงอยู่ที่ root ของ repo (`src/`, `functions/`, `tests/`) — แก้ PROJECT_CONTEXT.md ให้ตรงแล้ว
- ยังมีไฟล์ `*-Alex_PREDATOR.*` ค้างที่ root (eslint.config, next-env.d, package, tsconfig)
  ตามกติกาความปลอดภัยไม่ได้ลบหรือ merge ให้ — รอผู้ใช้ตัดสินใจ
- `npm run lint` ทั้งโปรเจกต์ยัง fail อยู่จาก error เดิม (ส่วนใหญ่มาจาก `_Backup_scratch_OneDriveMigration_20260719/`
  และ `tests/*.cjs` ที่ใช้ `require()`) — ไม่เกี่ยวกับงานรอบนี้ แต่ควรใส่ ignore ให้ eslint ในอนาคต
- localStorage ของ `localhost:3456` ถูกใช้ seed ข้อมูลทดสอบชั่วคราวระหว่างตรวจงาน และล้างออกแล้ว
