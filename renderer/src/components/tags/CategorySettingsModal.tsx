import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CategoryRecord, CategoryStats, CategoryWeight } from '../../services/db';
import { previewCategoryVisibilityChange } from '../../services/db/categories';
import { ArcAnimatedModalHost } from '../../motion';
import ConfirmDeleteCategoryModal from '../layout/ConfirmDeleteCategoryModal';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import ModalCategoryColorPicker from '../layout/ModalCategoryColorPicker';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import { normalizeHex } from '../../utils/colorPicker';
import { useLibraries } from '../../hooks/useLibraries';
import SettingsRadioRow from '../settings/SettingsRadioRow';
import SettingsCheckboxRow from '../settings/SettingsCheckboxRow';
import ConfirmModal from '../../pages/settings/ConfirmModal';

const DEFAULT_COLOR = '#EAB308';

const WEIGHT_OPTIONS: Array<{ key: CategoryWeight; label: string }> = [
  { key: 'neutral', label: 'Нулевой' },
  { key: 'low', label: 'Низкий' },
  { key: 'medium', label: 'Средний' },
  { key: 'high', label: 'Высокий' }
];

type TabId = 'name' | 'weight' | 'color' | 'visibility' | 'info';
type VisibilityUiMode = 'all' | 'current' | 'selected';

export type CategorySettingsModalState =
  | { mode: 'create' }
  | { mode: 'edit'; category: CategoryRecord };

type CreatePayload = {
  name: string;
  colorHex: string;
  weight: CategoryWeight;
  description?: string;
  visibilityMode?: 'all' | 'libraries';
  visibilityLibraryIds?: string[];
};

type EditPayload = {
  categoryId: string;
  name: string;
  colorHex: string;
  weight: CategoryWeight;
  description: string;
  visibilityMode: 'all' | 'libraries';
  visibilityLibraryIds: string[];
};

type Props = {
  state: CategorySettingsModalState;
  stats: CategoryStats | null;
  onClose: () => void;
  onCreate: (payload: CreatePayload) => Promise<void>;
  onSave: (payload: EditPayload) => Promise<void>;
  onDelete: (categoryId: string) => Promise<void>;
  hostClassName?: string;
};

function formatCategoryCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatStatNumber(value: number): string {
  return value.toLocaleString('ru-RU');
}

function deriveUiMode(
  category: CategoryRecord | undefined,
  activeLibraryId: string | null
): VisibilityUiMode {
  if (!category || category.visibilityMode !== 'libraries') return 'all';
  const ids = category.visibilityLibraryIds ?? [];
  if (activeLibraryId && ids.length === 1 && ids[0] === activeLibraryId) return 'current';
  return 'selected';
}

