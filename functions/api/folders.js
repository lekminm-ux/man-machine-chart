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
      'SELECT id, parentId, name, processType, expanded, createdAt FROM folders WHERE trashId IS NULL ORDER BY createdAt ASC'
    ).all();
    return json(results);
  } catch (err) {
    if (/no such column:\s*trashId/i.test(err.message)) {
      return json({ error: 'schema-unavailable: Trash migration is missing' }, 409);
    }
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
      const parent = await env.DB.prepare('SELECT 1 FROM folders WHERE id = ? AND trashId IS NULL').bind(parentId).first();
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
        const parent = await env.DB.prepare('SELECT 1 FROM folders WHERE id = ? AND trashId IS NULL').bind(parentId).first();
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
    const result = await env.DB.prepare(`UPDATE folders SET ${updates.join(', ')} WHERE id = ? AND trashId IS NULL`).bind(...binds).run();
    if (!result?.meta || result.meta.changes === 0) return conflict('folder not found or in trash');
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

    const root = await env.DB.prepare('SELECT id, name FROM folders WHERE id = ? AND trashId IS NULL').bind(id).first();
    if (!root) return json({ error: 'folder not found or already in trash' }, 404);
    const now = new Date();
    const deletedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const trashId = crypto.randomUUID();
    const subtree = `WITH RECURSIVE descendants(id) AS (
      SELECT id FROM folders WHERE id = ? AND trashId IS NULL
      UNION ALL
      SELECT f.id FROM folders f JOIN descendants d ON f.parentId = d.id WHERE f.trashId IS NULL
    )`;
    const results = await env.DB.batch([
      env.DB.prepare('INSERT INTO trash_entries (id, kind, rootId, name, deletedAt, expiresAt) SELECT ?, ?, id, name, ?, ? FROM folders WHERE id = ? AND trashId IS NULL')
        .bind(trashId, 'folder', deletedAt, expiresAt, id),
      env.DB.prepare(`${subtree} INSERT INTO trash_members (kind, memberId, trashId) SELECT 'folder', id, ? FROM descendants`)
        .bind(id, trashId),
      env.DB.prepare(`${subtree} INSERT INTO trash_members (kind, memberId, trashId) SELECT 'file', id, ? FROM chart_files WHERE folderId IN (SELECT id FROM descendants) AND trashId IS NULL`)
        .bind(id, trashId),
      env.DB.prepare(`${subtree} UPDATE chart_files SET trashId = ? WHERE folderId IN (SELECT id FROM descendants) AND trashId IS NULL`)
        .bind(id, trashId),
      env.DB.prepare(`${subtree} UPDATE folders SET trashId = ? WHERE id IN (SELECT id FROM descendants) AND trashId IS NULL`)
        .bind(id, trashId),
    ]);
    if (results[0]?.meta?.changes !== 1 || results[4]?.meta?.changes < 1) return conflict('folder was not moved to trash');
    return json({ success: true, trashId, deletedAt, expiresAt });
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
