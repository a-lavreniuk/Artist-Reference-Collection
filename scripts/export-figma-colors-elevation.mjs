#!/usr/bin/env node
/**
 * Экспорт коллекции Figma Colors (Dark или Light × Sunken | Default | Raised).
 *
 * Запуск через Figma MCP (use_figma) в файле ARC-2:
 *   node scripts/export-figma-colors-elevation.mjs --theme dark
 *   node scripts/export-figma-colors-elevation.mjs --theme light
 *
 * С флагом --write ожидает JSON на stdin (результат use_figma) и пишет:
 *   docs/design-tokens/figma-colors-dark.json  (--theme dark, по умолчанию)
 *   docs/design-tokens/figma-colors-light.json (--theme light)
 *
 * Без stdin — печатает Plugin API код для вставки в use_figma.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const THEMES = {
  dark: {
    outJson: join(ROOT, 'docs/design-tokens/figma-colors-dark.json'),
    modeIds: { sunken: '40:0', default: '102:0', raised: '102:1' },
    modeLabels: { sunken: 'Dark / Sunken', default: 'Dark / Default', raised: 'Dark / Raised' },
  },
  light: {
    outJson: join(ROOT, 'docs/design-tokens/figma-colors-light.json'),
    modeIds: { sunken: '1035:0', default: '1035:1', raised: '1035:2' },
    modeLabels: { sunken: 'Light / Sunken', default: 'Light / Default', raised: 'Light / Raised' },
  },
};

function parseThemeArg() {
  const idx = process.argv.indexOf('--theme');
  const theme = idx >= 0 ? process.argv[idx + 1] : 'dark';
  if (!THEMES[theme]) {
    console.error(`Unknown --theme "${theme}". Use: dark | light`);
    process.exit(1);
  }
  return theme;
}

function buildPluginCode(themeConfig) {
  const modeEntries = Object.entries(themeConfig.modeIds)
    .map(([k, v]) => `${k}: '${v}'`)
    .join(', ');
  const labelEntries = Object.entries(themeConfig.modeLabels)
    .map(([k, v]) => `${k}: '${v}'`)
    .join(', ');

  return `const COLLECTION_ID = 'VariableCollectionId:40:1343';
const MODES = { ${modeEntries} };
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
  modes: { ${labelEntries} },
  variables,
};`;
}

const theme = parseThemeArg();
const themeConfig = THEMES[theme];
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
  delete data.variableCount;
  data._note = `Полный экспорт ${Object.keys(data.variables || {}).length} переменных Colors (${theme === 'light' ? 'Light' : 'Dark'}). Перегенерация: node scripts/export-figma-colors-elevation.mjs --theme ${theme} + use_figma.`;
  mkdirSync(dirname(themeConfig.outJson), { recursive: true });
  writeFileSync(themeConfig.outJson, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Written:', themeConfig.outJson);
  console.log('Variables:', Object.keys(data.variables || {}).length);
} else {
  console.log('Figma file: ARC-2 (JD3pZdlV4Sz62creRMQsJV)');
  console.log(`Collection: Colors — ${themeConfig.modeLabels.sunken}, ${themeConfig.modeLabels.default.split(' / ')[1]}, ${themeConfig.modeLabels.raised.split(' / ')[1]} (${theme})`);
  console.log('');
  console.log('Выполните код ниже через use_figma, затем:');
  console.log(`  node scripts/export-figma-colors-elevation.mjs --theme ${theme} --write < export.json`);
  if (theme === 'light') {
    console.log('  node scripts/generate-light-theme-css.mjs');
    console.log('  node scripts/generate-elevation-audit.mjs --theme light');
  } else {
    console.log('  node scripts/generate-elevation-audit.mjs');
  }
  console.log('');
  console.log('--- use_figma code ---');
  console.log(buildPluginCode(themeConfig));
}
