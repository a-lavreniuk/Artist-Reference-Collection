import { useEffect, useState } from 'react';

import { LOADING_SPLASH_LOGO_SRC } from '../content/loadingScreen';

const FADE_MS = 250;

type ProgressPayload = {
  percent: number;
  phaseText: string;
  version: string;
};

export default function LoadingScreenApp() {
  const [percent, setPercent] = useState(0);
  const [phaseText, setPhaseText] = useState('Запуск приложения…');
  const [version, setVersion] = useState('');
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const arc = window.arc;
    if (!arc?.onLoadingProgress) return;

    const unsubProgress = arc.onLoadingProgress((payload: ProgressPayload) => {
      setPercent(Math.max(0, Math.min(100, Math.round(payload.percent))));
      if (payload.phaseText) setPhaseText(payload.phaseText);
      if (payload.version) setVersion(payload.version);
    });

    const unsubFade = arc.onLoadingFadeOut?.(() => {
      setFadingOut(true);
      window.setTimeout(() => {
        arc.signalLoadingFadeComplete?.();
      }, FADE_MS);
    });

    void arc.signalLoadingSplashReady?.();

    return () => {
      unsubProgress();
      unsubFade?.();
    };
  }, []);

  return (
    <div
      className={`arc-loading-screen${fadingOut ? ' arc-loading-screen--fade-out' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={phaseText ? `${percent}%. ${phaseText}` : `${percent}%`}
    >
      <img src={LOADING_SPLASH_LOGO_SRC} alt="" className="arc-loading-screen__logo" width={512} height={512} />
      <p className="arc-loading-screen__percent">{percent}%</p>
      <div className="arc-loading-screen__status">
        <p className="arc-loading-screen__phase">{phaseText}</p>
        {version ? <p className="arc-loading-screen__version">{version}</p> : null}
      </div>
    </div>
  );
}
