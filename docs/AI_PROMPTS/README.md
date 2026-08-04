# AI Collaboration Prompts — Man-Machine Chart

Project root:

`D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation`

This project uses the same separation of responsibilities as the Technical Injection Blow Mold project:

| Role | Responsibility | Coding authority |
|---|---|---|
| Claude | Review, root-cause analysis, fix/feature planning, Acceptance Criteria, Debug/QA, Final Review after Codex implements | Does not write application source code unless the user explicitly authorizes that specific instance |
| GPT/Codex | Implement application source code per Claude's plan, write/adjust automated tests, run test/lint/build/diff-check | Implements only the approved scope; must not expand scope on its own |
| User | Approves scope, starts coding, decides unresolved business choices, and authorizes deployment/escalation | Final decision maker |

(Role split updated 2026-08-03 — the user reversed the original GPT/Claude split above it replaced: Claude now owns review/plan/QA, Codex now owns implementation. Prompts 1-4 below predate this change and describe the old GPT-reviews/Claude-implements loop; treat their *content* as historical reference for what each phase covered, not as the current role assignment.)

## Prompt order

0. [Claude read-only project onboarding](PROMPT_CLAUDE_00_START_HERE_READ_ONLY.md) — optional first step
0A. [Claude database inventory and recovery export](PROMPT_CLAUDE_01A_DATABASE_SAFETY_PREFLIGHT_READ_ONLY.md) — required before persistence, schema, deployment, or data-recovery work
1. [GPT project audit and Master Plan](PROMPT_GPT_01_PROJECT_AUDIT_AND_MASTER_PLAN.md)
2. [Claude implementation of an approved plan](PROMPT_CLAUDE_02_IMPLEMENT_APPROVED_PLAN.md)
2A. [Claude runtime data-safety guards](PROMPT_CLAUDE_02A_DATA_SAFETY_RUNTIME_GUARDS.md) — use only for the approved Phase 0B guard scope after the read-only preflight
3. [GPT review of Claude handoff](PROMPT_GPT_03_REVIEW_CLAUDE_HANDOFF.md)
4. [Claude fix and re-test loop](PROMPT_CLAUDE_04_FIX_RETEST.md)

Fresh-chat handoff after Phase 0C: [final review and release prompt](PROMPT_NEW_CHAT_PHASE_0C_FINAL_REVIEW_AND_RELEASE.md).

Phase 4 (M5 Yamazumi completion), under the new Claude-plans/Codex-codes split:
[Phase 4a — Min/Max/Avg overlay](PROMPT_CODEX_PHASE4A_M5_YAMAZUMI_MINMAXAVG.md) (shipped, commit 06898ea),
[Phase 4b — Periodical/Changeover tiers](PROMPT_CODEX_PHASE4B_M5_PERIODICAL_CHANGEOVER.md) (shipped, commit 979774a),
[Phase 4c-1 — per-job-element bar segments](PROMPT_CODEX_PHASE4C1_M5_PER_ROW_SEGMENTS.md) (prerequisite for Drag & Drop; the drag interaction itself is Phase 4c-2, scoped separately after this ships). Codex reports back to Claude (not the user) for review before any further phase, commit, push, or deploy.

For this task, run Prompt 02A before the normal Prompt 02. Prompt 02A is the
approved Phase 0B safety gate and must finish with a handoff to GPT/Codex.

Repeat steps 3–4 until GPT returns `PASS` or `APPROVED_FOR_PHASE_CLOSURE`. GPT then updates `docs/Master_Plan.html`, `PROJECT_CONTEXT.md`, and the handoff/change records as appropriate.

## Continuous usability rule

The local/Production separation is an engineering safety boundary, not a reason
for the user to work from a permanently separate local copy. The deployed
WebApp must remain usable while improvements are developed. After GPT review
and explicit user authorization, the approved version must be committed,
deployed to `https://man-machine-chart.pages.dev`, and verified there. A safety
guard may block only the unsafe operation; it must not unnecessarily block
viewing existing charts or normal chart work. If Cloud is unavailable, show
cached data for review and fail closed for writes that could overwrite or
delete Production data.

## Active-user continuous release gate

This WebApp has ongoing users. Future AI sessions must assume that users may be
viewing or editing charts while the code is being improved.