export default function CategorySettingsModal({
  state,
  stats,
  onClose,
  onCreate,
  onSave,
  onDelete,
  hostClassName
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lastNonEmptyCreateNameRef = useRef('');
  const { libraries, activeLibrary } = useLibraries();
  const activeLibraryId = activeLibrary?.id ?? null;
  /** Видимость по библиотекам имеет смысл только при 2+ библиотеках. */
  const canConfigureVisibility = libraries.length > 1;

  const [tab, setTab] = useState<TabId>('name');
  const [name, setName] = useState(() => (state.mode === 'edit' ? state.category.name : ''));
  const [description, setDescription] = useState(() =>
    state.mode === 'edit' ? (state.category.description ?? '') : ''
  );
  const [colorHex, setColorHex] = useState(() =>
    state.mode === 'edit' ? state.category.colorHex : DEFAULT_COLOR
  );
  const [weight, setWeight] = useState<CategoryWeight>(() =>
    state.mode === 'edit' ? state.category.weight : 'neutral'
  );
  const [visibilityUi, setVisibilityUi] = useState<VisibilityUiMode>(() =>
    state.mode === 'edit' ? deriveUiMode(state.category, activeLibraryId) : 'all'
  );
  const [selectedLibIds, setSelectedLibIds] = useState<string[]>(() =>
    state.mode === 'edit' && state.category.visibilityMode === 'libraries'
      ? [...(state.category.visibilityLibraryIds ?? [])]
      : activeLibraryId
        ? [activeLibraryId]
        : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [visibilityConfirm, setVisibilityConfirm] = useState<{
    cardsAffected: number;
    payload: EditPayload;
  } | null>(null);

  const isEdit = state.mode === 'edit';
  const hasDuplicateNameError = Boolean(error && error.includes('уже есть'));
  const normalizedColor = normalizeHex(colorHex) ?? DEFAULT_COLOR;

  const resolvedVisibility = useMemo((): {
    visibilityMode: 'all' | 'libraries';
    visibilityLibraryIds: string[];
  } => {
    if (!canConfigureVisibility) return { visibilityMode: 'all', visibilityLibraryIds: [] };
    if (visibilityUi === 'all') return { visibilityMode: 'all', visibilityLibraryIds: [] };
    if (visibilityUi === 'current') {
      return {
        visibilityMode: 'libraries',
        visibilityLibraryIds: activeLibraryId ? [activeLibraryId] : []
      };
    }
    return { visibilityMode: 'libraries', visibilityLibraryIds: selectedLibIds };
  }, [canConfigureVisibility, visibilityUi, activeLibraryId, selectedLibIds]);

  const committedBaseline = useMemo(() => {
    if (state.mode !== 'edit') return null;
    return {
      name: state.category.name,
      description: state.category.description ?? '',
      colorHex: state.category.colorHex,
      weight: state.category.weight,
      visibilityMode: state.category.visibilityMode ?? 'all',
      visibilityLibraryIds: [...(state.category.visibilityLibraryIds ?? [])].sort()
    };
  }, [state]);

  const visibilityDirty =
    canConfigureVisibility &&
    committedBaseline !== null &&
    (resolvedVisibility.visibilityMode !== committedBaseline.visibilityMode ||
      JSON.stringify([...resolvedVisibility.visibilityLibraryIds].sort()) !==
        JSON.stringify(committedBaseline.visibilityLibraryIds));

  const isDirty =
    isEdit &&
    committedBaseline !== null &&
    (name.trim() !== committedBaseline.name.trim() ||
      description.trim() !== committedBaseline.description.trim() ||
      normalizedColor !== (normalizeHex(committedBaseline.colorHex) ?? committedBaseline.colorHex) ||
      weight !== committedBaseline.weight ||
      visibilityDirty);

  useEffect(() => {
    setTab('name');
    setName(state.mode === 'edit' ? state.category.name : '');
    setDescription(state.mode === 'edit' ? (state.category.description ?? '') : '');
    setColorHex(state.mode === 'edit' ? state.category.colorHex : DEFAULT_COLOR);
    setWeight(state.mode === 'edit' ? state.category.weight : 'neutral');
    setVisibilityUi(state.mode === 'edit' ? deriveUiMode(state.category, activeLibraryId) : 'all');
    setSelectedLibIds(
      state.mode === 'edit' && state.category.visibilityMode === 'libraries'
        ? [...(state.category.visibilityLibraryIds ?? [])]
        : activeLibraryId
          ? [activeLibraryId]
          : []
    );
    setError(null);
    setDeleteConfirmOpen(false);
    setVisibilityConfirm(null);
    lastNonEmptyCreateNameRef.current = '';
  }, [state, activeLibraryId]);

  useEffect(() => {
    if (!canConfigureVisibility && tab === 'visibility') {
      setTab('name');
    }
  }, [canConfigureVisibility, tab]);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [
    tab,
    name,
    description,
    colorHex,
    weight,
    error,
    isSaving,
    stats,
    deleteConfirmOpen,
    visibilityUi,
    selectedLibIds
  ]);

  const buildEditPayload = (): EditPayload | null => {
    if (state.mode !== 'edit') return null;
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    return {
      categoryId: state.category.id,
      name: trimmedName,
      colorHex: normalizedColor,
      weight,
      description: description.trim(),
      ...resolvedVisibility
    };
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (isSaving) return;
    if (!trimmedName) {
      if (isEdit) {
        setName(state.category.name);
      } else if (lastNonEmptyCreateNameRef.current) {
        setName(lastNonEmptyCreateNameRef.current);
      }
      return;
    }

    if (
      canConfigureVisibility &&
      resolvedVisibility.visibilityMode === 'libraries' &&
      resolvedVisibility.visibilityLibraryIds.length === 0
    ) {
      setError('Выберите хотя бы одну библиотеку');
      setTab('visibility');
      return;
    }

    setIsSaving(true);
    setError(null);
    const descTrim = description.trim();
    try {
      if (state.mode === 'create') {
        await onCreate({
          name: trimmedName,
          colorHex: normalizedColor,
          weight,
          ...(descTrim ? { description: descTrim } : {}),
          ...resolvedVisibility
        });
        onClose();
        return;
      }

      const payload = buildEditPayload();
      if (!payload) return;

      const preview = await previewCategoryVisibilityChange({
        categoryId: payload.categoryId,
        visibilityMode: payload.visibilityMode,
        visibilityLibraryIds: payload.visibilityLibraryIds
      });
      if (preview.cardsAffected > 0) {
        setVisibilityConfirm({ cardsAffected: preview.cardsAffected, payload });
        return;
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить категорию');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmVisibilitySave = async () => {
    if (!visibilityConfirm) return;
    setIsSaving(true);
    try {
      await onSave(visibilityConfirm.payload);
      setVisibilityConfirm(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить категорию');
      setVisibilityConfirm(null);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDisabled = isSaving;
  const primarySaveDisabled = isSaving;

  const infoRows = stats
    ? [
        { label: 'Меток', value: formatStatNumber(stats.tagCount) },
        { label: 'Карточек с метками', value: formatStatNumber(stats.cardsWithTags) },
        { label: 'Использований меток', value: formatStatNumber(stats.usageSum) },
        { label: 'Дата создания', value: formatCategoryCreatedAt(stats.createdAt) }
      ]
    : [];

  const renderTabButton = (tabId: TabId, label: string, disabled = false) => {
    const button = (
      <button
        type="button"
        className={`tab-button${tab === tabId ? ' is-active' : ''}`}
        role="tab"
        aria-selected={tab === tabId}
        id={`arc-category-modal-tab-${tabId}`}
        aria-controls={`arc-category-modal-panel-${tabId}`}
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

  if (visibilityConfirm) {
    return (
      <ConfirmModal
        title="Скрыть категорию в части библиотек?"
        message={`Метки этой категории будут сняты с ${formatStatNumber(visibilityConfirm.cardsAffected)} карточек в библиотеках, где категория станет недоступна. Продолжить?`}
        confirmLabel="Снять и сохранить"
        confirmVariant="danger"
        onCancel={() => setVisibilityConfirm(null)}
        onConfirm={() => void confirmVisibilitySave()}
      />
    );
  }

  return (
    <>
      <ArcAnimatedModalHost onClose={onClose} hostClassName={hostClassName}>
        {({ requestClose }) => (
          <FloatingModalPanel
            ref={hostRef}
            panelId="category-settings-modal"
            className="arc-modal"
            data-elevation="raised"
            data-input-size="m"
            data-btn-size="s"
            role="dialog"
            aria-modal="true"
            aria-label={isEdit ? 'Настройки категории' : 'Новая категория'}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="arc-modal__header arc-modal__header--tabs">
              <div className="arc-modal__header-tabs tabs" role="tablist" aria-label="Разделы настроек категории">
                {renderTabButton('name', 'Название')}
                {renderTabButton('weight', 'Вес')}
                {renderTabButton('color', 'Цвет')}
                {canConfigureVisibility ? renderTabButton('visibility', 'Видимость') : null}
                {renderTabButton('info', 'Информация', !isEdit)}
              </div>
              <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
                <span className="tab-icon arc-icon-close" aria-hidden="true" />
              </button>
            </header>

            <div className="arc-modal__body">
              {tab === 'name' ? (
                <div id="arc-category-modal-panel-name" role="tabpanel" aria-labelledby="arc-category-modal-tab-name">
                  <div className="arc-modal__slot">
                    <p className="arc-modal__slot-text">Придумайте название для категории.</p>
                  </div>
                  <div className="arc-modal__slot">
                    <label
                      className={`field input-live${name.trim() ? ' has-value' : ''}${error ? ' field-error' : ''}`}
                      data-live-input
                    >
                      <input
                        className="input"
                        placeholder="Введите название…"
                        value={name}
                        autoFocus
                        aria-invalid={error ? true : undefined}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setName(nextValue);
                          if (!isEdit && nextValue.trim()) {
                            lastNonEmptyCreateNameRef.current = nextValue.trim();
                          }
                          if (hasDuplicateNameError) setError(null);
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
                        placeholder="Введите описание…"
                        value={description}
                        rows={3}
                        onChange={(event) => setDescription(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {tab === 'weight' ? (
                <div
                  id="arc-category-modal-panel-weight"
                  role="tabpanel"
                  aria-labelledby="arc-category-modal-tab-weight"
                >
                  <div className="arc-modal__slot">
                    <p className="arc-modal__slot-text">
                      Выберите вес категории. Вес определяет значимость категории при подборе похожих
                      изображений. Высокий вес увеличивает влияние совпадений, нулевой — не влияет на
                      порядок карточек.
                    </p>
                  </div>
                  <div className="arc-modal__slot">
                    <div className="tabs arc-category-weight-tabs" role="tablist" aria-label="Вес категории">
                      {WEIGHT_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          role="tab"
                          aria-selected={weight === opt.key}
                          className={`tab-button${weight === opt.key ? ' is-active' : ''}`}
                          onClick={() => setWeight(opt.key)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'color' ? (
                <div id="arc-category-modal-panel-color" role="tabpanel" aria-labelledby="arc-category-modal-tab-color">
                  <div className="arc-modal__slot">
                    <p className="arc-modal__slot-text">
                      Назначьте цвет категории. Он будет отображаться в метках, которые к ней относятся.
                    </p>
                  </div>
                  <ModalCategoryColorPicker value={normalizedColor} onChange={(hex) => setColorHex(hex)} />
                </div>
              ) : null}

              {canConfigureVisibility && tab === 'visibility' ? (
                <div
                  id="arc-category-modal-panel-visibility"
                  role="tabpanel"
                  aria-labelledby="arc-category-modal-tab-visibility"
                  className="arc-ui-kit-scope"
                  data-btn-size="m"
                >
                  <div className="arc-modal__slot">
                    <p className="arc-modal__slot-text">
                      В каких библиотеках показывать эту категорию и её метки. Скрытые категории нельзя
                      назначить на карточки.
                    </p>
                  </div>
                  <div className="arc-modal__slot arc-category-visibility-options">
                    <SettingsRadioRow
                      label="Все библиотеки"
                      checked={visibilityUi === 'all'}
                      onCheckedChange={(checked) => {
                        if (checked) setVisibilityUi('all');
                      }}
                    />
                    <SettingsRadioRow
                      label={
                        activeLibrary ? `Только «${activeLibrary.name}»` : 'Только текущая библиотека'
                      }
                      checked={visibilityUi === 'current'}
                      disabled={!activeLibraryId}
                      onCheckedChange={(checked) => {
                        if (checked) setVisibilityUi('current');
                      }}
                    />
                    <SettingsRadioRow
                      label="Выбранные библиотеки"
                      checked={visibilityUi === 'selected'}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setVisibilityUi('selected');
                          if (selectedLibIds.length === 0 && activeLibraryId) {
                            setSelectedLibIds([activeLibraryId]);
                          }
                        }
                      }}
                    />
                  </div>
                  {visibilityUi === 'selected' ? (
                    <div className="arc-modal__slot arc-category-visibility-libs">
                      {libraries.map((lib) => (
                        <SettingsCheckboxRow
                          key={lib.id}
                          label={lib.name}
                          checked={selectedLibIds.includes(lib.id)}
                          onCheckedChange={(checked) => {
                            setSelectedLibIds((prev) =>
                              checked
                                ? [...new Set([...prev, lib.id])]
                                : prev.filter((id) => id !== lib.id)
                            );
                            setError(null);
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === 'info' && isEdit ? (
                <div id="arc-category-modal-panel-info" role="tabpanel" aria-labelledby="arc-category-modal-tab-info">
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

            {isEdit ? (
              <footer className="arc-modal__footer arc-modal__footer--actions-3">
                <button
                  type="button"
                  className="btn btn-ds btn-s btn-danger"
                  disabled={deleteDisabled}
                  onClick={() => {
                    if (deleteDisabled) return;
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <span className="btn-ds__value">Удалить</span>
                </button>
                <div className="arc-modal__footer-right">
                  <button
                    type="button"
                    className="btn btn-outline btn-ds btn-s"
                    onClick={requestClose}
                    disabled={isSaving}
                  >
                    <span className="btn-ds__value">Отмена</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-brand btn-ds btn-s"
                    disabled={primarySaveDisabled}
                    onClick={() => void submit()}
                  >
                    <span className="btn-ds__value">{isSaving ? 'Сохранение…' : 'Сохранить'}</span>
                    <span
                      className="arc-save-dot"
                      data-arc-save-dot
                      aria-hidden="true"
                      hidden={!isDirty || primarySaveDisabled}
                    />
                  </button>
                </div>
              </footer>
            ) : (
              <footer className="arc-modal__footer arc-modal__footer--actions-2">
                <button
                  type="button"
                  className="btn btn-outline btn-ds btn-s"
                  onClick={requestClose}
                  disabled={isSaving}
                >
                  <span className="btn-ds__value">Отмена</span>
                </button>
                <button
                  type="button"
                  className="btn btn-brand btn-ds btn-s"
                  disabled={primarySaveDisabled}
                  onClick={() => void submit()}
                >
                  <span className="btn-ds__value">{isSaving ? 'Сохранение…' : 'Создать'}</span>
                </button>
              </footer>
            )}
          </FloatingModalPanel>
        )}
      </ArcAnimatedModalHost>

      {deleteConfirmOpen && state.mode === 'edit' ? (
        <ConfirmDeleteCategoryModal
          categoryName={state.category.name}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            setDeleteConfirmOpen(false);
            setIsSaving(true);
            try {
              await onDelete(state.category.id);
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Не удалось удалить');
            } finally {
              setIsSaving(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
