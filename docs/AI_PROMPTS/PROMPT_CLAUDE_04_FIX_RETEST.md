# Prompt 04 — Claude Fix and Re-test from GPT Review

Use this Prompt after GPT returns `APPROVED_FOR_CLAUDE_FIX`. Paste GPT's findings into the marked section and fill the exact allowed paths.

```text
ROLE: Claude — targeted code-fix and verification agent
MODE: FIX_RETEST — fix only GPT-approved findings; do not redesign the project

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

GPT REVIEW INPUT
Paste the complete GPT review here:
[GPT findings, severity, exact files/lines/symbols, root causes, fix instructions, and retest criteria]

REQUIRED SCOPE
ALLOWED TO CHANGE — exact paths from GPT review only:
- [file path]
- [file path]

READ FIRST — exact paths
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/package.json
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
6. The exact files and lines named by GPT.
7. Direct callers, consumers, and tests of those files.
8. For time/data/persistence findings, also read the relevant files listed in PROMPT_GPT_03_REVIEW_CLAUDE_HANDOFF.md.

PREFLIGHT
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" status --short --branch
- Run: git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" diff -- [allowed files]
- Confirm that the GPT review is not PLAN_CHANGE_REQUIRED or BLOCKED.
- If the review is PLAN_CHANGE_REQUIRED, stop and return PLAN_CHANGE_REQUIRED. Do not code.

FORBIDDEN
- Do not edit files outside ALLOWED TO CHANGE.
- Do not expand scope, change architecture/schema/API/dependencies, or change business rules.
- Do not edit, move, rename, delete, or overwrite anything under:
  D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/Docs_StandardWork_Reference/
- Do not touch .git, node_modules, .next, out, tsconfig.tsbuildinfo, next-env.d.ts, or _Backup_scratch_OneDriveMigration_20260719.
- Do not delete/recreate `.wrangler/`, reset local D1, seed sample data over
  existing data, or run any Production write. If the fix needs a database
  mutation, stop with PLAN_CHANGE_REQUIRED until a verified recovery export and
  explicit user authorization exist.
- Do not deploy, push, or change the Master Plan unless explicitly authorized by the user/GPT workflow.

FIX RULES
- Fix the root cause identified by GPT, not only the visible symptom.
- Preserve saved-data compatibility and the project's duration, cycle-time, M1 source, persistence, and ID-remapping rules.
- Preserve the Production source-of-truth boundary and every folder `parentId`
  relationship, including the existing four-level tree. If cloud loading fails,
  fail closed rather than falling back to an empty state that could be saved.
- Keep the patch narrow and avoid encoding rewrites or unrelated cleanup.
- Add or adjust regression tests when the review requires behavioral protection.

RETEST
- Run: pnpm test
- Run: pnpm run lint
- Run: pnpm run build
- Reproduce the GPT-specified browser/smoke flow and inspect the console if UI behavior changed.
- Re-check the exact acceptance criteria from GPT.
- Report pre-existing failures separately from failures caused by this fix.
- For data-related fixes, compare pre/post folder count, root count, maximum depth,
  full parent-child mapping, chart count, representative IDs, and content checksums;
  verify the recovery export and real Production reopen flow.

SESSION RECORDS
- Update D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md with files changed, root causes, fixes, tests, and remaining risks.
- If a new architecture/schema/deployment/business-rule issue appears, stop and return PLAN_CHANGE_REQUIRED instead of hiding it in the patch.

REQUIRED HANDOFF OUTPUT
- STATUS: FIXED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- GPT findings addressed one by one
- Exact files read
- Exact files changed
- Commands/tests/manual checks and results
- Remaining findings or risks
- Any scope change discovered
- Next action: return to GPT for another review; do not close the phase yourself.
- Database Safety Gate result: DATA_SAFE_READ_ONLY_COMPLETE or DATA_SAFETY_BLOCKED
```
