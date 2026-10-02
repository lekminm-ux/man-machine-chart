# APP02 — Sidebar file action menu

Date: 2026-10-02 (Asia/Bangkok)
Status: Owner authorized Production release and explicitly approved Codex Final QA instead of native Sol QA for this Job. Exact reviewed artifacts applied locally; fresh root build/tests pass; GET-only Production backup verified. Commit/push/manual deploy/live verification pending at this checkpoint. Native Sol QA was not executed; the one-Job exception does not change central policy. Move/Trash native-dialog runtime checks remain NOT TESTED.
Baseline: clean `main`, `1af5aa2`; `git pull --ff-only` reported already up to date.

## Owner request

Show longer chart file names. Replace the five inline file action buttons with one
three-dot menu, providing Copy and Move to and room for future commands. This is
the current priority; Layout Job 03 remains proposed.

## Proposed result

- Keep the current 320px Sidebar. Reclaim the space occupied by five file action
  buttons, including their invisible reserved width before hover.
- Show one always visible, keyboard reachable `⋯` button per file. The file name
  occupies the remaining row width; keep the existing full-name tooltip.
- Menu: **Duplicate**, **Copy to Folder…**, **Move to…**, **Rename**, **Move to Trash…**.
- Open the menu without opening/switching the chart. Close on selection, Escape,
  outside click, scrolling, or chart/folder removal. Allow only one open menu.
- Position the menu within the viewport, outside the scrolling Sidebar clipping
  boundary. Provide keyboard navigation and return focus to its trigger on Escape.
- Display the Copy destination selector in a separate panel/dialog, so it does
  not shrink the file name. Keep the original file and existing confirmed-folder
  filtering/copy behavior.
- Keep the existing folder-row controls in this Job.
- Move to currently opens a gated workflow: `submitMove()` refuses the move pending
  server-side authorization. Relocating this command does not authorize removing
  that gate. Make the limitation clear; do not report a successful move test.

## Approved DEV edit paths (Owner: 2026-10-02, “ครับอนุมัติ”)

1. `src/components/layout/Sidebar.tsx`
2. `src/components/layout/SidebarActionMenu.tsx` (new isolated UI component)
3. `tests/sidebar-action-menu.test.cjs` (only if needed for actual interaction regressions)

Local closeout documentation: this scope record, `CHANGELOG_AI.md`, and
`PROJECT_CONTEXT.md`. Update `docs/Master_Plan.html` after verified implementation,
without marking an unimplemented feature complete.

No store, calculation, API, schema, dependencies, deployment configuration,
Production chart data, or release changes are proposed.

## Acceptance and evidence required

1. At the same Sidebar width/depth, a representative long name has more measurable
   display width than the baseline. Only one action trigger is on each file row.
2. Mouse and keyboard can open/close/navigate the menu. Clicking the trigger or a
   command does not accidentally open another chart; no clipped/offscreen menu.
3. On isolated synthetic local data, same-folder Duplicate and cross-folder Copy
   preserve the source and create independent IDs; copied content survives reload
   and API readback. Rename works. Trash requires confirmation; Cancel is harmless.
4. Move to retains its authorization gate, and unavailable Cloud state continues
   to block the existing affected actions.
5. Existing tests, scoped lint, build and actual local browser/console checks pass.
6. Gemini Pro review and independent Sol QA reference the exact DEV artifact SHA
   and trusted external test evidence. No prior Task's PASS is reused.

## Workflow / next Gate

Use central runbook v1.4 (2026-10-02):
`D:\00_LocalFile_WebApp\Smart_Factory_AI_ecosystem\01_Full_Automation\02_Hermes_Runtime\RUNBOOK_HERMES_ANTIGRAVITY_APP01_09.md`.

Owner approved the proposed DEV scope in this chat on 2026-10-02. Current Hermes
intake is `t_d4d6e13f`, board `production`, tenant `APP02MMO`, assignee `sf-manager`,
status `blocked`. Proposed Directory workspace (not provisioned/approved yet):
`/opt/data/workspace/hermes-production/app02mmo/sidebar-overflow-menu-dev-20261002`.
Do not reuse the 2026-09-29 Copy Task IDs/workspace.
Cloud Copy of sanitized minimal source requires its own destination-specific Gate.
Authenticated Hermes Manager and Kanban were accessed through Codex in-app browser.
Manager created the intake, and direct Kanban readback confirmed its fields.

Local Source-of-Truth apply, commit, push and deploy remain separate Owner Gates.
DEV implementation has started through the approved direct sf-implementer profile.
No local Source-of-Truth application edits, commit, push or deploy occurred.
Intentional tracked changes from this session are documentation only; retrieved
DEV files are held in an ignored isolated QA copy.

