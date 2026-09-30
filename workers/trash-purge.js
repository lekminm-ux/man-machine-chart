// Daily purge for trash entries that have spent at least 90 days in Trash and
// whose in-app warning was acknowledged at least seven days ago. No HTTP route.
const worker = {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(purgeExpired(env, new Date()));
  },
};
export default worker;

export async function purgeExpired(env, now) {
  if (!env.DB || !env.PHOTOS) throw new Error('DB and PHOTOS bindings are required');
  const nowIso = now.toISOString();
  const warningCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    'SELECT id, kind FROM trash_entries WHERE restoredAt IS NULL AND purgedAt IS NULL AND expiresAt <= ? AND warnedAt IS NOT NULL AND warnedAt <= ? ORDER BY expiresAt ASC LIMIT 20'
  ).bind(nowIso, warningCutoff).all();
  for (const entry of results) {
    try {
      await purgeOne(env, entry, nowIso);
    } catch (err) {
      console.error('Trash purge failed for entry', entry.id, err);
    }
  }
}

async function purgeOne(env, entry, nowIso) {
  if (entry.kind === 'folder') {
    // A child or chart trashed separately may still be inside its own 90-day
    // window. Never let folder FK cascade shorten that independent retention.
    const otherFolder = await env.DB.prepare(
      "SELECT 1 FROM folders WHERE parentId IN (SELECT id FROM folders WHERE trashId = ?) AND COALESCE(trashId, '') <> ? LIMIT 1"
    ).bind(entry.id, entry.id).first();
    const otherFile = await env.DB.prepare(
      "SELECT 1 FROM chart_files WHERE folderId IN (SELECT id FROM folders WHERE trashId = ?) AND COALESCE(trashId, '') <> ? LIMIT 1"
    ).bind(entry.id, entry.id).first();
    if (otherFolder || otherFile) return;
  }

  await env.DB.prepare(
    'UPDATE trash_entries SET purgeStartedAt = COALESCE(purgeStartedAt, ?) WHERE id = ? AND restoredAt IS NULL AND purgedAt IS NULL'
  ).bind(nowIso, entry.id).run();

  const { results: charts } = await env.DB.prepare('SELECT id FROM chart_files WHERE trashId = ?')
    .bind(entry.id).all();
  for (const chart of charts) await deleteChartPhotos(env.PHOTOS, chart.id);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM chart_files WHERE trashId = ?').bind(entry.id),
    env.DB.prepare('DELETE FROM folders WHERE trashId = ?').bind(entry.id),
    env.DB.prepare('UPDATE trash_entries SET purgedAt = ? WHERE id = ? AND restoredAt IS NULL')
      .bind(nowIso, entry.id),
  ]);
}

async function deleteChartPhotos(bucket, chartId) {
  let cursor;
  do {
    const page = await bucket.list({ prefix: `${chartId}/`, cursor });
    for (const object of page.objects) await bucket.delete(object.key);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
