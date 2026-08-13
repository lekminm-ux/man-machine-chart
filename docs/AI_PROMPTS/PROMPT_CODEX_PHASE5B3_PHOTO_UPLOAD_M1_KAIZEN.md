# Prompt — Codex Implementation: Phase 5b-3 + M1 PIC, Shared R2 Photo Upload

Paste this whole block into Codex / GPT-5.6 Luna Max. This is an
IMPLEMENT_ONLY handoff written by Claude, combining two previously-separate
open items into one build because they share the exact same underlying
mechanism (upload a photo, store it in R2, keep only a short reference key
in D1) and the user explicitly asked for one shared design instead of two
one-off implementations:

1. **Phase 5b-3** — a photo for each of the Kaizen Sheet's existing
   `beforeNote`/`afterNote` text fields (`Module6_Kaizen.tsx`, shipped in
   Phase 5b-2).
2. **New: M1 "PIC" column** — a reference photo per Job Element row in the
   Time Measurement Sheet (`Module1_TimeMeasurement.tsx`), positioned
   between the existing Job Element and Worker columns.

When done, report back to **Claude** (not the user directly) using the
REQUIRED HANDOFF OUTPUT format at the end.

```text
ROLE: Codex / GPT-5.6 Luna Max — implementation only
MODE: IMPLEMENT_ONLY — build exactly the plan below; do not redesign, do not
expand scope, do not add multi-photo/gallery support anywhere (the user
explicitly chose exactly one photo per M1 row and exactly one photo per
Kaizen Before/After side). Do NOT make the M1 photo flow through the
"ดึงข้อมูลจาก M4" / "ส่งข้อมูลไป M2-M5" bridge — it stays M1-only this phase
(the user explicitly deferred that to a possible future Phase 6, once M4
actually has UI to show it).

PROJECT ROOT
D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation

CONTEXT
This session, Claude resolved four open product questions with the user
directly (recorded here since docs/Master_Plan.html and the continuation
prompt have not been updated yet — per this project's rule, Master_Plan.html
is only updated AFTER a real build/test/browser verification passes, so
treat THIS prompt as the authoritative source for these decisions, not
whatever open-question phrasing is still sitting in the HTML):

1. Photos per M1 row: **exactly 1**, not a list/gallery.
2. M1 upload/view UI: **inline thumbnail directly in the column** (not an
   icon that opens a modal).
3. M1↔M4 bridge: **does NOT flow through** — the photo lives only in M1's
   `TimeStudyRow` this phase. `ChartStep` (shared by M3/M4/M5) gets no new
   field, and `stepsFromTimeStudy`/`timeStudyFromSteps` in
   `src/lib/time-study.ts` are NOT touched. Reason verified against the
   actual code this session: both bridge functions regenerate every row/
   step from scratch on every pull/push (fresh IDs each time, not a merge),
   and M3/M4/M5 currently have zero UI to display a per-row photo anyway —
   carrying the field through would be storage-cheap (R2 cost is per unique
   object, not per reference) but UI-pointless until M4 actually grows a
   thumbnail column of its own, which is out of scope here.
4. Kaizen Before/After photos (Phase 5b-3): **exactly 1 photo per side**,
   supplementing the existing `beforeNote`/`afterNote` text fields from
   Phase 5b-2 — not replacing them.

The R2 bucket name/binding were also decided and approved by the user this
session: bucket `mm-chart-photos`, binding `PHOTOS`. **The real Production
R2 bucket does not exist yet as of this handoff** — Claude is creating and
wiring it separately (blocked on the Cloudflare account needing R2 enabled
once via the Dashboard, a user-only action, in progress). This does **not**
block your work: Cloudflare Pages Functions/Workers use a local-simulated
R2 bucket by default under `wrangler pages dev` the moment a
`[[r2_buckets]]` binding exists in `wrangler.toml` — verified against
current Cloudflare docs — exactly the same way this project's existing
`[[d1_databases]]` binding already gives you a local D1 without touching
Production D1. Add the binding and build/test against the local simulation;
do not wait for the real bucket.

Design principle carried over from this project's existing Revision
Snapshot mechanic: once a photo is uploaded and its key is referenced from
a chart's content (directly, or frozen into a closed Revision snapshot),
**that key must stay valid forever** — a closed Revision may reference any
previously-uploaded photo key indefinitely, the same way it already freezes
every other field. This is why there is no delete/replace-cleanup logic in
this phase (see FORBIDDEN) — uploaded photos are treated as permanent,
consistent with how Revision snapshots themselves are never cleaned up by
design.

REQUIRED SCOPE — ALLOWED TO CHANGE, exactly these files, nothing else
- wrangler.toml
- functions/api/photos.js (NEW)
- src/types/index.ts
- src/lib/storage.ts
- src/store/useChartStore.ts
- src/components/shared/PhotoSlot.tsx (NEW)
- src/components/modules/Module1_TimeMeasurement.tsx
- src/components/modules/Module6_Kaizen.tsx
- tests/storage.test.cjs
- CHANGELOG_AI.md

READ FIRST — exact paths, in this order
1. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/PROJECT_CONTEXT.md
   — "Business Rules สำคัญ" and "High-Risk Files" (`src/types/index.ts`,
   `src/store/useChartStore.ts` are both listed — narrow, additive patches
   only)
2. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/CHANGELOG_AI.md
   (top entries — Updates 22-23, the Phase 5b-2 review and release)
3. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/types/index.ts
   (full file — `TimeStudyRow`, `KaizenSheet`, `ChartFile`,
   `RevisionSnapshotContent`, and how `kaizen`/`timeStudy` were added as
   optional `ChartFile` fields)
4. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/storage.ts
   (full file — especially `apiFetch` near line 28, `chartFileContent()`
   around line 176-186, and `SaveFileResult`'s `{ok:true|false}` union
   pattern around line 203-225; confirms `timeStudy`/`kaizen` already pass
   through as whole objects, so nested new fields need no allow-list change)
5. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/store/useChartStore.ts
   (full file — especially `emptyKaizenSheet()`, `updateKaizen`,
   `updateTimeStudy`; confirms no new store action is needed since
   `Module1`'s `patchRow` and `Module6`'s `patchKaizen` already do
   whole-object replacement through these two existing actions)
6. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module1_TimeMeasurement.tsx
   (full file — table column layout, `patchRow`, the `isLocked` +
   `disabled={isLocked}` pattern, and the empty-state `colSpan={study.readingCount + 11}`
   you must update to `+ 12`)
7. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/components/modules/Module6_Kaizen.tsx
   (full file — `patchKaizen`, the existing "Before and After" section
   around line 269-295 you are adding photo slots to, and the untouched
   Phase 5b-1 comparison section below it — do not modify that part)
8. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/files.js
   (full file — the `json`/`error`/`badRequest` helper convention and
   `env.DB.prepare(...).bind(...).first()/.run()` usage style to mirror)
9. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/functions/api/folders.js
   (confirms `json`/`error`/`badRequest` are duplicated locally per file,
   not imported from a shared module — do the same in the new file)
10. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/wrangler.toml
    (the existing `[[d1_databases]]` block to mirror for `[[r2_buckets]]`)
11. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/tests/storage.test.cjs
    (full file — the `mockResponse`/global-`fetch`-mock pattern used to test
    `storage.ts` functions; mirror this for the new upload helper test)
12. D:/00_LocalFile_WebApp/ManMachineChart_StandardOperation/src/lib/time-study.ts
    (read `stepsFromTimeStudy`/`timeStudyFromSteps` only to confirm you are
    NOT touching them — both regenerate rows/steps from scratch with fresh
    IDs on every call, which is exactly why a photo field added only to
    `TimeStudyRow` cannot silently leak into `ChartStep` by accident, and
    exactly why it needs no code there to stay M1-only)

PREFLIGHT
- Run: git status --short --branch
- `docs/Master_Plan.html` and `docs/AI_PROMPTS/PROMPT_CLAUDE_00B_FRESH_SESSION_CONTINUE.md`
  may already show as modified — this is expected pre-existing doc-only
  session-handoff churn from before this task started, not something you
  caused. Leave it exactly as found; do not revert or commit it.
- Preserve all other existing uncommitted/untracked files exactly as found.
  Do not reset, checkout, restore, delete, or run any broad cleanup.
- If anything else unexpected is already in the working tree, stop and
  report before touching anything.

FORBIDDEN
- Do not edit any file outside the list in REQUIRED SCOPE.
- Do not add a `photoKey`/photo field to `ChartStep`, and do not modify
  `src/lib/time-study.ts` (`stepsFromTimeStudy`, `timeStudyFromSteps`, or
  anything else in that file) — the M1 photo is explicitly M1-only this
  phase, per the user's own decision above.
- Do not implement multi-photo, a photo list/array, or a gallery UI
  anywhere — exactly one `photoKey` on `TimeStudyRow`, exactly one
  `beforePhotoKey` and one `afterPhotoKey` on `KaizenSheet`.
- Do not implement a DELETE handler for `/api/photos`, or any cleanup/
  garbage-collection of R2 objects. Uploaded photos are permanent by
  design this phase (see CONTEXT) — replacing a photo's key in the app
  must leave the old R2 object in place, untouched.
- Do not add a server-side lock check inside `functions/api/photos.js`, or
  inside any store action. This project's established convention (see
  `updateMachineCapacity`/`updateKaizen`) enforces locking at the UI
  `disabled` level only; the existing lock check in
  `functions/api/files.js`'s `onRequestPut` already protects the actual
  chart-content Save that would persist a new photo key.
- Do not create the real Production R2 bucket, run any `npx wrangler r2 …`
  command, or run `wrangler pages deploy`/`publish`. Claude is creating and
  wiring the real bucket separately, outside this handoff.
- Do not modify the existing Phase 5b-1 comparison section or
  `src/lib/kaizen-compare.ts` in any way.
- Do not add a dedicated Save button, new global persistence path, or
  auto-save-on-upload-completion side effect beyond calling `patchRow`/
  `patchKaizen` with the new key — the existing global TopBar "☁ Save"
  flow is what actually persists the chart content, exactly like every
  other field.
- If this turns out to require touching a file outside REQUIRED SCOPE, or
  changing any existing endpoint's response shape or another module's
  behavior, STOP and report `PLAN_CHANGE_REQUIRED` with the specific
  reason.
- Do not commit, push, deploy, or run any git-mutating command.

IMPLEMENTATION PLAN

1. wrangler.toml — add, mirroring the existing `[[d1_databases]]` block's
   comment style:
   ```toml
   [[r2_buckets]]
   binding      = "PHOTOS"          # ตัวแปรอ้างอิงในโค้ด (context.env.PHOTOS)
   bucket_name  = "mm-chart-photos" # ชื่อ R2 bucket บน Cloudflare
   ```

2. src/types/index.ts — add exactly one optional field to each existing
   interface (do not touch any other field):
   ```ts
   export interface TimeStudyRow {
     id: string;
     seq: number;
     jobElement: string;
     operator: OperatorType;
     kind: TimeStudyKind;
     category?: 'periodical' | 'changeover';
     readings: (number | null)[];
     /** R2 object key for this row's reference photo ("PIC"), or null/absent
      * if none uploaded. Exactly one photo per row — no list. */
     photoKey?: string | null;
   }
   ```
   and, inside `KaizenSheet`:
   ```ts
   export interface KaizenSheet {
     problem: string;
     solution: string;
     beforeNote: string;
     afterNote: string;
     /** R2 object keys for the Before/After photos (Phase 5b-3). Exactly
      * one photo per side, supplementing beforeNote/afterNote — not
      * replacing them. */
     beforePhotoKey?: string | null;
     afterPhotoKey?: string | null;
     details: KaizenDetailRow[];
     result: string;
     responsiblePerson: string;
     dueDate: string;
   }
   ```
   No change to `ChartFile`, `RevisionSnapshotContent`, or `ChartStep` is
   needed — `timeStudy` and `kaizen` are already whole-object fields on
   both, so the new nested keys ride along automatically (verify this by
   reading step 4 below; add the test in step 9 to prove it, don't just
   assume it).

3. functions/api/photos.js (NEW) — mirror `files.js`'s helper style
   exactly:
   ```js
   /* ==========================================================================
      CLOUDFLARE PAGES FUNCTION — /api/photos
      POST ?chartId=xxx   → upload a photo (multipart/form-data, field "photo")
      GET  ?key=xxx        → fetch a stored photo by key
      ========================================================================== */

   const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
   const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

   export async function onRequestPost(context) {
     const { env, request } = context;
     try {
       const url = new URL(request.url);
       const chartId = url.searchParams.get('chartId');
       if (!chartId) return badRequest('chartId query param required');

       const chart = await env.DB.prepare('SELECT 1 FROM chart_files WHERE id = ?').bind(chartId).first();
       if (!chart) return badRequest('chartId does not reference an existing chart');

       const formData = await request.formData();
       const file = formData.get('photo');
       if (!file || typeof file.arrayBuffer !== 'function') return badRequest('photo file required');

       const ext = ALLOWED_TYPES[file.type];
       if (!ext) return badRequest('unsupported image type — jpeg, png, or webp only');
       if (file.size > MAX_BYTES) return badRequest(`photo exceeds ${MAX_BYTES / (1024 * 1024)}MB limit`);

       const key = `${chartId}/${crypto.randomUUID()}.${ext}`;
       await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
       return json({ key });
     } catch (err) {
       return error(err);
     }
   }

   export async function onRequestGet(context) {
     const { env, request } = context;
     try {
       const url = new URL(request.url);
       const key = url.searchParams.get('key');
       if (!key) return badRequest('key query param required');

       const object = await env.PHOTOS.get(key);
       if (!object) return json({ error: 'not found' }, 404);

       const headers = new Headers();
       object.writeHttpMetadata(headers);
       headers.set('etag', object.httpEtag);
       headers.set('Cache-Control', 'public, max-age=31536000, immutable');
       return new Response(object.body, { headers });
     } catch (err) {
       return error(err);
     }
   }

   // ── Helpers ────────────────────────────────────────────────────────────────
   function json(data, status = 200) {
     return new Response(JSON.stringify(data), {
       status,
       headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
     });
   }
   function error(err)      { return json({ error: err.message }, 500); }
   function badRequest(msg) { return json({ error: msg }, 400); }
   ```
   `crypto.randomUUID()` is a Workers-runtime global — no `uuid` import
   needed in this file. Adjust only if something you read contradicts this
   (e.g. a different existing convention for generating IDs server-side);
   otherwise implement as-is.

4. src/lib/storage.ts — add near `SaveFileResult`/`saveFileCloud`, using
   the same `apiFetch` helper already defined in this file:
   ```ts
   export type UploadPhotoResult =
     | { ok: true; key: string }
     | { ok: false; error: string };

   export async function uploadPhotoCloud(chartId: string, file: File): Promise<UploadPhotoResult> {
     try {
       const formData = new FormData();
       formData.append('photo', file);
       const res = await apiFetch(`/api/photos?chartId=${encodeURIComponent(chartId)}`, {
         method: 'POST',
         body: formData,
       });
       if (!res || typeof res.key !== 'string') {
         return { ok: false, error: 'upload did not return a photo key' };
       }
       return { ok: true, key: res.key };
     } catch (err) {
       return { ok: false, error: err instanceof Error ? err.message : String(err) };
     }
   }

   export function photoUrl(key: string): string {
     return `/api/photos?key=${encodeURIComponent(key)}`;
   }
   ```
   Do not touch `chartFileContent()` or any other function in this file —
   confirm (and state in your handoff report) that this is genuinely
   sufficient, per the reasoning in step 2.

5. src/store/useChartStore.ts — the ONLY change here is inside
   `emptyKaizenSheet()`: add `beforePhotoKey: null, afterPhotoKey: null` to
   its returned object, matching how every other field there is already
   fully populated (not left `undefined`). Do not add any new store
   action — `updateTimeStudy`/`updateKaizen` already handle this via the
   components' own `patchRow`/`patchKaizen` helpers. Do not change
   `makeEmptyRow` in `time-study.ts` — mirror how the existing optional
   `category` field is already left unset there rather than explicitly
   initialized, for the same reason.

6. src/components/shared/PhotoSlot.tsx (NEW) — a small reusable component
   used by both Module 1 and Module 6:
   - Props: `{ chartId: string; photoKey: string | null | undefined; onChange: (key: string) => void; disabled?: boolean; alt?: string }`.
   - If `photoKey` is set: render a thumbnail `<img src={photoUrl(photoKey)} />`
     (reasonable fixed size, e.g. ~64-96px, rounded corners, border,
     `object-cover`) that opens the file picker on click to replace it.
   - If not set: render a compact dashed-border placeholder box with an
     upload affordance (icon + short label, e.g. a `lucide-react` camera/
     upload icon) that opens the file picker on click.
   - Use a hidden `<input type="file" accept="image/jpeg,image/png,image/webp" />`
     triggered via a ref, consistent with how this codebase already
     triggers hidden interactions elsewhere.
   - On file selection: call `uploadPhotoCloud(chartId, file)`; show a
     lightweight loading state (e.g. dim the thumbnail + small spinner)
     while the request is in flight and ignore further clicks until it
     resolves; on success call `onChange(result.key)`; on failure show a
     brief inline error near the control (small red text is sufficient)
     without discarding the previous `photoKey`.
   - Respect `disabled` — no click handler fires, visually match this
     project's existing `disabled:opacity-50 disabled:cursor-not-allowed`
     convention.
   - Match this codebase's existing Tailwind conventions (rounded-lg,
     slate/border color palette) — do not invent a new visual style.

7. src/components/modules/Module1_TimeMeasurement.tsx:
   - Import `PhotoSlot` from `@/components/shared/PhotoSlot`.
   - Add a new `<th>PIC</th>` immediately after the "Job Element" header
     and before "Worker" (a narrow fixed-width column is fine, e.g.
     `w-20`).
   - Add a matching `<td>` in the row-rendering `.map()`, in the same
     position, rendering:
     ```tsx
     <PhotoSlot
       chartId={activeFile.id}
       photoKey={row.photoKey}
       onChange={key => patchRow(row.id, { photoKey: key })}
       disabled={isLocked}
     />
     ```
   - Update the empty-state row's `colSpan={study.readingCount + 11}` to
     `colSpan={study.readingCount + 12}` (one more column now).
   - Do not touch anything else in this file (row logic, paste handling,
     totals, cross-check panel).

8. src/components/modules/Module6_Kaizen.tsx:
   - Import `PhotoSlot` from `@/components/shared/PhotoSlot`.
   - In the existing "Before and After" section (around line 269-295),
     inside each of the two `<label>` blocks, add a `PhotoSlot` directly
     above the existing `<textarea>`:
     ```tsx
     <PhotoSlot
       chartId={activeFile.id}
       photoKey={kaizen.beforePhotoKey}
       onChange={key => patchKaizen({ beforePhotoKey: key })}
       disabled={isLocked}
     />
     ```
     (mirrored for `afterPhotoKey`/`afterNote` in the After block).
   - Update both textareas' placeholder text — remove "…photo attachment
     coming in a later phase" (that phase is now this one) and replace with
     a plain description placeholder, e.g. "Describe the before state…" /
     "Describe the after state…".
   - Do not touch the existing Phase 5b-1 comparison section below this
     one, or anything in Cards 1/3/4 (Problem/Solution, Details, Result).

9. Tests — tests/storage.test.cjs:
   - Add a test for `uploadPhotoCloud` mirroring the existing fetch-mock
     pattern in this file (mock a successful `{ key: '...' }` JSON
     response; assert the returned `{ ok: true, key }`; then mock a
     non-ok response and assert `{ ok: false, error }` — mirror however
     `saveFileCloud`'s own test already covers both branches).
   - Add a test for `photoUrl('abc')` returning the expected
     `/api/photos?key=abc` string (and confirm it URL-encodes a key that
     needs it, e.g. one containing `/`).
   - Add a test proving `chartFileContent()` needs no changes: build a
     `ChartFile` fixture with `timeStudy.rows[0].photoKey` and
     `kaizen.beforePhotoKey`/`afterPhotoKey` populated, call
     `chartFileContent()`, and assert those nested values are present
     unchanged in the result — this is the concrete proof for the claim in
     step 2/4, not just a comment.

ACCEPTANCE CRITERIA
1. `wrangler.toml` has a new `[[r2_buckets]]` block (`binding = "PHOTOS"`,
   `bucket_name = "mm-chart-photos"`) matching the existing
   `[[d1_databases]]` formatting style.
2. `TimeStudyRow.photoKey` and `KaizenSheet.beforePhotoKey`/
   `afterPhotoKey` are optional; every existing chart/row without them
   still opens, renders, and saves without error.
3. `functions/api/photos.js` exports `onRequestPost` (validates `chartId`
   references a real `chart_files` row, validates image type against
   jpeg/png/webp and the 8MB size cap, stores under
   `{chartId}/{uuid}.{ext}`, returns `{ key }`) and `onRequestGet`
   (streams the object back with correct content-type via
   `writeHttpMetadata` and a long-lived immutable cache header, JSON 404 if
   missing). No `onRequestDelete` exists in this file.
4. `chartFileContent()` in `storage.ts` is unchanged, and the new test
   proves the nested photo fields survive it anyway.
5. `src/lib/storage.ts` has `uploadPhotoCloud` (mirroring `SaveFileResult`'s
   ok/error union style) and `photoUrl`.
6. `src/components/shared/PhotoSlot.tsx` exists and is used by both
   Module 1 and Module 6 — not two separate copies of similar logic.
7. M1's table has a new "PIC" column between Job Element and Worker; the
   photo does not appear anywhere in `ChartStep`, `time-study.ts`'s bridge
   functions, or M2/M3/M4/M5.
8. M6's Before/After section shows one photo slot above each textarea,
   wired to `beforePhotoKey`/`afterPhotoKey`; the stale "coming in a later
   phase" placeholder text is gone.
9. Every new/changed control is `disabled` exactly when
   `activeFile.lockedAt` is truthy, matching the established pattern.
10. No multi-photo/list/gallery support exists anywhere; no delete
    endpoint or R2 cleanup logic exists anywhere.
11. The existing Phase 5b-1 comparison section is byte-for-byte unchanged
    in behavior — diff review must show only additive changes to
    `Module6_Kaizen.tsx`.
12. Every existing test continues to pass unmodified.
13. `node --test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
    `git diff --check` all pass. Lint shows only the known pre-existing
    baseline — zero new errors in any file you touched.

