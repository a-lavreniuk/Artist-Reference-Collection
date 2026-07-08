const STORAGE_KEY = 'arc-color-format';
const SEARCH_STORAGE_KEY = 'arc-color-search-format';

import type { ColorFormat } from '../utils/colorFormats';
import { COLOR_FORMAT_ORDER, COLOR_SEARCH_FORMAT_ORDER } from '../utils/colorFormats';

export function readColorFormatPreference(): ColorFormat {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw && COLOR_FORMAT_ORDER.includes(raw as ColorFormat)) {
      return raw as ColorFormat;
    }
  } catch {
    /* ignore */
  }
  return 'hex';
}

export function writeColorFormatPreference(format: ColorFormat): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, format);
  } catch {
    /* ignore */
  }
}

/** Формат бара поиска по цвету (допускает Pantone). */
export function readColorSearchFormatPreference(): ColorFormat {
  try {
    const raw = sessionStorage.getItem(SEARCH_STORAGE_KEY);
    if (raw && COLOR_SEARCH_FORMAT_ORDER.includes(raw as ColorFormat)) {
      return raw as ColorFormat;
    }
  } catch {
    /* ignore */
  }
  return 'hex';
}

export function writeColorSearchFormatPreference(format: ColorFormat): void {
  try {
    sessionStorage.setItem(SEARCH_STORAGE_KEY, format);
  } catch {
    /* ignore */
  }
}
