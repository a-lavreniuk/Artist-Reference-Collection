import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import type { CollectionNameConflictRule, FolderImportPlan, FolderImportTargetMode } from '../../import/folderImportPlan';
import {
  ARC_COLLECTIONS_CHANGED_EVENT,
  addCollection,
  getAllCollections,
  getCollectionCardCounts,
  getCollectionPreviewSlices,
  type CardRecord,
  type CollectionRecord
} from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import CollectionSettingsModal from '../collections/CollectionSettingsModal';
import CollectionPickerRow from '../gallery/CollectionPickerRow';
import SettingsRadioRow from '../settings/SettingsRadioRow';
import { folderBaseName } from '../../import/folderImportPlan';

export type FolderImportDropContext = {
  folderPaths: string[];
  looseFiles: string[];
};

type Props = {
  drop: FolderImportDropContext;
  onClose: () => void;
  onConfirm: (plan: FolderImportPlan) => void;
};

const CONFLICT_OPTIONS: Array<{ id: CollectionNameConflictRule; label: string }> = [
  { id: 'merge', label: 'Добавить в существующую коллекцию с тем же именем' },
  { id: 'suffix', label: 'Создать новую с суффиксом (2), (3)…' },
  { id: 'skip', label: 'Пропустить папку' }
];

export default function ImportFolderCollectionsModal({ drop, onClose, onConfirm }: Props) {
  const { folderPaths, looseFiles } = drop;
  const hostRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [colSearch, setColSearch] = useState('');
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [collectionPreviews, setCollectionPreviews] = useState<Record<string, CardRecord[]>>({});
  const [mode, setMode] = useState<FolderImportTargetMode>('new-per-folder');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [conflictRule, setConflictRule] = useState<CollectionNameConflictRule>('merge');
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);

  const folderNames = useMemo(() => folderPaths.map((p) => folderBaseName(p)), [folderPaths]);
  const isSingleFolder = folderPaths.length === 1;
  const singleFolderName = folderNames[0] ?? '';

  const reloadCatalog = async () => {
    const [cols, counts, previews] = await Promise.all([
      getAllCollections(),
      getCollectionCardCounts(),
      getCollectionPreviewSlices(3)
    ]);
    setCollections(cols);
    setCollCounts(counts);
    setCollectionPreviews(previews);
  };

  useEffect(() => {
    void reloadCatalog();
    const onCatalog = () => void reloadCatalog();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onCatalog);
    return () => window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onCatalog);
  }, []);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [collections, colSearch, collectionPreviews, mode, selectedCollectionId, conflictRule, newCollectionOpen]);

  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    return collections.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [collections, colSearch]);

  const canConfirm =
    mode === 'new-per-folder' || (mode === 'existing' && selectedCollectionId !== null);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      mode,
      existingCollectionId: mode === 'existing' ? selectedCollectionId ?? undefined : undefined,
      conflictRule
    });
  };

  const title = isSingleFolder ? `Импорт папки «${singleFolderName}»` : `Импорт ${folderPaths.length} папок`;

  const introText = isSingleFolder
    ? 'Файлы из корня папки будут добавлены в библиотеку и привязаны к коллекции. Подпапки не просматриваются.'
    : 'Файлы из корня каждой папки будут добавлены в библиотеку. Подпапки не просматриваются.';

  return (
    <ArcAnimatedModalHost
      onClose={onClose}
      closeDisabled={newCollectionOpen}
      hostClassName="arc-modal-host--nested"
    >
      {({ requestClose }) => (
        <>
        <section
          ref={hostRef}
          className="arc-modal arc-ui-kit-scope"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcImportFolderTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcImportFolderTitle">
              {title}
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>

          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">{introText}</p>
            </div>

            {!isSingleFolder ? (
              <div className="arc-modal__slot">
                <p className="arc-modal__slot-text">
                  {folderNames.map((name) => `«${name}»`).join(', ')}
                </p>
              </div>
            ) : null}

            {looseFiles.length > 0 ? (
              <div className="arc-modal__slot">
                <p className="arc-modal__slot-text">
                  {looseFiles.length === 1
                    ? 'Отдельный файл будет импортирован после папок без привязки к коллекции.'
                    : `${looseFiles.length} отдельных файлов будут импортированы после папок без привязки к коллекции.`}
                </p>
              </div>
            ) : null}

            <div className="arc-modal__slot">
              <div className="arc-settings-radio-stack" role="radiogroup" aria-label="Куда добавить файлы">
                <SettingsRadioRow
                  labelSize="s"
                  label={
                    isSingleFolder
                      ? 'Создать коллекцию с именем папки'
                      : 'Создать коллекцию для каждой папки'
                  }
                  checked={mode === 'new-per-folder'}
                  onCheckedChange={(checked) => {
                    if (checked) setMode('new-per-folder');
                  }}
                />
                <SettingsRadioRow
                  labelSize="s"
                  label={
                    isSingleFolder
                      ? 'Добавить в существующую коллекцию'
                      : 'Добавить все файлы в одну коллекцию'
                  }
                  checked={mode === 'existing'}
                  onCheckedChange={(checked) => {
                    if (checked) setMode('existing');
                  }}
                />
              </div>
            </div>

            <hr className="arc-modal__separator" />

            {mode === 'new-per-folder' ? (
              <div className="arc-modal__slot">
                <p className="arc-modal__slot-text">
                  {isSingleFolder
                    ? 'Если коллекция с именем папки уже есть'
                    : 'Если коллекция с именем папки уже есть'}
                </p>
                <div
                  className="arc-settings-radio-stack"
                  role="radiogroup"
                  aria-label="Правило при совпадении имени коллекции"
                >
                  {CONFLICT_OPTIONS.map((opt) => (
                    <SettingsRadioRow
                      key={opt.id}
                      labelSize="s"
                      label={opt.label}
                      checked={conflictRule === opt.id}
                      onCheckedChange={(checked) => {
                        if (checked) setConflictRule(opt.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {mode === 'existing' ? (
              <>
                <div className="arc-modal__slot">
                  <div
                    className={`field field-full search-live${colSearch.length > 0 ? ' has-value' : ''}`}
                  >
                    <div className="input search-field input-slots">
                      <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
                      <input
                        ref={searchInputRef}
                        className="search-inner slot-value"
                        placeholder="Поиск по коллекциям"
                        value={colSearch}
                        onChange={(e) => setColSearch(e.target.value)}
                        aria-label="Поиск по коллекциям"
                      />
                      <button
                        type="button"
                        className="input-inline-icon search-clear-btn input-inline-icon--close slot-trailing arc-icon-close"
                        aria-label="Очистить"
                        onClick={() => {
                          setColSearch('');
                          searchInputRef.current?.focus();
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="arc-modal__slot">
                  {collections.length === 0 ? (
                    <p className="arc-modal__slot-text">Коллекций пока нет.</p>
                  ) : filteredCols.length === 0 ? (
                    <p className="arc-modal__slot-text">Нет совпадений по запросу.</p>
                  ) : (
                    <div className="arc-card-detail-collections-picker__list">
                      {filteredCols.map((collection) => (
                        <CollectionPickerRow
                          key={collection.id}
                          collection={collection}
                          previews={collectionPreviews[collection.id] ?? []}
                          count={collCounts[collection.id] ?? 0}
                          selected={selectedCollectionId === collection.id}
                          disabled={false}
                          onToggle={() =>
                            setSelectedCollectionId((current) =>
                              current === collection.id ? null : collection.id
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
                <hr className="arc-modal__separator" />
                <div className="arc-modal__slot">
                  <button
                    type="button"
                    className="btn btn-outline btn-ds btn-s arc-card-detail-collections-picker__new"
                    onClick={() => setNewCollectionOpen(true)}
                  >
                    <span className="btn-ds__value">Новая коллекция</span>
                    <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <footer className="arc-modal__footer arc-modal__footer--actions-2">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose}>
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button
              type="button"
              className="btn btn-brand btn-ds btn-s"
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              <span className="btn-ds__value">Импортировать</span>
            </button>
          </footer>
        </section>

        {newCollectionOpen ? (
          <CollectionSettingsModal
            state={{ mode: 'create' }}
            stats={null}
            hostClassName="arc-modal-host--nested"
            onClose={() => setNewCollectionOpen(false)}
            onCreate={async (payload) => {
              const created = await addCollection(payload.name, {
                description: payload.description
              });
              setSelectedCollectionId(created.id);
              setColSearch('');
              await reloadCatalog();
              setNewCollectionOpen(false);
            }}
            onSave={async () => {}}
            onDelete={async () => {}}
          />
        ) : null}
        </>
      )}
    </ArcAnimatedModalHost>
  );
}
