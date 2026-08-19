import { useEffect } from 'react';
import { matchesShortcut } from '../../shortcuts/matchShortcutEvent';
import { isContextMenuOpen, isEditableTarget } from '../../shortcuts/shortcutGuards';
import type { CardDetailVideoPlayerHandle } from './cardDetailVideoPlayerTypes';

type Options = {
  enabled: boolean;
  playerRef: React.RefObject<CardDetailVideoPlayerHandle | null>;
};

export function useCardDetailVideoShortcuts({ enabled, playerRef }: Options) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isContextMenuOpen()) return;
      const player = playerRef.current;
      if (!player) return;

      if (matchesShortcut(e, 'video.playPause')) {
        e.preventDefault();
        player.togglePlay();
        return;
      }
      if (matchesShortcut(e, 'video.seekBack10')) {
        e.preventDefault();
        player.seekBySeconds(-10);
        return;
      }
      if (matchesShortcut(e, 'video.seekForward30')) {
        e.preventDefault();
        player.seekBySeconds(30);
        return;
      }
      if (matchesShortcut(e, 'video.frameBack1')) {
        e.preventDefault();
        player.stepFrames(-1);
        return;
      }
      if (matchesShortcut(e, 'video.frameForward1')) {
        e.preventDefault();
        player.stepFrames(1);
        return;
      }
      if (matchesShortcut(e, 'video.frameBack10')) {
        e.preventDefault();
        player.stepFrames(-10);
        return;
      }
      if (matchesShortcut(e, 'video.frameForward10')) {
        e.preventDefault();
        player.stepFrames(10);
        return;
      }
      if (matchesShortcut(e, 'video.speedDown')) {
        e.preventDefault();
        player.adjustSpeed(-1);
        return;
      }
      if (matchesShortcut(e, 'video.speedUp')) {
        e.preventDefault();
        player.adjustSpeed(1);
        return;
      }
      if (matchesShortcut(e, 'video.copyFrame')) {
        e.preventDefault();
        void player.copyFrame();
        return;
      }
      if (matchesShortcut(e, 'video.saveFrame')) {
        e.preventDefault();
        void player.saveFrame();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, playerRef]);
}
