import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatGithubReleaseBody } from './format-github-release-body.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

async function main() {
  const versionArg = process.argv[2]?.trim();
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const version = versionArg || pkg.version;
  const notes = JSON.parse(await readFile(path.join(root, 'release-notes.json'), 'utf8'));
  const entry = notes[version];

  if (!entry) {
    console.error(`release-notes.json: нет записи для версии ${version}`);
    process.exit(1);
  }

  const body = formatGithubReleaseBody(entry, version);
  const tag = `v${version}`;

  // Prefer API patch — `gh release edit` can 422 when duplicate tags exist (0.1.x and v0.1.x).
  const metaRaw = execFileSync('gh', ['release', 'view', tag, '--json', 'databaseId'], {
    encoding: 'utf8'
  });
  const meta = JSON.parse(metaRaw);
  const releaseId = meta.databaseId;
  if (releaseId == null) {
    throw new Error(`Cannot resolve release id for ${tag}`);
  }

  execFileSync(
    'gh',
    [
      'api',
      '-X',
      'PATCH',
      `repos/a-lavreniuk/Artist-Reference-Collection/releases/${releaseId}`,
      '-f',
      `body=${body}`
    ],
    { stdio: 'inherit' }
  );

  console.log(`GitHub Release ${tag}: описание обновлено`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
