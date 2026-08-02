# AI Collaboration Prompts — Man-Machine Chart

Project root:

`D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation`

This project uses the same separation of responsibilities as the Technical Injection Blow Mold project:

| Role | Responsibility | Coding authority |
|---|---|---|
| GPT/Codex | Read the project, own the Master Plan, review plans and code, define improvements, and close phases | Does not write code unless the user explicitly asks |
| Claude | Implement and fix code according to the approved plan and GPT review findings | May edit code only after GPT approval and explicit user authorization |
| User | Approves scope, starts coding, decides unresolved business choices, and authorizes deployment/escalation | Final decision maker |

## Prompt order

0. [Claude read-only project onboarding](PROMPT_CLAUDE_00_START_HERE_READ_ONLY.md) — optional first step
0A. [Claude database inventory and recovery export](PROMPT_CLAUDE_01A_DATABASE_SAFETY_PREFLIGHT_READ_ONLY.md) — required before persistence, schema, deployment, or data-recovery work
1. [GPT project audit and Master Plan](PROMPT_GPT_01_PROJECT_AUDIT_AND_MASTER_PLAN.md)
2. [Claude implementation of an approved plan](PROMPT_CLAUDE_02_IMPLEMENT_APPROVED_PLAN.md)
2A. [Claude runtime data-safety guards](PROMPT_CLAUDE_02A_DATA_SAFETY_RUNTIME_GUARDS.md) — use only for the approved Phase 0B guard scope after the read-only preflight
3. [GPT review of Claude handoff](PROMPT_GPT_03_REVIEW_CLAUDE_HANDOFF.md)
4. [Claude fix and re-test loop](PROMPT_CLAUDE_04_FIX_RETEST.md)

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
