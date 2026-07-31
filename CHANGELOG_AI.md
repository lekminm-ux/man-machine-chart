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

## 2026-07-31 (Update 2)

### Tool

- Claude Code (Opus 5)

### Session Goal

จัดระเบียบโครงสร้างโฟลเดอร์ที่ root ของ repo และตั้งชื่อไฟล์/โฟลเดอร์ให้สื่อความหมาย
เพื่อให้ค้นหาและใช้งานง่ายขึ้น (root เดิมมี 35 รายการ ปนกันทั้งไฟล์ config, เอกสาร, ไฟล์ซ้ำ, ไฟล์ตาย)

### Completed

- **ลบไฟล์ซ้ำ/ไฟล์ตาย** (ผู้ใช้อนุมัติ — ยังกู้คืนได้จาก git history ที่ commit `976203f`):
  - `eslint.config-Alex_PREDATOR.mjs`, `next-env.d-Alex_PREDATOR.ts`,
    `package-Alex_PREDATOR.json`, `tsconfig-Alex_PREDATOR.json`
    (diff แล้ว = สำเนาเก่าของ config ตัวจริง ต่างกันแค่การจัดรูปแบบ/บรรทัดเดียว ไม่มีเนื้อหาใหม่)
  - `setup.ps1` — ใช้ไม่ได้แล้ว ชี้ไปที่ `G:\My Drive\Antigravity\...\mm-chart-app`
    ซึ่งทั้ง path และโฟลเดอร์ `mm-chart-app` ไม่มีอยู่จริงแล้ว
- **สร้าง `docs/` รวมเอกสารโปรเจกต์** (ใช้ `git mv` เพื่อรักษา history):
  - `Deploymen_checklist.md` → `docs/Deployment_Checklist.md` (แก้ typo ในชื่อไฟล์ด้วย)
  - `user_manual.html` → `docs/User_Manual.html`
  - `Codex_Multi_Device_Blueprint.md` → `docs/Codex_Multi_Device_Blueprint.md`
- **เปลี่ยนชื่อโฟลเดอร์เอกสารอ้างอิง**: `Doc.Support_Standardized_Work/` → `Docs_StandardWork_Reference/`
  (คงไว้ที่ root ตามที่ผู้ใช้เลือก เพราะเปิดใช้จาก File Explorer บ่อย)
- **`eslint.config.mjs`**: เพิ่ม ignore `_Backup_scratch_OneDriveMigration_20260719/**`
  และ `tests/**/*.cjs` — โฟลเดอร์ backup ไม่ใช่ source code และ test ใช้ `require()` โดยตั้งใจ
- **`.gitignore`**: commit บรรทัด ignore โฟลเดอร์ backup ที่ค้างมาจาก session ก่อน
- **`PROJECT_CONTEXT.md`**: อัปเดตให้ตรงโครงสร้างจริงทั้งไฟล์
  - ลบ prefix `mm-chart-app/` ที่ไม่มีอยู่จริงออกจากทุก path (Important Files / High-Risk Files / Tech Stack / Deployment)
  - เขียนหัวข้อ Important Files และ Folder Structure ใหม่ พร้อมกติกาว่าอะไรต้องอยู่ root อะไรย้ายเข้า `docs/`
  - ลบอ้างอิงไฟล์ที่ไม่มีแล้ว (`Sample.xlsx`) และอัปเดต Known Risks

### Files Added / Changed

- ลบ: `eslint.config-Alex_PREDATOR.mjs`, `next-env.d-Alex_PREDATOR.ts`, `package-Alex_PREDATOR.json`,
  `tsconfig-Alex_PREDATOR.json`, `setup.ps1`
- ย้าย/เปลี่ยนชื่อ: `docs/*` (3 ไฟล์), `Docs_StandardWork_Reference/*` (4 ไฟล์)
- แก้ไข: `eslint.config.mjs`, `.gitignore`, `PROJECT_CONTEXT.md`, `CHANGELOG_AI.md`

### Verification

- `npm run build` ผ่าน (Compiled successfully, prerender 5/5 หน้า)
- `npm test` ผ่าน 23/23 tests
- `npm run lint`: ปัญหาลดจาก 77 (61 errors) → 11 (7 errors) เพราะ backup folder และ tests
  ไม่ถูก lint แล้ว — error ที่เหลือทั้งหมดเป็นของเดิมใน source (`StepTable.tsx`, `TopBar.tsx`,
  `storage.ts`, `useChartStore.ts`, `Sidebar.tsx`) ไม่ได้เกิดจากการจัดโฟลเดอร์รอบนี้
- ไม่มีโค้ดไฟล์ไหนอ้างถึงเอกสารที่ย้าย (ตรวจด้วย grep ก่อนย้าย) — มีแต่ไฟล์ .md ที่อ้างถึงกันเอง