## 2026-10-02 approved-scope follow-up / exact next Gates

- Scope approval: Owner's reply `ครับอนุมัติ`, after the linked three-path DEV plan.
- Manager fresh intake session visibly `34ab2703` / GPT-6.1 Sol high. Only sanitized
  requirements and metadata were sent; no source file uploaded.
- **Unexpected lifecycle:** Manager initially reported no runs. Direct Kanban
  evidence later showed `created(blocked) -> promoted -> claimed -> spawned ->
  blocked`, run ID `78`, session `20261002_041509_060a90`. That Manager worker
  recorded that the non-dispatch card had been running and returned it to
  `blocked/needs_input`. No children or implementer/reviewer run was visible.
  Do not reuse the initial no-runs claim. The cause of promotion is not established;
  do not change orchestration/config or unblock automatically to investigate.
- Local prepared package: `.tmp/sidebar-menu-package-t_d4d6e13f.zip`, 111,791 bytes;
  SHA-256 `16E007F97FCA56194CA5756F30600DCD5B2FA06CA7A117844F93694FB2A9DCF5`.
  17 payload files plus `manifest.json`; payload 402,857 bytes, readback SHA/size
  verification 17/17. No credential/private-key/email patterns found in the package
  scan. This is a limited scan, not an independent security certification.
- Source references: Sidebar, types, store, storage, chart-utils, time-study,
  machine-capacity, layout-copy, layout-history. Read-only test/build references:
  store.test.cjs, package.json, pnpm-lock.yaml, tsconfig.json, eslint.config.mjs.
  Governance: GATE_AND_TASK.md and authoritative central runbook v1.4.
  Original operational seed is excluded and replaced by an empty synthetic stub;
  chart-utils operational worked-example comment is omitted in the package only.
  All references except Sidebar are read-only; new menu/optional test remain the
  only additional writer paths. No full Context/CHANGELOG, secrets, real chart
  exports, `.git`, dependencies, build output or Production bindings are included.
- Package baseline store tests ran locally using the existing Node dependencies:
  `NODE_PATH=<repo>/node_modules node --test .tmp/sidebar-menu-package-t_d4d6e13f/tests/store.test.cjs`.
  Exit 0, **80/80 PASS**, zero failures. This verifies sanitized baseline regression
  inputs; it is not testing the unimplemented menu. No UI/build/review/QA PASS yet.
- Direct Kanban screenshot: ignored `.tmp/sidebar-menu-task-gate.png`.

Requested next Gates, each limited to this exact Task/path/package:

1. Accept and provision the proposed Directory DEV workspace, without overwriting
   existing content. Stop if the path exists with unexpected files.
2. Cloud Copy: transfer the exact sanitized ZIP above to that private Hermes
   workspace, extract safely and verify manifest/hash readback before use.
3. After readiness is verified, allow bounded Gemini implementer execution in the
   already approved three paths, independent Pro review and separate Sol QA;
   evidence must match the exact artifact. Stop for unexpected lifecycle/config,
   source/hash/scope mismatch; no paid fallback or credit/token checks.

Local source apply, commit, push, deploy, Production and Memory writes stay outside
these Gates. This document is the continuation/handoff record for the same request;
use the existing Task and approved scope instead of creating a duplicate.

## 2026-10-02 approved transfer / authentication interruption

- Owner replied `ครับดำเนินการต่อให้เสร็จ` to the three exact Gates above. These
  workspace, Cloud Copy and bounded execution approvals are now granted; do not
  ask for them again. Manager recorded them in existing Task comments 122–123.
- The exact Directory workspace already existed and was empty when inspected.
  The approved ZIP was uploaded through authenticated Hermes Files UI. Its server
  readback was retrieved from the response to the UI download action; size
  111,791 bytes and SHA-256 matched the approved ZIP exactly. Local retained
  readback: ignored `.tmp/sidebar-menu-cloud-readback.zip`.
- Manager's enabled tools cannot inspect/extract/hash ZIP binary files. Use the
  equivalent Files UI transfer of the exact unpacked approved members, preserving
  their paths, under the existing Cloud Copy approval. Do not expand tool access
  or repackage the approved ZIP. The package's old pending-Gate prose is superseded
  by the Owner approval recorded in this chat and the Task comments.
- Created `src/components/layout` in the DEV workspace. Seven root files were
  visibly uploaded: package.json, pnpm-lock.yaml, tsconfig.json,
  eslint.config.mjs, GATE_AND_TASK.md, authoritative runbook v1.4, manifest.json.
  These extracted files have not yet had independent server hash readback.
