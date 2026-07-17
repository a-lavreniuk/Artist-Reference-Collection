import type { ViewerTransform } from './cardViewerTransforms';
import type { ViewerZoomMode } from './cardViewerZoom';

export type CardViewerPan = { x: number; y: number };

export type CardViewerViewState = {
  transform: ViewerTransform;
  zoomMode: ViewerZoomMode;
  pan: CardViewerPan;
};

export type CardViewerHistoryState = {
  past: CardViewerViewState[];
  present: CardViewerViewState;
  future: CardViewerViewState[];
};

function zoomModeEqual(a: ViewerZoomMode, b: ViewerZoomMode): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'scale' && b.kind === 'scale') return a.factor === b.factor;
  return true;
}

export function viewStateEqual(a: CardViewerViewState, b: CardViewerViewState): boolean {
  return (
    a.transform.rotateDeg === b.transform.rotateDeg &&
    a.transform.flipH === b.transform.flipH &&
    a.transform.flipV === b.transform.flipV &&
    a.transform.grayscale === b.transform.grayscale &&
    zoomModeEqual(a.zoomMode, b.zoomMode) &&
    a.pan.x === b.pan.x &&
    a.pan.y === b.pan.y
  );
}

export function createCardViewerHistory(present: CardViewerViewState): CardViewerHistoryState {
  return { past: [], present, future: [] };
}

/** Push a new present state; clears redo stack. No-op if equal to current present. */
export function pushCardViewerHistory(
  state: CardViewerHistoryState,
  next: CardViewerViewState
): CardViewerHistoryState {
  if (viewStateEqual(state.present, next)) return state;
  return {
    past: [...state.past, state.present],
    present: next,
    future: []
  };
}

export function undoCardViewerHistory(state: CardViewerHistoryState): CardViewerHistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1]!;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future]
  };
}

export function redoCardViewerHistory(state: CardViewerHistoryState): CardViewerHistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0]!;
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1)
  };
}

export function canUndoCardViewerHistory(state: CardViewerHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedoCardViewerHistory(state: CardViewerHistoryState): boolean {
  return state.future.length > 0;
}
