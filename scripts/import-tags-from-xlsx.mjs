/**
 * Импорт категорий и меток из Excel в открытую библиотеку ARC.
 * Usage: npm run import:tags -- "d:/Download/Тэги.xlsx"
 *        npm run import:tags -- "d:/Download/Тэги.xlsx" "D:/Библиотека ARC"
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const XLSX_PATH = process.argv[2] ?? 'd:/Download/Тэги.xlsx';

function readLibraryRootFromConfig() {
  const cfgPath = path.join(process.env.APPDATA || '', 'artist-reference-collection', 'library-root.json');
  if (!fs.existsSync(cfgPath)) return null;
  const j = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  return typeof j.path === 'string' && j.path.trim() ? path.resolve(j.path.trim()) : null;
}

const libraryRoot = process.argv[3] ? path.resolve(process.argv[3]) : readLibraryRootFromConfig();
if (!libraryRoot) {
  console.error('Укажите путь к библиотеке или настройте library-root.json.');
  process.exit(1);
}

const tagCatalogPath = path.join(repoRoot, 'main', 'mcp', 'tagCatalogService.js');
if (!fs.existsSync(tagCatalogPath)) {
  console.error('Сначала выполните: npm run build:main');
  process.exit(1);
}

const Module = require('module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'electron') {
    return { BrowserWindow: { getAllWindows: () => [] } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { createCategory, updateCategoryRecord, createTag, updateTagRecord } = require(tagCatalogPath);
const { listCategories, listAllTags } = require(path.join(repoRoot, 'main', 'storage', 'libraryStorage.js'));

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

function colorsForCount(count) {
  return Array.from({ length: count }, (_, i) => hslToHex(Math.round((i * 360) / count), 68, 50));
}

function readWorkbook(filePath) {
  const wb = XLSX.readFile(filePath);
  const out = {};
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    out[name] = rows
      .map((r) => [String(r[0] ?? '').trim(), String(r[1] ?? '').trim()])
      .filter(([a]) => a.length > 0);
  }
  return out;
}

function norm(value) {
  return value.trim().toLowerCase();
}

function resolveTagName(name, usedNames) {
  const trimmed = name.trim();
  const key = norm(trimmed);
  if (!usedNames.has(key)) {
    usedNames.add(key);
    return trimmed;
  }
  let candidate = `_double${trimmed}`;
  let n = 2;
  while (usedNames.has(norm(candidate))) {
    candidate = `_double${n}${trimmed}`;
    n += 1;
  }
  usedNames.add(norm(candidate));
  return candidate;
}

function main() {
  console.log(`Reading: ${XLSX_PATH}`);
  console.log(`Library: ${libraryRoot}`);
  const workbook = readWorkbook(XLSX_PATH);
  const sheetNames = Object.keys(workbook);
  const palette = colorsForCount(sheetNames.length);

  const stats = {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    tagsCreated: 0,
    tagsUpdated: 0,
    tagsPrefixed: 0,
    errors: [],
  };

  let categories = listCategories(libraryRoot);
  let tags = listAllTags(libraryRoot);
  const usedNames = new Set(tags.map((t) => norm(t.name)));
  const categoryByNorm = new Map(categories.map((c) => [norm(c.name), c]));
  const tagsByCategory = new Map();
  for (const tag of tags) {
    const list = tagsByCategory.get(tag.categoryId) ?? [];
    list.push(tag);
    tagsByCategory.set(tag.categoryId, list);
  }

  for (let i = 0; i < sheetNames.length; i += 1) {
    const sheetName = sheetNames[i];
    const colorHex = palette[i];
    let category = categoryByNorm.get(norm(sheetName));

    try {
      if (!category) {
        category = createCategory(libraryRoot, { name: sheetName, colorHex, weight: 'neutral' });
        categories.push(category);
        categoryByNorm.set(norm(sheetName), category);
        tagsByCategory.set(category.id, []);
        stats.categoriesCreated += 1;
        console.log(`+ category: ${sheetName}`);
      } else {
        category = updateCategoryRecord(libraryRoot, {
          categoryId: category.id,
          colorHex,
          weight: 'neutral',
        });
        stats.categoriesUpdated += 1;
        console.log(`~ category: ${sheetName}`);
      }
    } catch (err) {
      stats.errors.push({ sheet: sheetName, error: String(err instanceof Error ? err.message : err) });
      continue;
    }

    const rows = workbook[sheetName] ?? [];
    for (const [rawName, description] of rows) {
      const name = rawName.trim();
      if (!name) continue;

      const inCategory = (tagsByCategory.get(category.id) ?? []).find((t) => norm(t.name) === norm(name));
      if (inCategory) {
        try {
          const desc = description.trim();
          if ((inCategory.description ?? '') !== desc) {
            const updated = updateTagRecord(libraryRoot, {
              tagId: inCategory.id,
              description: desc || undefined,
            });
            inCategory.description = updated.description;
            stats.tagsUpdated += 1;
          }
        } catch (err) {
          stats.errors.push({ sheet: sheetName, tag: name, error: String(err instanceof Error ? err.message : err) });
        }
        continue;
      }

      const hadName = usedNames.has(norm(name));
      const finalName = resolveTagName(name, usedNames);
      if (hadName && finalName !== name) stats.tagsPrefixed += 1;

      try {
        const desc = description.trim();
        const created = createTag(libraryRoot, {
          categoryId: category.id,
          name: finalName,
          description: desc || undefined,
        });
        const list = tagsByCategory.get(category.id) ?? [];
        list.push(created);
        tagsByCategory.set(category.id, list);
        tags.push(created);
        stats.tagsCreated += 1;
      } catch (err) {
        stats.errors.push({ sheet: sheetName, tag: finalName, error: String(err instanceof Error ? err.message : err) });
      }
    }
  }

  console.log('\nImport complete:');
  console.log(JSON.stringify(stats, null, 2));
  if (stats.errors.length > 0) process.exit(1);
}

main();
