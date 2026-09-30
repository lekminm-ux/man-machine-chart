// Read-only Production API export. Run with NODE_USE_SYSTEM_CA=1 when the host
// uses an enterprise TLS root; never disable certificate verification.
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const origin = 'https://man-machine-chart.pages.dev';
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) {
  throw new Error('Provide an absolute destination outside the repository');
}
const target = path.resolve(destination);
if (target.toLowerCase().startsWith(path.resolve(process.cwd()).toLowerCase() + path.sep)) {
  throw new Error('Backup destination must be outside the repository');
}

async function getJson(endpoint) {
  const response = await fetch(`${origin}${endpoint}`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  return response.json();
}
const sha = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const folders = await getJson('/api/folders');
const metadata = await getJson('/api/files?all=1');
if (!Array.isArray(folders) || !Array.isArray(metadata)) throw new Error('Unexpected list response');
const folderIds = new Set(folders.map(folder => folder.id));
if (folderIds.size !== folders.length || new Set(metadata.map(file => file.id)).size !== metadata.length) {
  throw new Error('Duplicate folder or chart IDs');
}
for (const folder of folders) {
  if (folder.parentId && !folderIds.has(folder.parentId)) throw new Error(`Missing parent: ${folder.id}`);
}
for (const file of metadata) {
  if (!folderIds.has(file.folderId)) throw new Error(`Missing file folder: ${file.id}`);
}
const depthOf = (id, seen = new Set()) => {
  if (seen.has(id)) throw new Error(`Folder cycle: ${id}`);
  const folder = folders.find(item => item.id === id);
  if (!folder) throw new Error(`Folder missing: ${id}`);
  return folder.parentId ? 1 + depthOf(folder.parentId, new Set([...seen, id])) : 1;
};
const maxFolderDepth = Math.max(0, ...folders.map(folder => depthOf(folder.id)));

const charts = [];
const revisions = [];
const photoKeys = new Set();
function collectPhotos(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (/photoKey$/i.test(key) && typeof item === 'string' && item) photoKeys.add(item);
    else collectPhotos(item);
  }
}
for (const file of metadata) {
  const chart = await getJson(`/api/files?id=${encodeURIComponent(file.id)}`);
  if (chart.id !== file.id || chart.folderId !== file.folderId || !chart.content) {
    throw new Error(`Chart mismatch: ${file.id}`);
  }
  charts.push(chart);
  collectPhotos(chart.content);
  const revisionList = await getJson(`/api/revisions?chartFileId=${encodeURIComponent(file.id)}`);
  if (!Array.isArray(revisionList)) throw new Error(`Revision list mismatch: ${file.id}`);
  for (const rev of revisionList) {
    const full = await getJson(`/api/revisions?id=${encodeURIComponent(rev.id)}`);
    if (full.id !== rev.id || full.chartFileId !== file.id || !full.content) {
      throw new Error(`Revision mismatch: ${rev.id}`);
    }
    revisions.push(full);
    collectPhotos(full.content);
  }
}

// Detect concurrent edits during capture. A changed list means the export is
// incomplete and must not be used as a migration recovery point.
const afterFolders = await getJson('/api/folders');
const afterMetadata = await getJson('/api/files?all=1');
if (sha(json(afterFolders)) !== sha(json(folders)) || sha(json(afterMetadata)) !== sha(json(metadata))) {
  throw new Error('Production changed during capture; retry when quiet');
}
await mkdir(path.join(target, 'charts'), { recursive: true });
await mkdir(path.join(target, 'revisions'), { recursive: true });
const files = [];
async function save(relative, value) {
  const body = json(value);
  const filename = path.join(target, relative);
  await writeFile(filename, body, { flag: 'wx' });
  const readback = await readFile(filename);
  if (sha(readback) !== sha(body)) throw new Error(`Backup read-back mismatch: ${relative}`);
  files.push({ path: relative, size: readback.length, sha256: sha(readback) });
}
await save('folders.json', folders);
await save('chart-files-metadata.json', metadata);
for (const chart of charts) await save(`charts/${chart.id}.json`, chart);
for (const revision of revisions) await save(`revisions/${revision.id}.json`, revision);
await save('photo-keys.json', [...photoKeys].sort());
const manifest = {
  source: `${origin} GET API`,
  databaseName: 'mm-chart-db',
  databaseId: 'c475f51c-3bcc-410a-8205-846b458c4efd',
  capturedAt: new Date().toISOString(),
  folderCount: folders.length,
  rootCount: folders.filter(folder => !folder.parentId).length,
  maxFolderDepth,
  chartCount: charts.length,
  revisionCount: revisions.length,
  photoKeyCount: photoKeys.size,
  schemaStatus: 'NOT_VERIFIED_BY_THIS_EXPORT',
  files,
};
await save('manifest.json', manifest);
console.log(JSON.stringify({ destination: target, ...manifest, files: files.length }, null, 2));
