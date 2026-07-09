#!/usr/bin/env node
/**
 * Генерация renderer/public/ui/arc-ui/theme-light.css из figma-colors-light.json.
 * Alert-токены для dark и light — из default elevation соответствующих JSON.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildElevationDecls, buildLightRootDecls, declBlock, v } from './lib/build-light-elevation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LIGHT_JSON = join(ROOT, 'docs/design-tokens/figma-colors-light.json');
const DARK_JSON = join(ROOT, 'docs/design-tokens/figma-colors-dark.json');
const OUT_CSS = join(ROOT, 'renderer/public/ui/arc-ui/theme-light.css');

const ELEVATION_SELECTORS = {
  sunken: [
    'html[data-theme="light"] body[data-elevation="sunken"]',
    'html[data-theme="light"] .arc-category-panel-layout[data-elevation="sunken"]',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="sunken"]',
  ],
  default: [
    'html[data-theme="light"] body[data-elevation="default"]',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="default"]',
  ],
  raised: [
    'html[data-theme="light"] body[data-elevation="raised"]',
    'html[data-theme="light"] .arc-modal',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="raised"]',
  ],
};

/**
 * data-typo-tone → Figma Typography prefix (те же имена групп, что в arc-ui.css).
 * Black Bg и White Bg не меняются местами — значения берутся из Light modes того же пути.
 * @see arc-ui.css: Typography/Black Bg → data-typo-tone="white"; dark → White Bg (gray-950 в Dark).
 */
const TYPO_TONE_FIGMA_PREFIX = {
  white: 'Typography/Black Bg',
  dark: 'Typography/White Bg',
  danger: 'Typography/Danger',
  warning: 'Typography/Warning',
  success: 'Typography/Success',
};

const TYPO_TONE_VARS = [
  ['--typo-tone-primary', 'Primary/Default'],
  ['--typo-tone-primary-hover', 'Primary/Hover'],
  ['--typo-tone-primary-disabled', 'Primary/Disabled'],
  ['--typo-tone-secondary', 'Secondary/Default'],
  ['--typo-tone-secondary-hover', 'Secondary/Hover'],
  ['--typo-tone-secondary-disabled', 'Secondary/Disabled'],
];

const TYPO_BODY_SELECTORS = {
  sunken: [
    'html[data-theme="light"] body[data-elevation="sunken"][data-typo-tone="{tone}"]',
    'html[data-theme="light"] .arc-category-panel-layout[data-elevation="sunken"][data-typo-tone="{tone}"]',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="sunken"][data-typo-tone="{tone}"]',
  ],
  default: [
    'html[data-theme="light"] body[data-elevation="default"][data-typo-tone="{tone}"]',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="default"][data-typo-tone="{tone}"]',
  ],
  raised: [
    'html[data-theme="light"] body[data-elevation="raised"][data-typo-tone="{tone}"]',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="raised"][data-typo-tone="{tone}"]',
  ],
};

const TYPO_SCOPE_SELECTORS = {
  sunken: [
    'html[data-theme="light"] body[data-elevation="sunken"] #typographyScope[data-typo-tone="{tone}"]',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="sunken"] #typographyScope[data-typo-tone="{tone}"]',
  ],
  default: [
    'html[data-theme="light"] body[data-elevation="default"] #typographyScope[data-typo-tone="{tone}"]',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="default"] #typographyScope[data-typo-tone="{tone}"]',
  ],
  raised: [
    'html[data-theme="light"] body[data-elevation="raised"] #typographyScope[data-typo-tone="{tone}"]',
    'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="raised"] #typographyScope[data-typo-tone="{tone}"]',
  ],
};

