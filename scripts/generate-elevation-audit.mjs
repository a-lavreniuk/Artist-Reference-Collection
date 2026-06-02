#!/usr/bin/env node
/**
 * Сверка docs/design-tokens/figma-colors-dark.json с elevation-блоками arc-ui.css.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FIGMA_JSON = join(ROOT, 'docs/design-tokens/figma-colors-dark.json');
const CSS_PATH = join(ROOT, 'renderer/public/ui/arc-ui/arc-ui.css');
const AUDIT_MD = join(ROOT, 'docs/design-tokens/elevation-audit.md');

/** Figma path → CSS custom properties (per elevation mode) */
const CHECKS = [
  { figma: 'Background/Background', css: ['--panel-bg'] },
  { figma: 'Border/Default', css: ['--panel-border'] },
  { figma: 'Typography/Black Bg/Primary/Default', css: ['--text-elev-primary'] },
  { figma: 'Typography/Black Bg/Secondary/Default', css: ['--text-elev-secondary'] },
  { figma: 'Background/Tertiary/Default', css: ['--input-fill-default', '--tab-inactive-fill-default'] },
  { figma: 'Background/Tertiary/Hover', css: ['--input-fill-hover'] },
  { figma: 'Background/Secondary/Default', css: ['--btn-secondary-fill-default', '--tab-active-fill-default', '--tag-fill-default'] },
  { figma: 'Background/Secondary/Hover', css: ['--btn-secondary-fill-hover', '--tag-fill-hover'] },
  { figma: 'Background/Danger/Default', css: ['--button-danger-default'] },
  { figma: 'Background/Success/Default', css: ['--button-success-default'] },
  { figma: 'Background/Warning/Default', css: ['--button-warning-default'] },
  { figma: 'Background/Brand/Disabled', css: ['--btn-brand-fill-disabled'] },
  { figma: 'Typography/Danger/Primary/Default', css: ['--font-danger-primary-default'] },
  { figma: 'Icons/Danger/Default', css: ['--icons-danger-default'] },
  { figma: 'Icons/Black Bg/Default', css: ['--input-icon-default', '--icons-white-default'] },
  { figma: 'Border/Danger', css: ['--input-border-error'] },
];

const ELEVATION_SELECTORS = {
  sunken: /\[data-elevation="sunken"\]/,
  default: /\[data-elevation="default"\]/,
  raised: /\[data-elevation="raised"\]/,
};

function parseElevationBlocks(css) {
  const blocks = { sunken: {}, default: {}, raised: {} };
  const re = /\[data-elevation="(sunken|default|raised)"\][^{]*\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const mode = m[1];
    const body = m[2];
    for (const decl of body.matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)/gi)) {
      blocks[mode][`--${decl[1]}`] = `var(--${decl[2]})`;
    }
  }
  return blocks;
}

function norm(v) {
  if (!v) return '';
  return v.replace(/\s+/g, '');
}

const figma = JSON.parse(readFileSync(FIGMA_JSON, 'utf8'));
const css = readFileSync(CSS_PATH, 'utf8');
const blocks = parseElevationBlocks(css);

const lines = [
  '# Elevation audit: Figma Colors (Dark) vs arc-ui.css',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Source: [figma-colors-dark.json](./figma-colors-dark.json)`,
  '',
  '| Figma | CSS var | Sunken | Default | Raised | Status |',
  '|-------|---------|--------|---------|--------|--------|',
];

let ok = 0;
let mismatch = 0;

for (const { figma: fPath, css: cssVars } of CHECKS) {
  const fv = figma.variables[fPath];
  if (!fv) continue;
  for (const cssVar of cssVars) {
    const cells = [];
    let rowOk = true;
    for (const mode of ['sunken', 'default', 'raised']) {
      const expected = fv[mode]?.cssPrimitive ?? '—';
      const actual = blocks[mode][cssVar] ?? '—';
      cells.push(expected, actual);
      if (expected !== '—' && norm(expected) !== norm(actual)) rowOk = false;
    }
    if (rowOk) ok++;
    else mismatch++;
    lines.push(
      `| ${fPath} | \`${cssVar}\` | ${cells[0]} / ${cells[2]} / ${cells[4]} | ${cells[1]} / ${cells[3]} / ${cells[5]} | **${rowOk ? 'OK' : 'MISMATCH'}** |`
    );
  }
}

lines.push('', `Summary: **${ok}** OK, **${mismatch}** mismatch (subset of mapped tokens).`, '');
lines.push('Полный экспорт: `node scripts/export-figma-colors-elevation.mjs` + use_figma.');

writeFileSync(AUDIT_MD, lines.join('\n'), 'utf8');
console.log('Written:', AUDIT_MD);
console.log(`OK: ${ok}, MISMATCH: ${mismatch}`);
