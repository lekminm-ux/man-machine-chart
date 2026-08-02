# Prompt 03 — GPT/Codex Review Claude's Implementation

Copy this Prompt into GPT/Codex after Claude reports an implementation or fix. Attach Claude's handoff, changed-file list, test output, screenshots, and/or diff.

```text
ROLE: GPT/Codex — code reviewer, plan owner, and improvement lead
MODE: CODE_REVIEW_ONLY — do not edit application code

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

INPUT FROM CLAUDE
[Paste Claude's complete handoff, changed-file list, test output, and any screenshots or runtime observations here.]

REVIEW OBJECTIVE
Determine whether Claude's implementation matches the GPT-approved plan and the actual project rules. Find root causes and exact improvements. Do not write code unless the user explicitly asks GPT/Codex to write or fix code.

READ FIRST — exact baseline paths
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/User_Manual.html
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/package.json
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/schema.sql
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/wrangler.toml
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
9. The exact GPT-approved plan and implementation Prompt used for this task.
10. Every file Claude says it changed.
11. Every direct dependency/consumer/test of those changed files. At minimum, if time/data/persistence is involved, read:
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/types/index.ts
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/chart-utils.ts
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/time-study.ts
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/machine-capacity.ts
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/combination-table.ts
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/files.js
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/folders.js
    - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/

INSPECTION COMMANDS
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" status --short --branch
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" diff -- [changed files]
- Run: rg --files -g '!.git/**' -g '!node_modules/**' -g '!.next/**' -g '!out/**' -g '!_Backup_scratch_OneDriveMigration_20260719/**'
- Run the relevant existing checks: pnpm test; pnpm run lint; pnpm run build.
- If Claude reports a runtime fix, reproduce the affected flow in the browser and inspect the console.
- Do not change global Git configuration to solve safe-directory errors. Report the error if needed.

REVIEW CHECKLIST
1. Plan alignment: every requested acceptance criterion is implemented; no silent scope expansion.
2. Calculation correctness: entered durations are not subtracted; cycle time, total duration, worker loop, machine parallelism, takt time, capacity, M3 combination, M4 chart, and M5 Yamazumi agree with the approved business rules.
3. M1 source-of-truth: bridges to M2–M5 preserve data meaning, explicit user confirmation, and do not overwrite hand-entered data unexpectedly.
4. Persistence safety: localStorage fallback, lazy cloud loading, save guards,
   explicit Save-to-Cloud acknowledgement, complete deployed API read-back,
   refresh/reopen persistence, D1 content, folder/file operations, and duplicate
   ID remapping are safe. A local state change, passing request, test, build, or
   deploy is not proof that Cloud data persisted.
5. API/schema: request validation, response shapes, error handling, migrations, and D1 binding match the actual code and schema.
6. UI/UX: actual workflow, labels, responsive layout, keyboard/focus behavior, empty/loading/error states, and export region remain usable.
7. Test quality: tests cover the changed behavior and edge cases, not only happy paths. Build and lint results are real and reproducible.
8. Security/data: no secrets added, no unsafe raw errors, no accidental data deletion, and no broad unapproved dependency or deployment changes.
9. Documentation: Claude updated CHANGELOG_AI.md; plan/context updates are routed back to GPT when required.
10. Database preservation: verify the environment map, read-only preflight, recovery
    export, pre/post folder and chart counts, maximum depth, complete `parentId`
    tree, representative chart IDs/content, and the absence of remote writes.
    A missing or unverifiable export is `BLOCKED`, not a minor note.

FINDING FORMAT
For each finding, provide:
- Severity: Blocker / Major / Minor
- Exact file and line or symbol
- Observed behavior
- Why it violates the approved plan or project rule
- Root cause
- Exact fix instruction for Claude
- Verification command or manual test

DECISION
- APPROVED_FOR_CLAUDE_FIX — findings exist; Claude may fix only the listed scope.
- PASS — implementation meets the approved plan and evidence is sufficient.
- PLAN_CHANGE_REQUIRED — scope, architecture, schema, API, dependencies, or business rules must change; stop coding and revise the plan.
- BLOCKED — missing evidence, missing file, permission problem, or unresolved user decision.
- DATA_SAFETY_BLOCKED — Production/local target, recovery export, or hierarchy
  preservation cannot be verified.

REQUIRED OUTPUT
1. Decision status.
2. Short summary of what passed.
3. Prioritized findings using the format above.
4. Exact READ FIRST paths for Claude's next fix round.
5. Exact ALLOWED TO CHANGE paths for Claude's next fix round.
6. Exact acceptance and retest criteria.
7. Copy-paste Prompt for Claude's fix/retest round using PROMPT_CLAUDE_04_FIX_RETEST.md as the structure.
8. State explicitly whether GPT updated the Master Plan. GPT may update docs/Master_Plan.html only after a plan/phase decision is actually made; never mark the phase closed from code alone.
9. State explicitly whether the Database Safety Gate passed and whether the real
   four-level Production folder tree and existing charts were preserved.
```
