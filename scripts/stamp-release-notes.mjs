import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const notesPath = path.join(root, 'release-notes.json');
const rawDate = process.env.BUILD_DATE?.trim();
const buildDate = rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const notes = JSON.parse(await readFile(notesPath, 'utf8'));

if (notes[version]) {
  notes[version].buildDate = buildDate;
} else {
  notes[version] = {
    buildDate,
    changes: ['Сборка без описания изменений — дополните release-notes.json']
  };
}

await writeFile(notesPath, `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
console.log(`release-notes.json: ${version} → buildDate ${buildDate}`);