/** Information tone — нет в Figma Colors Light; те же blue, что в arc-ui.css (dark). */
const INFORMATION_TYPO_BY_MODE = {
  sunken: {
    '--typo-tone-primary': 'var(--blue-700)',
    '--typo-tone-primary-hover': 'var(--blue-500)',
    '--typo-tone-primary-disabled': 'var(--blue-900)',
    '--typo-tone-secondary': 'var(--blue-800)',
    '--typo-tone-secondary-hover': 'var(--blue-800)',
    '--typo-tone-secondary-disabled': 'var(--blue-900)',
  },
  default: {
    '--typo-tone-primary': 'var(--blue-600)',
    '--typo-tone-primary-hover': 'var(--blue-500)',
    '--typo-tone-primary-disabled': 'var(--blue-800)',
    '--typo-tone-secondary': 'var(--blue-800)',
    '--typo-tone-secondary-hover': 'var(--blue-800)',
    '--typo-tone-secondary-disabled': 'var(--blue-800)',
  },
  raised: {
    '--typo-tone-primary': 'var(--blue-500)',
    '--typo-tone-primary-hover': 'var(--blue-400)',
    '--typo-tone-primary-disabled': 'var(--blue-700)',
    '--typo-tone-secondary': 'var(--blue-600)',
    '--typo-tone-secondary-hover': 'var(--blue-600)',
    '--typo-tone-secondary-disabled': 'var(--blue-700)',
  },
};

const ROOT_SEMANTIC_FONT = [
  { css: '--font-danger-primary-default', figma: 'Typography/Danger/Primary/Default' },
  { css: '--font-danger-primary-hover', figma: 'Typography/Danger/Primary/Hover' },
  { css: '--font-danger-primary-disabled', figma: 'Typography/Danger/Primary/Disabled' },
  { css: '--font-danger-secondary-default', figma: 'Typography/Danger/Secondary/Default' },
  { css: '--font-danger-secondary-hover', figma: 'Typography/Danger/Secondary/Hover' },
  { css: '--font-danger-secondary-disabled', figma: 'Typography/Danger/Secondary/Disabled' },
  { css: '--font-success-primary-default', figma: 'Typography/Success/Primary/Default' },
  { css: '--font-success-primary-hover', figma: 'Typography/Success/Primary/Hover' },
  { css: '--font-success-primary-disabled', figma: 'Typography/Success/Primary/Disabled' },
  { css: '--font-success-secondary-default', figma: 'Typography/Success/Secondary/Default' },
  { css: '--font-success-secondary-hover', figma: 'Typography/Success/Secondary/Hover' },
  { css: '--font-success-secondary-disabled', figma: 'Typography/Success/Secondary/Disabled' },
  { css: '--font-warning-primary-default', figma: 'Typography/Warning/Primary/Default' },
  { css: '--font-warning-primary-hover', figma: 'Typography/Warning/Primary/Hover' },
  { css: '--font-warning-primary-disabled', figma: 'Typography/Warning/Primary/Disabled' },
  { css: '--font-warning-secondary-default', figma: 'Typography/Warning/Secondary/Default' },
  { css: '--font-warning-secondary-hover', figma: 'Typography/Warning/Secondary/Hover' },
  { css: '--font-warning-secondary-disabled', figma: 'Typography/Warning/Secondary/Disabled' },
];

const ALERT_MAPPINGS = [
  { css: '--alert-danger-bg', figma: 'Background/Danger/Default' },
  { css: '--alert-danger-border', figma: 'Border/Danger' },
  { css: '--alert-danger-text', figma: 'Typography/Danger/Primary/Default' },
  { css: '--alert-danger-close', figma: 'Icons/Danger/Default' },
  { css: '--alert-success-bg', figma: 'Background/Success/Default' },
  { css: '--alert-success-border', figma: 'Border/Success' },
  { css: '--alert-success-text', figma: 'Typography/Success/Primary/Default' },
  { css: '--alert-success-close', figma: 'Icons/Success/Default' },
  { css: '--alert-warning-bg', figma: 'Background/Warning/Default' },
  { css: '--alert-warning-border', figma: 'Border/Warning' },
  { css: '--alert-warning-text', figma: 'Typography/Warning/Primary/Default' },
  { css: '--alert-warning-close', figma: 'Icons/Warning/Default' },
  { css: '--alert-info-bg', figma: 'Background/Primary/Default' },
  { css: '--alert-info-border', figma: 'Border/Default' },
  { css: '--alert-info-text', figma: 'Typography/White Bg/Primary/Default' },
  { css: '--alert-info-close', figma: 'Icons/White Bg/Default' },
  { css: '--alert-brand-bg', figma: 'Background/Brand/Default' },
  { css: '--alert-brand-text', figma: 'Typography/Brand/Primary/Default' },
  { css: '--alert-brand-close', figma: 'Icons/Brand/Default' },
];

