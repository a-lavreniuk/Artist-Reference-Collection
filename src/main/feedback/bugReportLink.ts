import { app, shell } from 'electron';
import fs from 'fs';
import path from 'path';

/** Публичная форма бэта-фидбэка; переопределяется env или bug-report.json. */
export const DEFAULT_BUG_REPORT_FORM_URL =
  'https://forms.yandex.ru/u/6a382e851f1eb55aed4c9c42';

export type BugReportOpenResult =
  | { ok: true; formUrl: string }
  | { ok: false; error: string; code?: 'not_configured' | 'open_failed' };

function readEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function isFormUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function urlFromJson(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const formUrl = typeof r.formUrl === 'string' ? r.formUrl.trim() : '';
  if (isFormUrl(formUrl)) return formUrl;
  const baseUrl = typeof r.baseUrl === 'string' ? r.baseUrl.trim() : '';
  if (isFormUrl(baseUrl)) return baseUrl;
  return null;
}

function readConfigFile(filePath: string): string | null {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return urlFromJson(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export function readBugReportFormUrl(): string | null {
  const fromEnv = readEnv('ARC_BUG_REPORT_URL') || readEnv('ARC_YANDEX_FORM_URL');
  if (isFormUrl(fromEnv)) return fromEnv;

  const configPath = readEnv('ARC_BUG_REPORT_CONFIG');
  if (configPath) {
    const fromPath = readConfigFile(path.resolve(configPath));
    if (fromPath) return fromPath;
  }

  const userData = app.getPath('userData');
  for (const name of ['bug-report.json', 'yandex-feedback.json']) {
    const fromFile = readConfigFile(path.join(userData, name));
    if (fromFile) return fromFile;
  }

  if (isFormUrl(DEFAULT_BUG_REPORT_FORM_URL)) return DEFAULT_BUG_REPORT_FORM_URL;

  return null;
}

export async function openBugReportForm(): Promise<BugReportOpenResult> {
  const formUrl = readBugReportFormUrl();
  if (!formUrl) {
    return {
      ok: false,
      code: 'not_configured',
      error:
        'Ссылка на форму не настроена. Создайте bug-report.json в папке данных ARC (см. docs/bug-report-widget.md).'
    };
  }

  try {
    await shell.openExternal(formUrl);
    return { ok: true, formUrl };
  } catch {
    return { ok: false, code: 'open_failed', error: 'Не удалось открыть браузер.' };
  }
}
