import { useEffect } from 'react';
import type { CardRatingValue } from '@arc-main-shared/cardRating';
import { matchesShortcut } from '../../shortcuts/matchShortcutEvent';
import type { ShortcutId } from '../../shortcuts/shortcutRegistry';
import { isRendererShortcutBlocked } from '../../shortcuts/shortcutGuards';

const RATING_SHORTCUTS: ReadonlyArray<{ id: ShortcutId; rating: CardRatingValue }> = [
  { id: 'detail.rating0', rating: 0 },
  { id: 'detail.rating1', rating: 1 },
  { id: 'detail.rating2', rating: 2 },
  { id: 'detail.rating3', rating: 3 },
  { id: 'detail.rating4', rating: 4 },
  { id: 'detail.rating5', rating: 5 }
];

type Options = {
  enabled: boolean;
  onRate: (rating: CardRatingValue) => void;
};

/** Клавиши 0–5 в открытой деталке: ставят оценку, 0 — снимает. */
export function useCardRatingShortcuts({ enabled, onRate }: Options) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      if (isRendererShortcutBlocked(e)) return;
      const hit = RATING_SHORTCUTS.find((entry) => matchesShortcut(e, entry.id));
      if (!hit) return;
      e.preventDefault();
      onRate(hit.rating);
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled, onRate]);
}