/** Dark / Default: Information pill uses light Primary surface (Figma Alert 52:2131). */
const ALERT_DARK_OVERRIDES = {
  '--alert-info-bg': 'var(--gray-50)',
  '--alert-info-border': 'var(--gray-100)',
  '--alert-info-text': 'var(--gray-950)',
  '--alert-info-close': 'var(--gray-550)',
  '--alert-brand-bg': 'var(--brand-450)',
  '--alert-brand-text': 'var(--brand-950)',
  '--alert-brand-close': 'var(--brand-750)',
  '--alert-success-border': 'var(--green-850)',
  '--alert-warning-border': 'var(--yellow-850)',
};

const ALERT_LIGHT_OVERRIDES = {
  '--alert-info-border': 'transparent',
  '--alert-brand-border': 'transparent',
};

function buildAlertBlock(data, selectorPrefix = '', overrides = {}) {
  const mode = 'default';
  const decls = ALERT_MAPPINGS
    .map(({ css, figma }) => [css, overrides[css] ?? v(data, mode, figma)])
    .filter(([, val]) => val);
  return `${selectorPrefix} {\n${declBlock(decls)}\n}`;
}

function buildTypoToneDecls(data, mode, figmaPrefix) {
  return TYPO_TONE_VARS
    .map(([cssVar, suffix]) => [cssVar, v(data, mode, `${figmaPrefix}/${suffix}`)])
    .filter(([, val]) => val);
}

function buildTypoToneRule(selectors, decls) {
  if (!decls.length) return '';
  return `${selectors.join(',\n')} {\n${declBlock(decls)}\n}`;
}

function buildTypoToneBlocks(data) {
  const blocks = [];

  for (const [tone, figmaPrefix] of Object.entries(TYPO_TONE_FIGMA_PREFIX)) {
    for (const mode of ['sunken', 'default', 'raised']) {
      const decls = buildTypoToneDecls(data, mode, figmaPrefix);
      const selectors = TYPO_BODY_SELECTORS[mode].map((s) => s.replace('{tone}', tone));
      const rule = buildTypoToneRule(selectors, decls);
      if (rule) blocks.push(rule);
    }
  }

  for (const mode of ['sunken', 'default', 'raised']) {
    const decls = Object.entries(INFORMATION_TYPO_BY_MODE[mode]);
    const selectors = TYPO_BODY_SELECTORS[mode].map((s) => s.replace('{tone}', 'information'));
    blocks.push(buildTypoToneRule(selectors, decls));
  }

  for (const [tone, figmaPrefix] of Object.entries(TYPO_TONE_FIGMA_PREFIX)) {
    for (const mode of ['sunken', 'default', 'raised']) {
      const decls = buildTypoToneDecls(data, mode, figmaPrefix);
      const selectors = TYPO_SCOPE_SELECTORS[mode].map((s) => s.replace('{tone}', tone));
      const rule = buildTypoToneRule(selectors, decls);
      if (rule) blocks.push(rule);
    }
  }

  for (const mode of ['sunken', 'default', 'raised']) {
    const decls = Object.entries(INFORMATION_TYPO_BY_MODE[mode]);
    const selectors = TYPO_SCOPE_SELECTORS[mode].map((s) => s.replace('{tone}', 'information'));
    blocks.push(buildTypoToneRule(selectors, decls));
  }

  return blocks;
}

function buildLightRootDeclsWithFonts(data) {
  const mode = 'default';
  return [
    ...buildLightRootDecls(data),
    ...ROOT_SEMANTIC_FONT.map(({ css, figma }) => [css, v(data, mode, figma)]),
  ].filter(([, val]) => val);
}

const light = JSON.parse(readFileSync(LIGHT_JSON, 'utf8'));
const dark = JSON.parse(readFileSync(DARK_JSON, 'utf8'));

const lines = [
  '/* Generated by scripts/generate-light-theme-css.mjs — do not edit manually */',
  `/* Source: figma-colors-light.json (${light.exportedAt}) */`,
  '',
  'html[data-theme="light"] {',
  declBlock(buildLightRootDeclsWithFonts(light)),
  '}',
  '',
  '/* Alert semantic tokens — Dark / Default elevation */',
  buildAlertBlock(dark, ':root', ALERT_DARK_OVERRIDES),
  '',
  '/* Alert semantic tokens — Light / Default elevation */',
  buildAlertBlock(light, 'html[data-theme="light"]', ALERT_LIGHT_OVERRIDES),
  '',
  '/* Elevation panel + component tokens (Light) */',
];

