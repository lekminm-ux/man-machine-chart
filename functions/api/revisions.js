/* Cloudflare Pages Function — /api/revisions */

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const chartFileId = url.searchParams.get('chartFileId');

    if (id) {
      const row = await env.DB.prepare(
        'SELECT * FROM revision_snapshots WHERE id = ?'
      ).bind(id).first();
      if (!row) return json({ error: 'not found' }, 404);
      return json({ ...row, content: JSON.parse(row.content) });
    }

    if (chartFileId) {
      const { results } = await env.DB.prepare(
        'SELECT id, chartFileId, revNo, closedAt FROM revision_snapshots WHERE chartFileId = ? ORDER BY closedAt DESC'
      ).bind(chartFileId).all();
      return json(results);
    }

    return badRequest('id or chartFileId query param required');
  } catch (err) {
    return error(err);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const { id, chartFileId, revNo } = await request.json();
    if (!id || !chartFileId || typeof revNo !== 'string' || !revNo.trim()) {
      return badRequest('id, chartFileId, and non-empty revNo are required');
    }

    const row = await env.DB.prepare(
      'SELECT id, content, lockedAt FROM chart_files WHERE id = ?'
    ).bind(chartFileId).first();
    if (!row) return json({ error: 'not found' }, 404);
    if (row.lockedAt != null) {
      return conflict('this chart is already locked — open a new revision before closing again');
    }

    const normalizedRevNo = revNo.trim();
    const closedAt = new Date().toISOString();

    try {
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO revision_snapshots (id, chartFileId, revNo, content, closedAt) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, chartFileId, normalizedRevNo, row.content, closedAt),
        env.DB.prepare(
          'UPDATE chart_files SET lockedAt = ? WHERE id = ? AND lockedAt IS NULL'
        ).bind(closedAt, chartFileId),
      ]);
    } catch (err) {
      if (/UNIQUE constraint failed:\s*revision_snapshots\.chartFileId,\s*revision_snapshots\.revNo|idx_revision_snapshots_unique/i.test(err.message || '')) {
        return conflict(`revision "${normalizedRevNo}" was already closed for this chart — choose a different Rev No.`);
      }
      return error(err);
    }

    return json({
      success: true,
      snapshot: { id, chartFileId, revNo: normalizedRevNo, closedAt },
    });
  } catch (err) {
    return error(err);
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  try {
    const { chartFileId } = await request.json();
    if (!chartFileId) return badRequest('chartFileId required');

    const row = await env.DB.prepare(
      'SELECT lockedAt FROM chart_files WHERE id = ?'
    ).bind(chartFileId).first();
    if (!row) return json({ error: 'not found' }, 404);
    if (row.lockedAt == null) return conflict('this chart is not currently locked');

    await env.DB.prepare(
      'UPDATE chart_files SET lockedAt = NULL WHERE id = ?'
    ).bind(chartFileId).run();

    return json({ success: true, chartFileId });
  } catch (err) {
    return error(err);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
function error(err)      { return json({ error: err.message }, 500); }
function badRequest(msg) { return json({ error: msg }, 400); }
function conflict(msg)   { return json({ error: msg }, 409); }
