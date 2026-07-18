/**
 * Creates a public GitLab project for ARC release artifacts (not a full source mirror).
 *
 * Usage:
 *   set GITLAB_TOKEN=<Personal or Project Access Token with api scope>
 *   node scripts/create-gitlab-releases-mirror.mjs
 *
 * Optional:
 *   ARC_GITLAB_PROJECT_NAME=arc-releases   (default)
 *   ARC_GITLAB_UPDATE_FILES=1           (patch projectId into source + electron-builder.yml)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const token = process.env.GITLAB_TOKEN?.trim();
const projectName = (process.env.ARC_GITLAB_PROJECT_NAME || 'arc-releases').trim();
const updateFiles = process.env.ARC_GITLAB_UPDATE_FILES === '1';

if (!token) {
  console.error('GITLAB_TOKEN is required (api scope). Create at https://gitlab.com/-/user_settings/personal_access_tokens');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const res = await fetch('https://gitlab.com/api/v4/projects', {
  method: 'POST',
  headers: {
    'PRIVATE-TOKEN': token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: projectName,
    path: projectName,
    visibility: 'public',
    description:
      'Public mirror of ARC (Artist Reference Collection) release builds — installers and electron-updater metadata (latest.yml). Not a full source mirror of GitHub.',
    issues_enabled: false,
    wiki_enabled: false,
    jobs_enabled: false,
    snippets_enabled: false,
    container_registry_enabled: false,
    packages_enabled: true,
    releases_access_level: 'enabled',
    initialize_with_readme: true
  })
});

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error('Failed to create project:', res.status, body);
  process.exit(1);
}

const id = body.id;
const pathWithNamespace = body.path_with_namespace;
const webUrl = body.web_url;

console.log('Created GitLab releases mirror:');
console.log(`  id:   ${id}`);
console.log(`  path: ${pathWithNamespace}`);
console.log(`  url:  ${webUrl}`);
console.log('');
console.log('Next:');
console.log('  1. Add GITLAB_TOKEN to GitHub Actions secrets for the ARC repo.');
console.log('  2. Ensure ARC_GITLAB_RELEASES_PROJECT_ID / electron-builder.yml use this id or path.');
console.log('  3. Re-run with ARC_GITLAB_UPDATE_FILES=1 to patch files automatically.');

if (updateFiles) {
  const feedPath = path.join(root, 'src/main/updateFeedGitlab.ts');
  let feed = readFileSync(feedPath, 'utf8');
  feed = feed.replace(
    /export const ARC_GITLAB_RELEASES_PROJECT_ID: string \| number = [^;]+;/,
    `export const ARC_GITLAB_RELEASES_PROJECT_ID: string | number = ${id};`
  );
  writeFileSync(feedPath, feed, 'utf8');
  console.log(`Updated ${feedPath}`);

  const ymlPath = path.join(root, 'electron-builder.yml');
  let yml = readFileSync(ymlPath, 'utf8');
  if (/projectId:\s*.+/.test(yml) && yml.includes('provider: gitlab')) {
    yml = yml.replace(/(provider:\s*gitlab[\s\S]*?projectId:\s*)([^\n]+)/, `$1${id}`);
    writeFileSync(ymlPath, yml, 'utf8');
    console.log(`Updated ${ymlPath}`);
  } else {
    console.warn('electron-builder.yml: gitlab projectId not patched (pattern not found)');
  }
}