for (const mode of ['sunken', 'default', 'raised']) {
  const selector = ELEVATION_SELECTORS[mode].join(',\n');
  lines.push(`${selector} {`);
  lines.push(declBlock(buildElevationDecls(light, mode)));
  lines.push('}');
  lines.push('');
}

lines.push('/* Typography — data-typo-tone (Light, from Figma) */');
lines.push('');
for (const block of buildTypoToneBlocks(light)) {
  lines.push(block);
  lines.push('');
}

lines.push('/* Outline / Ghost — на светлом фоне текст Black Bg (Figma UI Tester) */');
lines.push(`html[data-theme="light"] .btn-outline .btn-ds__value,
html[data-theme="light"] .btn-ghost .btn-ds__value {
  color: var(--btn-secondary-value-default);
}
html[data-theme="light"] .btn-outline .btn-ds__counter,
html[data-theme="light"] .btn-ghost .btn-ds__counter {
  color: var(--btn-secondary-counter-default);
}
html[data-theme="light"] .btn-outline .btn-ds__icon,
html[data-theme="light"] .btn-outline .btn-icon-only__glyph,
html[data-theme="light"] .btn-ghost .btn-ds__icon,
html[data-theme="light"] .btn-ghost .btn-icon-only__glyph {
  color: var(--btn-secondary-icon-default);
}
html[data-theme="light"] .btn-outline:hover:not(:disabled) .btn-ds__value,
html[data-theme="light"] .btn-ghost:hover:not(:disabled) .btn-ds__value {
  color: var(--btn-secondary-value-hover);
}
html[data-theme="light"] .btn-outline:hover:not(:disabled) .btn-ds__counter,
html[data-theme="light"] .btn-ghost:hover:not(:disabled) .btn-ds__counter {
  color: var(--btn-secondary-counter-hover);
}
html[data-theme="light"] .btn-outline:hover:not(:disabled) .btn-ds__icon,
html[data-theme="light"] .btn-outline:hover:not(:disabled) .btn-icon-only__glyph,
html[data-theme="light"] .btn-ghost:hover:not(:disabled) .btn-ds__icon,
html[data-theme="light"] .btn-ghost:hover:not(:disabled) .btn-icon-only__glyph {
  color: var(--btn-secondary-icon-hover);
}
html[data-theme="light"] .btn-outline:disabled .btn-ds__value,
html[data-theme="light"] .btn-ghost:disabled .btn-ds__value {
  color: var(--btn-secondary-value-disabled);
}
html[data-theme="light"] .btn-outline:disabled .btn-ds__counter,
html[data-theme="light"] .btn-ghost:disabled .btn-ds__counter {
  color: var(--btn-secondary-counter-disabled);
}
html[data-theme="light"] .btn-outline:disabled .btn-ds__icon,
html[data-theme="light"] .btn-outline:disabled .btn-icon-only__glyph,
html[data-theme="light"] .btn-ghost:disabled .btn-ds__icon,
html[data-theme="light"] .btn-ghost:disabled .btn-icon-only__glyph {
  color: var(--btn-secondary-icon-disabled);
}
html[data-theme="light"] .btn-outline:focus-visible:not(:disabled) .btn-ds__value,
html[data-theme="light"] .btn-ghost:focus-visible:not(:disabled) .btn-ds__value {
  color: var(--btn-secondary-value-focus);
}
html[data-theme="light"] .btn-outline:focus-visible:not(:disabled) .btn-ds__counter,
html[data-theme="light"] .btn-ghost:focus-visible:not(:disabled) .btn-ds__counter {
  color: var(--btn-secondary-counter-focus);
}
html[data-theme="light"] .btn-outline:focus-visible:not(:disabled) .btn-ds__icon,
html[data-theme="light"] .btn-outline:focus-visible:not(:disabled) .btn-icon-only__glyph,
html[data-theme="light"] .btn-ghost:focus-visible:not(:disabled) .btn-ds__icon,
html[data-theme="light"] .btn-ghost:focus-visible:not(:disabled) .btn-icon-only__glyph {
  color: var(--btn-secondary-icon-focus);
}`);
lines.push('');

mkdirSync(dirname(OUT_CSS), { recursive: true });
const css = lines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
writeFileSync(OUT_CSS, css, 'utf8');
console.log('Written:', OUT_CSS);
console.log('Lines:', css.split('\n').length);
