# Codex Active-User Save-to-Cloud Persistence Audit

Date: 2026-08-02
Commit reviewed: `7cf43ef` (`docs: add save-to-cloud persistence gate`)
Mode: read-only source and release audit; no application, D1, or Production write

## Audit status

`AUDIT_STATUS: READ_ONLY_COMPLETE_WITH_PERSISTENCE_BLOCKERS`

The current application has Cloud availability and lazy-loading guards, but it
does not yet prove that a successful Save survived a fresh Cloud read and a
refresh/reopen. It must not be described as meeting the new Save-to-Cloud
Persistence Gate until the findings below are resolved and verified.

## Scope and files read

- `PROJECT_CONTEXT.md`
- `CHANGELOG_AI.md` and the recent release/data-safety entries
- `package.json`, `wrangler.toml`, and `schema.sql`
- `src/lib/storage.ts`
- `src/store/useChartStore.ts`
- `src/types/index.ts`
- `functions/api/files.js` and `functions/api/folders.js`
- `src/components/layout/TopBar.tsx` and `src/components/layout/Sidebar.tsx`
- persistence and data-safety tests under `tests/`
- the governing files under `docs/AI_PROMPTS/`

Production D1 remains the source of truth. This audit did not run a remote D1
query, migration, seed, reset, or write. A direct HTTP probe to the live URL was
not completed in this environment because the connection closed during receive;
therefore no live save/read-back/reopen evidence is claimed here.

## Current verified baseline

- `pnpm.cmd test`: 106/106 passed.
- `pnpm.cmd run build`: passed; TypeScript and Next production build completed.
- `pnpm.cmd run lint`: baseline has 5 errors and 7 warnings. The working tree
  contained no application-source changes in this audit, so these are not
  attributed to this documentation change. They remain open for the normal QA
  gate.
- The working tree was clean after push at commit `7cf43ef`.
- The deployed application uses `/api/files` and `/api/folders` backed by the
  Cloudflare D1 binding `DB` configured in `wrangler.toml`.

## Findings

### Major — Save is marked successful without Cloud read-back

Evidence:

- `src/lib/storage.ts:150-161` sends `PUT /api/files` and returns `void` after
  the HTTP status succeeds. It does not return or compare the canonical row.
- `src/store/useChartStore.ts:396-409` writes the draft to localStorage before
  the request and changes `syncStatus` to `saved` immediately after the PUT
  resolves. There is no read-after-write or refresh/reopen verification.
- `src/components/layout/TopBar.tsx:226-244` displays `Saved to Cloud` solely
  from that client status.

Impact: a successful HTTP response can be reported as a saved chart even when
the response does not prove the exact content was stored. This fails the new
user requirement and the Save-to-Cloud Persistence Gate.

### Major — The API returns success even when no chart row was updated

Evidence:

- `functions/api/files.js:72-81` executes an `UPDATE ... WHERE id = ?` and
  returns `{ success: true }` without checking the D1 result or returning the
  canonical row.

Impact: a local-only/stale chart ID or a missing row can produce a false success;
the user may see Saved while reopening the WebApp later shows no saved chart.

### Blocker — Successful cloud hydration can prefer stale local content

Evidence:

- `src/lib/storage.ts:57-60` returns a loaded local file instead of the Cloud
  metadata/content placeholder whenever the IDs match.
- `src/lib/storage.ts:71-79` appends local-only files and folders to a result
  that is then returned as `ok: true` and marked `cloudReady` by the store.
- `src/store/useChartStore.ts:171-185` treats that merged result as a confirmed
  Cloud state.

Impact: a stale or unsynced local file can appear as though it came from Cloud,
and a subsequent save can operate on data that was not confirmed by the current
Cloud read. A refresh/reopen test cannot be trusted until the authoritative
Cloud/local reconciliation is redesigned and tested.

### Major — Failed save keeps a local draft but has no explicit unconfirmed/dirty contract

Evidence:

- `src/store/useChartStore.ts:396-409` persists the updated draft locally before
  the Cloud request and, on failure, only changes `syncStatus` to `error`; it does
  not store a server-confirmed version or a retryable pending-save record.
- The existing test at `tests/store.test.cjs:350-367` verifies that a draft is
  retained after a rejected mock call, but it does not verify Cloud read-back,
  retry semantics, or reopening in a new session.

Impact: retaining a draft is useful for recovery, but it must never be confused
with persisted Cloud data. The UI and hydration path need an explicit
unconfirmed state and must prevent that draft from silently replacing Cloud.

### Blocker for multi-user safety — No server version/conflict authorization

Evidence:

- `functions/api/files.js:57-81` accepts a full PUT without an expected version,
  authenticated identity, authorization decision, or conflict response.
- The current Admin PIN/security gate is intentionally not a substitute for
  server-side authorization.

Impact: two users can overwrite one another silently. Concurrent editing must
remain out of scope until authentication, authorization, audit identity, version
checks, and conflict/retry handling are separately implemented and reviewed.

## Required next implementation plan

1. Define a canonical save contract: explicit success, exact chart identity,
   server revision/version and timestamp, affected-row validation, and the
   canonical stored payload or a verifiable read-back token.
2. Make Cloud authoritative after a successful hydration. Local drafts must be
   labeled separately; they must not silently merge into a confirmed Cloud
   database or become eligible for an update of a missing row.
3. Change the client save flow to keep a pre-save snapshot, send the complete
   payload, verify the server response with a fresh GET/read-back, compare all
   header/step/layout fields, and set `saved` only after that proof. A timeout,
   mismatch, or ambiguous result must remain unconfirmed and retryable.
4. Make refresh/reopen deterministic: open the representative chart from the
   deployed API, not from a loaded local copy, and prove the saved marker and
   every chart payload section remain present.
5. Add tests for: successful read-after-write, response mismatch, zero-row PUT,
   missing/local-only ID, failed/ambiguous save, stale local cache, refresh/reopen,
   and concurrent version conflict. Keep tests on mocks/in-memory fixtures.
6. Before any live write test, create and verify the required external
   Production recovery export and obtain the explicit test-data/target decision.
   Use one uniquely identifiable, reversible test change only; compare the
   before/after inventory and restore only through an approved recovery plan.
7. After GPT review and user authorization, have Claude implement the approved
   slice, then run tests, lint, build, visual smoke, console checks, and the live
   Save → API read-back → refresh/reopen verification before deployment sign-off.

## Handoff

Return this report to GPT/Codex for a Master Plan update. No application code
should be written until the plan explicitly approves the save contract,
Cloud/local reconciliation, test strategy, and Production verification method.

`NEXT_STATUS: GPT_MASTER_PLAN_REQUIRED`
