/**
 * Захват скриншотов для KB v2 из запущенного Electron (dev).
 * Требует: npm run dev уже работает ИЛИ запуск с PLAYWRIGHT_LAUNCH=1.
 *
 *   npx playwright install chromium
 *   node scripts/capture-kb-screenshots.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'kb-v2', 'screenshots');

/** @type {{ id: string; file: string; route: string; selector?: string; action?: string }[]} */
const SHOTS = [
  { id: 'ch2-04', file: 'ch2-navbar-islands.png', route: '/gallery', selector: '.arc-navbar-islands' },
  { id: 'ch2-05', file: 'ch2-tabs-all.png', route: '/gallery', selector: '[data-interface-tour-anchor="main-tabs"]' },
  { id: 'ch2-07', file: 'ch2-search-collapsed.png', route: '/gallery', selector: '[data-interface-tour-anchor="navbar-search"]' },
  { id: 'ch2-14', file: 'ch2-sort-menu.png', route: '/gallery', selector: '[data-interface-tour-anchor="navbar-sort-filters"] button:first-child' },
  { id: 'ch2-21', file: 'ch2-add-button.png', route: '/gallery', selector: '[data-interface-tour-anchor="navbar-add"]' },
  { id: 'ch2-23', file: 'ch2-menu-full.png', route: '/gallery', selector: '[data-interface-tour-anchor="navbar-menu"]' },
  { id: 'ch2-26', file: 'ch2-navbar-compact-tags.png', route: '/tags', selector: '.arc-navbar-islands' },
  { id: 'ch2-28', file: 'ch2-bug-report.png', route: '/gallery', selector: '[data-interface-tour-anchor="bug-report-widget"]' },
  { id: 'ch3-01', file: 'ch3-gallery-grid.png', route: '/gallery', selector: '[data-interface-tour-anchor="gallery-grid"]' },
  { id: 'ch4-06', file: 'ch4-tags-sidebar.png', route: '/tags', selector: '[data-interface-tour-anchor="tags-sidebar"]' },
  { id: 'ch5-01', file: 'ch5-settings-sidebar.png', route: '/settings/general', selector: '.arc-settings-sidebar' },
  { id: 'ch5-02', file: 'ch5-general.png', route: '/settings/general', selector: '.arc-settings-panel' }
];

async function main() {
  let electron;
  let app;
  let launched = false;

  try {
    ({ _electron: electron } = await import('playwright'));
  } catch {
    console.error('Установите Playwright: npx playwright install chromium');
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });

  if (process.env.PLAYWRIGHT_LAUNCH === '1') {
    app = await electron.launch({
      cwd: ROOT,
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'development' }
    });
    launched = true;
  } else {
    try {
      app = await electron.connect({ wsEndpoint: process.env.ARC_CDP_URL ?? 'http://127.0.0.1:9222' });
    } catch {
      console.log('CDP недоступен — запуск отдельного окна (PLAYWRIGHT_LAUNCH=1)...');
      app = await electron.launch({
        cwd: ROOT,
        args: ['.'],
        env: { ...process.env, NODE_ENV: 'development' }
      });
      launched = true;
    }
  }

  const page = app.windows()[0] ?? (await app.firstWindow());
  const manifest = [];

  for (const shot of SHOTS) {
    const hashRoute = `#${shot.route.startsWith('/') ? shot.route : `/${shot.route}`}`;
    await page.goto(`http://localhost:5173/${hashRoute.replace('#', '')}`);
    await page.waitForTimeout(800);

    const el = shot.selector ? page.locator(shot.selector).first() : page;
    const target = shot.selector ? el : page;
    const visible = shot.selector ? await el.isVisible().catch(() => false) : true;

    const outPath = path.join(OUT, shot.file);
    if (visible) {
      await target.screenshot({ path: outPath });
      manifest.push({ ...shot, status: 'ok', path: outPath });
      console.log(`OK ${shot.id} → ${shot.file}`);
    } else {
      manifest.push({ ...shot, status: 'missing_selector' });
      console.warn(`SKIP ${shot.id} — селектор не найден: ${shot.selector}`);
    }
  }

  await writeFile(path.join(OUT, 'capture-manifest.json'), JSON.stringify(manifest, null, 2));

  if (launched) await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