- Release only from a GPT-reviewed commit; keep the last known-good Production
  deployment available as the rollback target until the new release is verified.
- Preserve backward compatibility for existing UI clients, API fields/endpoints,
  and saved chart JSON. Any breaking API or schema change requires a new GPT plan,
  a compatibility window, and explicit user approval.
- Treat schema work as an expand/compatibility/contract sequence. Never use an
  ad-hoc `ALTER TABLE`, `schema.sql`, reset, seed, or bulk repair during a normal
  active-user release.
- If a release is unhealthy, keep existing charts readable, fail closed for
  unsafe writes, show a clear message, and roll back the application. Do not
  overwrite data while attempting recovery.
- Do not claim safe concurrent editing until server-side authentication,
  authorization, audit identity, optimistic version checks, and conflict
  handling are implemented and reviewed. The Admin PIN is not a substitute.
- Record commit, deployment result, live verification, rollback target, and open
  checks in the Master Plan, Deployment Checklist, and CHANGELOG.

## Save-to-cloud persistence gate

The Save button is successful only when the deployed server confirms the write
to the authoritative Cloudflare/D1 store and a fresh read confirms the complete
payload. Local React state, localStorage, fixtures, or local D1 are never proof
that Production data was saved.

- Keep the chart dirty and show an unconfirmed/failed state until the API returns
  explicit success with the chart identity and server version/timestamp.
- For every save-related change and every release, make a uniquely identifiable
  edit, save it through the deployed WebApp, read it back through the deployed
  API, compare metadata and all step/timeline values, refresh/reopen the WebApp,
  and read it again from Cloud. Record URL, chart identity, response, read-back,
  reopen result, and timestamp.
- On timeout, error, or ambiguous status, preserve unsaved work for retry, block
  unsafe overwrite, and tell the user that the Cloud write is unconfirmed. Never
  replace Cloud data with an empty or stale local fallback.
- Existing-chart updates require server-side version/conflict protection before
  safe concurrent editing may be claimed. An Admin PIN is not sufficient.
- Any schema, API, backup, restore, or recovery work required by this gate must
  return to GPT planning. Never reset, reseed, bulk-repair, or delete data to
  make a persistence test appear to pass.

## Project-specific read policy

Read the real project files before making decisions. Treat these as generated, local-only, or non-canonical unless a prompt explicitly asks for forensic inspection:

- `.git/**`
- `node_modules/**`
- `.next/**`
- `out/**`
- `tsconfig.tsbuildinfo`
- `next-env.d.ts`
- `_Backup_scratch_OneDriveMigration_20260719/**`

The reference documents under `Docs_StandardWork_Reference/` are read-only evidence. Do not edit, move, rename, delete, or overwrite them.

## Gate statuses

- `APPROVED` — GPT accepts the implementation plan; coding still requires an explicit user command.
- `CHANGES_REQUIRED` — Claude must not code; revise the plan or fix the requested scope first.
- `PLAN_CHANGE_REQUIRED` — scope, architecture, schema, API contract, or source-of-truth changed; return to GPT planning.
- `BLOCKED` — required file, source, permission, or decision is missing.
- `PASS` — GPT has verified the requested implementation and evidence.

Every prompt in this folder must contain: `READ FIRST`, inspection commands, authoritative sources, allowed files, forbidden actions, acceptance criteria, stop conditions, and required output.

## Database safety gate

`DATABASE_SAFETY_GATE.md` is the canonical rule set for protecting real D1 data.
It defines the separation between Production D1, local Pages Dev D1, browser
localStorage, and recovery exports. Any session involving persistence, schema,
API, deployment, migration, seed data, deletion, or recovery must read and obey
that file. A passing test/build/deploy is never sufficient evidence that the
four-level folder tree or chart contents were preserved.

The required first action for such work is the read-only inventory/export in
`PROMPT_CLAUDE_01A_DATABASE_SAFETY_PREFLIGHT_READ_ONLY.md`. It must finish with
`DATA_SAFE_READ_ONLY_COMPLETE` or `DATA_SAFETY_BLOCKED`; it must not silently
reset local state or write to Production.

For the current Machine Chart task, Phase 0A passed and the external recovery
export was verified. The next Claude session must use the dedicated Phase 0B
prompt for runtime guards before any normal feature implementation. That prompt
does not authorize schema migration, Production writes, authentication work,
deployment, or push.
