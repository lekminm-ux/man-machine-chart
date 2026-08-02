/* ==========================================================================
   CLOUDFLARE PAGES FUNCTION — /api/folders
   GET    → list all folders
   POST   → create folder
   PUT    → rename / toggle expanded
   DELETE → delete folder (cascades to files via FK)
   ========================================================================== */

export async function onRequestGet(context) {
  const { env } = context;
  try {
    // Named columns (not SELECT *) so a database that's missing parentId
    // fails loudly with a clear schema-unavailable error instead of just
    // omitting the field. No schema write happens here — a database that
    // needs the column added is a migration decision, not something a GET
    // handler self-heals.
    const { results } = await env.DB.prepare(
      'SELECT id, parentId, name, processType, expanded, createdAt FROM folders ORDER BY createdAt ASC'
    ).all();
    return json(results);
  } catch (err) {
    if (/no such column/i.test(err.message)) {
      return json({ error: 'schema-unavailable: folders.parentId column is missing' }, 409);
    }
    return error(err);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const { id, parentId, name, processType, expanded, createdAt } = await request.json();
    if (!id || !name) return badRequest('id and name are required');
    if (parentId != null) {
      const parent = await env.DB.prepare('SELECT 1 FROM folders WHERE id = ?').bind(parentId).first();
      if (!parent) return badRequest('parentId does not reference an existing folder');
    }
    await env.DB.prepare(
      'INSERT INTO folders (id, parentId, name, processType, expanded, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, parentId ?? null, name, processType ?? 'custom', expanded ? 1 : 0, createdAt ?? new Date().toISOString()).run();
    return json({ success: true });
  } catch (err) {
    return error(err);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  try {
    const { id, parentId, name, expanded } = await request.json();
    if (!id) return badRequest('id is required');
    const updates = [];
    const binds = [];
    if (parentId !== undefined) {
      if (parentId != null) {
        if (parentId === id) return badRequest('a folder cannot be its own parent');
        const parent = await env.DB.prepare('SELECT 1 FROM folders WHERE id = ?').bind(parentId).first();
        if (!parent) return badRequest('parentId does not reference an existing folder');
        if (await wouldCreateCycle(env, id, parentId)) {
          return badRequest('cannot move a folder into its own descendant');
        }
      }
      updates.push('parentId = ?'); binds.push(parentId);
    }
    if (name !== undefined)     { updates.push('name = ?');     binds.push(name); }
    if (expanded !== undefined) { updates.push('expanded = ?'); binds.push(expanded ? 1 : 0); }
    if (updates.length === 0)   return badRequest('nothing to update');
    binds.push(id);
    await env.DB.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
    return json({ success: true });
  } catch (err) {
    return error(err);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  try {
    const url  = new URL(request.url);
    const id   = url.searchParams.get('id');
    if (!id) return badRequest('id query param required');

    // Live Production has no self-referencing FK on folders.parentId (it was
    // added later via ALTER TABLE, which SQLite cannot attach a same-table FK
    // to), so nothing enforces this at the database level — it must be
    // enforced here. Deleting a folder that still has children would silently
    // orphan them (still present in the table, but unreachable from the root
    // tree), which reads as data loss to the user even though no row is gone.
    const childFolder = await env.DB.prepare('SELECT 1 FROM folders WHERE parentId = ? LIMIT 1').bind(id).first();
    if (childFolder) return conflict('folder has child folders; move or delete them first');

    const childFile = await env.DB.prepare('SELECT 1 FROM chart_files WHERE folderId = ? LIMIT 1').bind(id).first();
    if (childFile) return conflict('folder has chart files; move or delete them first');

    await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(id).run();
    return json({ success: true });
  } catch (err) {
    return error(err);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Walks the parentId chain from `proposedParentId` upward, looking for
// `folderId`. A bounded walk (not unbounded recursion/looping) so a corrupt
// or accidentally-cyclic chain already in the database can't hang the
// request — it's treated as an unsafe move rather than trusted.
const MAX_FOLDER_DEPTH_WALK = 100;
async function wouldCreateCycle(env, folderId, proposedParentId) {
  let current = proposedParentId;
  let hops = 0;
  while (current) {
    if (current === folderId) return true;
    if (++hops > MAX_FOLDER_DEPTH_WALK) return true;
    const row = await env.DB.prepare('SELECT parentId FROM folders WHERE id = ?').bind(current).first();
    if (!row) return false;
    current = row.parentId;
  }
  return false;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
function error(err) {
  return json({ error: err.message }, 500);
}
function badRequest(msg) {
  return json({ error: msg }, 400);
}
function conflict(msg) {
  return json({ error: msg }, 409);
}