### Notes / Risks

- ไฟล์ที่ต้องอยู่ root ต่อไปเพราะ framework/tool บังคับ: `src/`, `public/`, `functions/`, `tests/`,
  config ทั้งหมด, `schema.sql`, `wrangler.toml` และ `PROJECT_CONTEXT.md` / `CHANGELOG_AI.md`
  (AI workflow prompt อ่านสองไฟล์นี้ที่ root)
- โฟลเดอร์ที่ยังเห็นใน File Explorer แต่ไม่ได้อยู่ใน git (ignored ทั้งหมด, ลบทิ้งได้ถ้าอยากให้โล่ง):
  `.next/`, `out/`, `node_modules/`, `_Backup_scratch_OneDriveMigration_20260719/`, `tsconfig.tsbuildinfo`
- error ของ eslint ที่เหลือ 7 ข้อยังไม่ได้แก้ ถือเป็นงานแยกรอบ (โดยเฉพาะ
  `StepTable.tsx` ที่เรียก `useCallback` แบบมีเงื่อนไข = ผิดกติกา React Hooks จริง ควรแก้)

## 2026-07-31 (Update 3)

### Tool

- Claude Code (Opus 5)

### Session Goal

อ่าน blueprint PDF และไฟล์ Excel ต้นฉบับอย่างละเอียด เพื่อตรวจสอบว่า Module M1-M5 ตรงกับเอกสารจริงหรือไม่
แล้วจัดทำแผนแม่บท (Master Plan) เป็น HTML ให้ผู้ใช้อนุมัติ — **รอบนี้ยังไม่แก้โค้ดแอป**

### Completed

- **อ่าน `Antigravity_WebApp_Development_Blueprint_(2).pdf` ครบ 13 หน้า**
  - PDF เป็นสไลด์แบบรูปภาพ ไม่มี text layer และเครื่องนี้ไม่มี poppler/python
  - เขียน Node script แปลง image XObject (FlateDecode + PNG predictor 15) เป็นไฟล์ PNG โดยห่อ deflate stream
    เข้า IDAT chunk ตรงๆ แล้วอ่านทีละหน้า (script อยู่ใน scratchpad ไม่ได้ commit)
- **แกะสูตรจาก Excel** (unzip xlsx แล้วอ่าน sheet XML ด้วย Node)
  - `3 TEN SET Line SUV_Rev.01.xlsx` (32 ชีต) และ `แบบฟอร์มตารางจับเวลา 1.xlsx` (6 ชีต)
  - ชีต `JOB_C CAP_1`: `Min=MIN(C:G)`, `Max=MAX(C:G)`, `Aver=AVERAGE(C:G)`,
    `TOTAL=SUM(C8:C44)-C25` → **ยอดรวมหักแถวเครื่องจักรออก**
  - ชีต `Machine Capacity Sheet`: `Completion Time = SUM(Basic Time:Auto Time)`
  - ชีต `std.com table`: คอลัมน์ คน/เครื่อง/เดิน + เวลาสะสม `=H11+G11+E11`
  - ชีต `kaizen`: มีบล็อก BEFORE/AFTER + Problem + มาตรการ + ผู้รับผิดชอบ จริง
  - มีชีต `MIFC 1`, `MIFC 2` (Material & Information Flow Chart) อยู่แล้ว
- **ยืนยันว่า M1 ตีความผิดจริง**: สไลด์วาดเป็น iPad ปุ่ม LAP แต่ชื่อโมดูลคือ "ตารางจับเวลา"
  และฟอร์ม Excel เป็นตาราง key-in → นาฬิกาจับเวลาไม่ควรอยู่ใน WebApp
- **วิเคราะห์ M3 vs M4 ตามหลัก TPS**: M3 = แกนเวลา (Standardized Work Combination Table),
  M4 = แกนพื้นที่ (Standardized Work Chart) → **ไม่ควรยุบรวม** เป็นเอกสารคนละใบในระบบ TPS
  ผลคือ kaizen ไม่ต้องเบียดเข้า M5 แต่แยกเป็น M6
- **สร้าง `docs/Master_Plan.html`** — แผนแม่บท 13 หัวข้อ: วิสัยทัศน์ / หลักการ TPS / M3-M4 /
  สถานะโมดูล / สถาปัตยกรรมข้อมูล / สูตรมาตรฐาน / Kaizen loop + Before-After /
  Roadmap 8 เฟส / TPS Activity 4M / กติกาการทำงาน / Decision log / คำถามค้าง / Change log
- **`PROJECT_CONTEXT.md`**: เพิ่ม Master_Plan.html เข้า Important Files + Folder Structure
  และเพิ่มกติกา 2 ข้อ (Master Plan update rule, M1 เป็นตารางไม่ใช่นาฬิกา)

### Files Added / Changed

