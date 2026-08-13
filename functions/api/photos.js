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

// ── Helpers ─────────────────────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
function error(err)      { return json({ error: err.message }, 500); }
function badRequest(msg) { return json({ error: msg }, 400); }
