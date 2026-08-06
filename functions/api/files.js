/* ==========================================================================
   CLOUDFLARE PAGES FUNCTION — /api/files
   GET    ?all=1        → list all files (metadata only, no content)
   GET    ?id=xxx       → get single file with full content
   POST               → create new file
   PUT                → save / update file (full content)
   DELETE ?id=xxx      → delete file
   ========================================================================== */

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');

    if (id) {
      // Single file with content
      const row = await env.DB.prepare(
        'SELECT * FROM chart_files WHERE id = ?'
      ).bind(id).first();
      if (!row) return json({ error: 'not found' }, 404);
      return json({ ...row, content: JSON.parse(row.content) });
    }

    // All files — metadata only (no content to keep payload small)
    const { results } = await env.DB.prepare(
      'SELECT id, name, folderId, createdAt, updatedAt FROM chart_files ORDER BY updatedAt DESC'
    ).all();
    return json(results);
  } catch (err) {
    return error(err);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const file = await request.json();
    const { id, name, folderId, createdAt, updatedAt, content } = file;
    if (!id || !name || !folderId) return badRequest('id, name, folderId required');
    const folder = await env.DB.prepare('SELECT 1 FROM folders WHERE id = ?').bind(folderId).first();
    if (!folder) return badRequest('folderId does not reference an existing folder');
    await env.DB.prepare(
      'INSERT INTO chart_files (id, name, folderId, createdAt, updatedAt, content) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      id, name, folderId,
      createdAt ?? new Date().toISOString(),
      updatedAt ?? new Date().toISOString(),
      JSON.stringify(content ?? {})
    ).run();
    return json({ success: true });
  } catch (err) {
    return error(err);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  try {
    const file = await request.json();
    const { id, name, folderId, updatedAt, content } = file;
    if (!id) return badRequest('id required');
    const existing = await env.DB.prepare(
      'SELECT lockedAt FROM chart_files WHERE id = ?'
    ).bind(id).first();
    if (existing && existing.lockedAt != null) {
      return json({
        error: 'this revision is locked — open a new revision to keep editing',
        id,
        locked: true,
      }, 409);
    }
    if (folderId != null) {
      const folder = await env.DB.prepare('SELECT 1 FROM folders WHERE id = ?').bind(folderId).first();
      if (!folder) return badRequest('folderId does not reference an existing folder');
    }
    // COALESCE keeps the stored value when a field is omitted, so a
    // rename-only request can't blank out the chart content (and vice versa).
    // folderId was previously accepted by the client (moveFile sends it) but
    // silently dropped here — a move looked successful without ever being
    // persisted. It's now applied the same COALESCE way as the other fields.
    const savedUpdatedAt = updatedAt ?? new Date().toISOString();
    const result = await env.DB.prepare(
      'UPDATE chart_files SET name = COALESCE(?, name), folderId = COALESCE(?, folderId), updatedAt = ?, content = COALESCE(?, content) WHERE id = ?'
    ).bind(
      name ?? null,
      folderId ?? null,
      savedUpdatedAt,
      content !== undefined ? JSON.stringify(content) : null,
      id
    ).run();
    // D1 reports affected rows via meta.changes. A stale or local-only id
    // (nothing to update) must not report success — that's exactly the "save
    // looked fine but nothing was actually written" failure this endpoint
    // used to allow.
    if (!result || !result.meta || result.meta.changes === 0) {
      return json({ error: 'no chart row was updated — this id does not exist in Cloud', id }, 409);
    }
    return json({ success: true, id, updatedAt: savedUpdatedAt });
  } catch (err) {
    return error(err);
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');
    if (!id) return badRequest('id query param required');
    await env.DB.prepare('DELETE FROM chart_files WHERE id = ?').bind(id).run();
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
function error(err)      { return json({ error: err.message }, 500); }
function badRequest(msg) { return json({ error: msg }, 400); }
