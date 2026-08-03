# GPT Review — Phase 0C Save-to-Cloud Persistence

Date: 2026-08-02

## Decision

`APPROVED_FOR_CLAUDE_FIX`

The implementation direction is correct, but this handoff is not eligible for
`PASS`, phase closure, commit, push, or deployment. The next Claude round must
address the findings below and return a new handoff to GPT.

## Evidence reviewed

- Current working-tree diff and changed-file boundary.
- `src/lib/storage.ts`, `src/store/useChartStore.ts`,
  `functions/api/files.js`, `src/types/index.ts`, Sidebar/TopBar status UI,
  schema, focused tests, `CHANGELOG_AI.md`, and the Phase 0C section of
  `docs/Master_Plan.html`.
- `pnpm.cmd test`: **119/119 passed**.
- `pnpm.cmd run lint`: failed with the known 5 pre-existing errors; the run
  also reports generated `.wrangler` and existing-source warnings. No new
  lint error was identified in the changed Phase 0C logic.
- `pnpm.cmd run build`: **passed**; all five static routes generated.
- `git diff --check`: failed because added lines in the current diff contain
  CRLF/trailing-whitespace markers. Claude must clean this before handoff.
- No Production write, remote D1 command, deploy, push, schema change, or
  migration was authorized or performed during this review.

## Findings requiring correction

### 1. Blocker — the complete ChartFile payload is still not persisted

`ChartFile` contains `timeMeasurement`, `timeStudy`, and `machineCapacity`
(`src/types/index.ts`), and the application uses those fields in M1, M2, M3,
and M5. However, `createFileCloud` and `saveFileCloud` currently build
`content` with only `header`, `steps`, and `layoutDiagram`
(`src/lib/storage.ts:153-181`). The API stores that JSON as-is, so the three
module fields are silently dropped from Cloud on save. The read-back comparator
also omits them (`src/store/useChartStore.ts:130-136`), so a save can be shown
as `saved` even after those fields have been lost.

Required: define one canonical full chart payload for create, update, GET
read-back, and comparison. Preserve every persisted ChartFile field, including
all three module fields and stable metadata. Add a focused regression test that
puts unique markers in each optional field, verifies the PUT body and GET
round-trip, and makes any one-field loss produce `unconfirmed`.

### 2. Blocker — an unconfirmed draft can become trusted after reload

`saveActiveFile` writes the draft to localStorage before the Cloud read-back.
When the read-back fails or mismatches it only sets `syncStatus` to
`unconfirmed` (`src/store/useChartStore.ts:419-446`); it does not persist an
unconfirmed/dirty marker. On the next hydration,
`loadDatabaseFromCloud` trusts a local file whenever `_loaded !== false` and
`updatedAt` matches the Cloud metadata (`src/lib/storage.ts:64-76`). The local
draft can therefore be presented as confirmed without a fresh content read,
contrary to the Phase 0C failure and reopen contracts.

Required: persist an internal unconfirmed/dirty state for failed or ambiguous
read-back, never use that local content as confirmed Cloud content during
hydration, and keep it available as a clearly separate retryable draft. Add a
test that forces a read-back failure, starts a fresh hydration with a Cloud row
of the same id, and proves the Cloud content wins while the draft is not
silently discarded or treated as saved.

### 3. Major — local-only rows are still inside `cloudReady: true` state

`loadDatabaseFromCloud` appends `_unsynced` local files and folders to
`finalFiles`/`finalFolders` and returns `{ ok: true, db }`
(`src/lib/storage.ts:80-99`). `hydrate` then sets `cloudReady: true`, and the
Sidebar renders those rows without checking `_unsynced`. This contradicts the
approved source-of-truth rule: IDs absent from Cloud must not be merged into a
state labelled Cloud-ready or be available as if they were confirmed records.

Required: keep pending local-only drafts recoverable but separate from the
Cloud-authoritative database/tree, or explicitly block them from all confirmed
operations and make their status visible. The active selection must not cause
a local-only file to bypass the fresh Cloud load. Add a regression test for a
local-only file/folder plus the synthetic multi-level tree.

### 4. Major — the required refresh/reopen proof is missing

The new tests cover mocked save/read-back and hydration fragments, but do not
prove the complete acceptance sequence with a unique marker:

`Save -> deployed/local API -> fresh GET -> hard refresh/new session -> reopen`

Claude's own changelog states that no browser/UI smoke test of the new Save
flow was run. This is acceptable for a code-only intermediate handoff, but it
prevents `PASS` and deployment approval.

Required after the code fixes: run the local visual smoke test, record the
URL, chart id, unique marker, PUT response, fresh GET response, hard-refresh or
new-session reopen result, timestamp, and console result. Do not use
Production D1 for this local test.

## Handoff constraints for the next Claude round

- Read this report, `docs/Master_Plan.html`,
  `docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md`, and the exact changed files first.
- Stay within the Phase 0C allowed boundary. No schema migration, Production
  repair, authentication, multi-user versioning, remote D1 command, deploy,
  commit, or push.
- Normalize changed-file line endings and make `git diff --check` pass.
- Run `pnpm test`, `pnpm run lint`, and `pnpm run build`; separate known lint
  findings from newly introduced findings.
- Update `CHANGELOG_AI.md` with the actual verification evidence and return
  `IMPLEMENTED` plus the exact remaining risks. GPT must review the new diff
  before any phase closure or release action.

## Current gate

`GPT_REVIEW_APPROVED_FOR_CLAUDE_FIX`

The Phase 0C implementation is not yet `PASS`. Commit, push, deploy, and live
Production persistence verification remain gated.
