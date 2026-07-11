type VideoDebugPayload = Record<string, unknown>;

declare global {
  interface Window {
    __ARC_VIDEO_DEBUG__?: boolean;
  }
}

export function isVideoPlayerDebugEnabled(): boolean {
  return window.__ARC_VIDEO_DEBUG__ === true;
}

/** Временный трейс действий видеоплеера в консоль (DevTools → фильтр `[ARC video]`). */
export function logVideoPlayer(action: string, payload?: VideoDebugPayload): void {
  if (!isVideoPlayerDebugEnabled()) return;
  if (payload) {
    console.log('[ARC video]', action, payload);
  } else {
    console.log('[ARC video]', action);
  }
}
