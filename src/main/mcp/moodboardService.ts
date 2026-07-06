import {
  getMoodboardData,
  saveMoodboardData
} from '../storage/libraryStorage';
import type { ArcMoodboardV1 } from '../storage/types';

type MoodboardImageInstance = {
  id: string;
  cardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
};

type MoodboardBoard = {
  version: 1;
  viewport: { x: number; y: number; scale: number };
  imageInstances: MoodboardImageInstance[];
  strokes: unknown[];
  shapes: unknown[];
  texts: unknown[];
};

function pruneBoardForCard(board: MoodboardBoard, cardId: string): MoodboardBoard {
  return {
    ...board,
    imageInstances: board.imageInstances.filter((i) => i.cardId !== cardId)
  };
}

function emptyBoard(): MoodboardBoard {
  return {
    version: 1,
    viewport: { x: 0, y: 0, scale: 1 },
    imageInstances: [],
    strokes: [],
    shapes: [],
    texts: []
  };
}

function normalizeBoard(raw: unknown): MoodboardBoard {
  if (!raw || typeof raw !== 'object') return emptyBoard();
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return emptyBoard();
  const base = emptyBoard();
  const vp = o.viewport;
  if (vp && typeof vp === 'object') {
    const v = vp as Record<string, unknown>;
    base.viewport = {
      x: typeof v.x === 'number' ? v.x : 0,
      y: typeof v.y === 'number' ? v.y : 0,
      scale: typeof v.scale === 'number' ? Math.min(5, Math.max(0.15, v.scale)) : 1
    };
  }
  if (Array.isArray(o.imageInstances)) {
    base.imageInstances = o.imageInstances.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const i = item as Record<string, unknown>;
      if (typeof i.id !== 'string' || typeof i.cardId !== 'string') return [];
      return [
        {
          id: i.id,
          cardId: i.cardId,
          x: typeof i.x === 'number' ? i.x : 0,
          y: typeof i.y === 'number' ? i.y : 0,
          width: typeof i.width === 'number' && i.width > 0 ? i.width : 120,
          height: typeof i.height === 'number' && i.height > 0 ? i.height : 120,
          rotation: typeof i.rotation === 'number' ? i.rotation : 0,
          zIndex: typeof i.zIndex === 'number' ? i.zIndex : 0
        }
      ];
    });
  }
  if (Array.isArray(o.strokes)) base.strokes = o.strokes;
  if (Array.isArray(o.shapes)) base.shapes = o.shapes;
  if (Array.isArray(o.texts)) base.texts = o.texts;
  return base;
}

export async function readMoodboard(libraryRoot: string): Promise<ArcMoodboardV1> {
  return getMoodboardData(libraryRoot);
}

export async function addCardsToMoodboard(libraryRoot: string, cardIds: string[]): Promise<ArcMoodboardV1> {
  const data = await getMoodboardData(libraryRoot);
  const ids = new Set(data.moodboardCardIds);
  for (const id of cardIds) {
    if (id.trim()) ids.add(id.trim());
  }
  const next: ArcMoodboardV1 = { ...data, moodboardCardIds: [...ids] };
  await saveMoodboardData(libraryRoot, next);
  return next;
}

export async function removeCardsFromMoodboard(
  libraryRoot: string,
  cardIds: string[]
): Promise<ArcMoodboardV1> {
  const remove = new Set(cardIds);
  const data = await getMoodboardData(libraryRoot);
  let board = normalizeBoard(data.moodboardBoard);
  for (const cardId of remove) {
    board = pruneBoardForCard(board, cardId);
  }
  const next: ArcMoodboardV1 = {
    version: 1,
    moodboardCardIds: data.moodboardCardIds.filter((id) => !remove.has(id)),
    moodboardBoard: board
  };
  await saveMoodboardData(libraryRoot, next);
  return next;
}

export async function updateMoodboardBoard(
  libraryRoot: string,
  boardRaw: unknown
): Promise<ArcMoodboardV1> {
  const data = await getMoodboardData(libraryRoot);
  const board = normalizeBoard(boardRaw);
  const next: ArcMoodboardV1 = {
    version: 1,
    moodboardCardIds: data.moodboardCardIds,
    moodboardBoard: board
  };
  await saveMoodboardData(libraryRoot, next);
  return next;
}
