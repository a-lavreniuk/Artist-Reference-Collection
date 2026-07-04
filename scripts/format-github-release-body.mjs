import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** ISO YYYY-MM-DD → DD.MM.YYYY (как в renderer/releaseNotesFormat.ts) */
function formatBuildDate(isoDate) {
  const parts = isoDate.trim().split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  }
  return isoDate;
}

export function formatGithubReleaseBody(entry, version) {
  return [
    `Версия ${version} · ${formatBuildDate(entry.buildDate)}`,
    '',
    '## Что нового',
    '',
    ...entry.changes.map((line) => `- ${line}`)
  ].join('\n');
}

async function main() {
  const notes = JSON.parse(await readFile(path.join(root, 'release-notes.json'), 'utf8'));
  const versionArg = process.argv[2]?.trim();
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const version = versionArg || pkg.version;
  const entry = notes[version];

  if (!entry) {
    console.error(`release-notes.json: нет записи для версии ${version}`);
    process.exit(1);
  }

  process.stdout.write(formatGithubReleaseBody(entry, version));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
