import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  type UIEvent
} from 'react';
import {
  customFieldValueIsFilled,
  defaultDetailCardTemplate,
  isFieldInMainList,
  isStarterFieldId,
  templateFieldLabel,
  type DetailCardTemplateV1,
  type DetailTemplateField
} from '@arc-main-shared/detailCardTemplate';
import type { CardRecord, CollectionRecord } from '../../services/arcSchema';
import type { CategoryRecord, TagRecord } from '../../services/db';
import CollapsibleSection from '../gallery/CollapsibleSection';
import CardDetailAnnotationsSection from '../gallery/CardDetailAnnotationsSection';
import { formatInfoDate } from '../gallery/cardFileMetaFormat';
import { InfoSplitCard } from '../info-card';
import { formatFileMeta, toDisplayPath } from './duplicateCompareUtils';
import { useDuplicatePairDetails } from './useDuplicatePairDetails';

type Props = {
  cardA: CardRecord | null;
  cardB: CardRecord | null;
  libraryRootA: string | null;
  libraryRootB: string | null;
  libraryNameA?: string | null;
  libraryNameB?: string | null;
  templateA?: DetailCardTemplateV1 | null;
  templateB?: DetailCardTemplateV1 | null;
};

export type DuplicatesDetailSectionKey = 'details' | 'properties' | 'tags' | 'annotations' | 'collections';

type SectionsOpen = Record<DuplicatesDetailSectionKey, boolean>;

type SectionMinHeights = Record<DuplicatesDetailSectionKey, number>;

type SectionMeasureRefs = Partial<Record<DuplicatesDetailSectionKey, HTMLDivElement | null>>;

const SECTION_KEYS: DuplicatesDetailSectionKey[] = [
  'details',
  'properties',
  'tags',
  'annotations',
  'collections'
];

const DEFAULT_SECTIONS_OPEN: SectionsOpen = {
  details: true,
  properties: false,
  tags: false,
  annotations: false,
  collections: false
};

const ZERO_MIN_HEIGHTS: SectionMinHeights = {
  details: 0,
  properties: 0,
  tags: 0,
  annotations: 0,
  collections: 0
};

function normText(value?: string | null): string {
  return (value ?? '').trim();
}

function sortedIdsKey(ids: string[] | undefined): string {
  return [...(ids ?? [])].map(String).sort().join('\0');
}

function annotationsKey(card: CardRecord | null): string {
  return (card?.annotations ?? [])
    .map((annot) => `${annot.id}:${annot.text}`)
    .join('\0');
}

function customFieldsKey(card: CardRecord | null): string {
  const map = card?.customFields ?? {};
  return Object.keys(map)
    .sort()
    .map((key) => {
      const value = map[key];
      return `${key}=${Array.isArray(value) ? value.join(',') : String(value ?? '')}`;
    })
    .join('\0');
}

function fieldHasValue(card: CardRecord, field: DetailTemplateField): boolean {
  if (field.id === 'name') return normText(card.name).length > 0;
  if (field.id === 'link') return normText(card.linkUrl).length > 0;
  if (field.id === 'description') return normText(card.description).length > 0;
  return customFieldValueIsFilled(card.customFields?.[field.id]);
}

