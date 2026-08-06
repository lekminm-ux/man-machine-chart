# Prompt — Codex Implementation: Phase 5a-1, Revision Snapshot Mechanism

Paste this whole block into Codex / GPT-5.6 Luna Max. This is an
IMPLEMENT_ONLY handoff written by Claude, the first sub-phase of Phase 5
(M6 Kaizen + Before/After). Do not add read-only UI gating beyond what's
specified for HeaderForm.tsx, and do not build the Before/After page — those
are Phase 5a-2 and Phase 5b, separately scoped after this ships and is
reviewed. Do not redesign the approach, do not expand scope. When done,
report back to **Claude** (not the user directly) using the REQUIRED HANDOFF
OUTPUT format at the end.

```text
ROLE: Codex / GPT-5.6 Luna Max — implementation only
MODE: IMPLEMENT_ONLY — build exactly the plan below; do not redesign, do not
expand scope. Do NOT implement Phase 5a-2 (making M1/M2/M4/M5 input fields
visually/functionally read-only when locked, beyond the one Rev No. field
specified below) or Phase 5b (the Before/After comparison page) — those are
separately scoped after this ships and is reviewed.

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
Phase 4 (M5 Yamazumi, all of 4a-4c) shipped and is deployed to Production.
This starts Phase 5 (M6 Kaizen + Before/After), per docs/Master_Plan.html
section 6 ("Kaizen Loop และหน้าสรุป Before/After"). The eventual Phase 5b
goal is a page that picks two closed Revisions of the same chart and
compares Cycle Time, worker count, walk/idle time, capacity/shift, and an
overlaid Yamazumi chart. That comparison is meaningless today because
`ChartHeader.revNo` is just a free-typed string with zero history — there is
no record of what M1-M5 looked like at any past revision, and nothing stops
the live draft from silently overwriting what should have been a frozen
historical record. This prompt builds only the snapshot+lock mechanism that
Phase 5b will read from: schema, API, store guard, and the minimal
HeaderForm UI needed to trigger it.

The user explicitly chose the "auto-lock + snapshot" design over a
non-locking manual-snapshot alternative: closing a revision must both save
an immutable copy AND prevent further edits to the live row until the user
explicitly opens a new revision.

ROOT CAUSE
`ChartHeader.revNo` (src/types/index.ts) has no persistence history of its
own — it lives inside the same mutable `content` JSON blob as everything
else in `chart_files`. "Closing" a revision today means nothing more than
typing a different string into a text box; the previous state is gone the
moment the next Save happens. There is no snapshot table, no lock state, and
no server-side guard against overwriting what a user believes is a closed,
frozen record.

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- schema.sql
- functions/api/revisions.js (new file)
- functions/api/files.js
- src/types/index.ts
- src/lib/storage.ts
- src/store/useChartStore.ts
- src/components/editor/HeaderForm.tsx
- tests/revisions.test.cjs (new file)
- tests/storage.test.cjs
- tests/store.test.cjs
- CHANGELOG_AI.md

READ FIRST — exact paths, in this order
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
   — especially "Database Safety and Data Preservation", "Active-User
   Continuous Release Gate", and "Save-to-Cloud Persistence Gate"
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/docs/AI_PROMPTS/DATABASE_SAFETY_GATE.md
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md (latest entries)
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/schema.sql (full file — you are adding to this)
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/types/index.ts (full file — `ChartFile`, `ChartHeader`)
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/files.js (full file — model your new
   endpoint's style, error shapes, and `json`/`error`/`badRequest` helpers on this)
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/folders.js (full file — second example
   of this project's Pages Functions style, including validation patterns)
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts (full file — especially
   `chartFileContent()`, `saveFileCloud()`, `loadFileFromCloud()`, and the
   `apiFetch` helper they all use)
9. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts (full file — especially
   `blockCloudMutation`, `blockUnloadedFile`, `blockUnconfirmedFile`, and the
   full `saveActiveFile` implementation you are adding a guard to)
10. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/editor/HeaderForm.tsx (full file —
    the "Rev No" field block, `LABEL_CLASS`/`FIELD_CLASS` conventions)
11. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/storage.test.cjs and
    D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/store.test.cjs (existing test patterns —
    especially how they fake `fetch`/D1 and how they model cloud
    success/failure, to keep your new tests consistent)

PREFLIGHT
- Run: git status --short --branch
- Preserve all existing uncommitted/untracked files exactly as found. Do not
  reset, checkout, restore, delete, or run any broad cleanup.
- If anything unexpected is already in the working tree, stop and report
  before touching anything — note it if it's clearly just documentation
  (e.g. only CHANGELOG_AI.md or files under docs/AI_PROMPTS/ are pending)
  and proceed with the actual code task; only hard-stop if something in
  src/, tests/, schema.sql, or functions/ is unexpectedly modified.

FORBIDDEN
- Do not edit any file outside the list in REQUIRED SCOPE.
- Do not implement Phase 5a-2 (read-only input gating in M1/M2/M4/M5 beyond
  what's specified below for HeaderForm.tsx) or Phase 5b (Before/After page).
- Do not run any migration, `ALTER TABLE`, or write of any kind against
  Production D1. Do not use `--remote`. Test the new schema and endpoints
  only against local Pages Dev / Wrangler local D1 / test fixtures. The
  actual Production schema migration is a separate step Claude coordinates
  directly with the user after this round is reviewed — it is explicitly
  NOT part of this task.
- Do not add a `closedBy` / user-identity column or field anywhere. This app
  has no real server-side account system yet (the Admin PIN is explicitly
  not real auth per PROJECT_CONTEXT.md) — there is no meaningful value to
  put there. Leave identity out of the schema entirely; it can be added
  additively in a future auth phase.
- Do not add dirty/unsaved-change tracking infrastructure to the store. Use
  the approach specified in IMPLEMENTATION PLAN step 6 (closeRevision calls
  the existing saveActiveFile first and checks its outcome) instead of
  inventing a new dirty flag.
- Do not change the shape or behavior of any EXISTING API response field,
  and do not change `saveActiveFile`'s existing behavior/contract for
  already-unlocked files — the only new behavior for unlocked files is that
  the guard added in step 6 does nothing (passes through exactly as today).
- Do not attempt to solve simultaneous-close-revision race conditions beyond
  what step 1's unique index and step 2's `WHERE lockedAt IS NULL` guards
  already provide. This app has no concurrent-multi-user-editing story yet
  (a known, separately-scoped gap per PROJECT_CONTEXT.md) — do not build
  anything beyond that existing posture.
- If this turns out to require touching a file outside scope, or changing
  any existing endpoint's response shape in a way existing callers don't
  expect, STOP and report `PLAN_CHANGE_REQUIRED` with the specific reason.
- Do not commit, push, deploy, or run any git-mutating command.

IMPLEMENTATION PLAN

1. schema.sql — append (do not touch the existing `folders`/`chart_files`
   table definitions or indexes):
   ```sql
   -- Revision Snapshots (Phase 5a) — immutable history of closed revisions
   ALTER TABLE chart_files ADD COLUMN lockedAt TEXT DEFAULT NULL;

   CREATE TABLE IF NOT EXISTS revision_snapshots (
     id          TEXT PRIMARY KEY,
     chartFileId TEXT NOT NULL,
     revNo       TEXT NOT NULL,
     content     TEXT NOT NULL,
     closedAt    TEXT NOT NULL,
     FOREIGN KEY (chartFileId) REFERENCES chart_files(id) ON DELETE CASCADE
   );
   CREATE UNIQUE INDEX IF NOT EXISTS idx_revision_snapshots_unique
     ON revision_snapshots(chartFileId, revNo);
   CREATE INDEX IF NOT EXISTS idx_revision_snapshots_file
     ON revision_snapshots(chartFileId);
   ```
   `lockedAt` is nullable and defaults to NULL, so every existing row is
   unaffected (unlocked) the moment this runs. `content` stores the exact
   same JSON string shape as `chart_files.content` — copy it verbatim
   server-side (see step 2), do not re-derive or re-shape it.

2. functions/api/revisions.js (new file) — mirror files.js's `json`/`error`/
   `badRequest` helper style exactly (duplicate them locally, same as
   folders.js and files.js each already do independently — do not try to
   share a helper module across functions in this round).
   - `onRequestGet(context)`:
     - If `?id=xxx` — single snapshot: `SELECT * FROM revision_snapshots
       WHERE id = ?`; 404 if missing; return it with `content` JSON-parsed
       (same pattern as files.js's single-file GET).
     - Else if `?chartFileId=xxx` — list: `SELECT id, chartFileId, revNo,
       closedAt FROM revision_snapshots WHERE chartFileId = ? ORDER BY
       closedAt DESC` (metadata only, no content — same "list is metadata
       only" convention files.js already uses).
     - Else — 400 bad request.
   - `onRequestPost(context)` — close a revision. Body: `{ id, chartFileId,
     revNo }` (the client generates `id` via `uuidv4()`, same convention as
     `createFileCloud`).
     - Validate `id`, `chartFileId`, `revNo` all present and `revNo` is a
       non-empty trimmed string → 400 otherwise.
     - `SELECT id, content, lockedAt FROM chart_files WHERE id = ?` → 404 if
       missing.
     - If `lockedAt` is already non-null → 409 `{ error: 'this chart is
       already locked — open a new revision before closing again' }`.
     - `closedAt = new Date().toISOString()`.
     - Run atomically via `env.DB.batch([...])`:
       - `INSERT INTO revision_snapshots (id, chartFileId, revNo, content,
         closedAt) VALUES (?, ?, ?, ?, ?)` bound to
         `(id, chartFileId, revNo, row.content, closedAt)` — `row.content`
         is the raw string already read above, copied verbatim.
       - `UPDATE chart_files SET lockedAt = ? WHERE id = ? AND lockedAt IS
         NULL` bound to `(closedAt, chartFileId)`.
     - The UNIQUE index on `(chartFileId, revNo)` will throw if this revNo
       was already closed for this chart — catch that and return 409
       `{ error: 'revision "<revNo>" was already closed for this chart —
       choose a different Rev No.' }` rather than a raw 500 (inspect
       `err.message` for a constraint-violation match the same defensive
       way you'd detect any other D1 error in this codebase; only
       special-case that one string, let every other error fall through to
       the generic `error(err)` 500 helper).
     - On success: `json({ success: true, snapshot: { id, chartFileId,
       revNo, closedAt } })`.
   - `onRequestPut(context)` — open a new revision. Body: `{ chartFileId }`.
     - Validate `chartFileId` present → 400 otherwise.
     - `SELECT lockedAt FROM chart_files WHERE id = ?` → 404 if missing.
     - If `lockedAt` is already null → 409 `{ error: 'this chart is not
       currently locked' }`.
     - `UPDATE chart_files SET lockedAt = NULL WHERE id = ?`.
     - On success: `json({ success: true, chartFileId })`.

3. functions/api/files.js — `onRequestPut` only:
   - Before the existing UPDATE, add a check able to distinguish "row is
     locked" from "row doesn't exist" (e.g. a `SELECT lockedAt FROM
     chart_files WHERE id = ?` first — your call on exact approach, but the
     response must be able to tell the two apart).
   - If the row exists and `lockedAt` is non-null → return 409
     `{ error: 'this revision is locked — open a new revision to keep
     editing', id, locked: true }` and do NOT run the content UPDATE at all.
   - If the row doesn't exist at all, keep today's existing behavior
     unchanged (the existing zero-`meta.changes` 409 path).
   - Every other existing behavior of this endpoint (the COALESCE fields,
     the folderId-existence check, the success response shape) is
     UNCHANGED for unlocked rows.

4. src/types/index.ts:
   - Add `lockedAt?: string | null;` to `ChartFile` (near `updatedAt`),
     with a one-line comment: locked charts' content is read-only until
     `openNewRevision` clears this.
   - Add:
     ```ts
     export type RevisionSnapshotContent = Pick<ChartFile,
       'header' | 'steps' | 'layoutDiagram' | 'timeMeasurement' | 'timeStudy' | 'machineCapacity'>;

     export interface RevisionSnapshotMeta {
       id: string;
       chartFileId: string;
       revNo: string;
       closedAt: string;
     }

     export interface RevisionSnapshot extends RevisionSnapshotMeta {
       content: RevisionSnapshotContent;
     }
     ```
     (`RevisionSnapshotContent` must match exactly what `chartFileContent()`
     in storage.ts already returns — it's the same shape, just named so
     `functions/api/revisions.js`'s parsed JSON has a real type on the
     client side.)

5. src/lib/storage.ts — add three new functions near `saveFileCloud`,
   following its `apiFetch`-wrapped, explicit-Result-type style (not the
   throw-and-let-caller-catch style of the plainer folder/file CRUD
   functions — these are correctness-sensitive like `saveFileCloud`):
   ```ts
   export type CloseRevisionResult =
     | { ok: true; snapshot: RevisionSnapshotMeta }
     | { ok: false; error: string };

   export async function closeRevisionCloud(chartFileId: string, revNo: string): Promise<CloseRevisionResult> {
     // POST /api/revisions with a fresh uuidv4() id; mirror saveFileCloud's
     // try/catch-into-Result shape exactly.
   }

   export type OpenRevisionResult =
     | { ok: true }
     | { ok: false; error: string };

   export async function openRevisionCloud(chartFileId: string): Promise<OpenRevisionResult> {
     // PUT /api/revisions
   }

   export type ListRevisionsResult =
     | { ok: true; snapshots: RevisionSnapshotMeta[] }
     | { ok: false; error: string };

   export async function listRevisionSnapshotsCloud(chartFileId: string): Promise<ListRevisionsResult> {
     // GET /api/revisions?chartFileId=...
   }
   ```
   You do not need a `getRevisionSnapshotCloud(id)` single-snapshot fetch in
   this round — Phase 5b will add that when it builds the comparison page
   that actually needs snapshot content. Do not add it speculatively.
   Import `v4 as uuidv4` from `uuid` the same way useChartStore.ts already
   does.

6. src/store/useChartStore.ts:
   - Add a new guard function right after `blockUnconfirmedFile`, same
     shape and style:
     ```ts
     function blockLockedFile(set: Setter, actionName: string, file: ChartFile): boolean {
       if (file.lockedAt) {
         set({ syncStatus: 'error' });
         console.warn(`${actionName} blocked: this revision is locked — open a new revision to keep editing.`);
         return true;
       }
       return false;
     }
     ```
   - In `saveActiveFile`, add `if (blockLockedFile(set, 'saveActiveFile', file)) return;` alongside
     the existing `blockCloudMutation`/`blockUnloadedFile` guard calls at
     its top (same position in the guard sequence).
   - Add two new actions to the store interface and implementation:
     - `closeRevision(revNo: string): Promise<void>` —
       1. Get the active file; guard with `blockCloudMutation`,
          `blockUnloadedFile`, `blockUnconfirmedFile`, and `blockLockedFile`
          (an already-locked file can't be closed again — reusing
          `blockLockedFile` here is correct and intentional).
       2. Reject a blank/whitespace-only `revNo` client-side the same way
          (`set({ syncStatus: 'error' })` + `console.warn`) — do not call
          the API with an empty string.
       3. `await get().saveActiveFile();` — then re-read `get().files.find(f
          => f.id === file.id)`. If that file is missing, `_unconfirmed`, or
          `_loaded === false`, treat the save as failed: warn
          `'closeRevision blocked: the save before closing did not get
          confirmed — retry Save first.'`, set `syncStatus: 'error'`, and
          return WITHOUT calling the close-revision API.
       4. Call `closeRevisionCloud(file.id, revNo.trim())`. On failure:
          `console.warn` with the returned error, `set({ syncStatus:
          'error' })`, return — the file stays unlocked, fully retryable.
       5. On success: update the file in `files` (and whatever else derives
          `activeFile()`, matching how other actions in this file already
          update `files` in place) to set `lockedAt:
          result.snapshot.closedAt`. Set `syncStatus: 'idle'`.
     - `openNewRevision(): Promise<void>` —
       1. Get the active file; guard with `blockCloudMutation` and
          `blockUnloadedFile` only (deliberately NOT `blockUnconfirmedFile`
          or `blockLockedFile` — this is the unlock action, it must work
          precisely when the file IS locked).
       2. If `!file.lockedAt`, warn `'openNewRevision blocked: this chart is
          not currently locked.'`, set `syncStatus: 'error'`, return.
       3. Call `openRevisionCloud(file.id)`. On failure: warn, set
          `syncStatus: 'error'`, return — file stays locked, retryable.
       4. On success: update the file in `files` to clear `lockedAt` (match
          whichever of `undefined`/`null` this file already uses elsewhere
          for "cleared" optional fields — check before picking). Set
          `syncStatus: 'idle'`.
   - Add both new actions to the store's TypeScript interface near
     `saveActiveFile`'s own declaration.

7. src/components/editor/HeaderForm.tsx — in the existing "Rev No" block
   (currently just a label + text input, between Issue Date and Prepared By):
   - If `activeFile.lockedAt` is set: keep the Rev No. input but make it
     `disabled` (locked content is read-only — this one field's read-only
     state IS in scope here since it sits directly next to the buttons this
     round adds; the REST of the form's fields stay exactly as they are
     today and are NOT touched — that's Phase 5a-2). Below or beside it,
     show a small locked indicator (e.g. `🔒 ปิดแล้ว` plus the closedAt date)
     and a button "เปิด Revision ใหม่" that calls `openNewRevision()`.
   - If not locked: keep the Rev No. input exactly as today (still editable,
     unrelated to this feature), and add a button "ปิด Revision" next to it
     that calls `closeRevision(h.revNo)`. Disable this button when
     `h.revNo.trim() === ''`.
   - Surface `syncStatus === 'error'` next to these buttons specifically
     (a short inline message is enough — do not build a global toast/banner
     system) so a blocked/failed close or open is visible to the user, not
     silent-console-only.
   - Match `LABEL_CLASS`/`FIELD_CLASS` and this project's existing
     small-button Tailwind conventions (check Sidebar.tsx or TopBar.tsx)
     rather than inventing new styling.

8. Tests:
   - tests/revisions.test.cjs (new): test `functions/api/revisions.js`
     directly (mirror whichever existing test file already exercises Pages
     Functions directly, e.g. the `POST /api/folders`/`PUT /api/files`
     tests). Cover: close creates a snapshot and locks the row atomically;
     close on an already-locked chart returns 409; close with a duplicate
     revNo for the same chart returns 409 and does NOT lock/overwrite
     anything; close on a chart with unrelated existing snapshots does not
     touch them; open clears lockedAt; open on an already-unlocked chart
     returns 409; open on a nonexistent chart returns 404; list returns
     metadata only ordered by closedAt DESC; get single returns full content
     matching what was stored.
   - tests/storage.test.cjs: add tests for `closeRevisionCloud`,
     `openRevisionCloud`, `listRevisionSnapshotsCloud` — success shape,
     and failure/network-error shape (mirror the existing `saveFileCloud`
     failure tests exactly).
   - tests/store.test.cjs: add tests for `closeRevision`/`openNewRevision`
     covering: successful close locks the file locally after a confirmed
     save; closeRevision is blocked (no API call made) when the preceding
     save does not confirm; closeRevision on an already-locked file is
     blocked; closeRevision with a blank revNo is blocked before any API
     call; saveActiveFile is blocked on a locked file and does not call the
     save API; openNewRevision unlocks a locked file; openNewRevision on an
     already-unlocked file is blocked; a locked file's `lockedAt` survives
     hydrate() unchanged (add one assertion to whichever existing hydrate
     test fixture is easiest to extend — do not build a new fixture just
     for this one field).

ACCEPTANCE CRITERIA
1. `schema.sql` changes are purely additive (`ALTER TABLE ... ADD COLUMN`
   with a NULL default, `CREATE TABLE IF NOT EXISTS`, `CREATE ... INDEX IF
   NOT EXISTS`) and do not modify any existing table/index definition.
2. Closing a revision creates exactly one `revision_snapshots` row and sets
   `chart_files.lockedAt` in the same atomic batch — proven by a test that
   the two never disagree (no state where a snapshot exists but the row is
   still unlocked, or vice versa, under normal operation).
3. A locked chart's `PUT /api/files` is rejected with a distinguishable 409
   (not the generic not-found message) and does not modify `content`.
4. Duplicate `revNo` for the same `chartFileId` is rejected (409) and does
   not create a second snapshot or touch the existing one.
5. `openNewRevision` clears the lock and editing (Save) resumes working
   exactly as before for that file, with the file's prior content fully
   intact — zero data loss across a close→open cycle.
6. Every existing test for `saveActiveFile`, `PUT /api/files`, and every
   other currently-passing test continues to pass unmodified — this is an
   additive feature with zero behavior change for any file that has never
   been locked.
7. `node --test`, `npm run lint`, `npm run build`, `git diff --check` all
   pass. Lint shows only the known pre-existing baseline errors — zero new
   errors in any file you touched.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npm run build
- git diff --check
- Start local Cloudflare Pages Dev against a LOCAL/test D1 database only
  (check package.json scripts and docs/Deployment_Checklist.md for the
  exact command and binding flags this project already uses — do not guess
  wrangler flags), apply the new schema.sql to that local database, and
  manually: open a chart, close a revision, confirm the Rev No. field and
  the locked indicator/button update correctly, confirm Save is now
  rejected with the new message if attempted, open a new revision, confirm
  editing and Save work again, and confirm the file's data is completely
  unchanged throughout. Check the console is clean. Report the exact local
  D1/environment identity you tested against — this must not touch
  Production D1 in any way.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries) recording:
files changed, the exact schema DDL added, the new API endpoint contract,
the new store actions, and the verification results above. Explicitly state
this is Phase 5a-1 of Phase 5 (M6 Kaizen + Before/After), that Phase 5a-2
(read-only UI gating beyond HeaderForm) and Phase 5b (Before/After page) are
separately scoped next, and that no Production D1 schema change occurred.

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Exact files read
- Exact files changed (must match REQUIRED SCOPE exactly)
- The exact final schema.sql diff
- The exact final `functions/api/revisions.js` contract (confirm it matches
  the plan or note any deliberate deviation and why)
- Confirmation of the atomic-batch behavior for close (snapshot insert +
  lock update never disagree)
- Exact test/lint/build/diff-check output
- Manual local Pages Dev verification result, including the exact
  environment/database identity tested, console result, and the full
  close→blocked-save→open→save-works-again cycle outcome
- Any scope question or ambiguity you hit and how you resolved it, or why
  you stopped instead
- Explicit statement: no commit, push, deploy, or Production D1 write/
  migration occurred
- Next action: return this handoff to Claude for review. Do not proceed to
  Phase 5a-2, Phase 5b, or any release/migration action yourself.
```
