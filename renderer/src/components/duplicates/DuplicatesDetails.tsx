import { useState } from 'react';
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

const DEFAULT_SECTIONS_OPEN: SectionsOpen = {
  details: true,
  description: true,
  tags: true,
  collections: true
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

function DetailColumn({
  card,
  libraryRootAbs,
  categories,
  tagsByCategory,
  collectionsById,
  sectionsOpen,
  onSectionOpenChange
}: {
  card: CardRecord | null;
  libraryRootAbs: string | null;
  categories: CategoryRecord[];
  tagsByCategory: Map<string, TagRecord[]>;
  collectionsById: Map<string, CollectionRecord>;
  sectionsOpen: SectionsOpen;
  onSectionOpenChange: (key: DuplicatesDetailSectionKey, open: boolean) => void;
}) {
  if (!card) {
    return <div className="arc-duplicates-details__col arc-card-detail-settings-scroll" />;
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
    <div className="arc-duplicates-details__col arc-card-detail-settings-scroll">
      <div className="arc-card-detail-settings-scroll__pad">
      <CollapsibleSection
        title="Детали"
        open={sectionsOpen.details}
        onOpenChange={(open) => onSectionOpenChange('details', open)}
      >
        <InfoRows
          rows={[
            { label: 'Формат', value: meta.format },
            { label: 'Разрешение', value: meta.resolution },
            { label: 'Размер', value: meta.size },
            { label: 'Дата', value: formatDate(card.addedAt) },
            { label: 'Путь', value: path, title: path }
          ]}
        />
      </CollapsibleSection>

      <div className="arc-card-detail-section-sep" role="separator" />

      <CollapsibleSection
        title="Описание"
        open={sectionsOpen.description}
        onOpenChange={(open) => onSectionOpenChange('description', open)}
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
      </CollapsibleSection>

      <div className="arc-card-detail-section-sep" role="separator" />

      <CollapsibleSection
        title="Метки"
        count={totalTags}
        open={sectionsOpen.tags}
        onOpenChange={(open) => onSectionOpenChange('tags', open)}
      >
        {tagGroups.map(({ cat, tags }) => (
          <div key={cat.id} className="arc-duplicates-details__tag-group">
            <p className="arc-duplicates-details__tag-cat text-s">
              {cat.name}{' '}
              <span className="arc-card-detail-section-count">{tags.length}</span>
            </p>
            <div className="arc-card-detail-tags">
              {tags.map((tag) => (
                <span key={tag.id} className="arc-card-detail-tag-chip arc-card-detail-tag-chip--readonly">
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
      </CollapsibleSection>

      <div className="arc-card-detail-section-sep" role="separator" />

      <CollapsibleSection
        title="Коллекции"
        count={collections.length}
        open={sectionsOpen.collections}
        onOpenChange={(open) => onSectionOpenChange('collections', open)}
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
      </CollapsibleSection>
      </div>
    </div>
  );
}

export function DuplicatesDetailsPanels({ cardA, cardB, libraryRootAbs }: Props) {
  const { categories, tagsByCategory, collectionsById } = useDuplicatePairDetails(cardA, cardB);
  const [sectionsOpen, setSectionsOpen] = useState<SectionsOpen>(DEFAULT_SECTIONS_OPEN);

  const onSectionOpenChange = (key: DuplicatesDetailSectionKey, open: boolean) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: open }));
  };

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
        />
      </div>
    </>
  );
}
