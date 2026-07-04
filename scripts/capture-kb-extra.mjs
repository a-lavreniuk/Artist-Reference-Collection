import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'kb-v2', 'screenshots');

/** @type {{ file: string; url: string; sel: string; click?: boolean; shotSel?: string }[]} */
const SHOTS = [
  { file: 'ch5-duplicates-ready.png', url: 'http://localhost:5173/#/duplicates', sel: '.arc-duplicates-fill' },
  {
    file: 'ch5-browser-extension.png',
    url: 'http://localhost:5173/#/settings/browser-extension',
    sel: '.arc-settings-main__content'
  },
  { file: 'ch4-board-empty.png', url: 'http://localhost:5173/#/board', sel: '.arc-empty-state' },
  {
    file: 'ch2-menu-full.png',
    url: 'http://localhost:5173/#/gallery',
    sel: '[data-interface-tour-anchor="navbar-menu"]',
    click: true,
    shotSel: '.context-menu'
  }
];

async function waitForMainPage(app, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      if (win.isClosed()) continue;
      const ready = await win
        .locator('.arc-navbar-islands, .arc-duplicates-fill, .arc-settings-sidebar, .arc-onboarding-setup')
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (ready) return win;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Main ARC window not found');
}

async function main() {
  const { _electron: electron } = await import('playwright');
  await mkdir(OUT, { recursive: true });

  const app = await electron.launch({
    cwd: ROOT,
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'development' },
    timeout: 180000
  });

  const page = await waitForMainPage(app);
  await page.waitForTimeout(1500);

  for (const shot of SHOTS) {
    await page.goto(shot.url);
    await page.waitForTimeout(2500);

    const outPath = path.join(OUT, shot.file);

    if (shot.click) {
      const btn = page.locator(shot.sel).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(700);
        const menu = page.locator(shot.shotSel ?? '.context-menu').first();
        if (await menu.isVisible().catch(() => false)) {
          await menu.screenshot({ path: outPath });
          console.log(`OK ${shot.file}`);
        } else {
          await page.screenshot({ path: outPath });
          console.warn(`FALLBACK ${shot.file} — menu not visible`);
        }
        await page.keyboard.press('Escape');
        continue;
      }
    }

    const el = page.locator(shot.sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.screenshot({ path: outPath });
      console.log(`OK ${shot.file}`);
    } else {
      await page.screenshot({ path: outPath });
      console.warn(`FALLBACK ${shot.file} — selector ${shot.sel}`);
    }
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
