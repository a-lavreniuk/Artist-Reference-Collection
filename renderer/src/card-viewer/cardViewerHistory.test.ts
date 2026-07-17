import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEWER_TRANSFORM } from './cardViewerTransforms';
import {
  canRedoCardViewerHistory,
  canUndoCardViewerHistory,
  createCardViewerHistory,
  pushCardViewerHistory,
  redoCardViewerHistory,
  undoCardViewerHistory
} from './cardViewerHistory';

const base = {
  transform: DEFAULT_VIEWER_TRANSFORM,
  zoomMode: { kind: 'fit' as const },
  pan: { x: 0, y: 0 }
};

describe('cardViewerHistory', () => {
  it('pushes, undoes and redoes view state', () => {
    let history = createCardViewerHistory(base);
    const rotated = {
      ...base,
      transform: { ...DEFAULT_VIEWER_TRANSFORM, rotateDeg: 90 as const }
    };
    history = pushCardViewerHistory(history, rotated);
    expect(canUndoCardViewerHistory(history)).toBe(true);
    expect(history.present.transform.rotateDeg).toBe(90);

    history = undoCardViewerHistory(history);
    expect(history.present.transform.rotateDeg).toBe(0);
    expect(canRedoCardViewerHistory(history)).toBe(true);

    history = redoCardViewerHistory(history);
    expect(history.present.transform.rotateDeg).toBe(90);
  });

  it('does not push identical state', () => {
    let history = createCardViewerHistory(base);
    history = pushCardViewerHistory(history, base);
    expect(canUndoCardViewerHistory(history)).toBe(false);
  });

  it('clears redo stack on new push after undo', () => {
    let history = createCardViewerHistory(base);
    history = pushCardViewerHistory(history, {
      ...base,
      zoomMode: { kind: 'actual' }
    });
    history = undoCardViewerHistory(history);
    history = pushCardViewerHistory(history, {
      ...base,
      zoomMode: { kind: 'scale', factor: 2 }
    });
    expect(canRedoCardViewerHistory(history)).toBe(false);
    expect(history.present.zoomMode).toEqual({ kind: 'scale', factor: 2 });
  });
});
