/**
 * Перегенерация thumb_s / thumb_m / thumb_l для текущей библиотеки.
 * Usage: npm run thumbs:regenerate
 *        npm run thumbs:regenerate -- "D:\\path\\to\\library"
 *
 * Native-модули собраны под Electron — запуск через ELECTRON_RUN_AS_NODE.
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function readLibraryRootFromConfig() {
  const cfgPath = path.join(process.env.APPDATA || '', 'artist-reference-collection', 'library-root.json');
  if (!fs.existsSync(cfgPath)) return null;
  const j = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  return typeof j.path === 'string' && j.path.trim() ? path.resolve(j.path.trim()) : null;
}

const libraryRoot = process.argv[2] ? path.resolve(process.argv[2]) : readLibraryRootFromConfig();
if (!libraryRoot) {
  console.error('Укажите путь к библиотеке или настройте library-root.json в userData.');
  process.exit(1);
}

const backfillJs = path.join(repoRoot, 'main', 'storage', 'thumbBackfill.js');
if (!fs.existsSync(backfillJs)) {
  console.error('Сначала выполните: npm run build:main');
  process.exit(1);
}

const { backfillThumbGeneration } = require(backfillJs);

console.log(`Перегенерация превью: ${libraryRoot}`);
const started = Date.now();
const result = await backfillThumbGeneration(libraryRoot);
const sec = ((Date.now() - started) / 1000).toFixed(1);
console.log(JSON.stringify({ libraryRoot, elapsedSec: sec, ...result }, null, 2));
process.exit(result.failed > 0 ? 1 : 0);
