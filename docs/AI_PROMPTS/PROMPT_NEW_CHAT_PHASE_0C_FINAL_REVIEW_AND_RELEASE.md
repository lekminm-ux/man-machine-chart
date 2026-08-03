# Fresh-chat handoff — Phase 0C final review and release

Use Part A in a new GPT/Codex chat now. Use Part B in a new Claude Code chat
only after GPT returns `PASS` and the user explicitly authorizes the release.
Do not paste the old long conversation.

## Part A — GPT/Codex review (use now)

```text
ROLE: GPT/Codex — code reviewer and Master Plan owner
MODE: CODE_REVIEW_ONLY — do not edit application source code

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Claude completed Phase 0C Save-to-Cloud Persistence fix round 2. The previous
GPT findings were local-only mutation boundaries and an unconfirmed draft being
shown as the active chart. Claude reports both fixes implemented, complete
payload persistence/read-back, local Pages Dev browser smoke evidence, and no
Production D1 write, commit, push, or deploy.

The working tree contains uncommitted user/AI changes. Preserve them. Never use
git reset, git checkout, restore, delete, or broad cleanup to make the review
pass. Do not treat the old chat, a screenshot, localStorage, local D1, or a
passing build as proof that Production data is preserved.

READ FIRST — exact paths
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/REPORT_CODEX_GPT_REVIEW_PHASE_0C_ROUND_2_2026-08-02.md
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/layout/Sidebar.tsx
9. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/layout/TopBar.tsx
10. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/app/editor/page.tsx
11. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/files.js
12. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/folders.js
13. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/storage.test.cjs
14. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/store.test.cjs
15. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/data-safety.test.cjs
16. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/types/index.ts

INSPECTION
- Run git status --short --branch and inspect the complete current diff.
- Read every changed file and its direct consumers/tests.
- Exclude .git, node_modules, .next, out, .wrangler generated output, and
  Backup folders from source-of-truth reasoning.
- Verify that every Cloud-mutating store action blocks _unsynced targets and
  parent/folder IDs before any API call.
- Verify that hydrate() cannot expose _unconfirmed or _loaded:false content as
  the confirmed active editor, while preserving it for recovery.
- Verify that Save is only `saved` after explicit PUT success plus a fresh GET
  comparison of name, folderId, updatedAt, header, steps, layoutDiagram,
  timeMeasurement, timeStudy, and machineCapacity.
- Check that the existing nested/four-level folder structure is not flattened,
  reset, reseeded, or silently replaced.

VERIFICATION
- Run: node --test (or pnpm test if pnpm is available)
- Run: npm run lint (or pnpm run lint)
- Run: npm run build (or pnpm run build)
- Run: git diff --check
- Keep known baseline lint errors/warnings separate from new findings.
- Accept local Pages Dev browser evidence only when it records the URL, chart
  ID, unique marker, PUT response, fresh GET response, hard refresh/reopen,
  and browser console result. Local evidence is not Production evidence.
- Do not run --remote, Production D1 writes, schema migrations, reset, seed,
  commit, push, or deploy during this review.

DECISION
- PASS: current Phase 0C implementation is ready for a separately authorized
  release; state clearly that deployment/live verification is still pending.
- APPROVED_FOR_CLAUDE_FIX: list only concrete remaining findings.
- PLAN_CHANGE_REQUIRED: only if schema/API/architecture/business scope must
  change; stop and write the new plan.
- BLOCKED or DATA_SAFETY_BLOCKED: use when required evidence or data boundary
  cannot be verified.

REQUIRED OUTPUT
1. Decision and what passed.
2. Findings with severity, exact file/symbol, root cause, fix, and retest.
3. Exact tests/lint/build/diff-check results.
4. Database Safety Gate result and explicit Production-write statement.
5. Update docs/Master_Plan.html and CHANGELOG_AI.md only after making the
   actual review decision; do not close the phase merely because tests pass.
6. If PASS, provide the Part B Claude release prompt below with the final
   reviewed commit scope and the explicit user authorization still required.
```

## Part B — Claude release chat (use only after GPT `PASS`)

```text
ROLE: Claude Code — release executor and live verification agent
MODE: APPROVED_RELEASE_ONLY

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

GPT REVIEW
Paste the complete, current GPT review here. It must say PASS. If it says
APPROVED_FOR_CLAUDE_FIX, PLAN_CHANGE_REQUIRED, BLOCKED, or DATA_SAFETY_BLOCKED,
stop and return that status; do not release.

USER AUTHORIZATION
Paste the user's explicit authorization for this exact reviewed version to
commit, push, and deploy. Do not infer authorization from an old conversation.

READ FIRST — exact paths
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
5. The exact GPT PASS report and changed-file list
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/package.json
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/wrangler.toml

PREFLIGHT AND SAFETY
- Inspect git status and the complete diff. Do not reset, checkout, delete,
  overwrite, or hide existing user changes.
- Confirm the diff is exactly the GPT-reviewed scope. If not, stop and return
  SCOPE_MISMATCH; return to GPT before committing.
- Do not read or use node_modules, .git, .next, out, or Backup as a source of
  truth. Do not delete/recreate .wrangler or reset local D1.
- Do not run --remote, schema.sql, migrations, seed, reset, bulk repair, or
  Production data writes as part of deployment.
- Keep the previous known-good Production deployment as rollback target.

VERIFY BEFORE RELEASE
- Run node --test, npm run lint, npm run build, and git diff --check.
- Report known baseline lint findings separately; any new failure stops release.
- Verify the live target is man-machine-chart.pages.dev and the Cloudflare
  project/repository is the expected one before deploying.

RELEASE
- Commit only the reviewed files with a clear message.
- Push only the reviewed commit/branch authorized by the user.
- Deploy through the approved Cloudflare Pages path. Do not claim that a Git
  push alone deployed the site; confirm the Cloudflare deployment result.

LIVE VERIFICATION
- Open https://man-machine-chart.pages.dev/editor.
- Confirm the existing folder hierarchy and representative charts are present.
- Confirm the table and Timeline Graph render; Start → End must not hide the
  graph and the responsive layout must remain usable.
- Do not write a Production test marker unless the user has separately and
  explicitly authorized that exact reversible live data change and the required
  recovery/count checks are recorded beforehand.
- Record deployment ID/time, URL, tree/chart counts, representative IDs,
  browser console result, and rollback target.

REQUIRED HANDOFF
- STATUS: DEPLOYED_AND_VERIFIED / DEPLOYED_WITH_BLOCKER / BLOCKED / SCOPE_MISMATCH
- Commit hash, push result, Cloudflare deployment result, live URL.
- Exact verification commands and results.
- Data Safety Gate result; explicitly state whether Production data was written.
- Update CHANGELOG_AI.md and docs/Master_Plan.html with evidence.
```
