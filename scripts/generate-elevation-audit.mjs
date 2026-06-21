#!/usr/bin/env node
/**
 * Сверка figma-colors-*.json с elevation-блоками arc-ui.css (dark) или theme-light.css (light).
 *
 *   node scripts/generate-elevation-audit.mjs
 *   node scripts/generate-elevation-audit.mjs --theme light
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const THEMES = {
  dark: {
    figmaJson: join(ROOT, 'docs/design-tokens/figma-colors-dark.json'),
    cssPath: join(ROOT, 'renderer/public/ui/arc-ui/arc-ui.css'),
    auditMd: join(ROOT, 'docs/design-tokens/elevation-audit.md'),
    title: 'Elevation audit: Figma Colors (Dark) vs arc-ui.css',
    sourceFile: 'figma-colors-dark.json',
    typographyPrimary: 'Typography/Black Bg/Primary/Default',
    typographySecondary: 'Typography/Black Bg/Secondary/Default',
    iconsDefault: 'Icons/Black Bg/Default',
    selectorPrefix: '',
  },
  light: {
    figmaJson: join(ROOT, 'docs/design-tokens/figma-colors-light.json'),
    cssPath: join(ROOT, 'renderer/public/ui/arc-ui/theme-light.css'),
    auditMd: join(ROOT, 'docs/design-tokens/elevation-audit-light.md'),
    title: 'Elevation audit: Figma Colors (Light) vs theme-light.css',
    sourceFile: 'figma-colors-light.json',
    typographyPrimary: 'Typography/Black Bg/Primary/Default',
    typographySecondary: 'Typography/Black Bg/Secondary/Default',
    iconsDefault: 'Icons/Black Bg/Default',
    selectorPrefix: 'html\\[data-theme="light"\\] ',
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

function buildChecks(themeConfig) {
  return [
    { figma: 'Background/Background', css: ['--panel-bg'] },
    { figma: 'Border/Default', css: ['--panel-border'] },
    { figma: themeConfig.typographyPrimary, css: ['--text-elev-primary'] },
    { figma: themeConfig.typographySecondary, css: ['--text-elev-secondary'] },
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
    { figma: themeConfig.iconsDefault, css: ['--input-icon-default', '--icons-white-default'] },
    { figma: 'Border/Danger', css: ['--input-border-error'] },
  ];
}

function parseDecls(body, target) {
  for (const decl of body.matchAll(/--([a-z0-9-]+):\s*(var\(--[a-z0-9-]+\)|[^;]+)/gi)) {
    target[`--${decl[1]}`] = decl[2].trim();
  }
}

function parseElevationBlocks(css, theme) {
  const blocks = { sunken: {}, default: {}, raised: {} };
  if (theme === 'dark') {
    const re = /\[data-elevation="(sunken|default|raised)"\][^{]*\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
      parseDecls(m[2], blocks[m[1]]);
    }
  } else {
    const re = /html\[data-theme="light"\][^{]*\[data-elevation="(sunken|default|raised)"\][^{]*\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
      parseDecls(m[2], blocks[m[1]]);
    }
    const modalRe = /html\[data-theme="light"\] \.arc-modal[^{]*\{([^}]+)\}/;
    const modalMatch = css.match(modalRe);
    if (modalMatch) parseDecls(modalMatch[1], blocks.raised);
  }
  return blocks;
}

function norm(v) {
  if (!v) return '';
  return v.replace(/\s+/g, '');
}

const theme = parseThemeArg();
const themeConfig = THEMES[theme];
const CHECKS = buildChecks(themeConfig);

const figma = JSON.parse(readFileSync(themeConfig.figmaJson, 'utf8'));
const css = readFileSync(themeConfig.cssPath, 'utf8');
const blocks = parseElevationBlocks(css, theme);

const lines = [
  `# ${themeConfig.title}`,
  '',
  `Generated: ${new Date().toISOString()}`,
  `Source: [${themeConfig.sourceFile}](./${themeConfig.sourceFile})`,
  '',
  '| Figma | CSS var | Expected (S/D/R) | Actual (S/D/R) | Status |',
  '|-------|---------|------------------|----------------|--------|',
];

let ok = 0;
let mismatch = 0;

for (const { figma: fPath, css: cssVars } of CHECKS) {
  const fv = figma.variables[fPath];
  if (!fv) continue;
  for (const cssVar of cssVars) {
    const expectedParts = [];
    const actualParts = [];
    let rowOk = true;
    for (const mode of ['sunken', 'default', 'raised']) {
      const expected = fv[mode]?.cssPrimitive ?? '—';
      const actual = blocks[mode][cssVar] ?? '—';
      expectedParts.push(expected);
      actualParts.push(actual);
      if (expected !== '—' && norm(expected) !== norm(actual)) rowOk = false;
    }
    if (rowOk) ok++;
    else mismatch++;
    lines.push(
      `| ${fPath} | \`${cssVar}\` | ${expectedParts.join(' / ')} | ${actualParts.join(' / ')} | **${rowOk ? 'OK' : 'MISMATCH'}** |`
    );
  }
}

lines.push('', `Summary: **${ok}** OK, **${mismatch}** mismatch (subset of mapped tokens).`, '');
lines.push(`Полный экспорт: \`node scripts/export-figma-colors-elevation.mjs --theme ${theme}\` + use_figma.`);
if (theme === 'light') {
  lines.push('CSS: `node scripts/generate-light-theme-css.mjs`');
}

writeFileSync(themeConfig.auditMd, lines.join('\n'), 'utf8');
console.log('Written:', themeConfig.auditMd);
console.log(`OK: ${ok}, MISMATCH: ${mismatch}`);
