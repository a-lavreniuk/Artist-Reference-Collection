import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  type UIEvent
} from 'react';
import type { CardRecord, CollectionRecord } from '../../services/arcSchema';
import type { CategoryRecord, TagRecord } from '../../services/db';
import CollapsibleSection from '../gallery/CollapsibleSection';
import { formatFileMeta, toDisplayPath } from './duplicateCompareUtils';
import { useDuplicatePairDetails } from './useDuplicatePairDetails';

type Props = {
  cardA: CardRecord | null;
  cardB: CardRecord | null;
  libraryRootAbs: string | null;
};

export type DuplicatesDetailSectionKey = 'details' | 'description' | 'tags' | 'collections';

type SectionsOpen = Record<DuplicatesDetailSectionKey, boolean>;

type SectionMinHeights = Record<DuplicatesDetailSectionKey, number>;

type SectionMeasureRefs = Partial<Record<DuplicatesDetailSectionKey, HTMLDivElement | null>>;

const SECTION_KEYS: DuplicatesDetailSectionKey[] = [
  'details',
  'description',
  'tags',
  'collections'
];

const DEFAULT_SECTIONS_OPEN: SectionsOpen = {
  details: true,
  description: true,
  tags: true,
  collections: true
};

const ZERO_MIN_HEIGHTS: SectionMinHeights = {
  details: 0,
  description: 0,
  tags: 0,
  collections: 0
};

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function InfoRows({ rows }: { rows: { label: string; value: string; title?: string }[] }) {
  return (
    <div className="arc-card-info-group">
      {rows.map((row) => (
        <div key={row.label} className="arc-card-info-row">
          <span className="arc-card-info-row__label text-m">{row.label}</span>
          <span className="arc-card-info-row__value text-m" title={row.title}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionFill({
  sectionKey,
  minHeight,
  measureRefs,
  children
}: {
  sectionKey: DuplicatesDetailSectionKey;
  minHeight: number;
  measureRefs: MutableRefObject<SectionMeasureRefs>;
  children: ReactNode;
}) {
  return (
    <div
      className="arc-duplicates-details__section-fill"
      style={minHeight > 0 ? { minHeight } : undefined}
    >
      <div
        className="arc-duplicates-details__section-measure"
        ref={(el) => {
          measureRefs.current[sectionKey] = el;
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DetailColumn({
  card,
  libraryRootAbs,
  categories,
  tagsByCategory,
  collectionsById,
  sectionsOpen,
  onSectionOpenChange,
  scrollRef,
  onScroll,
  measureRefs,
  minHeights
}: {
  card: CardRecord | null;
  libraryRootAbs: string | null;
  categories: CategoryRecord[];
  tagsByCategory: Map<string, TagRecord[]>;
  collectionsById: Map<string, CollectionRecord>;
  sectionsOpen: SectionsOpen;
  onSectionOpenChange: (key: DuplicatesDetailSectionKey, open: boolean) => void;
  scrollRef: Ref<HTMLDivElement>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  measureRefs: MutableRefObject<SectionMeasureRefs>;
  minHeights: SectionMinHeights;
}) {
  if (!card) {
    return (
      <div
        ref={scrollRef}
        className="arc-duplicates-details__col arc-card-detail-settings-scroll"
        onScroll={onScroll}
      />
    );
  }

  const meta = formatFileMeta(card);
  const path = toDisplayPath(libraryRootAbs, card.originalRelativePath);
  const tagIdSet = new Set(card.tagIds ?? []);
  const totalTags = tagIdSet.size;

  const tagGroups = categories
    .map((cat) => {
      const catTags = (tagsByCategory.get(cat.id) ?? []).filter((t) => tagIdSet.has(t.id));
      return { cat, tags: catTags };
    })
    .filter((g) => g.tags.length > 0);

  const collections = (card.collectionIds ?? [])
    .map((id) => collectionsById.get(id))
    .filter((col): col is CollectionRecord => col != null);

  return (
    <div
      ref={scrollRef}
      className="arc-duplicates-details__col arc-card-detail-settings-scroll"
      onScroll={onScroll}
    >
      <div className="arc-card-detail-settings-scroll__pad">
        <CollapsibleSection
          title="Детали"
          open={sectionsOpen.details}
          onOpenChange={(open) => onSectionOpenChange('details', open)}
        >
          <SectionFill sectionKey="details" minHeight={minHeights.details} measureRefs={measureRefs}>
            <InfoRows
              rows={[
                { label: 'Формат', value: meta.format },
                { label: 'Разрешение', value: meta.resolution },
                { label: 'Размер', value: meta.size },
                { label: 'Дата', value: formatDate(card.addedAt) },
                { label: 'Путь', value: path, title: path }
              ]}
            />
          </SectionFill>
        </CollapsibleSection>

        <div className="arc-card-detail-section-sep" role="separator" />

        <CollapsibleSection
          title="Описание"
          open={sectionsOpen.description}
          onOpenChange={(open) => onSectionOpenChange('description', open)}
        >
          <SectionFill
            sectionKey="description"
            minHeight={minHeights.description}
            measureRefs={measureRefs}
          >
            <div className="arc-card-detail-description-fields arc-ui-kit-scope" data-input-size="m">
              <label
                className={`field input-live${card.name?.trim() ? ' has-value' : ''}`}
                data-live-input
              >
                <input
                  className="input"
                  type="text"
                  placeholder="Имя"
                  value={card.name ?? ''}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </label>
              <label
                className={`field input-live${card.linkUrl?.trim() ? ' has-value' : ''}`}
                data-live-input
              >
                <input
                  className="input"
                  type="text"
                  placeholder="Ссылка"
                  value={card.linkUrl ?? ''}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </label>
              <label className="field">
                <textarea
                  className="input textarea"
                  placeholder="Описание"
                  value={card.description ?? ''}
                  readOnly
                  tabIndex={-1}
                  aria-readonly="true"
                  rows={4}
                />
              </label>
            </div>
          </SectionFill>
        </CollapsibleSection>

        <div className="arc-card-detail-section-sep" role="separator" />

        <CollapsibleSection
          title="Метки"
          count={totalTags}
          open={sectionsOpen.tags}
          onOpenChange={(open) => onSectionOpenChange('tags', open)}
        >
          <SectionFill sectionKey="tags" minHeight={minHeights.tags} measureRefs={measureRefs}>
            {tagGroups.map(({ cat, tags }) => (
              <div key={cat.id} className="arc-duplicates-details__tag-group">
                <p className="arc-duplicates-details__tag-cat text-s">
                  {cat.name}{' '}
                  <span className="arc-card-detail-section-count">{tags.length}</span>
                </p>
                <div className="arc-card-detail-tags">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="arc-card-detail-tag-chip arc-card-detail-tag-chip--readonly"
                    >
                      <span
                        className="arc-card-detail-tag-dot"
                        style={{ background: cat.colorHex ?? 'var(--brand-500)' }}
                        aria-hidden="true"
                      />
                      <span className="arc-card-detail-tag-name">{tag.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </SectionFill>
        </CollapsibleSection>

        <div className="arc-card-detail-section-sep" role="separator" />

        <CollapsibleSection
          title="Коллекции"
          count={collections.length}
          open={sectionsOpen.collections}
          onOpenChange={(open) => onSectionOpenChange('collections', open)}
        >
          <SectionFill
            sectionKey="collections"
            minHeight={minHeights.collections}
            measureRefs={measureRefs}
          >
            {collections.length > 0 ? (
              <ul className="arc-card-detail-collections">
                {collections.map((col) => (
                  <li key={col.id} className="arc-card-detail-collection-row panel elevation-sunken">
                    <div className="arc-card-detail-collection-main">
                      <p className="text-l arc-card-detail-collection-name">{col.name}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionFill>
        </CollapsibleSection>
      </div>
    </div>
  );
}

function heightsEqual(a: SectionMinHeights, b: SectionMinHeights): boolean {
  return SECTION_KEYS.every((key) => a[key] === b[key]);
}

export function DuplicatesDetailsPanels({ cardA, cardB, libraryRootAbs }: Props) {
  const { categories, tagsByCategory, collectionsById } = useDuplicatePairDetails(cardA, cardB);
  const [sectionsOpen, setSectionsOpen] = useState<SectionsOpen>(DEFAULT_SECTIONS_OPEN);
  const [minHeights, setMinHeights] = useState<SectionMinHeights>(ZERO_MIN_HEIGHTS);

  const scrollARef = useRef<HTMLDivElement>(null);
  const scrollBRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);
  const measureARefs = useRef<SectionMeasureRefs>({});
  const measureBRefs = useRef<SectionMeasureRefs>({});

  const onSectionOpenChange = (key: DuplicatesDetailSectionKey, open: boolean) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: open }));
  };

  const remeasureSectionHeights = useCallback(() => {
    const next: SectionMinHeights = { ...ZERO_MIN_HEIGHTS };
    for (const key of SECTION_KEYS) {
      if (!sectionsOpen[key]) {
        next[key] = 0;
        continue;
      }
      const heightA = measureARefs.current[key]?.offsetHeight ?? 0;
      const heightB = measureBRefs.current[key]?.offsetHeight ?? 0;
      next[key] = Math.max(heightA, heightB);
    }
    setMinHeights((prev) => (heightsEqual(prev, next) ? prev : next));
  }, [sectionsOpen]);

  useLayoutEffect(() => {
    remeasureSectionHeights();

    const observed = new Set<Element>();
    const ro = new ResizeObserver(() => {
      remeasureSectionHeights();
    });

    for (const key of SECTION_KEYS) {
      const a = measureARefs.current[key];
      const b = measureBRefs.current[key];
      if (a) {
        ro.observe(a);
        observed.add(a);
      }
      if (b) {
        ro.observe(b);
        observed.add(b);
      }
    }

    return () => {
      ro.disconnect();
      observed.clear();
    };
  }, [
    remeasureSectionHeights,
    cardA,
    cardB,
    categories,
    tagsByCategory,
    collectionsById,
    sectionsOpen
  ]);

  const syncScrollFrom = useCallback((source: 'a' | 'b', event: UIEvent<HTMLDivElement>) => {
    if (syncingScrollRef.current) return;
    const other = source === 'a' ? scrollBRef.current : scrollARef.current;
    if (!other) return;

    const sourceEl = event.currentTarget;
    const otherMax = Math.max(0, other.scrollHeight - other.clientHeight);
    // Mirror only: do not pull the source back. If the peer has no scroll range
    // (empty column), clamping to sharedMax would lock the populated panel at 0.
    const nextTop =
      otherMax > 0
        ? Math.min(
            sourceEl.scrollTop,
            Math.min(Math.max(0, sourceEl.scrollHeight - sourceEl.clientHeight), otherMax)
          )
        : sourceEl.scrollTop;

    syncingScrollRef.current = true;
    if (other.scrollTop !== nextTop) {
      other.scrollTop = nextTop;
    }
    syncingScrollRef.current = false;
  }, []);

  const onScrollA = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      syncScrollFrom('a', event);
    },
    [syncScrollFrom]
  );

  const onScrollB = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      syncScrollFrom('b', event);
    },
    [syncScrollFrom]
  );

  return (
    <>
      <div className="arc-duplicates-panel arc-duplicates-panel--details">
        <DetailColumn
          card={cardA}
          libraryRootAbs={libraryRootAbs}
          categories={categories}
          tagsByCategory={tagsByCategory}
          collectionsById={collectionsById}
          sectionsOpen={sectionsOpen}
          onSectionOpenChange={onSectionOpenChange}
          scrollRef={scrollARef}
          onScroll={onScrollA}
          measureRefs={measureARefs}
          minHeights={minHeights}
        />
      </div>
      <div className="arc-duplicates-panel arc-duplicates-panel--details">
        <DetailColumn
          card={cardB}
          libraryRootAbs={libraryRootAbs}
          categories={categories}
          tagsByCategory={tagsByCategory}
          collectionsById={collectionsById}
          sectionsOpen={sectionsOpen}
          onSectionOpenChange={onSectionOpenChange}
          scrollRef={scrollBRef}
          onScroll={onScrollB}
          measureRefs={measureBRefs}
          minHeights={minHeights}
        />
      </div>
    </>
  );
}
