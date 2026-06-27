import fs from 'fs';

const lightCss = fs.readFileSync('renderer/public/ui/arc-ui/theme-light.css', 'utf8');
const darkCss = fs.readFileSync('renderer/public/ui/arc-ui/arc-ui.css', 'utf8');

function extractBlock(css, startIndex) {
  let depth = 0;
  let i = css.indexOf('{', startIndex);
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(startIndex, i + 1);
    }
  }
  throw new Error('unclosed block');
}

const lightRaisedStart = lightCss.indexOf('html[data-theme="light"] body[data-elevation="raised"]');
const lightTypoStart = lightCss.indexOf(
  'html[data-theme="light"] body[data-elevation="raised"][data-typo-tone="white"]'
);
const darkPanelStart = darkCss.indexOf('body[data-elevation="raised"],');
const darkRaised2Start = darkCss.indexOf('--input-fill-default: var(--gray-900);');
const darkTypoStart = darkCss.indexOf('body[data-elevation="raised"][data-typo-tone="white"]');

// Rewind darkRaised2Start to rule start
const darkRaised2RuleStart = darkCss.lastIndexOf('body[data-elevation="raised"]', darkRaised2Start);

const lightRaised = extractBlock(lightCss, lightRaisedStart);
const lightTypo = extractBlock(lightCss, lightTypoStart);
const darkPanel = extractBlock(darkCss, darkPanelStart);
const darkRaised2 = extractBlock(darkCss, darkRaised2RuleStart);
const darkTypo = extractBlock(darkCss, darkTypoStart);

const lightSel =
  'html[data-theme="dark"] .arc-interface-tour-host[data-tour-theme="light"],\n' +
  'html[data-theme="dark"] .arc-interface-tour-host[data-tour-theme="light"] .arc-modal,\n' +
  'html[data-theme="dark"] .arc-interface-tour-host[data-tour-theme="light"].arc-ui-kit-scope[data-elevation="raised"]';

const darkSel =
  'html[data-theme="light"] .arc-interface-tour-host[data-tour-theme="dark"],\n' +
  'html[data-theme="light"] .arc-interface-tour-host[data-tour-theme="dark"] .arc-modal,\n' +
  'html[data-theme="light"] .arc-interface-tour-host[data-tour-theme="dark"].arc-ui-kit-scope[data-elevation="raised"]';

const lightTypoSel =
  'html[data-theme="dark"] .arc-interface-tour-host[data-tour-theme="light"].arc-ui-kit-scope[data-elevation="raised"][data-typo-tone="white"],\n' +
  'html[data-theme="dark"] .arc-interface-tour-host[data-tour-theme="light"] .arc-modal[data-typo-tone="white"]';

const darkTypoSel =
  'html[data-theme="light"] .arc-interface-tour-host[data-tour-theme="dark"].arc-ui-kit-scope[data-elevation="raised"][data-typo-tone="white"],\n' +
  'html[data-theme="light"] .arc-interface-tour-host[data-tour-theme="dark"] .arc-modal[data-typo-tone="white"]';

function remap(block, from, to) {
  const normalized = block.replace(/\r\n/g, '\n');
  const normalizedFrom = from.replace(/\r\n/g, '\n');
  if (!normalized.startsWith(normalizedFrom)) {
    throw new Error(`Expected block to start with:\n${normalizedFrom}\nGot:\n${normalized.slice(0, 120)}`);
  }
  return to + normalized.slice(normalizedFrom.length);
}

const lightRaisedFrom =
  'html[data-theme="light"] body[data-elevation="raised"],\n' +
  'html[data-theme="light"] .arc-modal,\n' +
  'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="raised"]';

const lightTypoFrom =
  'html[data-theme="light"] body[data-elevation="raised"][data-typo-tone="white"],\n' +
  'html[data-theme="light"] .arc-ui-kit-scope[data-elevation="raised"][data-typo-tone="white"]';

const darkFrom =
  'body[data-elevation="raised"],\n.arc-modal,\n.arc-ui-kit-scope[data-elevation="raised"]';

const darkTypoFrom =
  'body[data-elevation="raised"][data-typo-tone="white"],\n' +
  '.arc-ui-kit-scope[data-elevation="raised"][data-typo-tone="white"]';

let out =
  '/* Interface tour: inverted theme (product-only). Mirrors theme-light Raised + arc-ui dark Raised. */\n\n';
out += 'html[data-theme="dark"] .arc-interface-tour-host[data-tour-theme="light"] { color-scheme: light; }\n';
out += 'html[data-theme="light"] .arc-interface-tour-host[data-tour-theme="dark"] { color-scheme: dark; }\n\n';
out += remap(lightRaised, lightRaisedFrom, lightSel) + '\n\n';
out += remap(lightTypo, lightTypoFrom, lightTypoSel) + '\n\n';
out += remap(darkPanel, darkFrom, darkSel) + '\n\n';
out += remap(darkRaised2, darkFrom, darkSel) + '\n\n';
out += remap(darkTypo, darkTypoFrom, darkTypoSel) + '\n\n';
out += `${darkSel} {\n`;
out += '  --btn-brand-fill-default: var(--brand-550);\n';
out += '  --btn-brand-fill-hover: var(--brand-600);\n';
out += '  --btn-brand-fill-focus: var(--brand-550);\n';
out += '  --btn-brand-value-default: var(--brand-100);\n';
out += '  --btn-brand-value-hover: var(--brand-50);\n';
out += '  --btn-brand-value-focus: var(--brand-100);\n';
out += '}\n';

fs.writeFileSync('renderer/src/components/onboarding/interfaceTourTheme.css', out);
console.log('written', out.length, 'chars');
