import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(repoRoot, 'renderer/public/ui/arc-ui/arc-ui.html');
const outPath = path.join(repoRoot, 'renderer/src/ui-kit/arcUiKitBoot.ts');

const lines = fs.readFileSync(htmlPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
const start = lines.findIndex((l) => l.includes('const body = document.body'));
const end = lines.findIndex((l, i) => i > start && /^\s*\}\)\(\);\s*$/.test(l));
if (start === -1 || end === -1) {
  console.error('Could not find script bounds', { start, end });
  process.exit(1);
}

let code = lines.slice(start, end).join('\n');
code = code.replace('const body = document.body;', 'const body = scope;');
code = code.replace(/document\.querySelectorAll\(/g, 'scope.querySelectorAll(');
code = code.replace(/document\.querySelector\(/g, 'scope.querySelector(');
code = code.replace(/document\.getElementById\("([^"]+)"\)/g, 'scope.querySelector("#$1")');
code = code.replace(/document\.getElementById\(hostId\)/g, 'scope.querySelector("#" + hostId)');
code = code.replace(/getComputedStyle\(document\.body\)/g, 'getComputedStyle(body)');
code = code.replace(
  /\n\s*initArcModals\(\);/,
  '\n\n      arcUiKitGlyphHydrators.set(scope, hydrateInputGlyphs);\n\n      initArcModals();'
);

const header = `// @ts-nocheck
/** Generated from renderer/public/ui/arc-ui/arc-ui.html — demo logic scoped to .arc-ui-kit-scope. Regenerate: node scripts/gen-ui-kit-boot.mjs */

const arcUiKitGlyphHydrators = new WeakMap<HTMLElement, () => Promise<unknown>>();

/** Повторная подстановка SVG в инпутах после смены \`data-input-size\` на контейнере стенда. */
export function refreshArcUiKitGlyphs(scope: HTMLElement): Promise<unknown> | undefined {
  const fn = arcUiKitGlyphHydrators.get(scope);
  return fn ? fn() : undefined;
}

export function mountArcUiKitDemo(scope: HTMLElement, options?: { signal?: AbortSignal }): void {
  const signal = options?.signal;
  const docOpts = signal ? ({ signal } as AddEventListenerOptions) : undefined;

`;

const footer = `\n}\n`;

fs.writeFileSync(outPath, header + code + footer, 'utf8');
console.log('Wrote', outPath, 'lines', end - start);
