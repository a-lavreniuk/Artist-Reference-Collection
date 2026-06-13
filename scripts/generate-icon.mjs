import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'build', 'icons');
const icoOut = path.join(iconsDir, 'icon.ico');

/** Размеры, которые нужно подготовить вручную в build/icons/. */
const ICON_SIZES = [16, 32, 64, 128, 256];

function iconPathForSize(size) {
  return size === 256
    ? path.join(iconsDir, 'icon.png')
    : path.join(iconsDir, `icon-${size}.png`);
}

async function requireIcon(size) {
  const filePath = iconPathForSize(size);
  try {
    await access(filePath);
  } catch {
    throw new Error(`Missing ${filePath}. Add a manually prepared ${size}×${size} PNG.`);
  }
  return readFile(filePath);
}

for (const size of ICON_SIZES) {
  await requireIcon(size);
}

const icoInputs = await Promise.all(ICON_SIZES.map((size) => requireIcon(size)));
const ico = await pngToIco(icoInputs);
await writeFile(icoOut, ico);
console.log('Wrote', icoOut);