- `docs/Master_Plan.html` (ใหม่)
- `PROJECT_CONTEXT.md`
- `CHANGELOG_AI.md`
- ไม่มีการแก้ไฟล์โค้ดแอปในรอบนี้

### Verification

- เปิด `docs/Master_Plan.html` ใน browser จริง ตรวจ DOM: section ครบ 13 หัวข้อ,
  ลิงก์สารบัญไม่มีอันไหนเสีย (0 broken anchors), badge ทุกอันมี class ถูกต้อง,
  ไม่มี horizontal overflow ทั้งจอ desktop (1280px) และ mobile (375px),
  ตารางทุกอันอยู่ใน container ที่ scroll แนวนอนได้

### Notes / Risks

- **กติกาใหม่จากผู้ใช้**: อัปเดต `docs/Master_Plan.html` ได้ก็ต่อเมื่อโค้ดผ่านการทดสอบจริงแล้วเท่านั้น
  (build + test + เปิดหน้าจอจริงไม่มี error) ห้ามอัปเดตแผนจากโค้ดที่ยังไม่ได้ทดสอบ
- **คำถามค้างที่ต้องได้คำตอบก่อนเริ่ม Phase 2**: สูตร `=39*8.66` ในชีต Machine Capacity
  ยังไม่ทราบที่มาของเลข 39 และ 8.66 และยังไม่ทราบเวลาทำงาน 1 กะ (หักพักแล้ว) ของโรงงาน
- ในระบบนี้ไม่มี skill ของ Toyota Production System ติดตั้งอยู่ (ตามที่ผู้ใช้ขอให้ใช้)
  จึงวิเคราะห์ด้วยความรู้ TPS ตรงๆ แทน
- M4 ไม่ถูกแตะต้องตามคำสั่งผู้ใช้ — งานเสริมเลื่อนไป Phase 6

## 2026-07-31 (Update 4) — Phase 1

### Tool

- Claude Code (Opus 5)

### Session Goal

Phase 1 ตาม Master Plan: เปลี่ยน Module 1 จากนาฬิกาจับเวลาเป็น **ตาราง key-in** ตามฟอร์ม
Time Measurement Sheet และเชื่อมข้อมูลกับ M4 ทั้งสองทาง เพื่อให้เห็นความสัมพันธ์ของตัวเลขข้ามโมดูล

### Completed

- **`src/types/index.ts`**: เพิ่ม `TimeStudy`, `TimeStudyRow`, `TimeStudyKind`, `TimeStudyRowStats`
  และ field `timeStudy?` ใน `ChartFile` — คง `timeMeasurement` (laps) ไว้เพื่อ backward compatibility
- **`src/lib/time-study.ts` (ใหม่)**: logic ทั้งหมดของ M1
  - `computeRowStats` = MIN / MAX / AVERAGE / Fluctuation ตามสูตร Excel (ช่องว่างถูกข้าม)
  - `computeTotals` = `=SUM(column)-<แถวเครื่อง>` — เวลาเครื่องไม่ถูกนับเป็นภาระคน
  - `computeOperatorTotals` = สรุปรายคน แยกเครื่องออกเป็น Auto M/C
  - `timeStudyFromSteps` / `stepsFromTimeStudy` = สะพานแปลงข้อมูลกับ M4
    **ผ่าน `getCalculatedSteps` เสมอ** เพราะ M4 เก็บ "เวลาหยุด" ส่วน M1 เก็บ "ระยะเวลา"
  - `parsePastedGrid` = รองรับวางบล็อกจาก Excel (tab/newline)
- **`src/store/useChartStore.ts`**: เพิ่ม `updateTimeStudy`, `importTimeStudyFromSteps`,
  `pushTimeStudyToSteps(basis)` — push จะคำนวณ cycleTime ใหม่ให้ด้วย
- **`src/components/modules/Module1_TimeMeasurement.tsx`**: เขียนใหม่ทั้งไฟล์
  - ตาราง: Seq · Job Element · Worker (A–J / Auto M/C) · ประเภท (คน/เครื่อง/เดิน/รอ) ·
    1st–10th · Min · Max · Fluc · Aver
  - แถวเครื่องจักรไฮไลต์เหลืองอัตโนมัติและไม่ถูกนับใน TOTAL
  - เพิ่ม/ลบ/เลื่อนแถวได้ไม่จำกัด · สลับจำนวนรอบ 5/10 · วางจาก Excel ได้ (ขยายแถวอัตโนมัติ)
  - ปุ่ม "ดึงข้อมูลจาก M4" และ "ส่งข้อมูลไป M2–M5" พร้อมกล่องยืนยันที่ระบุจำนวนแถวที่จะถูกเขียนทับ
  - แผงสรุปรายคนสำหรับทวนสอบตัวเลขข้ามโมดูล
