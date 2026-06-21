import type { AppPreferencesV1 } from './appPreferences';

export type UiThemePreference = AppPreferencesV1['uiTheme'];
export type ResolvedUiTheme = 'dark' | 'light';

const SYSTEM_MEDIA = '(prefers-color-scheme: dark)';

let systemListenerAttached = false;
let onSystemThemeChange: (() => void) | null = null;

export function resolveUiTheme(pref: UiThemePreference): ResolvedUiTheme {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia(SYSTEM_MEDIA).matches ? 'dark' : 'light';
  }
  return 'dark';
}

export function applyUiTheme(resolved: ResolvedUiTheme): void {
  const root = document.documentElement;
  const body = document.body;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;

  // Black Bg / White Bg — одни и те же имена групп в обеих темах (без замены).
  // Основной текст приложения: data-typo-tone="white" → Typography/Black Bg.
  if (body) {
    body.dataset.typoTone = 'white';
  }
}

export function syncUiThemeFromPreferences(pref: UiThemePreference): ResolvedUiTheme {
  const resolved = resolveUiTheme(pref);
  applyUiTheme(resolved);
  return resolved;
}

export function attachSystemThemeListener(listener: () => void): () => void {
  onSystemThemeChange = listener;
  if (systemListenerAttached || typeof window === 'undefined' || !window.matchMedia) {
    return () => {
      onSystemThemeChange = null;
    };
  }

  const media = window.matchMedia(SYSTEM_MEDIA);
  const handler = () => onSystemThemeChange?.();
  media.addEventListener('change', handler);
  systemListenerAttached = true;

  return () => {
    media.removeEventListener('change', handler);
    onSystemThemeChange = null;
    systemListenerAttached = false;
  };
}
