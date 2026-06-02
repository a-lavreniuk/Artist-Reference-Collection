/**
 * One-off bulk rename arc-2/arc2 → arc across source files.
 * Run: node scripts/rename-arc2-to-arc.mjs
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'main', 'preload', '.git']);

const REPLACEMENTS = [
  ['arc-2-ui', 'arc-ui'],
  ['arc-2-navbar', 'arc-navbar'],
  ['arc2-moodboard.css', 'arc-moodboard.css'],
  ['hydrateArc2NavbarIcons', 'hydrateArcNavbarIcons'],
  ['Arc2AddCardsQueueStateDetail', 'ArcAddCardsQueueStateDetail'],
  ['activeArc2ModalHost', 'activeArcModalHost'],
  ['closeArc2Modal', 'closeArcModal'],
  ['ARC2_', 'ARC_'],
  ['arc2_icon_', 'arc_icon_'],
  ['arc2-metadata.json', 'arc-metadata.json'],
  ['arc2-history.json', 'arc-history.json'],
  ['arc2-pending-restore.json', 'arc-pending-restore.json'],
  ['data-arc2-', 'data-arc-'],
  ['--arc2-', '--arc-'],
  ['arc2:', 'arc:'],
  ["'arc2.", "'arc."],
  ['"arc2.', '"arc.'],
  ['arc2-', 'arc-'],
  ['ARC-2', 'ARC'],
  ['[arc-2-ui]', '[arc-ui]'],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

function shouldProcess(file) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  if (rel.startsWith('scripts/rename-arc2-to-arc.mjs')) return false;
  if (rel.includes('node_modules/')) return false;
  if (rel.includes('/dist/')) return false;
  const ext = path.extname(file).toLowerCase();
  return ['.ts', '.tsx', '.css', '.html', '.md', '.mjs', '.json', '.mdc'].includes(ext);
}

function applyReplacements(text) {
  let out = text;
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

let changed = 0;
for (const file of walk(repoRoot)) {
  if (!shouldProcess(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  if (!/arc-2|arc2|ARC2|ARC-2/i.test(before)) continue;
  const after = applyReplacements(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed++;
    console.log('updated:', path.relative(repoRoot, file));
  }
}

console.log(`Done. ${changed} files updated.`);
