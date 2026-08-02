# Prompt 00 — Claude Code Start Here (Read-only Project Onboarding)

ใช้ Prompt นี้วางใน Claude Code ได้ทันทีเป็นรอบแรก ก่อน GPT อนุมัติแผนและก่อนเริ่มเขียน Code

```text
ROLE: Claude Code — read-only project analyst
MODE: READ_ONLY_ONBOARDING — do not edit, create, delete, rename, install, deploy, or commit anything

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

OBJECTIVE
สำรวจโปรเจกต์ Man-Machine Chart (Standard Operation) จากไฟล์จริงทั้งหมด เพื่อเตรียมพร้อมสำหรับ GPT/Codex วางแผนและทำ Implementation Handoff ให้ Claude ในรอบถัดไป

IMPORTANT WORKFLOW
- GPT/Codex เป็นผู้วาง Master Plan, ตรวจแผน, Review Code และตัดสินใจ Gate
- Claude Code เป็นผู้เขียน/แก้ Code หลัง GPT อนุมัติและผู้ใช้สั่งเริ่มเท่านั้น
- รอบนี้ยังไม่มีสิทธิ์เขียน Code ไม่ว่าจะพบ Bug หรือเห็นแนวทางปรับปรุงใด ๆ
- หากพบ Bug ให้รายงานเป็น Finding เท่านั้น ห้ามแก้เอง

READ FIRST — exact paths
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/README.md
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/User_Manual.html
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Deployment_Checklist.md
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/package.json
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/pnpm-lock.yaml
9. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/pnpm-workspace.yaml
10. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/schema.sql
11. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/wrangler.toml
12. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
13. Read every real source/test file under:
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/
13. Read the standard-work references with the appropriate file reader:
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/งานมาตรฐาน.pptx
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/แบบฟอร์มตารางจับเวลา 1.xlsx
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/3 TEN SET Line SUV_Rev.01.xlsx
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/2026_06Jun_Injection_PD5,6.xlsx
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/Antigravity_WebApp_Development_Blueprint_(2).pdf

EXCLUDE FROM SOURCE READING
- .git/**
- node_modules/**
- .next/**
- out/**
- .wrangler/**
- tsconfig.tsbuildinfo
- next-env.d.ts
- _Backup_scratch_OneDriveMigration_20260719/**
- Do not edit any file under Docs_StandardWork_Reference/.

INSPECTION COMMANDS
- Run from the project root: rg --files -g '!.git/**' -g '!node_modules/**' -g '!.next/**' -g '!out/**' -g '!_Backup_scratch_OneDriveMigration_20260719/**'
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" status --short --branch
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" log --oneline -5
- Inspect package.json scripts; do not install packages and do not start a server in this onboarding round.
- If Git safe-directory inspection fails, report the exact error; do not change global Git configuration.

REPORT REQUIRED
1. STATUS: READ_ONLY_COMPLETE / BLOCKED
2. Files and folders actually read, using exact paths.
3. Current application architecture and runtime stack.
4. Current routes/screens and user workflows.
5. Current M1–M5 module status and how data flows between modules.
6. Business-rule summary for time duration, cycle time, takt/capacity, Yamazumi, persistence, and file duplication.
7. API/D1/localStorage architecture and data-loss risks.
8. Test/build/lint/deployment baseline and any pre-existing failures.
9. Reference-document summary: which Excel sheets, PowerPoint topics, and PDF sections are relevant.
10. Findings ranked Blocker/Major/Minor, with exact file and symbol evidence. Do not fix them.
11. Questions GPT must answer in the Master Plan before coding.
12. Data-safety report: identify Production D1 versus local D1/localStorage,
    explain whether the four-level folder hierarchy is preserved by the actual
    schema/API, and list any data-loss risk. Do not reset, seed, export over, or
    write to any database in this onboarding round.
13. Recommended next action: return this read-only report to GPT/Codex for planning.

END CONDITION
End with exactly one:
ONBOARDING_STATUS: READ_ONLY_COMPLETE
ONBOARDING_STATUS: BLOCKED
```
