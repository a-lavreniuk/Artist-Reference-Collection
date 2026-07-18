/**
 * Upload local release assets (dist-electron/_gitlab-mirror) to GitLab via Generic Packages
 * (project /uploads rejects ~500MB installers with 413).
 *
 * Requires GITLAB_TOKEN. Default version 0.1.8, project 84578247.
 */
import { spawnSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = process.env.ARC_GITLAB_PROJECT_ID || '84578247';
const VERSION = (process.env.ARC_RELEASE_VERSION || '0.1.8').replace(/^v/, '');
const TAG = VERSION;
const token = process.env.GITLAB_TOKEN?.trim();
const GITLAB_HOST = 'https://gitlab.com';
const API = `${GITLAB_HOST}/api/v4`;

if (!token) {
  console.error('GITLAB_TOKEN required');
  process.exit(1);
}

const workDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist-electron/_gitlab-mirror');

async function gitlab(pathname, { method = 'GET', body } = {}) {
  const headers = { 'PRIVATE-TOKEN': token };
  let payload;
  if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${pathname}`, { method, headers, body: payload });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitLab ${res.status} ${method} ${pathname}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function packageUrl(fileName) {
  return `${API}/projects/${encodeURIComponent(PROJECT_ID)}/packages/generic/releases/${VERSION}/${encodeURIComponent(fileName)}`;
}

function uploadViaCurl(filePath, fileName) {
  const url = packageUrl(fileName);
  console.log(`  PUT ${url}`);
  // curl.exe on Windows handles large binary uploads reliably
  const result = spawnSync(
    'curl.exe',
    [
      '--fail',
      '--show-error',
      '--silent',
      '--header',
      `PRIVATE-TOKEN: ${token}`,
      '--upload-file',
      filePath,
      url
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    throw new Error(`curl upload failed for ${fileName}: ${result.stderr || result.stdout || result.error}`);
  }
  console.log(`  uploaded ${fileName}: ${result.stdout || 'ok'}`);
  return url;
}

const project = await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}`);
const ref = project.default_branch || 'main';
console.log(`Project ${project.path_with_namespace}, ref=${ref}, tag=${TAG}`);

try {
  await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}/releases/${encodeURIComponent(TAG)}`);
  console.log(`Release ${TAG} exists`);
} catch {
  console.log(`Creating release ${TAG}…`);
  await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}/releases`, {
    method: 'POST',
    body: {
      name: VERSION,
      tag_name: TAG,
      ref,
      description: `Mirrored from GitHub v${VERSION}`
    }
  });
}

// Existing links — delete then recreate so re-runs replace incomplete mirrors
try {
  const release = await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}/releases/${encodeURIComponent(TAG)}`);
  for (const link of release.assets?.links || []) {
    console.log(`Removing old link ${link.name} (id ${link.id})…`);
    await gitlab(
      `/projects/${encodeURIComponent(PROJECT_ID)}/releases/${encodeURIComponent(TAG)}/assets/links/${link.id}`,
      { method: 'DELETE' }
    );
  }
} catch {
  /* no release yet */
}

const names = (await readdir(workDir)).sort();
for (const name of names) {
  const filePath = path.join(workDir, name);
  const s = await stat(filePath);
  if (!s.isFile()) continue;
  console.log(`Uploading ${name} (${s.size} bytes) via generic package…`);
  const assetUrl = uploadViaCurl(filePath, name);
  await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}/releases/${encodeURIComponent(TAG)}/assets/links`, {
    method: 'POST',
    body: { name, url: assetUrl, link_type: 'package' }
  });
  console.log(`  linked ${name}`);
}

const latest = await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}/releases/permalink/latest`);
console.log('Done. latest tag:', latest.tag_name);
console.log(
  'assets:',
  (latest.assets?.links || []).map((l) => `${l.name} -> ${l.direct_asset_url || l.url}`).join('\n  ')
);
console.log(`URL: ${GITLAB_HOST}/${project.path_with_namespace}/-/releases/${TAG}`);
