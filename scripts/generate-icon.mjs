import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'build', 'icons');
const icoOut = path.join(iconsDir, 'icon.ico');
const macIconOut = path.join(iconsDir, 'icon-512.png');
const macIconSource = path.join(iconsDir, 'icon.png');

/** Размеры, которые нужно подготовить вручную в build/icons/. */
const ICON_SIZES = [16, 32, 64, 128, 256];

function iconPathForSize(size) {
  return size === 256
    ? macIconSource
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

const sourceMeta = await sharp(macIconSource).metadata();
if ((sourceMeta.width ?? 0) < 512 || (sourceMeta.height ?? 0) < 512) {
  await sharp(macIconSource)
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(macIconOut);
  console.log('Wrote', macIconOut, '(upscaled from icon.png for macOS)');
} else {
  await sharp(macIconSource).png().toFile(macIconOut);
  console.log('Wrote', macIconOut);
}
