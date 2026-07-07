import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SPACE = 'bafyreiatym7s6pb74pl53lc7dsldsoe6qv2n3yq62gvcbrbrlbk5su7o24.3tzcnbz8ajz22';
const TOKEN = process.env.ANYTYPE_API_TOKEN;
if (!TOKEN) {
  console.error('Set ANYTYPE_API_TOKEN before upload.');
  process.exit(1);
}
const OUT_DIR = path.join(ROOT, 'docs', 'kb-v2', 'screenshots');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/upload-kb-shots.mjs <file.png> ...');
  process.exit(1);
}

for (const file of files) {
  const p = path.isAbsolute(file) ? file : path.join(OUT_DIR, file);
  if (!existsSync(p)) {
    console.log('MISSING', file);
    continue;
  }
  const out = execFileSync(
    'curl',
    [
      '-s',
      '-X',
      'POST',
      `http://127.0.0.1:31009/v1/spaces/${SPACE}/files`,
      '-H',
      `Authorization: Bearer ${TOKEN}`,
      '-H',
      'Anytype-Version: 2025-11-08',
      '-F',
      `file=@${p}`
    ],
    { encoding: 'utf8' }
  );
  try {
    const j = JSON.parse(out);
    const id = j.object?.id ?? j.id;
    console.log(`${path.basename(p)}\t${id ?? out.slice(0, 160)}`);
  } catch {
    console.log(`${path.basename(p)}\t${out.slice(0, 160)}`);
  }
}
