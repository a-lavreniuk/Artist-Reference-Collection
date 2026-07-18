/**
 * Mirror the latest (or given) GitHub release assets to the public GitLab releases project.
 *
 * Requires:
 *   GITLAB_TOKEN — api scope (same secret as Actions)
 * Optional:
 *   GH_TOKEN / gh auth — only if private GitHub assets; public downloads work without it
 *   ARC_GITHUB_TAG — e.g. v0.1.8 (default: latest)
 *   ARC_GITLAB_PROJECT_ID — default 84578247
 *
 * Usage:
 *   $env:GITLAB_TOKEN="glpat-…"
 *   node scripts/mirror-github-release-to-gitlab.mjs
 */
import { createWriteStream, openAsBlob } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const GH_OWNER = 'a-lavreniuk';
const GH_REPO = 'Artist-Reference-Collection';
const GITLAB_HOST = 'https://gitlab.com';
const PROJECT_ID = process.env.ARC_GITLAB_PROJECT_ID || '84578247';
const token = process.env.GITLAB_TOKEN?.trim();

if (!token) {
  console.error('Set GITLAB_TOKEN (api scope), then re-run.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workDir = path.join(root, 'dist-electron', '_gitlab-mirror');

async function ghJson(url) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'arc-mirror' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${url}: ${await res.text()}`);
  return res.json();
}

async function gitlab(pathname, { method = 'GET', body, isForm = false } = {}) {
  const headers = { 'PRIVATE-TOKEN': token };
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${GITLAB_HOST}/api/v4${pathname}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`GitLab ${res.status} ${method} ${pathname}: ${text}`);
  }
  return json;
}

async function download(url, dest) {
  const headers = { 'User-Agent': 'arc-mirror' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  const s = await stat(dest);
  console.log(`  downloaded ${path.basename(dest)} (${s.size} bytes)`);
}

async function uploadProjectFile(filePath, fileName) {
  const blob = await openAsBlob(filePath);
  const form = new FormData();
  form.append('file', blob, fileName);
  const res = await fetch(`${GITLAB_HOST}/api/v4/projects/${encodeURIComponent(PROJECT_ID)}/uploads`, {
    method: 'POST',
    headers: { 'PRIVATE-TOKEN': token },
    body: form
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload ${fileName} failed ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function main() {
  let release;
  const tagEnv = process.env.ARC_GITHUB_TAG?.trim();
  if (tagEnv) {
    release = await ghJson(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/tags/${tagEnv}`);
  } else {
    release = await ghJson(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/latest`);
  }

  const githubTag = release.tag_name;
  const version = githubTag.replace(/^v/, '');
  // Match electron-builder.yml: vPrefixedTagName: false
  const gitlabTag = version;

  console.log(`Mirroring GitHub ${githubTag} → GitLab project ${PROJECT_ID} tag ${gitlabTag}`);
  console.log(`Assets: ${(release.assets || []).map((a) => a.name).join(', ')}`);

  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  const files = [];
  for (const asset of release.assets || []) {
    const dest = path.join(workDir, asset.name);
    console.log(`Downloading ${asset.name}…`);
    await download(asset.browser_download_url, dest);
    files.push({ name: asset.name, path: dest });
  }

  if (files.length === 0) throw new Error('No assets on GitHub release');

  // Ensure project default branch exists for release ref
  const project = await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}`);
  const ref = project.default_branch || 'main';

  // Create or find release (tag created via ref)
  let glRelease;
  try {
    glRelease = await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}/releases/${encodeURIComponent(gitlabTag)}`);
    console.log(`Release ${gitlabTag} already exists on GitLab`);
  } catch {
    console.log(`Creating GitLab release ${gitlabTag}…`);
    glRelease = await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}/releases`, {
      method: 'POST',
      body: {
        name: version,
        tag_name: gitlabTag,
        ref,
        description: `Mirrored from GitHub ${githubTag}\n\n${release.body || ''}`.slice(0, 50000)
      }
    });
  }

  for (const file of files) {
    console.log(`Uploading ${file.name}…`);
    const uploaded = await uploadProjectFile(file.path, file.name);
    // uploaded.url is site-relative like /uploads/...
    const fullUrl = uploaded.full_path
      ? `${GITLAB_HOST}${uploaded.full_path.startsWith('/') ? '' : '/'}${uploaded.full_path}`
      : uploaded.url?.startsWith('http')
        ? uploaded.url
        : `${GITLAB_HOST}${uploaded.url}`;

    await gitlab(
      `/projects/${encodeURIComponent(PROJECT_ID)}/releases/${encodeURIComponent(gitlabTag)}/assets/links`,
      {
        method: 'POST',
        body: {
          name: file.name,
          url: fullUrl,
          link_type: 'package'
        }
      }
    );
    console.log(`  linked ${file.name}`);
  }

  const latest = await gitlab(`/projects/${encodeURIComponent(PROJECT_ID)}/releases/permalink/latest`);
  console.log('');
  console.log('Done.');
  console.log(`  release: ${GITLAB_HOST}/${project.path_with_namespace}/-/releases/${gitlabTag}`);
  console.log(`  permalink/latest tag: ${latest.tag_name}`);
  console.log(`  assets: ${(latest.assets?.links || []).map((l) => l.name).join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
