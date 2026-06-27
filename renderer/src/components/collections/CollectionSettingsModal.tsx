import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CollectionRecord, CollectionStats } from '../../services/db';
import ConfirmCollectionDeleteModal from '../layout/ConfirmCollectionDeleteModal';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';

type TabId = 'name' | 'info';

export type CollectionSettingsModalState =
  | { mode: 'create' }
  | { mode: 'edit'; collection: CollectionRecord };

type CreatePayload = {
  name: string;
  description?: string;
};

type EditPayload = {
  collectionId: string;
  name: string;
  description: string;
};

type Props = {
  state: CollectionSettingsModalState;
  stats: CollectionStats | null;
  hostClassName?: string;
  onClose: () => void;
  onCreate: (payload: CreatePayload) => Promise<void>;
  onSave: (payload: EditPayload) => Promise<void>;
  onDelete: (collectionId: string) => Promise<void>;
};

function formatCollectionCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatStatNumber(value: number): string {
  return value.toLocaleString('ru-RU');
}

export default function CollectionSettingsModal({
  state,
  stats,
  hostClassName,
  onClose,
  onCreate,
  onSave,
  onDelete
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lastNonEmptyCreateNameRef = useRef('');
  const [tab, setTab] = useState<TabId>('name');
  const [name, setName] = useState(() => (state.mode === 'edit' ? state.collection.name : ''));
  const [description, setDescription] = useState(() =>
    state.mode === 'edit' ? (state.collection.description ?? '') : ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateName, setDuplicateName] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isEdit = state.mode === 'edit';
  const hasDuplicateNameError = duplicateName;

  const committedBaseline = useMemo(() => {
    if (state.mode !== 'edit') return null;
    return {
      name: state.collection.name,
      description: state.collection.description ?? ''
    };
  }, [state]);

  const isDirty =
    isEdit &&
    committedBaseline !== null &&
    (name.trim() !== committedBaseline.name.trim() ||
      description.trim() !== committedBaseline.description.trim());

  useEffect(() => {
    setTab('name');
    setName(state.mode === 'edit' ? state.collection.name : '');
    setDescription(state.mode === 'edit' ? (state.collection.description ?? '') : '');
    setDuplicateName(false);
    setDeleteConfirmOpen(false);
    lastNonEmptyCreateNameRef.current = '';
  }, [state]);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [tab, name, description, isSaving, stats, deleteConfirmOpen, duplicateName]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const submit = async () => {
    const trimmedName = name.trim();
    if (isSaving) return;
    if (!trimmedName) {
      if (isEdit) {
        setName(state.collection.name);
      } else if (lastNonEmptyCreateNameRef.current) {
        setName(lastNonEmptyCreateNameRef.current);
      }
      return;
    }

    setIsSaving(true);
    setDuplicateName(false);
    const descTrim = description.trim();
    try {
      if (state.mode === 'create') {
        await onCreate({
          name: trimmedName,
          ...(descTrim ? { description: descTrim } : {})
        });
      } else {
        await onSave({
          collectionId: state.collection.id,
          name: trimmedName,
          description: descTrim
        });
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('уже есть')) {
        setDuplicateName(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDisabled = !isEdit || isSaving;
  const primarySaveDisabled = isSaving;

  const infoRows = stats
    ? [
        { label: 'Количество карточек', value: formatStatNumber(stats.cardCount) },
        { label: 'Вес карточек', value: `${formatStatNumber(stats.totalSizeMb)} мб` },
        { label: 'Дата создания', value: formatCollectionCreatedAt(stats.createdAt) }
      ]
    : [];

  const renderTabButton = (tabId: TabId, label: string, disabled = false) => {
    const button = (
      <button
        type="button"
        className={`tab-button${tab === tabId ? ' is-active' : ''}`}
        role="tab"
        aria-selected={tab === tabId}
        id={`arc-collection-modal-tab-${tabId}`}
        aria-controls={`arc-collection-modal-panel-${tabId}`}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setTab(tabId);
        }}
      >
        {label}
      </button>
    );

    if (!disabled) return button;

    return (
      <Tooltip content="Доступно после сохранения" position="top" delay={500}>
        <span className="arc-tooltip-anchor-inline">{button}</span>
      </Tooltip>
    );
  };

  return (
    <>
      <div
        ref={hostRef}
        className={hostClassName ? `arc-modal-host ${hostClassName}` : 'arc-modal-host'}
        aria-hidden="false"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <section
          className="arc-modal"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-label={isEdit ? 'Настройки коллекции' : 'Новая коллекция'}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--tabs">
            <div className="arc-modal__header-tabs tabs" role="tablist" aria-label="Разделы настроек коллекции">
              {renderTabButton('name', 'Название')}
              {renderTabButton('info', 'Информация', !isEdit)}
            </div>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>

          <div className="arc-modal__body">
            {tab === 'name' ? (
              <div
                id="arc-collection-modal-panel-name"
                role="tabpanel"
                aria-labelledby="arc-collection-modal-tab-name"
              >
                <div className="arc-modal__slot">
                  <p className="arc-modal__slot-text">Придумайте название и описание для коллекции.</p>
                </div>
                <div className="arc-modal__slot">
                  <label
                    className={`field input-live${name.trim() ? ' has-value' : ''}${hasDuplicateNameError ? ' field-error' : ''}`}
                    data-live-input
                  >
                    <input
                      className="input"
                      placeholder="Введите название…"
                      value={name}
                      autoFocus
                      aria-invalid={hasDuplicateNameError || undefined}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setName(nextValue);
                        if (!isEdit && nextValue.trim()) {
                          lastNonEmptyCreateNameRef.current = nextValue.trim();
                        }
                        if (hasDuplicateNameError) {
                          setDuplicateName(false);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void submit();
                        }
                      }}
                    />
                    <button
                      className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                      type="button"
                      aria-label="Очистить"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setName('');
                      }}
                    />
                  </label>
                </div>
                <div className="arc-modal__slot">
                  <label className={`field${description.trim() ? ' has-value' : ''}`}>
                    <textarea
                      className="input textarea"
                      placeholder="Введите описание"
                      value={description}
                      rows={3}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {tab === 'info' && isEdit ? (
              <div
                id="arc-collection-modal-panel-info"
                role="tabpanel"
                aria-labelledby="arc-collection-modal-tab-info"
              >
                <div className="arc-category-info-rows">
                  {infoRows.map((row) => (
                    <div key={row.label} className="arc-category-info-row">
                      <span className="arc-category-info-row__label">{row.label}</span>
                      <span className="arc-category-info-row__value">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button
              type="button"
              className="btn btn-ds btn-s btn-danger"
              disabled={deleteDisabled}
              aria-disabled={deleteDisabled}
              onClick={() => {
                if (deleteDisabled) return;
                setDeleteConfirmOpen(true);
              }}
            >
              <span className="btn-ds__value">Удалить</span>
            </button>
            <div className="arc-modal__footer-right">
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onClose} disabled={isSaving}>
                <span className="btn-ds__value">Отмена</span>
              </button>
              <button
                type="button"
                className="btn btn-brand btn-ds btn-s"
                disabled={primarySaveDisabled}
                onClick={() => void submit()}
              >
                <span className="btn-ds__value">
                  {isSaving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Добавить'}
                </span>
                {isEdit ? (
                  <span
                    className="arc-save-dot"
                    data-arc-save-dot
                    aria-hidden="true"
                    hidden={!isDirty || primarySaveDisabled}
                  />
                ) : null}
              </button>
            </div>
          </footer>
        </section>
      </div>

      {deleteConfirmOpen && isEdit ? (
        <ConfirmCollectionDeleteModal
          collectionName={state.collection.name}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            await onDelete(state.collection.id);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
