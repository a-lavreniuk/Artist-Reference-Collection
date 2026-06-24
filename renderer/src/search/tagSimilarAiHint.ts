import { showAppNotification } from '../services/notificationService';

const STORAGE_KEY = 'arc-tag-similar-ai-hint-shown';

const HINT_MESSAGE =
  'Сейчас поиск идёт по меткам карточки. Подключите AI-поиск в настройках — подбор похожих будет точнее';

function markTagSimilarAiHintShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasSeenTagSimilarAiHint(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Показать подсказку один раз при fallback-поиске по меткам (без AI). */
export function maybeShowTagSimilarAiHint(): void {
  if (hasSeenTagSimilarAiHint()) return;
  markTagSimilarAiHintShown();
  showAppNotification({
    message: HINT_MESSAGE,
    variant: 'brand',
    skipPrefCheck: true,
    autoDismissMs: 0,
    withSound: false
  });
}
