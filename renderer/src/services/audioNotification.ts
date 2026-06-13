import type { DemoAlertVariant } from '../components/layout/DemoAlert';

const SUCCESS_SOUND_URL = './sounds/success.mp3';
const ERROR_SOUND_URL = './sounds/error.mp3';

let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;

function getSuccessAudio(): HTMLAudioElement {
  if (!successAudio) {
    successAudio = new Audio(SUCCESS_SOUND_URL);
  }
  return successAudio;
}

function getErrorAudio(): HTMLAudioElement {
  if (!errorAudio) {
    errorAudio = new Audio(ERROR_SOUND_URL);
  }
  return errorAudio;
}

export function playNotificationSound(variant: DemoAlertVariant): void {
  const audio =
    variant === 'success'
      ? getSuccessAudio()
      : variant === 'warning' || variant === 'danger'
        ? getErrorAudio()
        : null;

  if (!audio) return;

  audio.currentTime = 0;
  void audio.play().catch(() => {
    /* autoplay policy or missing file */
  });
}
