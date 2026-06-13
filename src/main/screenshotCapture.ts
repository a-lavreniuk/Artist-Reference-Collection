import { BrowserWindow, desktopCapturer, screen } from 'electron';
import { mkdir, unlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';

import { readAppPreferencesSync } from './appPreferences';
import { readLibraryRootSync } from './libraryRootConfig';
import type { ScreenshotRegion } from './screenshotOverlay';
import { importMediaFile, updateCardInStorage } from './storage/libraryStorage';
import { getMainWindow, showMainWindow } from './windowChrome';

export type ScreenshotFormat = 'png' | 'jpg' | 'webp';

function formatScreenshotName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `screenshot ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sanitizeFormat(raw: unknown): ScreenshotFormat {
  if (raw === 'png' || raw === 'jpg' || raw === 'webp') return raw;
  return 'webp';
}

function extForFormat(format: ScreenshotFormat): string {
  return format === 'jpg' ? '.jpg' : format === 'png' ? '.png' : '.webp';
}

async function capturePrimaryDisplayBuffer(): Promise<{ buffer: Buffer; scaleFactor: number }> {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;
  const scaleFactor = primary.scaleFactor || 1;
  const thumbWidth = Math.max(1, Math.round(width * scaleFactor));
  const thumbHeight = Math.max(1, Math.round(height * scaleFactor));

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: thumbWidth, height: thumbHeight }
  });

  const displayId = String(primary.id);
  const source =
    sources.find((s) => s.display_id === displayId) ??
    sources.find((s) => /primary|screen/i.test(s.name)) ??
    sources[0];

  if (!source) {
    throw new Error('Не удалось получить источник экрана');
  }

  return { buffer: source.thumbnail.toPNG(), scaleFactor };
}

async function cropScreenshotBuffer(
  pngBuffer: Buffer,
  region: ScreenshotRegion,
  scaleFactor: number
): Promise<Buffer> {
  const meta = await sharp(pngBuffer).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;

  const left = Math.max(0, Math.min(imgW - 1, Math.round(region.x * scaleFactor)));
  const top = Math.max(0, Math.min(imgH - 1, Math.round(region.y * scaleFactor)));
  const width = Math.max(1, Math.min(imgW - left, Math.round(region.width * scaleFactor)));
  const height = Math.max(1, Math.min(imgH - top, Math.round(region.height * scaleFactor)));

  return sharp(pngBuffer).extract({ left, top, width, height }).png().toBuffer();
}

async function encodeScreenshotBuffer(
  pngBuffer: Buffer,
  format: ScreenshotFormat,
  retina2x: boolean
): Promise<Buffer> {
  let pipeline = sharp(pngBuffer);
  if (retina2x) {
    const meta = await sharp(pngBuffer).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w > 0 && h > 0) {
      pipeline = sharp(pngBuffer).resize(w * 2, h * 2, { kernel: sharp.kernel.lanczos3 });
    }
  }

  if (format === 'png') return pipeline.png().toBuffer();
  if (format === 'jpg') return pipeline.jpeg({ quality: 92 }).toBuffer();
  return pipeline.webp({ quality: 92 }).toBuffer();
}

function broadcastScreenshotSaved(cardId: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('arc:screenshot-saved', { cardId });
    }
  }
}

function restoreMainWindow(
  mainWin: BrowserWindow | null,
  wasVisible: boolean,
  wasMinimized: boolean
): void {
  if (mainWin && !mainWin.isDestroyed() && (wasVisible || wasMinimized)) {
    showMainWindow();
  }
}

export async function importScreenshotFromRegion(
  region: ScreenshotRegion
): Promise<{ ok: true; cardId: string } | { ok: false }> {
  const prefs = readAppPreferencesSync();
  if (!prefs.screenshotsEnabled) return { ok: false };

  const libraryRoot = readLibraryRootSync();
  if (!libraryRoot) return { ok: false };

  const mainWin = getMainWindow();
  const wasVisible = mainWin?.isVisible() ?? false;
  const wasMinimized = mainWin?.isMinimized() ?? false;

  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.hide();
  }

  await new Promise((resolve) => setTimeout(resolve, 120));

  let tempPath: string | null = null;

  try {
    const { buffer: pngBuffer, scaleFactor } = await capturePrimaryDisplayBuffer();
    const cropped = await cropScreenshotBuffer(pngBuffer, region, scaleFactor);
    const format = sanitizeFormat(prefs.screenshotFormat);
    const encoded = await encodeScreenshotBuffer(cropped, format, prefs.screenshotRetina2x);

    const tempDir = path.join(os.tmpdir(), 'arc-screenshots');
    await mkdir(tempDir, { recursive: true });
    tempPath = path.join(tempDir, `arc-shot-${crypto.randomUUID()}${extForFormat(format)}`);
    await writeFile(tempPath, encoded);

    const result = await importMediaFile(libraryRoot, tempPath);
    if (!result.ok) return { ok: false };

    const cardId = result.row.id;

    if (prefs.screenshotPrefixName) {
      await updateCardInStorage(libraryRoot, cardId, { name: formatScreenshotName() });
    }

    broadcastScreenshotSaved(cardId);
    return { ok: true, cardId };
  } catch {
    return { ok: false };
  } finally {
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch {
        /* ignore */
      }
    }
    restoreMainWindow(mainWin, wasVisible, wasMinimized);
  }
}

export function registerScreenshotIpc(): void {
  // Picker IPC is registered in screenshotOverlay.ts
}
