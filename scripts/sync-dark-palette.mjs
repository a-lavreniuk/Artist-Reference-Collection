#!/usr/bin/env node
/**
 * Синхронизация dark color-токенов arc-ui.css с figma-colors-dark.json.
 * Генерирует docs/design-tokens/dark-palette-comparison.md и патчит arc-ui.css.
 *
 *   node scripts/sync-dark-palette.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPONENT_MAPPINGS } from './lib/token-component-mappings.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DARK_JSON = join(ROOT, 'docs/design-tokens/figma-colors-dark.json');
const ARC_UI_CSS = join(ROOT, 'renderer/public/ui/arc-ui/arc-ui.css');
const COMPARISON_MD = join(ROOT, 'docs/design-tokens/dark-palette-comparison.md');

const ELEVATION_SELECTORS = {
  sunken: `body[data-elevation="sunken"],
.arc-category-panel-layout[data-elevation="sunken"],
.arc-ui-kit-scope[data-elevation="sunken"]`,
  default: `body[data-elevation="default"],
.arc-ui-kit-scope[data-elevation="default"]`,
  raised: `body[data-elevation="raised"],
.arc-modal,
.arc-ui-kit-scope[data-elevation="raised"]`,
};

const SEMANTIC_ALIASES = [
  { css: '--typography-black-bg-primary-default', figma: 'Typography/Black Bg/Primary/Default' },
  { css: '--typography-black-bg-primary-hover', figma: 'Typography/Black Bg/Primary/Hover' },
  { css: '--typography-black-bg-primary-disabled', figma: 'Typography/Black Bg/Primary/Disabled' },
  { css: '--typography-black-bg-secondary-default', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--typography-black-bg-secondary-hover', figma: 'Typography/Black Bg/Secondary/Hover' },
  { css: '--typography-black-bg-secondary-disabled', figma: 'Typography/Black Bg/Secondary/Disabled' },
  { css: '--typography-brand-primary-default', figma: 'Typography/Brand/Primary/Default' },
  { css: '--typography-brand-primary-hover', figma: 'Typography/Brand/Primary/Hover' },
  { css: '--typography-brand-secondary-default', figma: 'Typography/Brand/Secondary/Default' },
  { css: '--typography-brand-secondary-hover', figma: 'Typography/Brand/Secondary/Hover' },
  { css: '--icons-black-bg-default', figma: 'Icons/Black Bg/Default' },
  { css: '--icons-black-bg-hover', figma: 'Icons/Black Bg/Hover' },
  { css: '--icons-black-bg-disabled', figma: 'Icons/Black Bg/Disabled' },
  { css: '--background-brand-default', figma: 'Background/Brand/Default' },
  { css: '--background-brand-hover', figma: 'Background/Brand/Hover' },
  { css: '--background-tertiary-hover', figma: 'Background/Tertiary/Hover' },
];

const ROOT_DARK_SEMANTIC = [
  ...SEMANTIC_ALIASES,
  { css: '--border-brand', figma: 'Border/Brand' },
];

const ROOT_BTN_BRAND = [
  { css: '--btn-brand-fill-default', figma: 'Background/Brand/Default' },
  { css: '--btn-brand-fill-hover', figma: 'Background/Brand/Hover' },
  { css: '--btn-brand-fill-focus', figma: 'Background/Brand/Default' },
  { css: '--btn-brand-value-default', figma: 'Typography/Brand/Primary/Default' },
  { css: '--btn-brand-value-hover', figma: 'Typography/Brand/Primary/Hover' },
  { css: '--btn-brand-value-focus', figma: 'Typography/Brand/Primary/Default' },
  { css: '--btn-brand-counter-default', figma: 'Typography/Brand/Secondary/Default' },
  { css: '--btn-brand-counter-hover', figma: 'Typography/Brand/Secondary/Hover' },
  { css: '--btn-brand-counter-focus', figma: 'Typography/Brand/Secondary/Default' },
  { css: '--btn-brand-icon-default', figma: 'Icons/Brand/Default' },
  { css: '--btn-brand-icon-hover', figma: 'Icons/Brand/Hover' },
  { css: '--btn-brand-icon-focus', figma: 'Icons/Brand/Default' },
];

const TAB_CSS_VARS = new Set(COMPONENT_MAPPINGS.filter((m) => m.css.startsWith('--tab-')).map((m) => m.css));

function v(data, mode, figmaPath) {
  return data.variables[figmaPath]?.[mode]?.cssPrimitive ?? null;
}

function resolve(data, mode, figmaPath) {
  return v(data, mode, figmaPath);
}

function buildMenuDropdownDecls(data, mode) {
  const brandBg = resolve(data, mode, 'Background/Brand/Default');
  const brandBgHover = resolve(data, mode, 'Background/Brand/Hover');
  const brandTextHover = resolve(data, mode, 'Typography/Brand/Primary/Hover');
  const brandIconHover = resolve(data, mode, 'Icons/Brand/Hover');
  const brandCounter = resolve(data, mode, 'Typography/Brand/Secondary/Default');
  return [
    ['--dropdown-row-fill-default', 'transparent'],
    ['--dropdown-row-value-default', 'var(--text-elev-primary)'],
    ['--dropdown-row-fill-hover', brandBg],
    ['--dropdown-row-value-hover', brandTextHover],
    ['--dropdown-row-fill-checked', 'transparent'],
    ['--dropdown-row-value-checked', 'var(--text-elev-primary)'],
    ['--dropdown-row-fill-checked-hover', brandBg],
    ['--dropdown-row-value-checked-hover', brandTextHover],
    ['--dropdown-row-icon-checked', 'var(--text-elev-primary)'],
    ['--menu-row-fill-default', 'transparent'],
    ['--menu-row-fill-hover', brandBgHover],
    ['--menu-row-label-default', 'var(--text-elev-primary)'],
    ['--menu-row-label-hover', brandTextHover],
    ['--menu-row-icon-default', 'var(--input-icon-default)'],
    ['--menu-row-icon-hover', brandIconHover],
    ['--menu-row-counter-default', 'var(--text-elev-secondary)'],
    ['--menu-row-counter-hover', brandCounter],
  ].filter(([, val]) => val);
}

function buildTabDecls() {
  return [
    ['--tab-inactive-fill-default', 'transparent'],
    ['--tab-inactive-value-default', 'var(--typography-black-bg-primary-default)'],
    ['--tab-inactive-counter-default', 'var(--typography-black-bg-secondary-default)'],
    ['--tab-inactive-icon-default', 'var(--icons-black-bg-default)'],
    ['--tab-inactive-fill-hover', 'var(--background-tertiary-hover)'],
    ['--tab-inactive-value-hover', 'var(--typography-black-bg-primary-hover)'],
    ['--tab-inactive-counter-hover', 'var(--typography-black-bg-secondary-default)'],
    ['--tab-inactive-icon-hover', 'var(--icons-black-bg-hover)'],
    ['--tab-inactive-fill-focus', 'var(--background-tertiary-hover)'],
    ['--tab-inactive-value-focus', 'var(--typography-black-bg-primary-default)'],
    ['--tab-inactive-counter-focus', 'var(--typography-black-bg-secondary-default)'],
    ['--tab-inactive-icon-focus', 'var(--icons-black-bg-default)'],
    ['--tab-inactive-fill-disabled', 'transparent'],
    ['--tab-inactive-value-disabled', 'var(--typography-black-bg-secondary-disabled)'],
    ['--tab-inactive-counter-disabled', 'var(--typography-black-bg-secondary-disabled)'],
    ['--tab-inactive-icon-disabled', 'var(--icons-black-bg-disabled)'],
    ['--tab-active-fill-default', 'var(--background-brand-default)'],
    ['--tab-active-value-default', 'var(--typography-brand-primary-default)'],
    ['--tab-active-counter-default', 'var(--typography-brand-secondary-default)'],
    ['--tab-active-icon-default', 'var(--typography-brand-primary-default)'],
    ['--tab-active-fill-hover', 'var(--background-brand-hover)'],
    ['--tab-active-value-hover', 'var(--typography-brand-primary-hover)'],
    ['--tab-active-counter-hover', 'var(--typography-brand-secondary-hover)'],
    ['--tab-active-icon-hover', 'var(--typography-brand-primary-hover)'],
    ['--tab-active-fill-focus', 'var(--background-brand-default)'],
    ['--tab-active-value-focus', 'var(--typography-brand-primary-default)'],
    ['--tab-active-counter-focus', 'var(--typography-brand-secondary-default)'],
    ['--tab-active-icon-focus', 'var(--typography-brand-primary-default)'],
  ];
}

function buildElevationDecls(data, mode) {
  const map = new Map();

  for (const { css, figma } of SEMANTIC_ALIASES) {
    const val = resolve(data, mode, figma);
    if (val) map.set(css, val);
  }

  for (const { css, figma } of COMPONENT_MAPPINGS) {
    if (TAB_CSS_VARS.has(css)) continue;
    const val = resolve(data, mode, figma);
    if (val) map.set(css, val);
  }

  for (const [css, val] of buildTabDecls()) map.set(css, val);
  for (const [css, val] of buildMenuDropdownDecls(data, mode)) map.set(css, val);

  map.set('--button-outline-default', 'var(--panel-bg)');
  map.set('--button-outline-disabled', 'var(--panel-bg)');
  map.set('--button-ghost-default', 'var(--panel-bg)');
  map.set('--button-ghost-disabled', 'var(--panel-bg)');

  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function declBlock(entries) {
  return entries.map(([k, val]) => `  ${k}: ${val};`).join('\n');
}

function buildElevationCss(data) {
  const blocks = [];
  for (const mode of ['sunken', 'default', 'raised']) {
    const decls = buildElevationDecls(data, mode);
    blocks.push(`${ELEVATION_SELECTORS[mode]} {\n${declBlock(decls)}\n}`);
  }
  return blocks.join('\n\n');
}

function parseElevationBlocks(css) {
  const blocks = { sunken: {}, default: {}, raised: {} };
  const re = /\[data-elevation="(sunken|default|raised)"\][^{]*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    for (const decl of m[2].matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) {
      blocks[m[1]][`--${decl[1]}`] = decl[2].trim();
    }
  }
  return blocks;
}

function parseDeclInBlock(css, selectorPattern) {
  const re = new RegExp(`${selectorPattern}[^{]*\\{([^}]+)\\}`, 's');
  const m = css.match(re);
  const out = {};
  if (!m) return out;
  for (const decl of m[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) {
    out[`--${decl[1]}`] = decl[2].trim();
  }
  return out;
}

function categorize(cssVar) {
  if (cssVar.includes('border') || cssVar.includes('outline-border')) return 'обводка';
  if (cssVar.includes('shadow') || cssVar.includes('elevation')) return 'тень';
  if (cssVar.includes('icon') || cssVar.startsWith('--icons-')) return 'иконка';
  if (cssVar.includes('fill') || cssVar.includes('bg') || cssVar.startsWith('--button-') || cssVar.startsWith('--background-')) return 'фон';
  if (cssVar.includes('value') || cssVar.includes('text') || cssVar.includes('label') || cssVar.includes('font') || cssVar.includes('typography') || cssVar.includes('counter')) return 'типографика';
  return 'прочее';
}

function elementFromVar(cssVar) {
  if (cssVar.startsWith('--btn-brand')) return 'Кнопка brand';
  if (cssVar.startsWith('--btn-primary')) return 'Кнопка primary';
  if (cssVar.startsWith('--btn-secondary')) return 'Кнопка secondary';
  if (cssVar.startsWith('--btn-group')) return 'Кнопка group';
  if (cssVar.startsWith('--tab-')) return 'Таб';
  if (cssVar.startsWith('--input-')) return 'Инпут';
  if (cssVar.startsWith('--menu-row')) return 'Пункт меню';
  if (cssVar.startsWith('--dropdown-row')) return 'Dropdown';
  if (cssVar.startsWith('--tag-')) return 'Чип';
  if (cssVar.startsWith('--button-outline') || cssVar.startsWith('--button-ghost')) return 'Кнопка outline/ghost';
  if (cssVar.startsWith('--button-danger') || cssVar.startsWith('--font-danger') || cssVar.startsWith('--icons-danger')) return 'Danger';
  if (cssVar.startsWith('--button-success') || cssVar.startsWith('--font-success') || cssVar.startsWith('--icons-success')) return 'Success';
  if (cssVar.startsWith('--button-warning') || cssVar.startsWith('--font-warning') || cssVar.startsWith('--icons-warning')) return 'Warning';
  if (cssVar.startsWith('--typography-') || cssVar.startsWith('--background-') || cssVar.startsWith('--icons-black')) return 'Семантика';
  if (cssVar === '--border-brand') return 'Border brand';
  return 'Прочее';
}

function buildComparisonTable(data, oldBlocks, newBlocksByMode) {
  const rows = [];
  const modes = ['default'];
  const allVars = new Set();
  for (const mode of ['sunken', 'default', 'raised']) {
    Object.keys(oldBlocks[mode]).forEach((k) => allVars.add(k));
    newBlocksByMode[mode].forEach(([k]) => allVars.add(k));
  }

  for (const cssVar of [...allVars].sort()) {
    const newVal = newBlocksByMode.default.find(([k]) => k === cssVar)?.[1] ?? '—';
    const oldVal = oldBlocks.default[cssVar] ?? '—';
    if (newVal === oldVal) continue;
    rows.push({
      element: elementFromVar(cssVar),
      category: categorize(cssVar),
      state: 'default',
      token: cssVar,
      current: oldVal,
      next: newVal,
      usage: ELEVATION_SELECTORS.default.split(',')[0].trim(),
    });
  }

  for (const { css, figma } of ROOT_DARK_SEMANTIC) {
    const next = resolve(data, 'default', figma);
    rows.push({
      element: 'html[data-theme=dark]',
      category: categorize(css),
      state: 'root',
      token: css,
      current: '(см. arc-ui.css)',
      next,
      usage: 'html[data-theme="dark"]',
    });
  }

  for (const { css, figma } of ROOT_BTN_BRAND) {
    const next = resolve(data, 'default', figma);
    rows.push({
      element: 'Кнопка brand (:root)',
      category: categorize(css),
      state: 'root',
      token: css,
      current: '(см. arc-ui.css)',
      next,
      usage: ':root',
    });
  }

  return rows;
}

function patchCss(css, data) {
  let next = css;

  const semanticLines = ROOT_DARK_SEMANTIC
    .filter(({ css: c }) => c !== '--border-brand')
    .map(({ css: c, figma }) => {
      const val = resolve(data, 'default', figma);
      return val ? `  ${c}: ${val};` : null;
    })
    .filter(Boolean)
    .join('\n');
  next = next.replace(
    /\/\* Figma semantic aliases[\s\S]*?(?=\n\n  --red-50:)/,
    `/* Figma semantic aliases (Typography / Background / Icons) — synced from figma-colors-dark.json */\n${semanticLines}\n`
  );

  next = next.replace(
    /--border-brand:\s*[^;]+;/,
    `--border-brand: ${resolve(data, 'default', 'Border/Brand')};`
  );

  for (const { css: c, figma } of ROOT_BTN_BRAND) {
    const val = resolve(data, 'default', figma);
    if (!val) continue;
    const re = new RegExp(`(${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}):\\s*[^;]+;`);
    next = next.replace(re, `$1: ${val};`);
  }

  const elevationCss = buildElevationCss(data);
  const markerStart = '/* BEGIN GENERATED dark-elevation-tokens */';
  const markerEnd = '/* END GENERATED dark-elevation-tokens */';
  const wrapped = `${markerStart}\n${elevationCss}\n${markerEnd}`;

  if (next.includes(markerStart)) {
    next = next.replace(
      new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`),
      wrapped
    );
  } else {
    const blockStartRe = /body\[data-elevation="sunken"\],\s*\.arc-category-panel-layout\[data-elevation="sunken"\],\s*\.arc-ui-kit-scope\[data-elevation="sunken"\]\s*\{\s*--input-fill-default:/;
    const startMatch = next.match(blockStartRe);
    const primaryIdx = next.indexOf('/* Primary */');
    if (!startMatch || primaryIdx === -1) {
      throw new Error('Could not locate dark elevation component blocks in arc-ui.css');
    }
    const startIdx = startMatch.index;
    next = `${next.slice(0, startIdx)}${wrapped}\n\n${next.slice(primaryIdx)}`;
  }

  return next;
}

