# Prompt 02A — Claude: Phase 0B Data-Safety Runtime Guards

Use this prompt after the read-only Database Safety Preflight has returned
`DATA_SAFE_READ_ONLY_COMPLETE` and GPT/Codex has approved the Phase 0B scope in
`docs/Master_Plan.html` v1.10. This is a narrow safety patch. It is not a
schema-migration, authentication, recovery, deployment, or feature-expansion
prompt.

```text
ROLE: Claude — implementation and debugging agent
MODE: PHASE_0B_RUNTIME_DATA_SAFETY_GUARDS

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

AUTHORIZED PLAN
GPT/Codex approved: docs/Master_Plan.html, section
"Phase 0B · Runtime Data-Safety Guards — approved scope".
User authorization, relayed by GPT/Codex on 2026-08-02:
"ดำเนินการได้เลยครับ"

The approved Production read-only baseline is:
- Production D1 is the source of truth.
- Recovery evidence is outside the repository at:
  D:/00_LocalFile_WebApp/ManMachineChart_Data_Backups/2026-08-02_082002/
- The verified snapshot contains 5 folder rows, 3 roots, 6 chart files, and
  maximum folder nesting depth 3.
- The export reported zero database writes and matching content checksums.
- Live Production `folders.parentId` was appended without the self-referencing
  foreign key declared in `schema.sql`.

Do not reinterpret the recovery export as a seed, fixture source, or permission
to write. Do not attempt to repair the live schema in this task.

READ FIRST — exact paths
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/Master_Plan.html
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/schema.sql
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/wrangler.toml
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/package.json
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts
9. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
10. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/folders.js
11. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/files.js
12. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/layout/Sidebar.tsx
13. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/store.test.cjs
14. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/chart-utils.test.cjs
15. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/time-study.test.cjs
16. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/machine-capacity.test.cjs

PRE-FLIGHT
- Run from the project root:
  rg --files -g '!.git/**' -g '!node_modules/**' -g '!.next/**' -g '!out/**' -g '!_Backup_scratch_OneDriveMigration_20260719/**'
- Run:
  git -c safe.directory="D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation" status --short --branch
- Record the existing dirty worktree. The earlier StepTable layout patch and
  documentation changes belong to the user; do not revert or normalize them.
- Run the existing checks before editing when practical. Prefer:
  pnpm test
  pnpm run lint
  pnpm run build
  If pnpm is unavailable, use npm.cmd equivalents and report that fact.
- Do not run any remote database write. The preflight has already passed; do not
  repeat it by changing data.

ALLOWED FILES — only these
- D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts
- D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
- D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/folders.js
- D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/files.js
- D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/layout/Sidebar.tsx
  only when needed to present the blocked/unsafe state correctly
- D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/store.test.cjs
- D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/data-safety.test.cjs
  (new focused test file only if the existing harness cannot cover the cases)
- D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md

If any other file is required, stop and return PLAN_CHANGE_REQUIRED. Do not
silently edit the Master Plan or PROJECT_CONTEXT during implementation.

FORBIDDEN ACTIONS
- No Production INSERT, UPDATE, DELETE, ALTER TABLE, DROP, migration, reset,
  seed, restore, or deployment.
- No `wrangler d1 delete`, no `wrangler pages dev --remote`, and no remote write
  of any kind. A remote read is not needed for this phase.
- Do not delete, recreate, or clear `.wrangler/`, local SQLite, browser
  localStorage, or any user folder. Do not overwrite local data with a sample.
- Do not run `schema.sql` against any existing database. Do not add a new
  schema migration or try to retrofit the missing Production foreign key.
- Do not use the recovery export as application source, seed data, or a test
  fixture. It is recovery evidence only.
- Do not implement accounts, sessions, password storage, approval records, or
  audit tables in this phase. That is a separate architecture/security plan.
- Do not keep, add, or strengthen a client-visible Admin PIN. Do not put a PIN,
  password, token, or secret in `NEXT_PUBLIC_*` or browser JavaScript.
- Do not deploy, push, commit, install dependencies, or change package/config
  files unless GPT returns a new approved plan.
- Do not rewrite unrelated code, change calculation rules, alter chart JSON
  shape, or modify reference files under Docs_StandardWork_Reference.

IMPLEMENTATION OBJECTIVE
Make the existing runtime fail safely when cloud persistence is unavailable or
when a structural operation could damage the folder/chart hierarchy. Preserve
the current Production rows and the existing chart-content behavior.

REQUIRED BEHAVIOR

1. Cloud hydration must be distinguishable from local cache fallback
- `loadDatabaseFromCloud()` must not return an empty/local database as though it
  were a successful cloud load.
- Expose an explicit, typed or otherwise unambiguous unavailable/unsafe result
  or error that the store can track.
- `hydrate()` may show cached data for review, but must mark the state as not
  cloud-ready and must block any operation that could write the cached/fallback
  state to Production.
- A cloud read failure must never silently replace a non-empty cloud state with
  an empty local state, and must never be reported as `saved`.
- Preserve the existing lazy `_loaded === false` chart-content guard.

2. No optimistic data loss on failed mutations
- For delete, move, rename, and other structural operations, do not remove or
  move the local record before the server confirms success. Alternatively take
  a complete snapshot and restore it on every failed request; prove this with
  tests.
- A 4xx/5xx response, network error, unsafe hydration state, or authorization
  refusal must leave the current local view/data intact and set an error/blocked
  status.
- Do not claim `saved` until the server request succeeds.

3. Folder hierarchy integrity at the API boundary
- A folder parent may be null or an existing folder ID only.
- Reject a folder becoming its own parent.
- Reject moving a folder into any of its descendants. Use a bounded parent walk
  or equivalent cycle-safe check; never loop forever on corrupt data.
- Do not silently detach children or rewrite parent IDs to repair an invalid
  request.
- Because live Production lacks the self-referencing FK, the folder DELETE
  handler must refuse to delete a folder when it has child folders or chart
  files. Return a clear conflict/blocked response and delete zero rows.
- Do not implement recursive deletion or cascading repair in this phase.
- A GET handler must not perform a hidden `ALTER TABLE` or other schema write.
  If a database lacks the required column, return a clear schema-unavailable
  error and stop; do not self-heal by mutating the database.

4. Deny privileged structural operations until real authorization exists
- The current browser Admin PIN is not security. Remove its security meaning;
  do not send it to an API and do not compare a client-provided PIN to a secret.
- Until the separate server-side account/session/approval design is approved,
  destructive operations and folder/file hierarchy changes must be denied by
  the server or clearly unavailable in the UI. A denial must not mutate local
  state first.
- Normal chart-content editing may remain available only when cloud hydration
  is confirmed and the existing loaded-content/save guards pass. Do not broaden
  this into a new authorization system.

5. Preserve the data model
- Keep every folder `id`, `parentId`, name, process type, expanded state, and
  created timestamp unchanged unless a successful, authorized operation later
  changes it.
- Keep every chart file ID, folder ID, name, timestamps, and JSON content
  unchanged. Do not flatten, regenerate, or re-seed the hierarchy.
- Preserve the documented duration, cycle-time, M1→M2–M5, and Start→End rules.

TEST REQUIREMENTS
- Add focused tests for:
  1. cloud load failure produces an unsafe/unavailable state;
  2. save/destructive actions are blocked while cloud is not ready;
  3. failed delete/move/rename leaves the local state unchanged;
  4. invalid parent, self-parent, and descendant-cycle requests are rejected;
  5. deleting a non-empty folder performs zero deletes and returns conflict;
  6. a synthetic multi-level folder tree and all chart placements remain intact.
- Tests must use mocks/in-memory fixtures. Do not use Production D1 or the
  external recovery export as a test fixture.
- Run after edits:
  pnpm test
  pnpm run lint
  pnpm run build
  Use npm.cmd equivalents only if pnpm is unavailable and report it.
- If the UI changes, run a local dev/smoke check without resetting local D1.
  Verify the sidebar shows a clear blocked/unsafe state, the chart can still be
  reviewed, and no browser console error is introduced.
- Do not deploy or reopen Production as part of this implementation. Production
  verification belongs to GPT review and a separately authorized deployment
  gate.

STOP CONDITIONS
- Any need to change `schema.sql`, live schema, D1 data, authentication,
  sessions, audit records, API architecture, dependencies, or deployment.
- Any missing testable way to distinguish cloud-ready from local-only state.
- Any operation that could delete, overwrite, detach, or regenerate a real row.
- Any need to use a remote write or reset local runtime state.
- Any scope expansion beyond the ALLOWED FILES list.
Return PLAN_CHANGE_REQUIRED or BLOCKED with the exact reason; do not work
around the stop condition.

SESSION RECORDS
- Update CHANGELOG_AI.md only with the exact files changed, behavior, tests,
  pre-existing failures, and remaining risks.
- Do not mark the Phase complete. Return the handoff to GPT/Codex for review.

REQUIRED HANDOFF
- STATUS: IMPLEMENTED / BLOCKED / PLAN_CHANGE_REQUIRED / TESTS_FAILED
- Exact files read and exact files changed
- Cloud-ready/unsafe-state behavior and mutation rollback behavior
- Folder API validation and deletion refusal behavior
- Whether the client PIN was removed from any security decision
- Exact commands and results for test, lint, build, and local smoke test
- Pre-existing failures versus new failures
- Confirmation: no Production writes, no schema migration, no deploy, no push
- Remaining risks, especially authentication and live schema drift
- Recommended next action: return to GPT for code review
- End with exactly one status line: IMPLEMENTED, BLOCKED, PLAN_CHANGE_REQUIRED,
  or TESTS_FAILED
```