- Sidebar upload did not produce a visible file. The subsequent UI upload
  response was HTTP 401 and the Files page displayed Sign in. No source writer,
  reviewer or final QA has been dispatched. Owner was asked to sign in again;
  do not treat expired authentication as a missing approval or claim readiness.
- Local ZIP member verification passed: 18 members, safe relative paths, no
  symlink entries, all 17 payload hashes/sizes and the manifest hash matched.
  Evidence: ignored `.tmp/sidebar-menu-zip-validation.json`.
- Next: after login, inspect the same Directory for upload results, finish the
  remaining approved members and verify readback before dispatch. Preserve the
  same Task, workspace and three writer paths. Local Source-of-Truth apply,
  commit, push, deploy, Production and Memory remain separate gates.

### After Owner re-login

- Source Sidebar, types, all seven lib references and store were visibly uploaded.
  Independent Files UI-triggered server response readback now matches size/hash
  for **16 payload files plus manifest**. Only `tests/store.test.cjs` remains
  missing. `.tmp/sidebar-menu-cloud-readback-manifest.json` records exact checks.
- Upload tool stalls remained severe, including 1,841.9 seconds for one call.
  Asked the same Manager to check a bounded preparation route using existing
  implementer capability for exact ZIP inspection/missing-member extraction;
  references may not be modified or mismatches overwritten. Manager delegated
  a read-only capability check; this is not a code writer or a preparation PASS.
- Fresh sf-implementer Dashboard Chat and existing Files refresh displayed Sign in
  again. Owner was asked to log into the actual sf-implementer profile. Do not
  bypass authentication or change central config. Keep current approvals valid;
  readiness, implementation, Pro review and separate Sol QA remain pending.
- Manager capability check completed: `delegate_task` child inherited sf-manager,
  not sf-implementer, and has no binary hash/extract capability. Manager recorded
  comments 124–126 and confirmed same Task remains blocked / preparation NOT READY.
  Do not repeat that probe. Next authorized route is actual sf-implementer via
  direct-profile preparation-only session after authentication, then bounded source
  microtasks when missing-member/hash readiness is verified. No new Gate is needed
  for those already approved DEV steps; do not modify global routing/config.
- Screenshot of actual sf-implementer Sign in: ignored
  `.tmp/sidebar-menu-gemini-signin.png`. Existing Manager resumed session URL ends
  `?profile=sf-manager&resume=20261002_041149_730c60`. Preserve Task/workspace and
  transfer results; do not re-upload verified entries solely because auth expired.

### Authenticated direct DEV and isolated QA preparation

- Actual user-authenticated browser tab, profile sf-implementer / Gemini 3.8 Flash
  high, session short ID `8983798e`, resolved the prior stale-tab login issue.
  All 17 payload files plus manifest now match independent UI-triggered server
  readback. Final missing store.test.cjs is 92,127 bytes, SHA-256
  `f9fdb9b199e18e8614f010c10097f7e643643f74f5086b5528a639845e12da4f`.
- Manager recorded readiness resolved and direct implementation in comment 127;
  the main Task stays blocked as metadata, without scheduler promotion. Direct
  profile writes are covered by the existing bounded DEV execution approval.
- New menu file readback: 15,144 bytes, SHA-256
  `c80868e9b53f8677b8800a2fa17766b387d545f9e17edab344fa8158e82f3adb`.
  First Sidebar integration: 26,777 bytes, SHA-256
  `6fca72fb5c3350da424a592095595121daf63190dc1c13aad1cafedd709e9c2d`.
  It failed scoped lint and TypeScript with missing confirmation braces and a
  literal newline escape; it is **not** ready to apply. Findings returned to a
  compact fresh Gemini session after the bridge reported safe-command limit.
- Retrieved files are only in ignored `.tmp/sidebar-menu-qa-t_d4d6e13f`, an
  isolated app copy with a node_modules junction. Local Source-of-Truth source
  files remain unchanged. Native restricted Sol QA and Pro review are pending.
- Local-only Wrangler 4.145.0 Pages Dev runs on 127.0.0.1:8794, with fresh
  synthetic DB(local-DB) / PHOTOS(local-photos) under
  `.tmp/sidebar-menu-local-state-t_d4d6e13f`. No Production bindings are used.
  Fresh schema and two synthetic chart fixtures were created locally.
