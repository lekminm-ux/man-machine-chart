/* Recoverable chart and folder trash. A warning must be acknowledged in the
   app at least seven days before the scheduled worker can purge an entry. */

const WARNING_MS = 7 * 24 * 60 * 60 * 1000;

export async function onRequestGet({ env }) {
  try {
    const [entries, folders, files] = await Promise.all([
      env.DB.prepare(
        'SELECT id, kind, rootId, name, deletedAt, expiresAt, warnedAt, purgeStartedAt FROM trash_entries WHERE restoredAt IS NULL AND purgedAt IS NULL ORDER BY deletedAt DESC'
      ).all(),
      env.DB.prepare("SELECT m.memberId AS id FROM trash_members m JOIN trash_entries t ON t.id = m.trashId WHERE m.kind = 'folder' AND t.restoredAt IS NULL").all(),
      env.DB.prepare("SELECT m.memberId AS id FROM trash_members m JOIN trash_entries t ON t.id = m.trashId WHERE m.kind = 'file' AND t.restoredAt IS NULL").all(),
    ]);
    return json({
      entries: entries.results,
      hiddenFolderIds: folders.results.map(row => row.id),
      hiddenFileIds: files.results.map(row => row.id),
    });
  } catch (err) {
    return error(err);
  }
}

export async function onRequestPost({ env, request }) {
  try {
    const { action, id } = await request.json();
    if (!id || !['acknowledge', 'restore'].includes(action)) return json({ error: 'valid action and id required' }, 400);
    const entry = await env.DB.prepare(
      'SELECT id, kind, rootId, expiresAt, warnedAt, purgeStartedAt FROM trash_entries WHERE id = ? AND restoredAt IS NULL AND purgedAt IS NULL'
    ).bind(id).first();
    if (!entry) return json({ error: 'trash entry not found' }, 404);
    if (entry.purgeStartedAt) return json({ error: 'permanent deletion has already started' }, 409);

    if (action === 'acknowledge') {
      const now = new Date();
      if (now.getTime() < new Date(entry.expiresAt).getTime() - WARNING_MS) {
        return json({ error: 'warning is available in the last seven days of retention' }, 409);
      }
      const warnedAt = entry.warnedAt || now.toISOString();
      if (!entry.warnedAt) {
        await env.DB.prepare(
          'UPDATE trash_entries SET warnedAt = ? WHERE id = ? AND warnedAt IS NULL AND purgeStartedAt IS NULL'
        ).bind(warnedAt, id).run();
      }
      return json({ success: true, id, warnedAt });
    }

    if (entry.kind === 'file') {
      const file = await env.DB.prepare('SELECT folderId FROM chart_files WHERE id = ? AND trashId = ?')
        .bind(entry.rootId, id).first();
      if (!file) return json({ error: 'trashed chart is missing' }, 409);
      const parent = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND trashId IS NULL')
        .bind(file.folderId).first();
      if (!parent) return json({ error: 'restore the parent folder first' }, 409);
    } else {
      const folder = await env.DB.prepare('SELECT parentId FROM folders WHERE id = ? AND trashId = ?')
        .bind(entry.rootId, id).first();
      if (!folder) return json({ error: 'trashed folder is missing' }, 409);
      if (folder.parentId) {
        const parent = await env.DB.prepare('SELECT id FROM folders WHERE id = ? AND trashId IS NULL')
          .bind(folder.parentId).first();
        if (!parent) return json({ error: 'restore the parent folder first' }, 409);
      }
    }

    const restoredAt = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('UPDATE folders SET trashId = NULL WHERE trashId = ?').bind(id),
      env.DB.prepare('UPDATE chart_files SET trashId = NULL WHERE trashId = ?').bind(id),
      env.DB.prepare('UPDATE trash_entries SET restoredAt = ? WHERE id = ? AND purgeStartedAt IS NULL AND restoredAt IS NULL')
        .bind(restoredAt, id),
    ]);
    return json({ success: true, id, restoredAt });
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
function error(err) { return json({ error: err.message }, 500); }
