#!/usr/bin/env node
/**
 * Экспорт коллекции Figma Colors (Dark / Sunken | Default | Raised).
 *
 * Запуск через Figma MCP (use_figma) в файле ARC-2:
 *   node scripts/export-figma-colors-elevation.mjs --write
 *
 * С флагом --write ожидает JSON на stdin (результат use_figma) и пишет:
 *   docs/design-tokens/figma-colors-dark.json
 *
 * Без stdin — печатает Plugin API код для вставки в use_figma.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_JSON = join(ROOT, 'docs/design-tokens/figma-colors-dark.json');

const FIGMA_PLUGIN_CODE = `const COLLECTION_ID = 'VariableCollectionId:40:1343';
const MODES = { sunken: '40:0', default: '102:0', raised: '102:1' };
const coll = await figma.variables.getVariableCollectionByIdAsync(COLLECTION_ID);
const vars = await Promise.all(coll.variableIds.map(id => figma.variables.getVariableByIdAsync(id)));
const variables = {};
for (const v of vars) {
  if (!v) continue;
  const entry = {};
  for (const [key, modeId] of Object.entries(MODES)) {
    const raw = v.valuesByMode[modeId];
    if (raw?.type === 'VARIABLE_ALIAS') {
      const aliasVar = await figma.variables.getVariableByIdAsync(raw.id);
      const aliasName = aliasVar ? aliasVar.name : null;
      const primitive = aliasName ? aliasName.replace(/\\//g, '-').toLowerCase() : null;
      entry[key] = { alias: aliasName, cssPrimitive: primitive ? 'var(--' + primitive + ')' : null };
    } else {
      entry[key] = null;
    }
  }
  variables[v.name] = entry;
}
return {
  exportedAt: new Date().toISOString(),
  collection: 'Colors',
  fileKey: 'JD3pZdlV4Sz62creRMQsJV',
  modes: { sunken: 'Dark / Sunken', default: 'Dark / Default', raised: 'Dark / Raised' },
  variables,
};`;

const write = process.argv.includes('--write');

if (write) {
  const chunks = [];
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = chunks.join('').trim();
  if (!raw) {
    console.error('Ожидается JSON на stdin (результат use_figma).');
    process.exit(1);
  }
  const data = JSON.parse(raw);
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Written:', OUT_JSON);
  console.log('Variables:', Object.keys(data.variables || {}).length);
} else {
  console.log('Figma file: ARC-2 (JD3pZdlV4Sz62creRMQsJV)');
  console.log('Collection: Colors — Dark / Sunken, Default, Raised');
  console.log('');
  console.log('Выполните код ниже через use_figma, затем:');
  console.log('  node scripts/export-figma-colors-elevation.mjs --write < export.json');
  console.log('  node scripts/generate-elevation-audit.mjs');
  console.log('');
  console.log('--- use_figma code ---');
  console.log(FIGMA_PLUGIN_CODE);
}
