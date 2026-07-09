import { COMPONENT_MAPPINGS } from './token-component-mappings.mjs';

export const SEMANTIC_ALIASES = [
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

const TAB_CSS_VARS = new Set(COMPONENT_MAPPINGS.filter((m) => m.css.startsWith('--tab-')).map((m) => m.css));

export function v(data, mode, figmaPath) {
  return data.variables[figmaPath]?.[mode]?.cssPrimitive ?? null;
}

export function resolve(data, mode, figmaPath) {
  return v(data, mode, figmaPath);
}

export function buildMenuDropdownDecls(data, mode) {
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

/** Navbar tabs (Figma 1916:45704): active = brand fill, inactive = transparent + Black Bg typography */
export function buildTabDecls() {
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

export function buildElevationDecls(data, mode) {
  const map = new Map();

  map.set('--app-bg', v(data, 'sunken', 'Background/Background') ?? 'var(--gray-25)');
  map.set('--panel-bg', v(data, mode, 'Background/Background'));
  map.set('--panel-border', v(data, mode, 'Border/Default'));
  map.set('--text-elev-primary', v(data, mode, 'Typography/Black Bg/Primary/Default'));
  map.set('--text-elev-secondary', v(data, mode, 'Typography/Black Bg/Secondary/Default'));

  for (const { css, figma } of SEMANTIC_ALIASES) {
    const val = resolve(data, mode, figma);
    if (val) map.set(css, val);
  }

  for (const { css, figma } of COMPONENT_MAPPINGS) {
    if (TAB_CSS_VARS.has(css)) continue;
    if (css.startsWith('--button-outline') || css.startsWith('--button-ghost')) continue;
    const val = resolve(data, mode, figma);
    if (val) map.set(css, val);
  }

  for (const [css, val] of buildTabDecls()) map.set(css, val);
  for (const [css, val] of buildMenuDropdownDecls(data, mode)) map.set(css, val);

  map.set('--button-outline-default', 'var(--panel-bg)');
  map.set('--button-outline-hover', resolve(data, mode, 'Background/Tertiary/Hover'));
  map.set('--button-outline-disabled', 'var(--panel-bg)');
  map.set('--button-outline-border-default', resolve(data, mode, 'Border/Default'));
  map.set('--button-outline-border-hover', resolve(data, mode, 'Border/Default'));
  map.set('--button-outline-border-disabled', resolve(data, mode, 'Border/Default'));
  map.set('--button-ghost-default', 'var(--panel-bg)');
  map.set('--button-ghost-hover', resolve(data, mode, 'Background/Tertiary/Hover'));
  map.set('--button-ghost-disabled', 'var(--panel-bg)');

  // Raised: disabled input fill matches default (dark parity; avoids gray-25 wash on gray-50 menus)
  if (mode === 'raised') {
    const fillDefault = map.get('--input-fill-default');
    if (fillDefault) map.set('--input-fill-disabled', fillDefault);
  }

  return [...map.entries()].filter(([, val]) => val).sort(([a], [b]) => a.localeCompare(b));
}

export function declBlock(entries) {
  return entries.map(([k, val]) => `  ${k}: ${val};`).join('\n');
}

export function buildLightRootDecls(data) {
  return [
    ['color-scheme', 'light'],
    ['--sunken-bg', v(data, 'sunken', 'Background/Background')],
    ['--default-bg', v(data, 'default', 'Background/Background')],
    ['--raised-bg', v(data, 'raised', 'Background/Background')],
    ['--surface-border-sunken', v(data, 'sunken', 'Border/Default')],
    ['--surface-border-default', v(data, 'default', 'Border/Default')],
    ['--surface-border-raised', v(data, 'raised', 'Border/Default')],
    ['--ui-text-primary', v(data, 'default', 'Typography/Black Bg/Primary/Default')],
    ['--ui-text-secondary', v(data, 'default', 'Typography/Black Bg/Secondary/Default')],
    ['--border-brand', v(data, 'default', 'Border/Brand')],
    ['--arc-modal-shadow', '0 12px 16px 0 rgba(0, 0, 0, 0.06), 0 3px 16px 0 rgba(0, 0, 0, 0.06)'],
    ['--shade-tint-from', 'var(--gray-150)'],
    ...SEMANTIC_ALIASES.map(({ css, figma }) => [css, v(data, 'default', figma)]),
  ].filter(([, val]) => val);
}
