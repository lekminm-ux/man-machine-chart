# GPT Review — Phase 0C Fix Round 2

Date: 2026-08-02

## Decision

`APPROVED_FOR_CLAUDE_FIX`

Claude correctly fixed the complete chart payload and the basic unconfirmed
marker, but this handoff is still not `PASS`. Do not commit, push, deploy, or
close Phase 0C yet.

## Verification performed

- `pnpm.cmd test`: **123/123 passed**.
- `pnpm.cmd run build`: **passed**; TypeScript and all five static routes are
  clean.
- `pnpm.cmd run lint`: failed with the same 5 pre-existing errors; 15 warnings
  are reported, including generated `.wrangler` output. No new error was
  identified in the Phase 0C logic.
- `git diff --check`: **passed**.
- The local API/D1 save → GET → repeated GET evidence is useful and confirms
  the complete JSON payload path locally. It is not browser-rendered evidence
  of the Save badge or console state.
- No Production write, remote D1 command, schema change, commit, push, or
  deploy was performed.

## Findings still open

### 1. Blocker — local-only rows remain in the Cloud-ready mutation state

`loadDatabaseFromCloud()` still appends `_unsynced` files and folders to the
same `db` returned with `ok: true` (`src/lib/storage.ts:90-111`). The store then
sets `cloudReady: true` (`src/store/useChartStore.ts:201-206`). The Sidebar's
amber badge is helpful visibility, but it does not enforce the source-of-truth
rule.

The store still permits calls such as `renameFolder`, `toggleFolder`,
`renameFile`, `moveFile`, and `saveActiveFile` for an `_unsynced` id while
`cloudReady` is true. In particular, the folder API's PUT currently returns
success without checking affected rows (`functions/api/folders.js:69-70`), so
a local-only folder toggle can be shown as saved even though no Cloud row
exists. A local-only chart is also sent to the files API before the 409 guard
rejects it.

Required: keep local-only records recoverable but outside the confirmed
Cloud-authoritative database, or add explicit client guards that block every
Cloud mutation for `_unsynced` folders/files before any API call. The UI must
show the pending state and provide a safe recovery/retry path. Add tests for
local-only folder toggle/rename and local-only chart save/rename/move proving
that no Cloud mutation is attempted and no `saved` status is shown.

### 2. Major — an unconfirmed draft is still rendered as the active document

Hydration preserves an `_unconfirmed` draft with `_loaded:false`, which is a
good safeguard for `saveActiveFile`. However, `hydrate()` still retains the
cached `activeFileId` and sets `cloudReady:true`; `src/app/editor/page.tsx`
renders `useChartStore(s => s.activeFile())` immediately after hydration and
does not call `openFile()` automatically. Thus the unconfirmed local draft can
appear in the editor before any fresh Cloud GET, while the global sync status
has already been reset to `idle`. The sidebar badge alone is not a sufficient
read-only/Cloud-source boundary.

Required: after hydration, do not expose an unconfirmed/local-only draft as the
confirmed active editor document. Either select no active document until an
explicit open performs the Cloud GET, or keep the draft in a separate pending
state and make the editor clearly read-only with a retry/recovery action. Add a
store/UI-level regression test proving that a matching-timestamp unconfirmed
draft cannot be rendered or saved as the active Cloud chart before a fresh
`openFile()` read succeeds.

## Release gate still open

The server-side local save/read-back/reopen proof is recorded in Claude's
changelog. The required browser-rendered smoke test (Save status, hard refresh
or reopen, and zero console errors) was not completed because the automation
surfaces failed. Before `PASS`, perform this check manually in a visible
browser or another reliable browser surface against local Pages Dev only, and
record the URL, chart id, marker, responses, reopen result, and console result.

## Handoff constraints

- Read this report, `docs/Master_Plan.html`,
  `docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md`, and the changed source/tests first.
- Stay within the approved Phase 0C boundary. No schema/auth/concurrency work,
  Production D1 access, commit, push, or deploy.
- Run `pnpm test`, `pnpm run lint`, `pnpm run build`, and return the exact
  results. Keep the known lint findings separate.
- Update `CHANGELOG_AI.md` and return `IMPLEMENTED` with the new evidence and
  remaining risks. GPT review is required again before release.
