/** @deprecated Маршрут /add перенаправляется на галерею; импорт — через глобальный overlay (ImportHost). */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import { extractDroppedFilePaths } from '../media/droppedFilePaths';
import { Tooltip } from '../components/tooltip/Tooltip';
import DemoAlert from '../components/layout/DemoAlert';
import TagChipToggleWithTooltip from '../components/tags/TagChipToggleWithTooltip';
import TagSettingsModal, { type TagSettingsModalState } from '../components/tags/TagSettingsModal';
import {
  ARC_CATEGORIES_CHANGED_EVENT,
  ARC_TAGS_CHANGED_EVENT,
  ARC_COLLECTIONS_CHANGED_EVENT,
  addTag,
  deleteTag,
  getAllCategories,
  getTagsByCategory,
  getAllCollections,
  getCollectionCardCounts,
  insertImportedCards,
  isLibraryConfigured,
  updateTag,
  type TagRecord,
  type CollectionRecord,
  type CategoryRecord,
  type CardRecord
} from '../services/db';
import { isImportableMediaPath, isVideoPath } from '../media/allowedImportExtensions';

const MAX_QUEUE = 25;

function capQueueItems(items: QueueItem[]): QueueItem[] {
  if (items.length <= MAX_QUEUE) return items;
  return items.slice(0, MAX_QUEUE);
}

type QueueItem = {
  key: string;
  absPath: string;
  tagIds: string[];
  collectionIds: string[];
  description: string;
};

type TabKey = 'tags' | 'collections' | 'description';

/** Порядок как в EL-TABS-DEFAULT / экран настройки карточки */
const ADD_CARD_TAB_ORDER: TabKey[] = ['tags', 'description', 'collections'];

function basename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

function normalizeFsPathForCompare(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** Превращает абсолютный путь файла в относительный путь внутри корня библиотеки (POSIX slashes). */
function absolutePathToLibraryRelative(absPath: string, libraryRootAbs: string): string | null {
  const abs = normalizeFsPathForCompare(absPath);
  const root = normalizeFsPathForCompare(libraryRootAbs);
  if (!abs.startsWith(`${root}/`) && abs !== root) return null;
  const raw = abs.slice(root.length).replace(/^\/+/, '');
  return raw;
}

async function resolvePreviewUrlForAbsolutePath(absPath: string, libraryRootAbs: string | null): Promise<string | null> {
  if (!window.arc) return null;

  if (libraryRootAbs) {
    const rel = absolutePathToLibraryRelative(absPath, libraryRootAbs);
    if (rel) {
      const url = await window.arc.toFileUrl(rel);
      if (url) return url;
    }
  }

  return await window.arc.toFileUrl(absPath);
}

function extractFormat(pathLike: string): string | undefined {
  const idx = pathLike.lastIndexOf('.');
  if (idx < 0 || idx === pathLike.length - 1) return undefined;
  const ext = pathLike.slice(idx + 1).trim().toLowerCase();
  return ext || undefined;
}

function toMegabytes(bytes: number): number {
  const mb = bytes / (1024 * 1024);
  return Math.round(mb * 1000) / 1000;
}

async function getImageSizeByRelativePath(relativePath: string): Promise<{ width: number; height: number } | null> {
  if (!window.arc) return null;
  const fileUrl = await window.arc.toFileUrl(relativePath);
  if (!fileUrl) return null;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = fileUrl;
  });
}

async function getVideoSizeByRelativePath(relativePath: string): Promise<{ width: number; height: number } | null> {
  if (!window.arc) return null;
  const fileUrl = await window.arc.toFileUrl(relativePath);
  if (!fileUrl) return null;
  return await new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    const done = (dim: { width: number; height: number } | null) => {
      v.removeAttribute('src');
      v.load();
      resolve(dim);
    };
    v.onloadedmetadata = () => {
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (w && h) done({ width: w, height: h });
      else done(null);
    };
    v.onerror = () => done(null);
    v.src = fileUrl;
  });
}

