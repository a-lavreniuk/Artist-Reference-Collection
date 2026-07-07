import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
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
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'arc-release-'));
  const notesPath = path.join(tmpDir, 'release-body.md');
  await writeFile(notesPath, body, 'utf8');

  execFileSync('gh', ['release', 'edit', `v${version}`, '--notes-file', notesPath], {
    stdio: 'inherit'
  });

  console.log(`GitHub Release v${version}: описание обновлено`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
