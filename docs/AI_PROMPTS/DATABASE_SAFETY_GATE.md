# Database Safety Gate — Man-Machine Chart

This is a mandatory rule set for every AI session that can inspect, change, test,
deploy, migrate, seed, or troubleshoot chart data. It is the canonical data-
preservation policy referenced by the Project Context, Master Plan, and AI
workflow prompts.

## Source of truth and environment separation

The following environments are different data stores and must never be treated
as interchangeable:

| Environment | Purpose | Data authority |
|---|---|---|
| Cloudflare Production D1 behind `https://man-machine-chart.pages.dev` | Real user folders and charts | Canonical source of truth |
| Cloudflare Pages Dev at `127.0.0.1:8788` with local D1 | Local integration and visual testing | Disposable test data only |
| Next dev at `localhost:3456` and browser `localStorage` | UI-only fallback/testing | Not a copy of Production D1 |
| `D:\00_LocalFile_WebApp\ManMachineChart_Data_Backups\` | Recovery exports | Recovery evidence only; never development source of truth |

The local `.wrangler/` directory contains local runtime/D1 state. It is not
Production, must not be used to infer that Production data exists or is missing,
and must never be deleted or recreated merely to make a test convenient.

## Non-negotiable preservation rules

1. Identify the environment, database name, binding, URL, and local/remote mode
   before running any database command.
2. Never run `DROP`, `DELETE`, `UPDATE`, `INSERT`, reset, migration, seed, or
   database deletion against Production without explicit user authorization,
   a written scope, and a verified recovery export made immediately beforehand.
3. Never use `--remote` for local testing. A remote read-only `SELECT` is allowed
   only for an explicitly authorized inventory/backup audit; remote writes are
   never part of ordinary testing.
4. Never delete `.wrangler/`, local SQLite state, browser storage, or a backup in
   order to fix a runtime problem. Stop and report the exact target first.
5. Never seed, reset, or overwrite a database with a one-folder/one-chart sample
   and call it a restoration. Sample data must be clearly labelled as local test
   data and must never replace existing data.
6. Preserve every `folders` row, its `parentId` chain, and every `chart_files`
   row/content. The existing four-level tree is user data; it is not permission
   to flatten, regenerate, or assume a fixed depth.
7. If a cloud read fails, fail closed: show/report the error and block save or
   destructive actions. Do not silently replace a non-empty cloud state with an
   empty local fallback.
8. Before and after a schema, API, persistence, or deployment change, compare
   folder count, root count, maximum hierarchy depth, parent-child relationships,
   chart-file count, and known chart IDs/names. Any unexpected decrease is a
   STOP condition.
9. A successful test, build, or deploy command is not evidence that data was
   preserved. The real Production tree and representative existing charts must
   be reopened and checked after deployment.

## Active-user release safety

The WebApp is a continuously used system. A code or deployment change may run
while users are viewing or editing charts, so the current release must remain
usable until the replacement is verified.

- Ship only a GPT-reviewed release commit and retain the last known-good
  deployment as the rollback target.
- Keep UI, API, and saved chart JSON backward-compatible for existing clients.
  Breaking changes require a separately reviewed version/compatibility plan.
- Use an expand/compatibility/contract sequence for schema changes. Do not mix
  destructive schema cleanup, ad-hoc `ALTER TABLE`, reset, seed, or bulk repair
  with an ordinary user-facing release.
- If a release fails, preserve read access to existing charts, fail closed for
  unsafe writes, and roll back the application. Never overwrite data as part of
  an emergency recovery.
- Concurrent editing is not considered safe until server-side authentication,
  authorization, audit identity, optimistic version checks, and conflict
  handling are implemented and GPT-reviewed. An Admin PIN alone is not enough.

## Save-to-cloud persistence gate

Never treat a browser-side state change or a request without a visible error as
proof that a chart was saved. The authoritative result is the deployed API and
Cloudflare/D1 read-back.

- A save may be reported as successful only after the server returns explicit
  success with the exact chart identity and a server version/timestamp.
- The required verification sequence is: save a uniquely identifiable change
  through the deployed WebApp, read the same chart through the deployed API,
  compare metadata and every step/timeline value, refresh or reopen the WebApp,
  and read it again from Cloud. Record the URL, chart identity, response,
  read-back, reopen result, and timestamp.
- A timeout, error, or ambiguous response must preserve unsaved work for retry,
  block unsafe overwrite, and be reported as unconfirmed. Never write an empty
  or stale local fallback over Cloud data.
- Read-after-write checks must not rely on localStorage, React state, fixtures,
  local D1, or a stale browser cache. A successful test/build/deploy alone is
  not sufficient evidence.
- If the application cannot prove this round trip, the release is not ready for
  active users and must return to GPT planning. Do not reset, reseed, bulk-repair,
  or delete data to make the check pass.

## Required data-safety preflight

Before changing persistence, schema, API, deployment configuration, or starting
a Production-related investigation:

- Read `PROJECT_CONTEXT.md`, `CHANGELOG_AI.md`, `docs/Master_Plan.html`,
  `schema.sql`, `wrangler.toml`, `src/lib/storage.ts`,
  `src/store/useChartStore.ts`, `functions/api/folders.js`, and
  `functions/api/files.js`.
- Record the target environment and the exact read-only command.
- Inventory `folders` and `chart_files` without changing them.
- Verify root folders, the full `parentId` tree (including the existing four
  levels), chart-file placement, row counts, and representative IDs/names.
- Export the Production rows and schema to a timestamped directory outside the
  repository before any authorized write or migration. Do not commit this export.
- If the export cannot be verified, stop with `BLOCKED`; do not improvise a
  restore from source code or sample data.

## Required implementation direction

Any future persistence-safety implementation must be planned and reviewed by
GPT/Codex before Claude edits code. The plan must consider:

- server-side authorization and approval/audit records for delete, move,
  structural, schema, and bulk-data actions;
- explicit loading/error/sync states instead of silent empty fallback;
- save guards that cannot overwrite a cloud file while lazy loading is incomplete
  or while the cloud read has failed;
- server-side validation and transactional/idempotent API behavior;
- a recoverable delete/version/archive strategy before removing rows; and
- regression tests proving that nested folders, chart content, refresh/reopen,
  cloud failure, and duplicate-file ID remapping preserve data.

## Gate decisions

- `DATA_SAFE_READ_ONLY_COMPLETE` — inventory and export verified; no writes made.
- `DATA_SAFETY_BLOCKED` — target, permission, export, or counts cannot be verified.
- `PLAN_CHANGE_REQUIRED` — schema, API, architecture, or recovery behavior must change.
- `APPROVED_FOR_DATA_IMPLEMENTATION` — GPT approved the plan and the user explicitly
  authorized Claude to implement it.
