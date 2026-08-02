# Prompt 02 — Claude Implement the GPT-Approved Plan

Copy this Prompt into Claude only after GPT has returned `APPROVED_FOR_USER_CODING_AUTHORIZATION` and the user has explicitly instructed Claude to start coding. Replace the bracketed task fields with the approved plan details.

```text
ROLE: Claude — implementation and debugging agent
MODE: IMPLEMENTATION — code changes are authorized only for the explicit task below

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

AUTHORIZED TASK
Approved plan/reference: [exact path or pasted GPT-approved plan]
User authorization: [paste the user's explicit command to start coding]
Allowed scope: [exact feature/module and exact files Claude may change]
Do not expand this scope.

PRECONDITIONS
- Confirm that GPT/Codex returned APPROVED_FOR_USER_CODING_AUTHORIZATION.
- Confirm that the user explicitly authorized coding in this task.
- If either is missing, stop with BLOCKED and do not edit files.

READ FIRST — exact baseline paths
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/package.json
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/pnpm-lock.yaml
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/schema.sql
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/wrangler.toml
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
9. Read the exact files named in the approved plan under:
   - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/
   - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/
   - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/
10. Read the relevant read-only reference files under:
   - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/
   - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/User_Manual.html
   - D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Deployment_Checklist.md

PREFLIGHT COMMANDS
- Run from the project root: rg --files -g '!.git/**' -g '!node_modules/**' -g '!.next/**' -g '!out/**' -g '!_Backup_scratch_OneDriveMigration_20260719/**'
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" status --short --branch
- Run the existing checks before editing when practical: pnpm test; pnpm run lint; pnpm run build.
- Record pre-existing failures separately from failures caused by this task.
- If the task touches persistence, schema, API, deployment, migration, seed, delete,
  or recovery, complete the Database Safety Gate first. Record the target
  environment and a verified pre-change recovery export outside the repository.
- Do not delete/recreate `.wrangler/` or reset local D1 to make a test pass.
- Never run two AI tools against the same files at the same time.

IMPLEMENTATION RULES
- Modify only ALLOWED FILES from the approved plan. If another file is required, stop and return PLAN_CHANGE_REQUIRED with the reason.
- Do not change scope, architecture, data schema, API contract, package dependencies, deployment configuration, or business rules without returning to GPT for plan review.
- Do not edit, move, rename, delete, or overwrite any file under:
  D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/
- Do not use generated or backup directories as source: .git, node_modules, .next, out, tsconfig.tsbuildinfo, next-env.d.ts, and _Backup_scratch_OneDriveMigration_20260719.
- Preserve backward compatibility of saved chart JSON and localStorage whenever possible.
- Before changing calculation logic, read chart-utils, the related library modules, all consumers, and related tests.
- Before changing persistence, read useChartStore, storage, both API functions, schema.sql, and persistence tests.
- Preserve the documented duration model: entered values are durations; do not subtract them.
- Preserve the documented Cycle Time rule, parallel machine timing, machine-tender attribution, M1 single-source flow, and M1→M2–M5 bridge behavior unless the approved plan explicitly changes them.
- Preserve cloud/local hydration safeguards and never save an incompletely loaded file over existing data.
- Treat Production D1 as the canonical source of truth. Local Pages Dev, localhost,
  localStorage, and `.wrangler/` are isolated test/cache environments.
- Preserve every folder row, `parentId` relationship, four-level folder tree,
  chart-file row, and chart content. Do not flatten or regenerate hierarchy.
- Never seed or overwrite a real database with a sample. Never run a Production
  write, migration, reset, delete, or bulk update without explicit user approval,
  a written scope, and a verified recovery export.
- If a cloud read fails, fail closed and block save/destructive actions; never let
  an empty local fallback overwrite cloud data.
- Preserve ID remapping when duplicating steps, layout elements, and connections.
- Keep UI labels and terminology consistent with docs/User_Manual.html and the approved plan.
- Preserve chart readability: the Start -> End timing/detail area must not become a large fixed-width region that hides, squeezes, or pushes the timeline graph out of the viewport. Keep it compact or collapsible; retain a normal compact table plus separate full-chart view where appropriate. Use the supplied screenshots as visual evidence for the intended layout problem.
- Use narrow patches; do not rewrite unrelated files or normalize encoding in old Thai text.

VERIFICATION REQUIRED
- Run: pnpm test
- Run: pnpm run lint
- Run: pnpm run build
- If the UI changes, run the dev server and manually smoke-test the affected flow at http://localhost:3000/editor.
- For the Start -> End/chart layout, inspect the real rendered screen at desktop and a narrower viewport: confirm the graph is visible beside the table, labels do not consume the chart area, horizontal scrolling is intentional, and the compact and full-chart views both remain usable. Capture/report the actual result before handoff.
- Inspect browser console for application errors and warnings.
- For time/data changes, cross-check M1, M2, M3, M4, and M5 figures against the approved invariants and regression cases.
- For persistence changes, test local fallback, cloud failure handling, lazy file loading, save guard, refresh/reopen, and no data loss.
- For every save-related change, prove the deployed API returns explicit success
  for the exact chart with a server version/timestamp, read the complete payload
  back from Cloud, compare it, then hard-refresh/reopen and read it again. Never
  mark a save successful from local state alone; ambiguous saves must remain
  unconfirmed and must not overwrite Cloud data with an empty/stale fallback.
- For persistence or deployment changes, compare pre/post folder count, root count,
  maximum depth, complete parent-child mapping, chart count, representative IDs,
  and content checksums. Any unexpected decrease is a STOP condition.
- Do not call a test/build/deploy successful until the real Production tree and
  representative existing charts are reopened and verified.
- For export changes, test PNG/PDF output and the actual visible chart region.
- Do not deploy or push unless the user explicitly authorizes deployment/push in this task.

SESSION RECORDS
- Update D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md at the end with goal, files changed, tests, findings, and remaining risks.
- If architecture, schema, deployment, workflow, or a business rule changed, stop and ask GPT to update/review PROJECT_CONTEXT.md and docs/Master_Plan.html. Do not silently change those plan documents.

REQUIRED HANDOFF OUTPUT
- STATUS: IMPLEMENTED / BLOCKED / PLAN_CHANGE_REQUIRED / TESTS_FAILED
- Exact files read
- Exact files changed
- Summary of behavior implemented
- Commands/tests run and results
- Manual smoke-test steps and results
- Pre-existing failures versus new failures
- Data/schema/API/deployment impact
- Remaining risks and recommended next action
- State whether GPT code review is required before any phase closure.
- Do not claim completion until the visual layout inspection and all required tests are recorded in the handoff.
```
