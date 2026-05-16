import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const lightPng = path.join(root, 'build', 'icons', 'icon-light.png');
const icoOut = path.join(root, 'build', 'icons', 'icon.ico');

const png = await readFile(lightPng);
const ico = await pngToIco(png);
await writeFile(icoOut, ico);
console.log('Wrote', icoOut);
