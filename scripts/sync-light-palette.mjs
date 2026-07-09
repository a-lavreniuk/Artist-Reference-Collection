#!/usr/bin/env node
/**
 * Сравнение light color-токенов theme-light.css с figma-colors-light.json.
 * Генерирует docs/design-tokens/light-palette-comparison.md
 *
 *   node scripts/sync-light-palette.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildElevationDecls, buildLightRootDecls } from './lib/build-light-elevation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LIGHT_JSON = join(ROOT, 'docs/design-tokens/figma-colors-light.json');
const THEME_LIGHT_CSS = join(ROOT, 'renderer/public/ui/arc-ui/theme-light.css');
const COMPARISON_MD = join(ROOT, 'docs/design-tokens/light-palette-comparison.md');

function parseLightElevationBlocks(css) {
  const blocks = { sunken: {}, default: {}, raised: {} };
  const re =
    /html\[data-theme="light"\][^{]*\[data-elevation="(sunken|default|raised)"\][^{]*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    for (const decl of m[2].matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) {
      blocks[m[1]][`--${decl[1]}`] = decl[2].trim();
    }
  }
  return blocks;
}

function parseLightRoot(css) {
  const out = {};
  const m = css.match(/html\[data-theme="light"\]\s*\{([^}]+)\}/);
  if (!m) return out;
  for (const decl of m[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) {
    out[`--${decl[1]}`] = decl[2].trim();
  }
  return out;
}

function categorize(cssVar) {
  if (cssVar.includes('border') || cssVar.includes('outline-border')) return 'обводка';
  if (cssVar.includes('shadow')) return 'тень';
  if (cssVar.includes('icon') || cssVar.startsWith('--icons-')) return 'иконка';
  if (cssVar.includes('fill') || cssVar.includes('bg') || cssVar.startsWith('--button-') || cssVar.startsWith('--background-')) return 'фон';
  if (cssVar.includes('value') || cssVar.includes('text') || cssVar.includes('label') || cssVar.includes('font') || cssVar.includes('typography') || cssVar.includes('counter')) return 'типографика';
  return 'прочее';
}

function elementFromVar(cssVar) {
  if (cssVar.startsWith('--btn-brand')) return 'Кнопка brand';
  if (cssVar.startsWith('--btn-primary')) return 'Кнопка primary';
  if (cssVar.startsWith('--btn-secondary')) return 'Кнопка secondary';
  if (cssVar.startsWith('--tab-')) return 'Таб';
  if (cssVar.startsWith('--input-')) return 'Инпут';
  if (cssVar.startsWith('--menu-row')) return 'Пункт меню';
  if (cssVar.startsWith('--button-outline') || cssVar.startsWith('--button-ghost')) return 'Кнопка outline/ghost';
  if (cssVar.startsWith('--typography-') || cssVar.startsWith('--background-') || cssVar.startsWith('--icons-black')) return 'Семантика';
  if (cssVar === '--panel-bg' || cssVar === '--panel-border' || cssVar === '--app-bg') return 'Elevation panel';
  if (cssVar === '--arc-modal-shadow' || cssVar === '--shade-tint-from') return 'Chrome / shadow';
  return 'Прочее';
}

const data = JSON.parse(readFileSync(LIGHT_JSON, 'utf8'));
const css = readFileSync(THEME_LIGHT_CSS, 'utf8');
const oldBlocks = parseLightElevationBlocks(css);
const oldRoot = parseLightRoot(css);
const newBlocksByMode = {
  sunken: buildElevationDecls(data, 'sunken'),
  default: buildElevationDecls(data, 'default'),
  raised: buildElevationDecls(data, 'raised'),
};
const newRoot = buildLightRootDecls(data);

const allVars = new Set();
for (const mode of ['sunken', 'default', 'raised']) {
  Object.keys(oldBlocks[mode]).forEach((k) => allVars.add(k));
  newBlocksByMode[mode].forEach(([k]) => allVars.add(k));
}
Object.keys(oldRoot).forEach((k) => allVars.add(k));
newRoot.forEach(([k]) => allVars.add(k));

const changedRows = [];
for (const cssVar of [...allVars].sort()) {
  const newVal = newBlocksByMode.default.find(([k]) => k === cssVar)?.[1] ?? newRoot.find(([k]) => k === cssVar)?.[1] ?? '—';
  const oldVal = oldBlocks.default[cssVar] ?? oldRoot[cssVar] ?? '—';
  if (newVal === oldVal) continue;
  changedRows.push({
    element: elementFromVar(cssVar),
    category: categorize(cssVar),
    token: cssVar,
    current: oldVal,
    next: newVal,
  });
}

const mdLines = [
  '# Light palette: Как сейчас / Новый стиль',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Source: [figma-colors-light.json](./figma-colors-light.json) → [theme-light.css](../../renderer/public/ui/arc-ui/theme-light.css)`,
  '',
  'Сверка по elevation **default** (основной контекст приложения). Только строки с изменениями.',
  '',
  '> **Примечание:** Sunken и Default по фону (`Background/Background`) совпадают в Figma (`gray-25`) — намеренно, селекторы **не объединяются**.',
  '',
  '| Элемент | Категория | Токен CSS | Как сейчас | Новый стиль |',
  '|---------|-----------|-----------|------------|-------------|',
];

for (const row of changedRows) {
  mdLines.push(
    `| ${row.element} | ${row.category} | \`${row.token}\` | ${row.current} | ${row.next} |`
  );
}

mdLines.push(
  '',
  '## Figma chrome (ручные правки вне JSON)',
  '',
  '| Зона | Node | Спека |',
  '|------|------|-------|',
  '| Title Bar | [1916:45698](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1916-45698) | `gray-150` фон, title `typography-black-bg-secondary` |',
  '| Navbar + shade | [1916:45704](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1916-45704) | island inset `gray-150` + white glow; светлый shade tint |',
  '| Modal shadow | [1493:6150](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1493-6150) | `--arc-modal-shadow` 0.06 opacity |',
  '',
  `Summary: **${changedRows.length}** изменений (default elevation + root).`
);

writeFileSync(COMPARISON_MD, mdLines.join('\n') + '\n', 'utf8');
console.log('Written:', COMPARISON_MD);
console.log(`Changes (default elevation + root): ${changedRows.length}`);
