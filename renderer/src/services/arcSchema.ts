/** Контракт файла arc-metadata.json в корне библиотеки */

export type CardRecord = {
  id: string;
  type: 'image' | 'video';
  addedAt: string;
  /** ISO-время создания исходного файла на диске (при импорте). */
  fileCreatedAt?: string;
  dateModified?: string;
  /** Относительно корня библиотеки, с прямыми слэшами */
  originalRelativePath: string;
  /** Малое превью (thumb_s) — для галереи и ленивой загрузки */
  thumbRelativePath: string;
  thumbSRelativePath?: string;
  thumbMRelativePath?: string;
  thumbLRelativePath?: string;
  /** Доминирующий цвет для скелетона (#RRGGBB) */
  dominantColorHex?: string;
  format?: string;
  width?: number;
  height?: number;
  /** Нативная ширина видео (для информации о файле). */
  videoWidth?: number;
  /** Нативная высота видео (для информации о файле). */
  videoHeight?: number;
  /** Длительность видео в миллисекундах. */
  durationMs?: number;
  /** Timestamp кастомного кадра превью. */
  previewFrameMs?: number;
  tagIds: string[];
  collectionIds: string[];
  description?: string;
  /** AI-описание после heavy-индексации (JoyCaption). */
  aiCaption?: string;
  /** Пользовательское имя карточки (не имя файла). */
  name?: string;
  /** Внешняя ссылка, связанная с карточкой. */
  linkUrl?: string;
  fileSize?: number;
  fileSizeMb?: number;
};

export type CollectionRecord = {
  id: string;
  name: string;
  createdAt: string;
  sortIndex: number;
  description?: string;
};

/** Состояние доски мудборда (один глобальный мудборд на библиотеку). */
export type MoodboardBoardV1 = {
  version: 1;
  viewport: { x: number; y: number; scale: number };
  imageInstances: Array<{
    id: string;
    cardId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    zIndex: number;
  }>;
  strokes: Array<{
    id: string;
    points: number[];
    color: string;
    width: number;
    zIndex: number;
  }>;
  shapes: Array<{
    id: string;
    type: 'rect' | 'ellipse' | 'line';
    x: number;
    y: number;
    width?: number;
    height?: number;
    x2?: number;
    y2?: number;
    rotation: number;
    color: string;
    strokeWidth: number;
    zIndex: number;
  }>;
  texts: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    content: string;
    color: string;
    fontSize: number;
    align: 'left' | 'center' | 'right';
    rotation: number;
    zIndex: number;
  }>;
};

export function createEmptyMoodboardBoard(): MoodboardBoardV1 {
  return {
    version: 1,
    viewport: { x: 0, y: 0, scale: 1 },
    imageInstances: [],
    strokes: [],
    shapes: [],
    texts: []
  };
}