- **แก้บั๊ก `Module5_YamazumiChart.tsx`**: เดิมบวก `manualTime + walkingTime + idleTime` ซึ่งเป็น
  **เวลาหยุด** ไม่ใช่ระยะเวลา ทำให้แท่งสูงเกินจริง (Worker B ขึ้น 53s ทั้งที่ M1/M4 ได้ 33s)
  เปลี่ยนไปใช้ `getCalculatedSteps` แล้วตัวเลขตรงกับ M1 และ M4
- **`TopBar.tsx`**: เปลี่ยนป้ายแท็บ "1: Lapping" → "1: Time Sheet" ให้ตรงกับของจริง
- **`tests/time-study.test.cjs` (ใหม่)**: 15 เทสต์ ทวนสอบกับตัวเลขจริงจากไฟล์ Excel
- **`tests/store.test.cjs`**: เพิ่ม module mapping ให้ `@/lib/time-study`
- **`docs/Master_Plan.html`**: อัปเดตเป็น v1.1 — สถานะโมดูล, Roadmap Phase 1, Decision Log, Change Log

### Files Added / Changed

- ใหม่: `src/lib/time-study.ts`, `tests/time-study.test.cjs`
- แก้: `src/types/index.ts`, `src/store/useChartStore.ts`,
  `src/components/modules/Module1_TimeMeasurement.tsx`,
  `src/components/modules/Module5_YamazumiChart.tsx`,
  `src/components/layout/TopBar.tsx`, `tests/store.test.cjs`,
  `docs/Master_Plan.html`, `CHANGELOG_AI.md`

### Verification

- `npm test` → **37/37 ผ่าน** (เดิม 22 + ใหม่ 15) รวมเทสต์เทียบกับตัวเลขจริงในชีต JOB_C CAP_1:
  แถว "เดินไปที่ rack" Min 1.50 / Max 2.00 / Aver 1.73 และแถวเครื่อง 46.99 / 48.72 / 47.83
- `npx tsc --noEmit` ไม่มี error · `npm run build` ผ่าน
- `npx eslint` บนไฟล์ที่แก้: ไม่มี error ใหม่ (เหลือเฉพาะของเดิมใน TopBar และ `any` เดิมใน store)
- **ทดสอบบนเบราว์เซอร์จริง** ด้วยข้อมูลจำลอง BYD Side step (6 step, 2 คน + 1 เครื่อง):
  - ดึงจาก M4 → ได้ระยะเวลา 12 / 4 / 14 / 48 / 20 / 13 ถูกต้อง (แปลงจากเวลาหยุด 12/16/30/48/20/33)
  - ประเภทถูกจำแนกเอง: คน / เดิน / เครื่อง
  - TOTAL = 63.00 ตัดแถวเครื่อง 48s ออก — ตรงกับ Line Total ใน M4
  - กรอกรอบที่ 2 → Min/Max/Fluc/Aver อัปเดตทันที (12/14/2/13)
  - วางบล็อก 2×3 จาก Excel → ลงถูกช่อง TOTAL เปลี่ยนเป็น Min 63.00 / Max 67.50 / Aver 65.48
  - ส่งไป M2–M5 → step กลับมาเป็นเวลาหยุดชุดเดิมเป๊ะ cycle time 48s
  - M4 หลัง push: man 59 / walk 4 / line total 63 / CT 48 เท่าเดิมทุกตัว
  - M5 หลังแก้บั๊ก: Worker A 30s · Worker B 33s ตรงกับ M1 และ M4
  - ไฟล์เก่าที่มีแต่ `laps` และไม่มี `timeStudy` → เปิดได้ปกติ ไม่ crash ข้อมูลเดิมยังอยู่ครบ
  - console ไม่มี error
- ล้างข้อมูลทดสอบใน localStorage ของ localhost:3456 แล้ว

### Notes / Risks

- ปุ่ม "ส่งข้อมูลไป M2–M5" **เขียนทับ step ทั้งหมดใน M4** จึงมีกล่องยืนยันที่ระบุจำนวนแถวเสมอ
  ยังเป็นแบบกดเอง (manual push) ตามที่ตกลงไว้ ส่วน auto-sync อยู่ในแผนระยะถัดไป
- ค่าที่ส่งต่อใช้ **Min** เป็นเวลามาตรฐานตาม blueprint (`stepsFromTimeStudy` รองรับ average/max แล้ว
  แต่ยังไม่เปิดให้เลือกบน UI)
- M2 และ M3 ยังเป็นหน้าว่าง — ปุ่มส่งข้อมูลจึงมีผลกับ M4/M5 ก่อน
- **ยังต้องรอคำตอบก่อนเริ่ม Phase 2**: เลข 39 และ 8.66 ในสูตร `=39*8.66` ของชีต Machine Capacity
  และเวลาทำงาน 1 กะ (หักพักแล้ว) ของโรงงาน
