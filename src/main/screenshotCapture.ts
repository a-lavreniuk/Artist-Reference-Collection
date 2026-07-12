import { BrowserWindow, desktopCapturer, Display, screen } from 'electron';
import { mkdir, unlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';

import { readAppPreferencesSync } from './appPreferences';
import { readLibraryRootSync } from './libraryRootConfig';
import type { ScreenshotRegion } from './screenshotOverlay';
import { importMediaFile, updateCardInStorage } from './storage/libraryStorage';

export type ScreenshotFormat = 'png' | 'jpg' | 'webp';

export function formatScreenshotName(windowTitle?: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const title = sanitizeWindowTitle(windowTitle);
  return title ? `${base} ${title}` : base;
}

export function sanitizeWindowTitle(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function sanitizeFormat(raw: unknown): ScreenshotFormat {
  if (raw === 'png' || raw === 'jpg' || raw === 'webp') return raw;
  return 'webp';
}

function extForFormat(format: ScreenshotFormat): string {
  return format === 'jpg' ? '.jpg' : format === 'png' ? '.png' : '.webp';
}

async function captureDisplayBuffer(
  display: Display
): Promise<{ buffer: Buffer; scaleFactor: number }> {
  const { width, height } = display.size;
  const scaleFactor = display.scaleFactor || 1;
  const thumbWidth = Math.max(1, Math.round(width * scaleFactor));
  const thumbHeight = Math.max(1, Math.round(height * scaleFactor));

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: thumbWidth, height: thumbHeight }
  });

  const displayId = String(display.id);
  const source =
    sources.find((s) => s.display_id === displayId) ??
    sources.find((s) => s.name.toLowerCase().includes(String(display.id))) ??
    sources[0];

  if (!source) {
    throw new Error('Не удалось получить источник экрана');
  }

  return { buffer: source.thumbnail.toPNG(), scaleFactor };
}

export async function capturePrimaryDisplayBuffer(): Promise<{ buffer: Buffer; scaleFactor: number }> {
  return captureDisplayBuffer(screen.getPrimaryDisplay());
}

export async function captureDisplayAtCursorBuffer(): Promise<{ buffer: Buffer; scaleFactor: number }> {
  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  return captureDisplayBuffer(display);
}

async function captureWindowBuffer(windowTitle: string, nativeId?: number): Promise<Buffer> {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 4096, height: 4096 }
  });

  const matchByNativeId = (id: number) =>
    sources.find((s) => {
      const parts = s.id.split(':');
      if (parts[0] !== 'window' || parts.length < 2) return false;
      return parts.some((part) => part === String(id));
    });

  const needle = windowTitle.trim().toLowerCase();
  const source =
    (nativeId != null ? matchByNativeId(nativeId) : undefined) ??
    sources.find((s) => s.name.trim().toLowerCase() === needle) ??
    sources.find((s) => s.name.toLowerCase().includes(needle)) ??
    sources.find((s) => needle.length > 0 && s.name.toLowerCase().includes(needle));

  if (!source) {
    throw new Error('Не удалось получить источник окна');
  }

  const meta = await sharp(source.thumbnail.toPNG()).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 1 || h < 1) {
    throw new Error('Пустой кадр окна');
  }

  return source.thumbnail.toPNG();
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

async function importScreenshotPng(
  pngBuffer: Buffer,
  windowTitle?: string
): Promise<{ ok: true; cardId: string } | { ok: false }> {
  const prefs = readAppPreferencesSync();
  if (!prefs.screenshotsEnabled) return { ok: false };

  const libraryRoot = readLibraryRootSync();
  if (!libraryRoot) return { ok: false };

  let tempPath: string | null = null;

  try {
    const format = sanitizeFormat(prefs.screenshotFormat);
    const encoded = await encodeScreenshotBuffer(pngBuffer, format, prefs.screenshotRetina2x);

    const tempDir = path.join(os.tmpdir(), 'arc-screenshots');
    await mkdir(tempDir, { recursive: true });
    tempPath = path.join(tempDir, `arc-shot-${crypto.randomUUID()}${extForFormat(format)}`);
    await writeFile(tempPath, encoded);

    const result = await importMediaFile(libraryRoot, tempPath);
    if (!result.ok) return { ok: false };

    const cardId = result.row.id;
    await updateCardInStorage(libraryRoot, cardId, { name: formatScreenshotName(windowTitle) });
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
  }
}

export async function importScreenshotFromRegion(
  region: ScreenshotRegion
): Promise<{ ok: true; cardId: string } | { ok: false }> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const { buffer: pngBuffer, scaleFactor } = await capturePrimaryDisplayBuffer();
    const cropped = await cropScreenshotBuffer(pngBuffer, region, scaleFactor);
    return importScreenshotPng(cropped);
  } catch {
    return { ok: false };
  }
}

export async function importScreenshotFromFullscreen(): Promise<{ ok: true; cardId: string } | { ok: false }> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const { buffer: pngBuffer } = await captureDisplayAtCursorBuffer();
    return importScreenshotPng(pngBuffer);
  } catch {
    return { ok: false };
  }
}

export async function importScreenshotFromWindow(
  windowTitle: string,
  nativeId?: number
): Promise<{ ok: true; cardId: string } | { ok: false }> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const pngBuffer = await captureWindowBuffer(windowTitle, nativeId);
    const effectiveTitle = windowTitle.trim() || undefined;
    return importScreenshotPng(pngBuffer, effectiveTitle);
  } catch {
    return { ok: false };
  }
}

export function registerScreenshotIpc(): void {
  // Picker IPC is registered in screenshotOverlay.ts / screenshotWindowPicker.ts
}
