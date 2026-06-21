import type { AlertVariant } from '../components/alert/types';
import { getAppPreferencesSync } from './appPreferencesRuntime';

const SUCCESS_SOUND_URL = './sounds/success.mp3';
const INFO_SOUND_URL = './sounds/info.mp3';
const WARNING_SOUND_URL = './sounds/warning.mp3';
const ERROR_SOUND_URL = './sounds/error.mp3';

const audioByUrl = new Map<string, HTMLAudioElement>();

function getAudio(url: string): HTMLAudioElement {
  let audio = audioByUrl.get(url);
  if (!audio) {
    audio = new Audio(url);
    audioByUrl.set(url, audio);
  }
  return audio;
}

function soundUrlForVariant(variant: AlertVariant): string | null {
  switch (variant) {
    case 'success':
      return SUCCESS_SOUND_URL;
    case 'info':
    case 'brand':
      return INFO_SOUND_URL;
    case 'warning':
      return WARNING_SOUND_URL;
    case 'danger':
      return ERROR_SOUND_URL;
    default:
      return null;
  }
}

export function isNotificationSoundEnabled(): boolean {
  return getAppPreferencesSync().notifySoundEnabled === true;
}

export function playNotificationSound(variant: AlertVariant): void {
  if (!isNotificationSoundEnabled()) return;

  const url = soundUrlForVariant(variant);
  if (!url) return;

  const audio = getAudio(url);
  audio.currentTime = 0;
  void audio.play().catch(() => {
    /* autoplay policy or missing file */
  });
}