VERIFICATION — run exactly these, report exact output
- git status --short --branch
- node --test
- npm run lint
- npx tsc --noEmit
- npm run build
- git diff --check
- Best-effort manual check: this phase's new upload/fetch behavior needs
  real Cloudflare Pages Functions + a local R2 simulation, which plain
  `next dev` cannot serve (the same limitation noted in prior phases'
  handoffs — `/api/folders` 404s there). If your environment has a working
  local Pages Dev setup, start it, open any chart, try uploading a photo
  in both the M1 PIC column and M6's Before/After section, confirm the
  thumbnail appears, reload the page and confirm it persists after a Save,
  and confirm every new control is visibly disabled on a locked chart. If
  your environment cannot run Pages Dev, state that plainly instead of
  guessing — Claude will do the full live local-D1+R2 round-trip
  verification afterward (upload, save, reload, close a Revision, confirm
  the frozen snapshot still resolves the photo), the same way prior
  UI-facing phases were verified.

SESSION RECORDS
Append a new entry to CHANGELOG_AI.md (do not edit older entries) recording:
files changed, the exact `TimeStudyRow.photoKey`/`KaizenSheet.beforePhotoKey`/
`afterPhotoKey` shapes as actually implemented (note any deliberate
deviation from this prompt and why), the `functions/api/photos.js`
contract, the `uploadPhotoCloud`/`photoUrl` contract, and the verification
results above. Explicitly state: this combines Phase 5b-3 (Kaizen Before/
After photos) with the new M1 PIC column under one shared R2 upload
mechanism per the user's explicit request; the M1 photo does not flow
through the M1↔M4 bridge; no delete/cleanup logic exists by design; the
real Production R2 bucket does not exist yet (Claude is creating it
separately) and nothing here required it; and no commit, push, deploy, or
Production/schema change of any kind occurred.

REQUIRED HANDOFF OUTPUT — report this back to Claude, not the user
- STATUS: IMPLEMENTED / TESTS_FAILED / PLAN_CHANGE_REQUIRED / BLOCKED
- Exact files read
- Exact files changed (must match REQUIRED SCOPE exactly)
- The exact final `TimeStudyRow`/`KaizenSheet`/`functions/api/photos.js`/
  `storage.ts` contracts (confirm they match the plan or note any
  deliberate deviation and why)
- Exact test/lint/tsc/build/diff-check output
- Manual verification result, stating plainly what you were and were not
  able to check in your environment (especially whether local Pages Dev +
  R2 simulation worked at all)
- Any scope question or ambiguity you hit and how you resolved it, or why
  you stopped instead
- Explicit statement: no commit, push, deploy, real R2 bucket creation, or
  Production/schema/API change occurred
- Next action: return this handoff to Claude for review. Do not proceed to
  any further phase or release/migration action yourself.
```
