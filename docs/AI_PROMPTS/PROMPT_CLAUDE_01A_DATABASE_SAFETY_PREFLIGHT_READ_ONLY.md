# Prompt 01A — Claude Database Safety Preflight (Read-only)

Use this prompt before any persistence, schema, API, deployment, migration,
seed, delete, recovery, or data-loss investigation. It is the next action for
the current Machine Chart task. It protects the real Production D1 data and
does not implement application code.

```text
ROLE: Claude Code — database safety auditor
MODE: DATA_SAFETY_PREFLIGHT — read-only against all databases; no source-code or database writes

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

OBJECTIVE
Prove which database contains the real Machine Chart data, preserve the complete
folder hierarchy (including the existing four-level tree), and create a verified
recovery export before any future persistence/schema/deployment work. Do not
repair, seed, reset, migrate, delete, rename, or overwrite data in this task.

READ FIRST — exact paths
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/schema.sql
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/wrangler.toml
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
9. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/folders.js
10. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/files.js
11. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Deployment_Checklist.md

ENVIRONMENT RULES
- Production source of truth: Cloudflare D1 used by https://man-machine-chart.pages.dev.
- Local Pages Dev at 127.0.0.1:8788 is a separate disposable test database.
- localhost:3456 and browser localStorage are not Production D1.
- .wrangler/ is local runtime state. Do not delete or recreate it.
- Recovery exports belong outside the repository, for example:
  D:/00_LocalFile_WebApp/ManMachineChart_Data_Backups/YYYY-MM-DD_HHmmss/
  They are recovery evidence only and must not be committed or treated as source.

ALLOWED ACTIONS
- Read actual project files and inspect Git status; do not edit project files.
- Run only read-only SELECT/inventory commands against Production or local D1.
- Export the existing Production rows/schema to the timestamped recovery folder
  above. This is the only permitted write, and it must be outside the repository.
- Read the existing Production UI only to confirm the known folder/chart names.

FORBIDDEN ACTIONS
- No application source, schema, config, prompt, or changelog edits.
- No DROP, DELETE, UPDATE, INSERT, ALTER TABLE, reset, migration, seed, restore,
  `wrangler d1 delete`, or bulk write.
- Never use `--remote` for a write. A remote command is permitted only when it
  is demonstrably read-only SELECT/export and its exact command is reported.
- Do not use the one-folder/one-chart local sample as a restoration.
- Do not deploy, push, or change Production data.
- If a command cannot be proven read-only, do not run it.

PREFLIGHT
1. Report the exact current Git status and whether .wrangler/ exists. Do not
   delete or clean any untracked state.
2. Identify the exact database name, binding, database ID, URL, and local/remote
   mode before each database command.
3. Inspect Production with read-only queries and record:
   - total folders and total chart_files;
   - root-folder count;
   - maximum folder depth;
   - every folder's id, parentId, name, processType, expanded, createdAt;
   - every chart file's id, folderId, name, createdAt, updatedAt;
   - a deterministic parent-child tree and representative chart names/IDs.
4. Export the complete Production `folders` and `chart_files` rows, including
   chart `content`, plus the schema and the command output, to the timestamped
   recovery directory. Do not redact or transform the content in the recovery
   copy. Verify the export can be read back and that its row counts match the
   inventory.
5. Inspect local D1 separately, if available, and label it clearly as LOCAL
   TEST ONLY. Never copy local sample data over Production.
6. Compare the Production inventory before and after export. If any count,
   parentId, ID, or content checksum changes, stop immediately.

STOP CONDITIONS
- Production target or authentication is unclear.
- A read-only query/export cannot be verified.
- The export directory cannot be created outside the repository.
- Counts or hierarchy do not match before and after export.
- Any command would mutate Production or local D1.
Return DATA_SAFETY_BLOCKED and explain the exact blocker. Do not work around it.

REQUIRED HANDOFF
1. STATUS: DATA_SAFE_READ_ONLY_COMPLETE or DATA_SAFETY_BLOCKED
2. Exact files read and exact commands run.
3. Environment map: Production vs local Pages Dev vs localhost/localStorage.
4. Production counts, root count, maximum depth, full four-level tree, and chart list.
5. Recovery export path, file list, row counts, and verification result.
6. Local D1 counts and explicit statement that it was not used as Production source.
7. Any discrepancy, risk, or missing recovery capability.
8. Recommended next step: return this report to GPT/Codex for a Data Safety Plan.

END CONDITION
End with exactly one:
DATA_SAFE_READ_ONLY_COMPLETE
DATA_SAFETY_BLOCKED
```