export default function AddCardsPage() {
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [libraryRootAbs, setLibraryRootAbs] = useState<string | null>(null);
  const [previewUrlsByKey, setPreviewUrlsByKey] = useState<Record<string, string | null>>({});
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<TabKey>('tags');
  const [tagSearch, setTagSearch] = useState('');
  const [colSearch, setColSearch] = useState('');
  const [clipboardTagIds, setClipboardTagIds] = useState<string[] | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tagsByCat, setTagsByCat] = useState<Record<string, TagRecord[]>>({});
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const [queueStripDragging, setQueueStripDragging] = useState(false);
  const [tagModal, setTagModal] = useState<TagSettingsModalState | null>(null);
  const [tagsSettingsToast, setTagsSettingsToast] = useState<'copy' | 'apply' | null>(null);
  const tagsSettingsToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueStripRef = useRef<HTMLDivElement>(null);
  const stripDragRef = useRef<{
    pointerId: number | null;
    startClientX: number;
    initialScrollLeft: number;
    dragging: boolean;
  } | null>(null);
  const suppressQueueTileClickRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const active = queue[activeIndex];

  const onAddTabListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const keys = ADD_CARD_TAB_ORDER;
      const i = keys.indexOf(tab);
      let next: TabKey = tab;
      if (e.key === 'Home') next = keys[0];
      else if (e.key === 'End') next = keys[keys.length - 1];
      else if (e.key === 'ArrowRight') next = keys[(i + 1) % keys.length];
      else if (e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length];
      if (next !== tab) {
        setTab(next);
        queueMicrotask(() => {
          document.getElementById(`arc-add-tab-${next}`)?.focus();
        });
      }
    },
    [tab]
  );

  useEffect(() => {
    return () => {
      if (tagsSettingsToastTimerRef.current) {
        window.clearTimeout(tagsSettingsToastTimerRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [queue.length, tab, activeIndex, active?.tagIds.length, active?.collectionIds.length, active?.description]);

  const reloadCatalog = useCallback(async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const map: Record<string, TagRecord[]> = {};
    cats.forEach((c, i) => {
      map[c.id] = lists[i] ?? [];
    });
    setTagsByCat(map);
    setCollections(await getAllCollections());
    setCollCounts(await getCollectionCardCounts());
  }, []);

  useEffect(() => {
    void (async () => {
      setReady(await isLibraryConfigured());
      if (window.arc) {
        setLibraryRootAbs(await window.arc.getLibraryPath());
      } else {
        setLibraryRootAbs(null);
      }
      await reloadCatalog();
    })();
  }, [reloadCatalog]);

  useEffect(() => {
    const onRefresh = () => void reloadCatalog();
    window.addEventListener(ARC_CATEGORIES_CHANGED_EVENT, onRefresh);
    window.addEventListener(ARC_TAGS_CHANGED_EVENT, onRefresh);
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onRefresh);
    return () => {
      window.removeEventListener(ARC_CATEGORIES_CHANGED_EVENT, onRefresh);
      window.removeEventListener(ARC_TAGS_CHANGED_EVENT, onRefresh);
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onRefresh);
    };
  }, [reloadCatalog]);

  useEffect(() => {
    if (!queue.length) {
      setPreviewUrlsByKey({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string | null> = {};
      await Promise.all(
        queue.map(async (item) => {
          const url = await resolvePreviewUrlForAbsolutePath(item.absPath, libraryRootAbs);
          if (!cancelled) next[item.key] = url;
        })
      );
      if (!cancelled) setPreviewUrlsByKey(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [queue, libraryRootAbs]);

  const handleSubmitAll = useCallback(async () => {
    setError(null);
    if (!(await isLibraryConfigured())) {
      setError('Сначала укажите папку библиотеки в разделе «Настройки → Библиотека».');
      return;
    }
    if (!queue.length) {
      setError('Добавьте хотя бы один файл.');
      return;
    }
    if (!window.arc) {
      setError('Импорт доступен только в Electron.');
      return;
    }
    setBusy(true);
    try {
      const cappedQueue = capQueueItems(queue);
      const results = await window.arc.importFiles(cappedQueue.map((q) => q.absPath));
      const failures = results.filter((r) => !r.ok).map((r) => r.error);
      const merged: CardRecord[] = [];

      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (!res.ok) continue;
        const row = res.row;
        const src = cappedQueue[i];
        let dimensions: { width: number; height: number } | null =
          row.width && row.height ? { width: row.width, height: row.height } : null;
        if (!dimensions) {
          dimensions =
            row.type === 'image'
              ? await getImageSizeByRelativePath(row.originalRelativePath)
              : await getVideoSizeByRelativePath(row.originalRelativePath);
        }
        const fileSizeMb = toMegabytes(row.fileSize);
        merged.push({
          id: row.id,
          type: row.type,
          addedAt: row.addedAt,
          originalRelativePath: row.originalRelativePath,
          thumbRelativePath: row.thumbRelativePath,
          format: extractFormat(row.originalRelativePath) ?? extractFormat(src.absPath),
          dateModified: row.addedAt,
          fileSize: row.fileSize,
          fileSizeMb,
          ...(dimensions ? dimensions : {}),
          tagIds: src.tagIds,
          collectionIds: src.collectionIds,
          ...(src.description.trim() ? { description: src.description.trim() } : {})
        });
      }

      if (merged.length === 0) {
        setError(failures.length ? failures.join(' ') : 'Не удалось импортировать файлы.');
        return;
      }

      await insertImportedCards(merged);

      if (failures.length) {
        navigate('/gallery', { state: { importWarnings: failures } });
      } else {
        navigate('/gallery');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось импортировать');
    } finally {
      setBusy(false);
    }
  }, [queue, navigate]);

  const appendPaths = useCallback((paths: string[]) => {
    const allowed = paths.filter((p) => isImportableMediaPath(p));
    const skipped = paths.length - allowed.length;
    setQueue((prev) => {
      const safePrev = capQueueItems(prev);
      if (safePrev.length < prev.length) {
        requestAnimationFrame(() =>
          setError(`В очереди не больше ${MAX_QUEUE} файлов — лишнее отброшено.`)
        );
      }
      const remaining = Math.max(0, MAX_QUEUE - safePrev.length);
      if (remaining <= 0) {
        requestAnimationFrame(() =>
          setError(`В очереди уже ${MAX_QUEUE} файлов — удалите часть или завершите импорт.`)
        );
        return safePrev;
      }
      if (skipped > 0) {
        requestAnimationFrame(() =>
          setError(
            `Пропущено файлов с неподдерживаемым расширением: ${skipped}. Допустимы изображения и видео из списка форматов приложения.`
          )
        );
      }
      const slice = allowed.slice(0, remaining).map((absPath) => ({
        key: `${crypto.randomUUID?.() ?? String(Math.random())}-${basename(absPath)}`,
        absPath,
        tagIds: [],
        collectionIds: [],
        description: ''
      }));
      const nextItems = [...safePrev, ...slice];
      const merged = capQueueItems(nextItems);
      if (merged.length < nextItems.length) {
        requestAnimationFrame(() =>
          setError(`В очереди не больше ${MAX_QUEUE} файлов — лишнее отброшено.`)
        );
      } else if (allowed.length > remaining) {
        requestAnimationFrame(() =>
          setError(`Добавлено ${slice.length} из ${allowed.length} файлов (лимит очереди ${MAX_QUEUE}).`)
        );
      } else if (!skipped) {
        requestAnimationFrame(() => setError(null));
      }
      return merged;
    });
  }, []);

  const pickFiles = async () => {
    if (!window.arc) {
      setError('Доступно только в Electron.');
      return;
    }
    try {
      const pick =
        typeof window.arc.pickMediaFiles === 'function'
          ? window.arc.pickMediaFiles
          : window.arc.pickImageFiles;
      const paths = await pick.call(window.arc);
      if (!paths.length) return;
      appendPaths(paths);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось открыть окно выбора файлов');
    }
  };

  const onQueueStripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.arc-add-queue-remove-btn, .arc-add-queue-add-tile')) return;
    const el = queueStripRef.current;
    if (!el) return;
    /* Без setPointerCapture здесь: иначе клик по превью уходит в полосу и не открывает настройки элемента. */
    stripDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      initialScrollLeft: el.scrollLeft,
      dragging: false
    };
  };

  const onQueueStripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = stripDragRef.current;
    const el = queueStripRef.current;
    if (!d || !el || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startClientX;
    if (!d.dragging) {
      if (Math.abs(dx) <= 6) return;
      d.dragging = true;
      suppressQueueTileClickRef.current = true;
      setQueueStripDragging(true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    e.preventDefault();
    el.scrollLeft = d.initialScrollLeft - (e.clientX - d.startClientX);
  };

  const onQueueStripPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = stripDragRef.current;
    const el = queueStripRef.current;
    const wasDragging = Boolean(d?.dragging);
    if (d?.dragging && d.pointerId === e.pointerId && el) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (wasDragging) {
      window.setTimeout(() => {
        suppressQueueTileClickRef.current = false;
      }, 0);
    } else {
      suppressQueueTileClickRef.current = false;
    }
    stripDragRef.current = null;
    setQueueStripDragging(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth((d) => d + 1);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth((d) => Math.max(0, d - 1));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragDepth(0);
    const dt = e.dataTransfer;
    if (!dt?.files?.length) return;
    const paths = extractDroppedFilePaths(dt);
    if (!paths.length) {
      void pickFiles();
      return;
    }
    appendPaths(paths);
  };

  const updateActive = (patch: Partial<QueueItem>) => {
    setQueue((prev) => {
      const i = activeIndexRef.current;
      return prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
    });
  };

  const toggleTag = (tagId: string) => {
    if (!active) return;
    const set = new Set(active.tagIds);
    if (set.has(tagId)) set.delete(tagId);
    else set.add(tagId);
    updateActive({ tagIds: [...set] });
  };

  const toggleCollection = (colId: string) => {
    if (!active) return;
    const set = new Set(active.collectionIds);
    if (set.has(colId)) set.delete(colId);
    else set.add(colId);
    updateActive({ collectionIds: [...set] });
  };

  const removeFromQueue = (key: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((q) => q.key === key);
      const next = prev.filter((q) => q.key !== key);
      if (idx >= 0 && activeIndex >= next.length) {
        setActiveIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const showTagsSettingsToast = (kind: 'copy' | 'apply') => {
    setTagsSettingsToast(kind);
    if (tagsSettingsToastTimerRef.current) {
      window.clearTimeout(tagsSettingsToastTimerRef.current);
    }
    tagsSettingsToastTimerRef.current = window.setTimeout(() => {
      setTagsSettingsToast(null);
      tagsSettingsToastTimerRef.current = null;
    }, 2400);
  };

  const copyTags = () => {
    if (!active) return;
    if (
      active.tagIds.length === 0 &&
      active.description.trim().length === 0 &&
      active.collectionIds.length === 0
    ) {
      return;
    }
    /* В буфер всегда кладём массив (в т.ч. []): «не скопировано» отличаем только null — иначе нельзя применить пустой набор меток ко второй карточке. */
    setClipboardTagIds([...(active.tagIds ?? [])]);
    showTagsSettingsToast('copy');
  };

  const applyTags = () => {
    if (clipboardTagIds === null) return;
    updateActive({ tagIds: [...clipboardTagIds] });
    showTagsSettingsToast('apply');
  };

  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    const rows: { cat: CategoryRecord; tags: TagRecord[] }[] = [];
    for (const cat of categories) {
      const allT = tagsByCat[cat.id] ?? [];
      const tags = q ? allT.filter((t) => t.name.toLowerCase().includes(q)) : allT;
      if (!q || tags.length > 0 || cat.name.toLowerCase().includes(q)) {
        rows.push({ cat, tags: q ? tags : allT });
      }
    }
    return rows;
  }, [categories, tagsByCat, tagSearch]);

  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    return collections.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [collections, colSearch]);

  const descFilled = Boolean(active?.description.trim());
  const activePreviewSrc = active ? previewUrlsByKey[active.key] ?? null : null;

  const canCopyActiveCardSettings = useMemo(() => {
    if (!active) return false;
    return (
      active.tagIds.length > 0 ||
      active.description.trim().length > 0 ||
      active.collectionIds.length > 0
    );
  }, [active]);

  if (!ready) {
    return (
      <div className="arc-page-empty panel elevation-default">
        <p className="typo-p-m">Сначала укажите папку библиотеки в разделе «Настройки → Библиотека».</p>
      </div>
    );
  }

  const dropzoneActive = dragDepth > 0;

  return (
    <div
      ref={hostRef}
      className={`arc-add-page${queue.length === 0 ? ' arc-add-page--empty' : ' arc-add-page--with-queue'}`}
    >
      {queue.length > 0 ? (
        <div className="arc-page-actions">
          <button className="btn btn-outline btn-ds" type="button" onClick={() => navigate('/gallery')}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button
            className="btn btn-success btn-ds"
            type="button"
            disabled={busy}
            onClick={() => void handleSubmitAll()}
            aria-label={`Добавить ${queue.length} карточек`}
          >
            <span className="btn-ds__value">Добавить</span>
            <span className="btn-ds__counter">{queue.length}</span>
            <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {queue.length === 0 ? (
        <div
          className={`arc-add-dropzone panel elevation-sunken${dropzoneActive ? ' arc-add-dropzone--dropping' : ''}`}
          data-elevation="sunken"
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <div className="arc-add-dropzone-inner">
            <p className="h3 arc-add-dropzone-title">Добавить изображение или видео...</p>
            <p className="typo-p-m arc-add-dropzone-sub">
              Можно перетащить файлы в это окно или нажать на кнопку. Допускается загрузка нескольких файлов
              одновременно, но не более 25-ти в очереди.
            </p>
            <button
              type="button"
              className="btn btn-brand btn-ds arc-add-dropzone-cta"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void pickFiles();
              }}
            >
              <span className="btn-ds__value">Добавить</span>
              <span className="btn-ds__icon arc-add-dropzone-plus-icon" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <div className="arc-add-with-queue">
          <div
            ref={queueStripRef}
            className={`arc-add-queue-scroll panel elevation-default${queueStripDragging ? ' is-dragging-queue' : ''}`}
            role="list"
            onPointerDown={onQueueStripPointerDown}
            onPointerMove={onQueueStripPointerMove}
            onPointerUp={onQueueStripPointerEnd}
            onPointerCancel={onQueueStripPointerEnd}
          >
            {queue.map((item, i) => {
              const isActive = i === activeIndex;
              const previewSrc = previewUrlsByKey[item.key];
              const fileLabel = basename(item.absPath);
              return (
                <div
                  key={item.key}
                  className={`arc-add-queue-tile${isActive ? ' is-active' : ''}`}
                  role="listitem"
                >
                  <button
                    type="button"
                    className="arc-add-queue-tile-main"
                    onClick={() => {
                      if (suppressQueueTileClickRef.current) {
                        suppressQueueTileClickRef.current = false;
                        return;
                      }
                      setActiveIndex(i);
                    }}
                    aria-label={`Выбрать в очереди: ${fileLabel}`}
                  >
                    {previewSrc ? (
                      isVideoPath(item.absPath) ? (
                        <video
                          className="arc-add-queue-tile-video"
                          src={previewSrc}
                          muted
                          playsInline
                          preload="metadata"
                          aria-hidden
                        />
                      ) : (
                        <img className="arc-add-queue-tile-img" src={previewSrc} alt="" loading="lazy" decoding="async" />
                      )
                    ) : null}
                  </button>
                  <div className="arc-ui-kit-scope arc-add-queue-tile-remove" data-btn-size="s">
                    <button
                      type="button"
                      className="btn btn-danger btn-icon-only btn-ds arc-add-queue-remove-btn"
                      aria-label={`Убрать из очереди ${fileLabel}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(item.key);
                      }}
                    >
                      <span className="btn-icon-only__glyph arc-add-queue-remove-icon" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
            {queue.length < MAX_QUEUE ? (
              <Tooltip content={`${queue.length} / ${MAX_QUEUE}`} position="top">
                <button
                  type="button"
                  className="arc-add-queue-add-tile"
                  onClick={() => void pickFiles()}
                  aria-label={`Добавить файлы в очередь (${queue.length} из ${MAX_QUEUE})`}
                >
                  <span className="arc-add-queue-add-tile-plus" aria-hidden="true" />
                </button>
              </Tooltip>
            ) : null}
          </div>

          {active ? (
            <div className="arc-add-workspace">
              <div className="arc-add-preview panel">
                {activePreviewSrc ? (
                  active && isVideoPath(active.absPath) ? (
                    <video
                      className="arc-add-preview-image"
                      src={activePreviewSrc}
                      muted
                      playsInline
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img className="arc-add-preview-image" src={activePreviewSrc} alt="" />
                  )
                ) : null}
              </div>

              <div
                className="arc-add-editor panel elevation-sunken arc-ui-kit-scope"
                data-elevation="sunken"
                data-typo-tone="white"
                data-input-size="m"
                data-btn-size="m"
              >
                <div
                  className="tabs arc-add-tabs"
                  role="tablist"
                  aria-label="Настройка карточки"
                  aria-orientation="horizontal"
                  onKeyDown={onAddTabListKeyDown}
                >
                  {(
                    [
                      ['tags', 'Метки', active.tagIds.length],
                      ['description', 'Описание', descFilled ? 1 : 0],
                      ['collections', 'Коллекции', active.collectionIds.length]
                    ] as const
                  ).map(([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      id={`arc-add-tab-${key}`}
                      aria-selected={tab === key}
                      aria-controls={`arc-add-panel-${key}`}
                      tabIndex={tab === key ? 0 : -1}
                      className={`tab-button${tab === key ? ' is-active' : ''}`}
                      onClick={() => setTab(key)}
                    >
                      <span>{label}</span>
                      {key === 'description' ? (
                        count > 0 ? (
                          <Tooltip content="Есть текст" position="top">
                            <span className="arc-add-tab-dot" aria-hidden="true" />
                          </Tooltip>
                        ) : null
                      ) : count > 0 ? (
                        <span className="tab-counter">{count}</span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="arc-add-tab-panels">
                <div
                  role="tabpanel"
                  id="arc-add-panel-tags"
                  aria-labelledby="arc-add-tab-tags"
                  hidden={tab !== 'tags'}
                  className="arc-add-tab-body"
                >
                    <div className="arc-add-toolbar">
                      <div className="field field-full input-live arc-add-search">
                        <div className="input input--size-m input-slots search-live">
                          <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
                          <input
                            className="search-inner slot-value"
                            placeholder="Поиск метки или категории"
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            aria-label="Поиск метки или категории"
                          />
                        </div>
                      </div>
                      <div className="btn-group btn-group-ds arc-add-tags-btn-group">
                        {canCopyActiveCardSettings ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-ds btn-icon-only"
                            onClick={copyTags}
                            aria-label="Скопировать настройки"
                          >
                            <span className="btn-icon-only__glyph arc-add-copy-settings-icon" aria-hidden="true" />
                          </button>
                        ) : (
                          <Tooltip
                            content="Сначала выберите метку, опишите карточку или укажите коллекцию"
                            position="top"
                          >
                            <span className="arc-tooltip-anchor-inline">
                              <button
                                type="button"
                                className="btn btn-outline btn-ds btn-icon-only"
                                onClick={copyTags}
                                disabled
                                aria-label="Скопировать настройки"
                              >
                                <span className="btn-icon-only__glyph arc-add-copy-settings-icon" aria-hidden="true" />
                              </button>
                            </span>
                          </Tooltip>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-ds btn-icon-only"
                          onClick={applyTags}
                          disabled={clipboardTagIds === null}
                          aria-label="Применить настройки"
                        >
                          <span className="btn-icon-only__glyph arc-add-apply-tags-icon" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="arc-add-tags-scroll">
                      {filteredTags.length === 0 ? (
                        <p className="hint">Нет совпадений поиска или категорий.</p>
                      ) : (
                        <div className="arc-add-tags-categories">
                          {filteredTags.map(({ cat, tags }, index) => (
                            <div key={cat.id} className="arc-add-tag-category-row">
                              <p className="text-m arc-add-tag-category-title">{cat.name}</p>
                              <div className="arc-add-tag-chips-column">
                                {index > 0 ? (
                                  <div className="arc-add-tag-sep" role="separator" aria-hidden="true" />
                                ) : null}
                                <div className="tags-row arc-add-tag-chips--with-add">
                                  {tags.map((t) => (
                                    <TagChipToggleWithTooltip
                                      key={t.id}
                                      tag={t}
                                      categoryColorHex={cat.colorHex}
                                      selected={active.tagIds.includes(t.id)}
                                      onToggle={() => toggleTag(t.id)}
                                    />
                                  ))}
                                  <div
                                    className="arc-ui-kit-scope"
                                    data-elevation="sunken"
                                    data-typo-tone="white"
                                    data-btn-size="s"
                                  >
                                    <Tooltip content="Новая метка" position="top">
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-ds btn-icon-only arc-add-tag-new-btn"
                                        onClick={() => setTagModal({ mode: 'create', categoryId: cat.id })}
                                        aria-label={`Добавить метку в категорию «${cat.name}»`}
                                      >
                                        <span className="btn-icon-only__glyph arc-icon-plus" aria-hidden="true" />
                                      </button>
                                    </Tooltip>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                </div>

                <div
                  role="tabpanel"
                  id="arc-add-panel-description"
                  aria-labelledby="arc-add-tab-description"
                  hidden={tab !== 'description'}
                  className="arc-add-tab-body arc-add-tab-body--description"
                >
                    <div className="field field-full">
                      <textarea
                        id="arcAddDesc"
                        className="input textarea arc-add-textarea"
                        rows={8}
                        placeholder="Кратко опишите содержимое — текст сохранится на карточке."
                        value={active.description}
                        onChange={(e) => updateActive({ description: e.target.value })}
                        aria-label="Описание карточки"
                      />
                    </div>
                </div>

                <div
                  role="tabpanel"
                  id="arc-add-panel-collections"
                  aria-labelledby="arc-add-tab-collections"
                  hidden={tab !== 'collections'}
                  className="arc-add-tab-body"
                >
                    <div className="field field-full input-live arc-add-search">
                      <div className="input input--size-m input-slots search-live">
                        <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
                        <input
                          className="search-inner slot-value"
                          placeholder="Поиск коллекции"
                          value={colSearch}
                          onChange={(e) => setColSearch(e.target.value)}
                          aria-label="Поиск коллекции"
                        />
                      </div>
                    </div>
                    <div className="arc-add-collection-chips">
                      {filteredCols.map((c) => {
                        const sel = active.collectionIds.includes(c.id);
                        const n = collCounts[c.id] ?? 0;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className={`arc-add-collection-chip${sel ? ' is-selected' : ''}`}
                            onClick={() => toggleCollection(c.id)}
                          >
                            <span className="arc-add-collection-chip-name">{c.name}</span>
                            <span className="arc-add-collection-chip-count">{n}</span>
                          </button>
                        );
                      })}
                    </div>
                    {filteredCols.length === 0 ? <p className="hint">Коллекций не найдено</p> : null}
                </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {tagModal ? (
        <TagSettingsModal
          state={tagModal}
          categories={categories}
          onClose={() => setTagModal(null)}
          onCreate={async (payload) => {
            await addTag(payload.categoryId, payload.name, {
              description: payload.description,
              tooltipImageDataUrl: payload.tooltipImageDataUrl
            });
          }}
          onSave={async (payload) => {
            await updateTag(payload.tagId, {
              name: payload.name,
              categoryId: payload.categoryId,
              description: payload.description,
              tooltipImageDataUrl: payload.tooltipImageDataUrl
            });
          }}
          onDelete={async (tagId) => {
            await deleteTag(tagId);
          }}
        />
      ) : null}

      {error ? (
        <p className="hint input-inline-error arc-add-error panel elevation-default" role="alert">
          {error}
        </p>
      ) : null}

      {busy ? <p className="hint arc-add-busy">Импортирование…</p> : null}

      {tagsSettingsToast ? (
        <DemoAlert
          message={tagsSettingsToast === 'copy' ? 'Настройки скопированы.' : 'Настройки применены.'}
          variant="success"
          onClose={() => {
            setTagsSettingsToast(null);
            if (tagsSettingsToastTimerRef.current) {
              window.clearTimeout(tagsSettingsToastTimerRef.current);
              tagsSettingsToastTimerRef.current = null;
            }
          }}
        />
      ) : null}
    </div>
  );
}