function formatTemplateFieldValue(card: CardRecord, field: DetailTemplateField): string {
  if (isStarterFieldId(field.id) || field.id === 'name' || field.id === 'link' || field.id === 'description') {
    if (field.id === 'name') return normText(card.name) || '—';
    if (field.id === 'link') return normText(card.linkUrl) || '—';
    if (field.id === 'description') return normText(card.description) || '—';
  }
  const raw = card.customFields?.[field.id];
  if (Array.isArray(raw)) {
    const parts = raw.map((item) => item.trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }
  if (typeof raw === 'string') return raw.trim() || '—';
  return '—';
}

function fieldChipValues(card: CardRecord, field: DetailTemplateField): string[] | null {
  if (field.type !== 'select' && field.type !== 'multiSelect') return null;
  const raw = card.customFields?.[field.id];
  if (Array.isArray(raw)) return raw.map((item) => item.trim()).filter(Boolean);
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text ? [text] : [];
}

type PropertyRow = {
  id: string;
  label: string;
  value?: string;
  chips?: string[];
};

function listedPropertyRows(card: CardRecord, template: DetailCardTemplateV1): PropertyRow[] {
  return template.fields
    .filter((field) => isFieldInMainList(field, fieldHasValue(card, field)))
    .map((field) => {
      const chips = fieldChipValues(card, field);
      if (chips) {
        return { id: field.id, label: templateFieldLabel(field), chips };
      }
      return {
        id: field.id,
        label: templateFieldLabel(field),
        value: formatTemplateFieldValue(card, field)
      };
    });
}

const LABEL_COLUMN_MAX_PX = 400;

const DETAIL_FIELD_LABELS = ['Формат', 'Разрешение', 'Размер', 'Дата добавления', 'Путь'] as const;

export function clampDuplicatesLabelWidth(px: number): number {
  if (!Number.isFinite(px) || px <= 0) return 0;
  return Math.min(LABEL_COLUMN_MAX_PX, Math.ceil(px));
}

function cardHasSectionContent(
  card: CardRecord | null,
  template: DetailCardTemplateV1,
  key: DuplicatesDetailSectionKey
): boolean {
  if (!card) return false;
  if (key === 'details') return true;
  if (key === 'properties') {
    return template.fields.some(
      (field) => isFieldInMainList(field, fieldHasValue(card, field)) && fieldHasValue(card, field)
    );
  }
  if (key === 'tags') return (card.tagIds ?? []).length > 0;
  if (key === 'annotations') return (card.annotations ?? []).length > 0;
  return (card.collectionIds ?? []).length > 0;
}

/** Секции одной карточки, у которых есть содержимое. */
export function visibleDetailSections(
  card: CardRecord | null,
  template: DetailCardTemplateV1 = defaultDetailCardTemplate()
): DuplicatesDetailSectionKey[] {
  return SECTION_KEYS.filter((key) => cardHasSectionContent(card, template, key));
}

/** Секции пары: панель есть, если она заполнена хотя бы у одной карточки. */
export function visibleDetailSectionsForPair(
  cardA: CardRecord | null,
  templateA: DetailCardTemplateV1,
  cardB: CardRecord | null,
  templateB: DetailCardTemplateV1
): DuplicatesDetailSectionKey[] {
  return SECTION_KEYS.filter(
    (key) =>
      cardHasSectionContent(cardA, templateA, key) || cardHasSectionContent(cardB, templateB, key)
  );
}

export function collectDuplicatesLabelTexts(
  cardA: CardRecord | null,
  templateA: DetailCardTemplateV1,
  libraryNameA: string | null | undefined,
  cardB: CardRecord | null,
  templateB: DetailCardTemplateV1,
  libraryNameB: string | null | undefined
): string[] {
  const labels = new Set<string>(DETAIL_FIELD_LABELS);
  if (libraryNameA || libraryNameB) labels.add('Библиотека');
  const showProperties =
    cardHasSectionContent(cardA, templateA, 'properties') ||
    cardHasSectionContent(cardB, templateB, 'properties');
  if (showProperties) {
    if (cardA) {
      for (const row of listedPropertyRows(cardA, templateA)) labels.add(row.label);
    }
    if (cardB) {
      for (const row of listedPropertyRows(cardB, templateB)) labels.add(row.label);
    }
  }
  return [...labels];
}

/** Какие панели открыть по умолчанию: метаданные всегда; остальные — только при любом расхождении. */
export function sectionsOpenForPair(
  cardA: CardRecord | null,
  cardB: CardRecord | null
): SectionsOpen {
  if (!cardA || !cardB) {
    return { ...DEFAULT_SECTIONS_OPEN };
  }

  const propertiesDiffer =
    normText(cardA.name) !== normText(cardB.name) ||
    normText(cardA.linkUrl) !== normText(cardB.linkUrl) ||
    normText(cardA.description) !== normText(cardB.description) ||
    customFieldsKey(cardA) !== customFieldsKey(cardB);

  return {
    details: true,
    properties: propertiesDiffer,
    tags: sortedIdsKey(cardA.tagIds) !== sortedIdsKey(cardB.tagIds),
    annotations: annotationsKey(cardA) !== annotationsKey(cardB),
    collections: sortedIdsKey(cardA.collectionIds) !== sortedIdsKey(cardB.collectionIds)
  };
}

function InfoRows({ rows }: { rows: PropertyRow[] }) {
  return (
    <div className="arc-card-info-group">
      {rows.map((row) => (
        <div key={row.id} className="arc-card-info-row">
          <span className="arc-card-info-row__label text-m" title={row.label}>
            {row.label}
          </span>
          {row.chips ? (
            <div className="arc-duplicates-details__chips">
              {row.chips.map((chip) => (
                <span key={chip} className="chip">
                  <span>{chip}</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="arc-card-info-row__value text-m">{row.value}</span>
          )}
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
  libraryName,
  template,
  categories,
  tagsByCategory,
  collectionsById,
  sectionsOpen,
  onSectionOpenChange,
  scrollRef,
  onScroll,
  measureRefs,
  minHeights,
  visibleKeys
}: {
  card: CardRecord | null;
  libraryRootAbs: string | null;
  libraryName?: string | null;
  template: DetailCardTemplateV1;
  categories: CategoryRecord[];
  tagsByCategory: Map<string, TagRecord[]>;
  collectionsById: Map<string, CollectionRecord>;
  sectionsOpen: SectionsOpen;
  onSectionOpenChange: (key: DuplicatesDetailSectionKey, open: boolean) => void;
  scrollRef: Ref<HTMLDivElement>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  measureRefs: MutableRefObject<SectionMeasureRefs>;
  minHeights: SectionMinHeights;
  visibleKeys: DuplicatesDetailSectionKey[];
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
  const annotations = card.annotations ?? [];
  const propertyRows = listedPropertyRows(card, template);

  const tagGroups = categories
    .map((cat) => {
      const catTags = (tagsByCategory.get(cat.id) ?? []).filter((t) => tagIdSet.has(t.id));
      return { cat, tags: catTags };
    })
    .filter((g) => g.tags.length > 0);

  const collections = (card.collectionIds ?? [])
    .map((id) => collectionsById.get(id))
    .filter((col): col is CollectionRecord => col != null);

  const sectionsByKey: Partial<Record<DuplicatesDetailSectionKey, ReactNode>> = {
    details: (
      <CollapsibleSection
        title="Детали"
        titleClassName="h2"
        open={sectionsOpen.details}
        onOpenChange={(open) => onSectionOpenChange('details', open)}
      >
        <SectionFill sectionKey="details" minHeight={minHeights.details} measureRefs={measureRefs}>
          <InfoRows
            rows={[
              { id: 'format', label: 'Формат', value: meta.format },
              { id: 'resolution', label: 'Разрешение', value: meta.resolution },
              { id: 'size', label: 'Размер', value: meta.size },
              { id: 'date', label: 'Дата добавления', value: formatInfoDate(card.addedAt) ?? '—' },
              ...(libraryName ? [{ id: 'library', label: 'Библиотека', value: libraryName }] : []),
              { id: 'path', label: 'Путь', value: path }
            ]}
          />
        </SectionFill>
      </CollapsibleSection>
    ),
    properties: (
      <CollapsibleSection
        title="Свойства"
        titleClassName="h2"
        open={sectionsOpen.properties}
        onOpenChange={(open) => onSectionOpenChange('properties', open)}
      >
        <SectionFill
          sectionKey="properties"
          minHeight={minHeights.properties}
          measureRefs={measureRefs}
        >
          {propertyRows.length > 0 ? <InfoRows rows={propertyRows} /> : null}
        </SectionFill>
      </CollapsibleSection>
    ),
    tags: (
      <CollapsibleSection
        title="Метки"
        titleClassName="h2"
        count={totalTags > 0 ? totalTags : undefined}
        open={sectionsOpen.tags}
        onOpenChange={(open) => onSectionOpenChange('tags', open)}
      >
        <SectionFill sectionKey="tags" minHeight={minHeights.tags} measureRefs={measureRefs}>
          {tagGroups.map(({ cat, tags }) => (
            <div key={cat.id} className="arc-duplicates-details__tag-group">
              <p className="h3 arc-duplicates-details__tag-cat">
                {cat.name}{' '}
                <span className="arc-duplicates-details__tag-cat-count">{tags.length}</span>
              </p>
              <div className="arc-card-detail-tags">
                {tags.map((tag) => (
                  <span key={tag.id} className="chip">
                    <span
                      className="chip-color"
                      style={{ background: cat.colorHex ?? 'var(--brand-500)' }}
                      aria-hidden="true"
                    />
                    <span>{tag.name}</span>
                    {tag.usageCount > 0 ? <span className="chip-count">{tag.usageCount}</span> : null}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </SectionFill>
      </CollapsibleSection>
    ),
    annotations: (
      <CollapsibleSection
        title="Аннотации"
        titleClassName="h2"
        count={annotations.length > 0 ? annotations.length : undefined}
        open={sectionsOpen.annotations}
        onOpenChange={(open) => onSectionOpenChange('annotations', open)}
      >
        <SectionFill
          sectionKey="annotations"
          minHeight={minHeights.annotations}
          measureRefs={measureRefs}
        >
          <CardDetailAnnotationsSection
            annotations={annotations}
            hoveredId={null}
            focusedId={null}
            isVideo={card.type === 'video'}
            readOnly
            compact
            onSelect={() => undefined}
            onHover={() => undefined}
            onDelete={() => undefined}
          />
        </SectionFill>
      </CollapsibleSection>
    ),
    collections: (
      <CollapsibleSection
        title="Коллекции"
        titleClassName="h2"
        count={collections.length > 0 ? collections.length : undefined}
        open={sectionsOpen.collections}
        onOpenChange={(open) => onSectionOpenChange('collections', open)}
      >
        <SectionFill
          sectionKey="collections"
          minHeight={minHeights.collections}
          measureRefs={measureRefs}
        >
          {collections.length > 0 ? (
            <ul className="arc-card-detail-collections arc-info-card-list">
              {collections.map((col) => (
                <li key={col.id}>
                  <InfoSplitCard compact title={col.name} />
                </li>
              ))}
            </ul>
          ) : null}
        </SectionFill>
      </CollapsibleSection>
    )
  };

  return (
    <div
      ref={scrollRef}
      className="arc-duplicates-details__col arc-card-detail-settings-scroll arc-ui-kit-scope"
      onScroll={onScroll}
    >
      <div className="arc-card-detail-settings-scroll__pad">
        {visibleKeys.map((key, index) => (
          <Fragment key={key}>
            {index > 0 ? <div className="arc-card-detail-section-sep" role="separator" /> : null}
            {sectionsByKey[key]}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function heightsEqual(a: SectionMinHeights, b: SectionMinHeights): boolean {
  return SECTION_KEYS.every((key) => a[key] === b[key]);
}

export function DuplicatesDetailsPanels({
  cardA,
  cardB,
  libraryRootA,
  libraryRootB,
  libraryNameA,
  libraryNameB,
  templateA,
  templateB
}: Props) {
  const resolvedTemplateA = templateA ?? defaultDetailCardTemplate();
  const resolvedTemplateB = templateB ?? defaultDetailCardTemplate();
  const { categories, tagsByCategory, collectionsById } = useDuplicatePairDetails(cardA, cardB);
  const visibleKeys = useMemo(
    () =>
      visibleDetailSectionsForPair(cardA, resolvedTemplateA, cardB, resolvedTemplateB),
    [cardA, cardB, resolvedTemplateA, resolvedTemplateB]
  );
  const labelTexts = useMemo(
    () =>
      collectDuplicatesLabelTexts(
        cardA,
        resolvedTemplateA,
        libraryNameA,
        cardB,
        resolvedTemplateB,
        libraryNameB
      ),
    [cardA, cardB, libraryNameA, libraryNameB, resolvedTemplateA, resolvedTemplateB]
  );
  const [sectionsOpen, setSectionsOpen] = useState<SectionsOpen>(() =>
    sectionsOpenForPair(cardA, cardB)
  );
  const [minHeights, setMinHeights] = useState<SectionMinHeights>(ZERO_MIN_HEIGHTS);
  const [labelWidthPx, setLabelWidthPx] = useState(0);
  const labelMeasureRef = useRef<HTMLSpanElement>(null);

  const scrollARef = useRef<HTMLDivElement>(null);
  const scrollBRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);
  const measureARefs = useRef<SectionMeasureRefs>({});
  const measureBRefs = useRef<SectionMeasureRefs>({});

  useLayoutEffect(() => {
    setSectionsOpen(sectionsOpenForPair(cardA, cardB));
  }, [cardA?.id, cardB?.id]);

  useLayoutEffect(() => {
    const sample = labelMeasureRef.current;
    if (!sample) return;
    let max = 0;
    for (const label of labelTexts) {
      sample.textContent = label;
      max = Math.max(max, sample.offsetWidth);
    }
    sample.textContent = '';
    const next = clampDuplicatesLabelWidth(max);
    setLabelWidthPx((prev) => (prev === next ? prev : next));
  }, [labelTexts]);

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
    resolvedTemplateA,
    resolvedTemplateB,
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

  const labelWidthStyle =
    labelWidthPx > 0
      ? ({ ['--arc-duplicates-label-w' as string]: `${labelWidthPx}px` } as const)
      : undefined;

  return (
    <div className="arc-duplicates-details-pair" style={labelWidthStyle}>
      <span
        ref={labelMeasureRef}
        className="text-m arc-duplicates-details__label-measure"
        aria-hidden="true"
      />
      <div className="arc-duplicates-panel arc-duplicates-panel--details">
        <DetailColumn
          card={cardA}
          libraryRootAbs={libraryRootA}
          libraryName={libraryNameA}
          template={resolvedTemplateA}
          categories={categories}
          tagsByCategory={tagsByCategory}
          collectionsById={collectionsById}
          sectionsOpen={sectionsOpen}
          onSectionOpenChange={onSectionOpenChange}
          scrollRef={scrollARef}
          onScroll={onScrollA}
          measureRefs={measureARefs}
          minHeights={minHeights}
          visibleKeys={visibleKeys}
        />
      </div>
      <div className="arc-duplicates-panel arc-duplicates-panel--details">
        <DetailColumn
          card={cardB}
          libraryRootAbs={libraryRootB}
          libraryName={libraryNameB}
          template={resolvedTemplateB}
          categories={categories}
          tagsByCategory={tagsByCategory}
          collectionsById={collectionsById}
          sectionsOpen={sectionsOpen}
          onSectionOpenChange={onSectionOpenChange}
          scrollRef={scrollBRef}
          onScroll={onScrollB}
          measureRefs={measureBRefs}
          minHeights={minHeights}
          visibleKeys={visibleKeys}
        />
      </div>
    </div>
  );
}