export function normalizeMoodboardBoard(raw: unknown): MoodboardBoardV1 {
  const empty = createEmptyMoodboardBoard();
  if (!raw || typeof raw !== 'object') return empty;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return empty;

  const vp = o.viewport;
  let viewport = empty.viewport;
  if (vp && typeof vp === 'object') {
    const v = vp as Record<string, unknown>;
    const x = typeof v.x === 'number' && Number.isFinite(v.x) ? v.x : 0;
    const y = typeof v.y === 'number' && Number.isFinite(v.y) ? v.y : 0;
    let scale = typeof v.scale === 'number' && Number.isFinite(v.scale) ? v.scale : 1;
    scale = Math.min(5, Math.max(0.15, scale));
    viewport = { x, y, scale };
  }

  const imageInstances = Array.isArray(o.imageInstances)
    ? o.imageInstances
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const i = item as Record<string, unknown>;
          const id = typeof i.id === 'string' ? i.id : '';
          const cardId = typeof i.cardId === 'string' ? i.cardId : '';
          if (!id || !cardId) return null;
          const x = typeof i.x === 'number' && Number.isFinite(i.x) ? i.x : 0;
          const y = typeof i.y === 'number' && Number.isFinite(i.y) ? i.y : 0;
          const width = typeof i.width === 'number' && Number.isFinite(i.width) && i.width > 0 ? i.width : 120;
          const height = typeof i.height === 'number' && Number.isFinite(i.height) && i.height > 0 ? i.height : 120;
          const rotation = typeof i.rotation === 'number' && Number.isFinite(i.rotation) ? i.rotation : 0;
          const zIndex = typeof i.zIndex === 'number' && Number.isFinite(i.zIndex) ? i.zIndex : 0;
          return { id, cardId, x, y, width, height, rotation, zIndex };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  const strokes = Array.isArray(o.strokes)
    ? o.strokes
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const s = item as Record<string, unknown>;
          const id = typeof s.id === 'string' ? s.id : '';
          if (!id) return null;
          const points = Array.isArray(s.points)
            ? s.points.flatMap((n) => (typeof n === 'number' && Number.isFinite(n) ? [n] : []))
            : [];
          const color = typeof s.color === 'string' ? s.color : '#c5c7cc';
          const width = typeof s.width === 'number' && Number.isFinite(s.width) && s.width > 0 ? s.width : 3;
          const zIndex = typeof s.zIndex === 'number' && Number.isFinite(s.zIndex) ? s.zIndex : 0;
          return { id, points, color, width, zIndex };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  const shapes = Array.isArray(o.shapes)
    ? o.shapes
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const sh = item as Record<string, unknown>;
          const id = typeof sh.id === 'string' ? sh.id : '';
          const type = sh.type === 'rect' || sh.type === 'ellipse' || sh.type === 'line' ? sh.type : null;
          if (!id || !type) return null;
          const x = typeof sh.x === 'number' && Number.isFinite(sh.x) ? sh.x : 0;
          const y = typeof sh.y === 'number' && Number.isFinite(sh.y) ? sh.y : 0;
          const rotation = typeof sh.rotation === 'number' && Number.isFinite(sh.rotation) ? sh.rotation : 0;
          const color = typeof sh.color === 'string' ? sh.color : '#c5c7cc';
          const strokeWidth =
            typeof sh.strokeWidth === 'number' && Number.isFinite(sh.strokeWidth) && sh.strokeWidth > 0
              ? sh.strokeWidth
              : 2;
          const zIndex = typeof sh.zIndex === 'number' && Number.isFinite(sh.zIndex) ? sh.zIndex : 0;
          const width = typeof sh.width === 'number' && Number.isFinite(sh.width) ? sh.width : undefined;
          const height = typeof sh.height === 'number' && Number.isFinite(sh.height) ? sh.height : undefined;
          const x2 = typeof sh.x2 === 'number' && Number.isFinite(sh.x2) ? sh.x2 : undefined;
          const y2 = typeof sh.y2 === 'number' && Number.isFinite(sh.y2) ? sh.y2 : undefined;
          return { id, type, x, y, width, height, x2, y2, rotation, color, strokeWidth, zIndex };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  const texts = Array.isArray(o.texts)
    ? o.texts
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const t = item as Record<string, unknown>;
          const id = typeof t.id === 'string' ? t.id : '';
          if (!id) return null;
          const x = typeof t.x === 'number' && Number.isFinite(t.x) ? t.x : 0;
          const y = typeof t.y === 'number' && Number.isFinite(t.y) ? t.y : 0;
          const width = typeof t.width === 'number' && Number.isFinite(t.width) && t.width > 0 ? t.width : 200;
          const content = typeof t.content === 'string' ? t.content : '';
          const color = typeof t.color === 'string' ? t.color : '#f2f3f4';
          const fontSize = typeof t.fontSize === 'number' && Number.isFinite(t.fontSize) && t.fontSize > 0 ? t.fontSize : 14;
          const align =
            t.align === 'left' || t.align === 'center' || t.align === 'right' ? t.align : 'left';
          const rotation = typeof t.rotation === 'number' && Number.isFinite(t.rotation) ? t.rotation : 0;
          const zIndex = typeof t.zIndex === 'number' && Number.isFinite(t.zIndex) ? t.zIndex : 0;
          return { id, x, y, width, content, color, fontSize, align, rotation, zIndex };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  return {
    version: 1,
    viewport,
    imageInstances,
    strokes,
    shapes,
    texts
  };
}

export type ArcMetadataV1 = {
  version: 1;
  categories: unknown[];
  tags: unknown[];
  cards: CardRecord[];
  collections: CollectionRecord[];
  moodboardCardIds: string[];
  /** Состояние доски мудборда (опционально). */
  moodboardBoard?: MoodboardBoardV1;
  /** Порог сходства для поиска дублей, % (по умолчанию 85). */
  duplicateSimilarityThresholdPct?: number;
  /** Пропущенные пары дублей как [minId, maxId]. */
  skippedDuplicatePairs?: [string, string][];
};