- Baseline Sidebar build passed using `NODE_OPTIONS=--use-system-ca` and webpack,
  after the default Node certificate trust failed to download Inter. Baseline
  UI measurement: Sidebar 319.99px, nested row 275.12px, long-name span 88.61px,
  five action buttons. This is a baseline comparison, not a feature build/QA PASS.
- Fresh compact writer session was observed reading Sidebar lines130–179. Before
  final correction readback, actual tab7 redirected to `/login`; the Files8 UI
  download returned HTTP401. This is a new verified expiry of the actual session,
  not the earlier virtual-tab mismatch. Owner was asked to sign in again.
  Do not infer that correction succeeded or restart implementation from scratch.
  After login, retrieve current DEV files first and verify exact changes.

### Current continuation after authenticated corrections and Pro review

- Final exact artifact readback (HTTP200): Sidebar.tsx 27,421 bytes,
  `b504170d4dcb80d3f164f177a587fa8f2498e5906ad107220eeecb8c4e46cfe2`;
  SidebarActionMenu.tsx 16,523 bytes,
  `8e7cfbe3d09bd4cf1b08f5c25d202f9c9e044ef6d5ac4a872afbbe9a2b6fe94a`.
  No optional test file was written. Gemini remains the sole DEV writer.
- Final Codex isolated checks, not native QA execution: scoped eslint exit0,
  0 errors/2 low warnings (menu412/422); npm test exit0, 238 pass/0 fail;
  npm run build -- --webpack exit0 including TypeScript/five static routes.
  All logs are inside `.tmp/sidebar-menu-qa-t_d4d6e13f`:
  - qa-lint-final.log SHA `4f9ff8c594e94e406e779a0b578940f3ae15e8b0be9b2bceaee3dbc0eb566147`
  - qa-tests-final.log SHA `6120d25863f5746983d23f6ba7d7dceba9051dddb3a26631fdf32215ebb54538`
  - qa-build-final.log SHA `ea4c874d3b91a2f54cd2df6bcbb5b0eecd16e06d0ccfe53e864f202a3b70da14`
- Synthetic browser checks: one trigger at unchanged320px; filename185.37px
  versus88.61px baseline; menu within1280x720; keyboard/Escape; Rename focuses
  and cancels; Copy cancel returns trigger focus; collapsing an ancestor closes
  menu permanently until explicitly reopened. Duplicate and cross-folder Copy
  survive reload. Local DB readback: 2 baseline records to4; source unchanged;
  copied headers/steps/shape properties/connections preserved, chart and shape
  IDs regenerated. No browser errors/warnings. Native Move/Trash dialogs remain
  NOT TESTED after browser bridge input/focus failure, not an application PASS.
  Evidence qa-ui-evidence-final.json SHA
  `b9d79681d1c5cd34def90b8906860e77651f5127bb1a0195c68609dfc741874a`.
  Screenshot `.tmp/sidebar-menu-preview-final.png` is actual local synthetic UI.
- Pro session `Review task t_d4d6e13f`, Gemini3.1Pro high, returned
  PASS_WITH_LIMITATIONS with both exact source SHAs. Low hook warnings and
  unverified native confirm runtime recorded. No new blocking code finding.
  test_execution_by_reviewer=NOT TESTED for the supplied external logs.
  Conclusion `.tmp/sidebar-menu-pro-review-final.md` SHA
  `c7f9c394b5c4688de1e378f10c5ece82f0944571a558f99f1eefa85cfdad375d`.
- Separate restricted Sol QA remains BLOCKED, not dispatched. Manager session
  `Identify native sf-final-qa-pilot session route` read the actual Task and
  enabled capability descriptions: Kanban max_runtime/goal budget cannot prove
  native tool restrictions/6turns/120seconds; enabled Manager/UI has no native
  profile launcher/effective restriction/canonical DB readback/clarify route.
  Dashboard TUI QA is prohibited. A verified native operator invocation/readback
  is required; no global config repair or inherited-manager delegation fallback.
- Preserve Task/board/tenant/workspace and approvals. Root app source untouched;
  no local apply, commit, push, deploy, Production or Memory action. Next steps:
  verified native QA route -> exact artifact/Pro/external evidence packet ->
  restricted Sol QA -> Manager closeout -> separate source apply/release Gates.
  User re-login succeeded; do not ask for login again based on stale badges.
- Prepared ignored `.tmp/sidebar-menu-native-qa-handoff.md` with exact artifacts,
  same-SHA Pro review, external commands/exits/counts/evidence hashes and required
  sanitized native route proof. Submitted a status-only Manager comment request;
  no returned comment number/readback yet, so do not claim the Task comment was
  saved. Local preview remains on127.0.0.1:8794 using disposable synthetic data.
