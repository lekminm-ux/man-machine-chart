# Prompt 01 — GPT/Codex Project Audit and Master Plan

Copy the text inside the code block into the GPT/Codex planning task for the Machine Chart project.

```text
ROLE: GPT/Codex — project planner, reviewer, and phase owner
MODE: PROJECT_AUDIT + MASTER_PLAN; PLAN_ONLY; do not write application code

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

OBJECTIVE
Read the project from disk before making any recommendation. Build or update the Master Plan for the Man-Machine Chart (Standard Operation) Web App, then prepare a precise copy-paste implementation handoff Prompt for Claude. The plan must respect the actual code, data model, tests, deployment configuration, business rules, and standard-work references already present in the project.

RESPONSIBILITY RULES
- GPT/Codex owns the plan, review decisions, source-of-truth decisions, and phase closure.
- GPT/Codex must not write application code, refactor source, install dependencies, or deploy unless the user explicitly asks for that action.
- Claude is the implementation agent. Claude may write code only after GPT returns APPROVED and the user explicitly authorizes coding.
- If scope, architecture, schema, API contract, calculation rules, or source data must change, return PLAN_CHANGE_REQUIRED and revise the plan before Claude codes.
- Update docs/Master_Plan.html whenever the approved plan or phase status changes. Never mark a phase complete merely because code exists.

READ FIRST — exact paths, do not skip
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
   Why: current architecture, business rules, high-risk files, deployment rules, and AI workflow.
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
   Why: recent changes, known risks, unfinished work, and previous agent handoffs.
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/README.md
   Why: repository baseline and run commands.
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
   Why: current Master Plan, M1–M6 mapping, roadmap, decisions, and open questions.
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/User_Manual.html
   Why: actual user workflow and terminology that the implementation must preserve.
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Deployment_Checklist.md
   Why: build, deployment, and post-deployment verification requirements.
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Codex_Multi_Device_Blueprint.md
   Why: read as legacy/secondary context; it contains encoding-corrupted sections, so do not treat it as the current source of truth over PROJECT_CONTEXT.md.
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/package.json
9. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/pnpm-lock.yaml
10. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/pnpm-workspace.yaml
11. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/next.config.ts
12. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tsconfig.json
13. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tailwind.config.ts
14. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/postcss.config.mjs
15. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/eslint.config.mjs
16. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/wrangler.toml
17. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/schema.sql
18. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
19. Read every file under these real application paths:
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/
20. Read the standard-work evidence files, using an appropriate Office/PDF reader:
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/งานมาตรฐาน.pptx
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/แบบฟอร์มตารางจับเวลา 1.xlsx
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/3 TEN SET Line SUV_Rev.01.xlsx
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/2026_06Jun_Injection_PD5,6.xlsx
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/Antigravity_WebApp_Development_Blueprint_(2).pdf
   Why: source forms, M1–M6 terminology, machine/process data, and implementation constraints. Report if a binary file cannot be opened or visually inspected.

DISCOVERY AND PREFLIGHT COMMANDS
- Run from the project root: rg --files -g '!.git/**' -g '!node_modules/**' -g '!.next/**' -g '!out/**' -g '!_Backup_scratch_OneDriveMigration_20260719/**'
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" status --short --branch
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" log --oneline -5
- Inspect available scripts from package.json. Do not assume npm when pnpm-lock.yaml is the package-manager source.
- Do not edit global Git configuration to bypass a safe-directory error. Report the error if the exact command still fails.

PROJECT FACTS TO VERIFY, NOT ASSUME
- Framework: Next.js App Router; UI: React/TypeScript/Tailwind; state: Zustand.
- Persistence: Cloudflare Pages Functions + D1 with localStorage fallback; D1 binding is DB.
- M1 is a key-in time-measurement sheet, not a stopwatch UI.
- M1 is the single source for data that feeds M2–M5; M6 is the future Kaizen/Before–After area.
- Duration model: every entered Manual/Machine/Walk/Idle value is a duration; do not subtract entered values.
- Cycle Time is the longest operator loop under the current documented business rules; verify the exact implementation and tests before proposing changes.
- Machine/worker parallel timing, cloud/local hydration, backup/merge behavior, duplicated-file ID remapping, and export behavior are high-risk areas.
- Production D1 is the source of truth for real folders/charts; local Pages Dev, localhost/localStorage, and `.wrangler/` are separate test/cache environments.
- The existing four-level folder tree is user data represented by `parentId`; no plan may flatten, regenerate, seed over, or assume a fixed hierarchy depth.
- Any persistence/schema/API/deployment plan must include a read-only preflight, verified external recovery export, before/after row/tree comparison, and a fail-closed behavior when cloud loading fails.
- Any save/persistence plan must prove a deployed API acknowledgement, a
  read-after-write comparison of the complete chart payload, and persistence
  after refresh/reopen from Cloud. Local state, fixtures, localStorage, or local
  D1 are not evidence of Production persistence.

REQUIRED PLAN OUTPUT
1. Current-state inventory: features, routes, modules, source files, API endpoints, schema, tests, and deployment path.
2. Source-of-truth matrix: which claims/rules come from PROJECT_CONTEXT, Master Plan, code, tests, Excel, PowerPoint, PDF, or user decision. Flag conflicts; do not silently choose.
3. M1–M6 status matrix and dependency order. Preserve the Master Plan rule that M1 is the source feeding M2–M5.
4. Current gaps and risks, ranked Blocker/Major/Minor, with exact file evidence.
5. Proposed phase objective, non-goals, allowed files, data/schema impact, acceptance criteria, test plan, and Definition of Done.
6. Calculation invariants and regression cases for time, totals, cycle time, takt time, machine capacity, Yamazumi, and M1→M2–M5 bridges.
7. Persistence/API safety plan covering localStorage fallback, lazy cloud loading, save guards, explicit Save-to-Cloud acknowledgement, read-after-write verification, refresh/reopen persistence, D1 schema, hierarchy preservation, environment separation, verified recovery export, and data-loss prevention.
8. UI/UX/accessibility/responsive/export requirements appropriate to the actual existing screens.
9. Deployment gate and rollback/verification plan, including pre/post folder/chart counts, parent-child tree comparison, representative existing charts, and recovery-export verification. Do not deploy in this planning task.
10. A complete copy-paste Prompt for Claude that includes exact READ FIRST paths, inspection commands, allowed files, forbidden actions, acceptance criteria, stop conditions, and required handoff output.

PLAN FILE POLICY
- Update docs/Master_Plan.html only for the plan/status changes that are actually approved by the user/GPT workflow.
- Update PROJECT_CONTEXT.md only when architecture, schema, deployment, workflow, or important business rules change.
- Update CHANGELOG_AI.md with the planning session and files changed.
- Do not edit source code or reference files under Docs_StandardWork_Reference in this task.
- Read and enforce `docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md`; do not run Production writes, resets, seeds, migrations, or deletes in a planning task.

APPROVAL OUTPUT
End with exactly one status:
- PLAN_STATUS: APPROVED_FOR_USER_CODING_AUTHORIZATION
- PLAN_STATUS: CHANGES_REQUIRED
- PLAN_STATUS: BLOCKED

If the result is APPROVED, state clearly that Claude still must wait for the user's explicit command to start coding.
```
