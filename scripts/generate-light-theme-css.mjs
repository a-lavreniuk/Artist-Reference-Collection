#!/usr/bin/env node
/**
 * Генерация renderer/public/ui/arc-ui/theme-light.css из figma-colors-light.json.
 * Alert-токены для dark и light — из default elevation соответствующих JSON.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Component token mappings (Figma paths mirror dark elevation blocks in arc-ui.css) */
const COMPONENT_MAPPINGS = [
  { css: '--input-fill-default', figma: 'Background/Tertiary/Default' },
  { css: '--input-fill-hover', figma: 'Background/Tertiary/Hover' },
  { css: '--input-fill-disabled', figma: 'Background/Tertiary/Disabled' },
  { css: '--input-value-default', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--input-value-entered', figma: 'Typography/Black Bg/Primary/Hover' },
  { css: '--input-value-hover', figma: 'Typography/Black Bg/Primary/Hover' },
  { css: '--input-value-disabled', figma: 'Typography/Black Bg/Primary/Disabled' },
  { css: '--input-border-default', figma: 'Border/Default' },
  { css: '--input-border-hover', figma: 'Border/Hover' },
  { css: '--input-border-focus', figma: 'Border/Brand' },
  { css: '--input-border-error', figma: 'Border/Danger' },
  { css: '--input-border-error-hover', figma: 'Border/Danger' },
  { css: '--input-border-disabled', figma: 'Border/Default' },
  { css: '--input-icon-default', figma: 'Icons/Black Bg/Default' },
  { css: '--input-icon-hover', figma: 'Icons/Black Bg/Hover' },

  { css: '--btn-primary-fill-default', figma: 'Background/Primary/Default' },
  { css: '--btn-primary-fill-hover', figma: 'Background/Primary/Hover' },
  { css: '--btn-primary-fill-focus', figma: 'Background/Primary/Default' },
  { css: '--btn-primary-value-default', figma: 'Typography/White Bg/Primary/Default' },
  { css: '--btn-primary-value-hover', figma: 'Typography/White Bg/Primary/Hover' },
  { css: '--btn-primary-value-focus', figma: 'Typography/White Bg/Primary/Default' },
  { css: '--btn-primary-counter-default', figma: 'Typography/White Bg/Secondary/Default' },
  { css: '--btn-primary-counter-hover', figma: 'Typography/White Bg/Secondary/Hover' },
  { css: '--btn-primary-counter-focus', figma: 'Typography/White Bg/Secondary/Default' },
  { css: '--btn-primary-icon-default', figma: 'Icons/White Bg/Default' },
  { css: '--btn-primary-icon-hover', figma: 'Icons/White Bg/Hover' },
  { css: '--btn-primary-icon-focus', figma: 'Icons/White Bg/Default' },
  { css: '--btn-primary-fill-disabled', figma: 'Background/Primary/Disabled' },
  { css: '--btn-primary-value-disabled', figma: 'Typography/White Bg/Primary/Disabled' },
  { css: '--btn-primary-counter-disabled', figma: 'Typography/White Bg/Secondary/Disabled' },
  { css: '--btn-primary-icon-disabled', figma: 'Icons/White Bg/Disabled' },

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
  { css: '--btn-brand-fill-disabled', figma: 'Background/Brand/Disabled' },
  { css: '--btn-brand-value-disabled', figma: 'Typography/Brand/Primary/Disabled' },
  { css: '--btn-brand-counter-disabled', figma: 'Typography/Brand/Secondary/Disabled' },
  { css: '--btn-brand-icon-disabled', figma: 'Icons/Brand/Disabled' },

  { css: '--btn-secondary-fill-default', figma: 'Background/Secondary/Default' },
  { css: '--btn-secondary-value-default', figma: 'Typography/Black Bg/Primary/Default' },
  { css: '--btn-secondary-counter-default', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--btn-secondary-icon-default', figma: 'Icons/Black Bg/Default' },
  { css: '--btn-secondary-fill-hover', figma: 'Background/Secondary/Hover' },
  { css: '--btn-secondary-value-hover', figma: 'Typography/Black Bg/Primary/Default' },
  { css: '--btn-secondary-counter-hover', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--btn-secondary-icon-hover', figma: 'Icons/Black Bg/Hover' },
  { css: '--btn-secondary-fill-focus', figma: 'Background/Secondary/Default' },
  { css: '--btn-secondary-value-focus', figma: 'Typography/Black Bg/Primary/Default' },
  { css: '--btn-secondary-counter-focus', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--btn-secondary-icon-focus', figma: 'Icons/Black Bg/Default' },
  { css: '--btn-secondary-fill-disabled', figma: 'Background/Primary/Disabled' },
  { css: '--btn-secondary-value-disabled', figma: 'Typography/Black Bg/Primary/Disabled' },
  { css: '--btn-secondary-counter-disabled', figma: 'Typography/Black Bg/Secondary/Disabled' },
  { css: '--btn-secondary-icon-disabled', figma: 'Icons/Black Bg/Disabled' },

  { css: '--btn-group-fill-default', figma: 'Background/Tertiary/Default' },
  { css: '--btn-group-fill-hover', figma: 'Background/Tertiary/Hover' },
  { css: '--btn-group-fill-focus', figma: 'Background/Tertiary/Default' },
  { css: '--btn-group-fill-disabled', figma: 'Background/Tertiary/Disabled' },
  { css: '--btn-group-value-default', figma: 'Typography/Black Bg/Primary/Default' },
  { css: '--btn-group-value-hover', figma: 'Typography/Black Bg/Primary/Default' },
  { css: '--btn-group-value-focus', figma: 'Typography/Black Bg/Primary/Default' },
  { css: '--btn-group-value-disabled', figma: 'Typography/Black Bg/Primary/Disabled' },
  { css: '--btn-group-counter-default', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--btn-group-counter-hover', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--btn-group-counter-focus', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--btn-group-counter-disabled', figma: 'Typography/Black Bg/Secondary/Disabled' },
  { css: '--btn-group-icon-default', figma: 'Icons/Black Bg/Default' },
  { css: '--btn-group-icon-hover', figma: 'Icons/Black Bg/Hover' },
  { css: '--btn-group-icon-focus', figma: 'Icons/Black Bg/Default' },
  { css: '--btn-group-icon-disabled', figma: 'Icons/Black Bg/Disabled' },
  { css: '--btn-group-border-default', figma: 'Border/Default' },
  { css: '--btn-group-border-hover', figma: 'Border/Default' },
  { css: '--btn-group-border-focus', figma: 'Border/Default' },
  { css: '--btn-group-border-disabled', figma: 'Border/Default' },

  { css: '--tab-inactive-fill-default', figma: 'Background/Tertiary/Default' },
  { css: '--tab-inactive-value-default', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tab-inactive-counter-default', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tab-inactive-icon-default', figma: 'Icons/Black Bg/Default' },
  { css: '--tab-inactive-fill-hover', figma: 'Background/Tertiary/Default' },
  { css: '--tab-inactive-value-hover', figma: 'Typography/Black Bg/Primary/Hover' },
  { css: '--tab-inactive-counter-hover', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tab-inactive-icon-hover', figma: 'Icons/Black Bg/Hover' },
  { css: '--tab-inactive-fill-focus', figma: 'Background/Tertiary/Default' },
  { css: '--tab-inactive-value-focus', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tab-inactive-counter-focus', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tab-inactive-icon-focus', figma: 'Icons/Black Bg/Default' },
  { css: '--tab-active-fill-default', figma: 'Background/Secondary/Default' },
  { css: '--tab-active-value-default', figma: 'Typography/Black Bg/Primary/Hover' },
  { css: '--tab-active-counter-default', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tab-active-icon-default', figma: 'Icons/Black Bg/Default' },
  { css: '--tab-active-fill-hover', figma: 'Background/Secondary/Default' },
  { css: '--tab-active-value-hover', figma: 'Typography/Black Bg/Primary/Hover' },
  { css: '--tab-active-counter-hover', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tab-active-icon-hover', figma: 'Icons/Black Bg/Hover' },
  { css: '--tab-active-fill-focus', figma: 'Background/Secondary/Default' },
  { css: '--tab-active-value-focus', figma: 'Typography/Black Bg/Primary/Hover' },
  { css: '--tab-active-counter-focus', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tab-active-icon-focus', figma: 'Icons/Black Bg/Default' },

  { css: '--tag-fill-default', figma: 'Background/Secondary/Default' },
  { css: '--tag-text-default', figma: 'Typography/Black Bg/Primary/Default' },
  { css: '--tag-counter-default', figma: 'Typography/Black Bg/Secondary/Default' },
  { css: '--tag-fill-hover', figma: 'Background/Secondary/Hover' },
  { css: '--tag-text-hover', figma: 'Typography/Black Bg/Primary/Hover' },
  { css: '--tag-counter-hover', figma: 'Typography/Black Bg/Secondary/Hover' },
  { css: '--tag-border-hover', figma: 'Border/Hover' },
  { css: '--tag-fill-active', figma: 'Background/Primary/Default' },
  { css: '--tag-text-active', figma: 'Typography/White Bg/Primary/Default' },
  { css: '--tag-counter-active', figma: 'Typography/White Bg/Secondary/Default' },
  { css: '--tag-fill-active-hover', figma: 'Background/Primary/Hover' },
  { css: '--tag-text-active-hover', figma: 'Typography/White Bg/Primary/Hover' },
  { css: '--tag-counter-active-hover', figma: 'Typography/White Bg/Secondary/Hover' },

  { css: '--button-outline-default', figma: 'Background/Tertiary/Default' },
  { css: '--button-outline-hover', figma: 'Background/Tertiary/Hover' },
  { css: '--button-outline-disabled', figma: 'Background/Tertiary/Disabled' },
  { css: '--button-outline-border-default', figma: 'Border/Default' },
  { css: '--button-outline-border-hover', figma: 'Border/Default' },
  { css: '--button-outline-border-disabled', figma: 'Border/Default' },
  { css: '--button-ghost-default', figma: 'Background/Tertiary/Default' },
  { css: '--button-ghost-hover', figma: 'Background/Tertiary/Hover' },
  { css: '--button-ghost-disabled', figma: 'Background/Tertiary/Disabled' },

  { css: '--font-white-primary-default', figma: 'Typography/White Bg/Primary/Default' },
  { css: '--font-white-primary-hover', figma: 'Typography/White Bg/Primary/Hover' },
  { css: '--font-white-primary-disabled', figma: 'Typography/White Bg/Primary/Disabled' },
  { css: '--font-white-secondary-default', figma: 'Typography/White Bg/Secondary/Default' },
  { css: '--font-white-secondary-hover', figma: 'Typography/White Bg/Secondary/Hover' },
  { css: '--font-white-secondary-disabled', figma: 'Typography/White Bg/Secondary/Disabled' },
  { css: '--icons-white-default', figma: 'Icons/White Bg/Default' },
  { css: '--icons-white-hover', figma: 'Icons/White Bg/Hover' },
  { css: '--icons-white-disabled', figma: 'Icons/White Bg/Disabled' },

  { css: '--button-danger-default', figma: 'Background/Danger/Default' },
  { css: '--button-danger-hover', figma: 'Background/Danger/Hover' },
  { css: '--button-danger-disabled', figma: 'Background/Danger/Disabled' },
  { css: '--button-danger-border-default', figma: 'Background/Danger/Default' },
  { css: '--button-danger-border-hover', figma: 'Background/Danger/Hover' },
  { css: '--button-danger-border-disabled', figma: 'Background/Danger/Disabled' },
  { css: '--font-danger-primary-default', figma: 'Typography/Danger/Primary/Default' },
  { css: '--font-danger-primary-hover', figma: 'Typography/Danger/Primary/Hover' },
  { css: '--font-danger-primary-disabled', figma: 'Typography/Danger/Primary/Disabled' },
  { css: '--font-danger-secondary-default', figma: 'Typography/Danger/Secondary/Default' },
  { css: '--font-danger-secondary-hover', figma: 'Typography/Danger/Secondary/Hover' },
  { css: '--font-danger-secondary-disabled', figma: 'Typography/Danger/Secondary/Disabled' },
  { css: '--icons-danger-default', figma: 'Icons/Danger/Default' },
  { css: '--icons-danger-hover', figma: 'Icons/Danger/Hover' },
  { css: '--icons-danger-disabled', figma: 'Icons/Danger/Disabled' },

  { css: '--button-success-default', figma: 'Background/Success/Default' },
  { css: '--button-success-hover', figma: 'Background/Success/Hover' },
  { css: '--button-success-disabled', figma: 'Background/Success/Disabled' },
  { css: '--button-success-border-default', figma: 'Background/Success/Default' },
  { css: '--button-success-border-hover', figma: 'Background/Success/Hover' },
  { css: '--button-success-border-disabled', figma: 'Background/Success/Disabled' },
  { css: '--font-success-primary-default', figma: 'Typography/Success/Primary/Default' },
  { css: '--font-success-primary-hover', figma: 'Typography/Success/Primary/Hover' },
  { css: '--font-success-primary-disabled', figma: 'Typography/Success/Primary/Disabled' },
  { css: '--font-success-secondary-default', figma: 'Typography/Success/Secondary/Default' },
  { css: '--font-success-secondary-hover', figma: 'Typography/Success/Secondary/Hover' },
  { css: '--font-success-secondary-disabled', figma: 'Typography/Success/Secondary/Disabled' },
  { css: '--icons-success-default', figma: 'Icons/Success/Default' },
  { css: '--icons-success-hover', figma: 'Icons/Success/Hover' },
  { css: '--icons-success-disabled', figma: 'Icons/Success/Disabled' },

  { css: '--button-warning-default', figma: 'Background/Warning/Default' },
  { css: '--button-warning-hover', figma: 'Background/Warning/Hover' },
  { css: '--button-warning-disabled', figma: 'Background/Warning/Disabled' },
  { css: '--font-warning-primary-default', figma: 'Typography/Warning/Primary/Default' },
  { css: '--font-warning-primary-hover', figma: 'Typography/Warning/Primary/Hover' },
  { css: '--font-warning-primary-disabled', figma: 'Typography/Warning/Primary/Disabled' },
  { css: '--font-warning-secondary-default', figma: 'Typography/Warning/Secondary/Default' },
  { css: '--font-warning-secondary-hover', figma: 'Typography/Warning/Secondary/Hover' },
  { css: '--font-warning-secondary-disabled', figma: 'Typography/Warning/Secondary/Disabled' },
  { css: '--icons-warning-default', figma: 'Icons/Warning/Default' },
  { css: '--icons-warning-hover', figma: 'Icons/Warning/Hover' },
  { css: '--icons-warning-disabled', figma: 'Icons/Warning/Disabled' },
];

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
  '--alert-brand-bg': 'var(--brand-550)',
  '--alert-brand-text': 'var(--brand-100)',
  '--alert-brand-close': 'var(--brand-250)',
  '--alert-success-border': 'var(--green-850)',
  '--alert-warning-border': 'var(--yellow-850)',
};

const ALERT_LIGHT_OVERRIDES = {
  '--alert-info-border': 'transparent',
  '--alert-brand-border': 'transparent',
};

function v(data, mode, figmaPath) {
  const entry = data.variables[figmaPath]?.[mode];
  return entry?.cssPrimitive ?? null;
}

function resolveLight(data, mode, figmaPath) {
  return v(data, mode, figmaPath);
}

function declBlock(entries) {
  return entries.map(([k, val]) => `  ${k}: ${val};`).join('\n');
}

function buildElevationBlock(data, mode) {
  const panelDecls = [
    ['--app-bg', 'var(--gray-25)'],
    ['--panel-bg', v(data, mode, 'Background/Background')],
    ['--panel-border', v(data, mode, 'Border/Default')],
    ['--text-elev-primary', v(data, mode, 'Typography/Black Bg/Primary/Default')],
    ['--text-elev-secondary', v(data, mode, 'Typography/Black Bg/Secondary/Default')],
  ].filter(([, val]) => val);

  const componentDecls = COMPONENT_MAPPINGS
    .map(({ css, figma }) => [css, resolveLight(data, mode, figma)])
    .filter(([, val]) => val);

  const surfaceDecls = [
    ['--button-outline-default', 'var(--panel-bg)'],
    ['--button-outline-hover', resolveLight(data, mode, 'Background/Tertiary/Hover')],
    ['--button-outline-disabled', 'var(--panel-bg)'],
    ['--button-ghost-default', 'var(--panel-bg)'],
    ['--button-ghost-hover', resolveLight(data, mode, 'Background/Tertiary/Hover')],
    ['--button-ghost-disabled', 'var(--panel-bg)'],
  ].filter(([, val]) => val);

  return declBlock([...panelDecls, ...componentDecls, ...surfaceDecls]);
}

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

function buildLightRootDecls(data) {
  const mode = 'default';
  return [
    ['color-scheme', 'light'],
    ['--sunken-bg', 'var(--gray-25)'],
    ['--default-bg', 'var(--gray-50)'],
    ['--raised-bg', 'var(--gray-100)'],
    ['--surface-border-sunken', 'var(--gray-100)'],
    ['--surface-border-default', 'var(--gray-150)'],
    ['--surface-border-raised', 'var(--gray-200)'],
    ['--ui-text-primary', v(data, mode, 'Typography/Black Bg/Primary/Default')],
    ['--ui-text-secondary', v(data, mode, 'Typography/Black Bg/Secondary/Default')],
    ['--border-brand', v(data, mode, 'Border/Brand')],
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
  declBlock(buildLightRootDecls(light)),
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
  lines.push(buildElevationBlock(light, mode));
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
