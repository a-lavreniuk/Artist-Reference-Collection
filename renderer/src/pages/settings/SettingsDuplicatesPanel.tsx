import { useCallback, useEffect, useState } from 'react';
import {
  addSkippedDuplicatePair,
  permanentDeleteCard,
  getDuplicateSimilarityThresholdPct,
  listCardsSorted,
  setDuplicateSimilarityThresholdPct,
  type CardRecord
} from '../../services/db';
import { storageCardsPhash, storageSkippedPairs } from '../../services/storageClient';
import { similarityCombined, type ImageDupFingerprint } from './imageDupHash';
import { cardSizeToBytes } from '../../utils/cardSizeToBytes';
import { formatBytes } from '../../utils/formatBytes';
import { Tooltip } from '../../components/tooltip/Tooltip';
type Pair = { a: CardRecord; b: CardRecord; sim: number };

type PairCardProps = {
  card: CardRecord;
  imageUrl: string;
  absolutePath: string;
  onDelete: () => void;
  onSkip: () => void;
};

function toWindowsPath(rootAbs: string | null, relativePath: string): string {
  const rel = relativePath.replace(/\//g, '\\');
  if (!rootAbs) return rel;
  const root = rootAbs.replace(/[\\/]+$/, '');
  return `${root}\\${rel}`;
}

function formatImageInfo(card: CardRecord): { format: string; resolution: string; size: string } {
  const format = (card.format ?? card.originalRelativePath.split('.').pop() ?? '—').toUpperCase();
  const resolution = card.width && card.height ? `${card.width}×${card.height}` : '—';
  const size = formatBytes(cardSizeToBytes(card));
  return { format, resolution, size };
}

function PairCard({ card, imageUrl, absolutePath, onDelete, onSkip }: PairCardProps) {
  const info = formatImageInfo(card);

  return (
    <article className="arc-dup-card">
      <div className="arc-dup-card__preview">
        <img className="arc-dup-card__img" src={imageUrl} alt="" />
      </div>
      <div className="arc-dup-card__body">
        <Tooltip
          content={absolutePath}
          delay={500}
          position="top"
          className="arc-dup-card__path-tooltip"
        >
          <p className="typo-p-m arc-dup-card__path">{absolutePath}</p>
        </Tooltip>
        <div className="arc-dup-card__meta typo-p-m">
          <span>{info.format}</span>
          <span>{info.resolution}</span>
          <span>{info.size}</span>
        </div>
        <div className="arc-dup-card__actions">
          <button type="button" className="btn btn-danger btn-ds" onClick={onDelete}>
            <span className="btn-ds__value">Удалить эту</span>
            <span className="btn-ds__icon arc-dup-delete-icon" aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-outline btn-ds" onClick={onSkip}>
            <span className="btn-ds__value">Пропустить</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default function SettingsDuplicatesPanel() {
  const [threshold, setThreshold] = useState(85);
  const [scanTick, setScanTick] = useState(0);
  const [current, setCurrent] = useState<Pair | null>(null);
  const [busy, setBusy] = useState(false);
  const [urlA, setUrlA] = useState<string | null>(null);
  const [urlB, setUrlB] = useState<string | null>(null);
  const [libraryRootAbs, setLibraryRootAbs] = useState<string | null>(null);

  const loadThreshold = useCallback(async () => {
    setThreshold(await getDuplicateSimilarityThresholdPct());
  }, []);

  useEffect(() => {
    void loadThreshold();
  }, [loadThreshold]);

  useEffect(() => {
    if (scanTick === 0) return;
    if (!window.arc?.maintenanceBegin) return undefined;
    let cancelled = false;

    void (async () => {
      const arc = window.arc;
      if (!arc) return;
      await arc.maintenanceBegin();
      try {
        if (cancelled) return;
        setBusy(true);
        try {
          const skip = new Set(
            (await storageSkippedPairs()).map(([x, y]) => {
              const a = x < y ? x : y;
              const b = x < y ? y : x;
              return `${a}:${b}`;
            })
          );
          const images = (await listCardsSorted('all')).filter((c) => c.type === 'image').slice(0, 200);
          const storedPhash = await storageCardsPhash();
          const phashById = new Map(storedPhash.map((x) => [x.id, x.phash]));
          const fps = new Map<string, ImageDupFingerprint | null>();
          for (const c of images) {
            if (cancelled) break;
            const stored = phashById.get(c.id);
            if (stored) {
              fps.set(c.id, stored);
              continue;
            }
            const u = await arc.toFileUrl(c.thumbRelativePath);
            if (!u) {
              fps.set(c.id, null);
              continue;
            }
            fps.set(c.id, null);
          }
          if (cancelled) return;
          const thr = await getDuplicateSimilarityThresholdPct();
          let found: Pair | null = null;
          outer: for (let i = 0; i < images.length; i++) {
            if (cancelled) break;
            for (let j = i + 1; j < images.length; j++) {
              const a = images[i]!;
              const b = images[j]!;
              const ka = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
              if (skip.has(ka)) continue;
              const fa = fps.get(a.id);
              const fb = fps.get(b.id);
              if (!fa || !fb) continue;
              const sim = similarityCombined(fa, fb);
              if (sim >= thr) {
                found = { a, b, sim };
                break outer;
              }
            }
          }
          if (!cancelled) {
            setCurrent(found);
            if (found) {
              setUrlA(await arc.toFileUrl(found.a.thumbRelativePath));
              setUrlB(await arc.toFileUrl(found.b.thumbRelativePath));
            } else {
              setUrlA(null);
              setUrlB(null);
            }
          }
        } finally {
          setBusy(false);
        }
      } finally {
        await arc.maintenanceEnd();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scanTick]);

  useEffect(() => {
    if (!window.arc?.getLibraryPath) return;
    void window.arc.getLibraryPath().then((path) => setLibraryRootAbs(path ?? null));
  }, []);

  const skipPair = async () => {
    if (!current) return;
    await addSkippedDuplicatePair(current.a.id, current.b.id);
    setCurrent(null);
    setUrlA(null);
    setUrlB(null);
    setScanTick((t) => t + 1);
  };

  const removeOne = async (id: string) => {
    if (!current) return;
    await permanentDeleteCard(id);
    await addSkippedDuplicatePair(current.a.id, current.b.id);
    setCurrent(null);
    setUrlA(null);
    setUrlB(null);
    setScanTick((t) => t + 1);
  };

  return (
    <div className="arc-dup-screen">
      <div className="arc-dup-controls">
        <div className="field input-live arc-dup-controls__threshold">
          <input
            id="dup-threshold"
            className="input input--size-l"
            type="number"
            min={50}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            onBlur={() => {
              const v = Math.min(100, Math.max(50, Math.round(threshold)));
              setThreshold(v);
              void setDuplicateSimilarityThresholdPct(v).then(() => void loadThreshold());
            }}
          />
        </div>
        <button type="button" className="btn btn-brand btn-ds" onClick={() => setScanTick((t) => t + 1)} disabled={busy}>
          <span className="btn-ds__value">{busy ? 'Поиск…' : 'Найти похожее'}</span>
        </button>
      </div>

      {!busy && current && urlA && urlB ? (
        <div className="arc-dup-grid">
          <PairCard
            card={current.a}
            imageUrl={urlA}
            absolutePath={toWindowsPath(libraryRootAbs, current.a.originalRelativePath)}
            onDelete={() => void removeOne(current.a.id)}
            onSkip={() => void skipPair()}
          />
          <PairCard
            card={current.b}
            imageUrl={urlB}
            absolutePath={toWindowsPath(libraryRootAbs, current.b.originalRelativePath)}
            onDelete={() => void removeOne(current.b.id)}
            onSkip={() => void skipPair()}
          />
        </div>
      ) : null}

      {!busy && scanTick > 0 && !current ? <p className="typo-p-m hint">Пары с выбранным порогом не найдено.</p> : null}
    </div>
  );
}