const data = JSON.parse(readFileSync(DARK_JSON, 'utf8'));
const css = readFileSync(ARC_UI_CSS, 'utf8');
const oldBlocks = parseElevationBlocks(css);
const newBlocksByMode = {
  sunken: buildElevationDecls(data, 'sunken'),
  default: buildElevationDecls(data, 'default'),
  raised: buildElevationDecls(data, 'raised'),
};

const comparisonRows = buildComparisonTable(data, oldBlocks, newBlocksByMode);
const changedOnly = comparisonRows.filter((r) => r.current !== r.next && r.current !== '(см. arc-ui.css)');

const mdLines = [
  '# Dark palette: Как сейчас / Новый стиль',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Source: [figma-colors-dark.json](./figma-colors-dark.json) → [arc-ui.css](../../renderer/public/ui/arc-ui/arc-ui.css)`,
  '',
  'Сверка по elevation **default** (основной контекст приложения). Только строки с изменениями.',
  '',
  '| Элемент | Категория | Состояние | Токен CSS | Как сейчас | Новый стиль | Где используется |',
  '|---------|-----------|-----------|-----------|------------|-------------|------------------|',
];

for (const row of changedOnly) {
  mdLines.push(
    `| ${row.element} | ${row.category} | ${row.state} | \`${row.token}\` | ${row.current} | ${row.next} | ${row.usage} |`
  );
}

const rootRows = comparisonRows.filter((r) => r.current === '(см. arc-ui.css)');
if (rootRows.length) {
  mdLines.push('', '## Корневые токены (html[data-theme=dark], :root btn-brand)', '');
  mdLines.push('| Элемент | Категория | Токен CSS | Новый стиль |');
  mdLines.push('|---------|-----------|-----------|-------------|');
  for (const row of rootRows) {
    mdLines.push(`| ${row.element} | ${row.category} | \`${row.token}\` | ${row.next} |`);
  }
}

mdLines.push('', `Summary: **${changedOnly.length}** изменений в elevation default, **${rootRows.length}** корневых токенов.`);

writeFileSync(COMPARISON_MD, mdLines.join('\n') + '\n', 'utf8');
writeFileSync(ARC_UI_CSS, patchCss(css, data), 'utf8');

console.log('Written:', COMPARISON_MD);
console.log('Patched:', ARC_UI_CSS);
console.log(`Changes (default elevation): ${changedOnly.length}`);
