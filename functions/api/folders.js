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
    // Run schema migration to add parentId column if it doesn't exist
    try {
      await env.DB.prepare(
        'ALTER TABLE folders ADD COLUMN parentId TEXT DEFAULT NULL'
      ).run();
    } catch (migErr) {
      // Ignore error if column already exists
    }

    const { results } = await env.DB.prepare(
      'SELECT * FROM folders ORDER BY createdAt ASC'
    ).all();
    return json(results);
  } catch (err) {
    return error(err);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const { id, parentId, name, processType, expanded, createdAt } = await request.json();
    if (!id || !name) return badRequest('id and name are required');
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
    if (parentId !== undefined) { updates.push('parentId = ?'); binds.push(parentId); }
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
    // Delete files in folder first (in case FK cascade not supported)
    await env.DB.prepare('DELETE FROM chart_files WHERE folderId = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(id).run();
    return json({ success: true });
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
function error(err) {
  return json({ error: err.message }, 500);
}
function badRequest(msg) {
  return json({ error: msg }, 400);
}
