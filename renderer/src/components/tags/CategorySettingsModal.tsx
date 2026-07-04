import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CategoryRecord, CategoryStats, CategoryWeight } from '../../services/db';
import { ArcAnimatedModalHost } from '../../motion';
import ConfirmDeleteCategoryModal from '../layout/ConfirmDeleteCategoryModal';
import ModalCategoryColorPicker from '../layout/ModalCategoryColorPicker';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import { normalizeHex } from '../../utils/colorPicker';

const DEFAULT_COLOR = '#EAB308';

const WEIGHT_OPTIONS: Array<{ key: CategoryWeight; label: string }> = [
  { key: 'neutral', label: 'Нулевой' },
  { key: 'low', label: 'Низкий' },
  { key: 'medium', label: 'Средний' },
  { key: 'high', label: 'Высокий' }
];

type TabId = 'name' | 'weight' | 'color' | 'info';

export type CategorySettingsModalState =
  | { mode: 'create' }
  | { mode: 'edit'; category: CategoryRecord };

type CreatePayload = {
  name: string;
  colorHex: string;
  weight: CategoryWeight;
  description?: string;
};

type EditPayload = {
  categoryId: string;
  name: string;
  colorHex: string;
  weight: CategoryWeight;
  description: string;
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isEdit = state.mode === 'edit';
  const hasDuplicateNameError = Boolean(error && error.includes('уже есть'));
  const normalizedColor = normalizeHex(colorHex) ?? DEFAULT_COLOR;

  const committedBaseline = useMemo(() => {
    if (state.mode !== 'edit') return null;
    return {
      name: state.category.name,
      description: state.category.description ?? '',
      colorHex: state.category.colorHex,
      weight: state.category.weight
    };
  }, [state]);

  const isDirty =
    isEdit &&
    committedBaseline !== null &&
    (name.trim() !== committedBaseline.name.trim() ||
      description.trim() !== committedBaseline.description.trim() ||
      normalizedColor !== (normalizeHex(committedBaseline.colorHex) ?? committedBaseline.colorHex) ||
      weight !== committedBaseline.weight);

  useEffect(() => {
    setTab('name');
    setName(state.mode === 'edit' ? state.category.name : '');
    setDescription(state.mode === 'edit' ? (state.category.description ?? '') : '');
    setColorHex(state.mode === 'edit' ? state.category.colorHex : DEFAULT_COLOR);
    setWeight(state.mode === 'edit' ? state.category.weight : 'neutral');
    setError(null);
    setDeleteConfirmOpen(false);
    lastNonEmptyCreateNameRef.current = '';
  }, [state]);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [tab, name, description, colorHex, weight, error, isSaving, stats, deleteConfirmOpen]);

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

    setIsSaving(true);
    setError(null);
    const descTrim = description.trim();
    try {
      if (state.mode === 'create') {
        await onCreate({
          name: trimmedName,
          colorHex: normalizedColor,
          weight,
          ...(descTrim ? { description: descTrim } : {})
        });
      } else {
        await onSave({
          categoryId: state.category.id,
          name: trimmedName,
          colorHex: normalizedColor,
          weight,
          description: descTrim
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить категорию');
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

  return (
    <>
      <ArcAnimatedModalHost onClose={onClose} hostClassName={hostClassName}>
        {({ requestClose }) => (
          <section
            ref={hostRef}
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
              {renderTabButton('info', 'Информация', !isEdit)}
            </div>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>

          <div className="arc-modal__body">
            {tab === 'name' ? (
              <div
                id="arc-category-modal-panel-name"
                role="tabpanel"
                aria-labelledby="arc-category-modal-tab-name"
              >
                <div className="arc-modal__slot">
                  <p className="arc-modal__slot-text">Придумайте название для категории.</p>
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
                          setError(null);
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
              <div
                id="arc-category-modal-panel-color"
                role="tabpanel"
                aria-labelledby="arc-category-modal-tab-color"
              >
                <div className="arc-modal__slot">
                  <p className="arc-modal__slot-text">
                    Назначьте цвет категории. Он будет отображаться в метках, которые к ней относятся.
                  </p>
                </div>
                <ModalCategoryColorPicker value={normalizedColor} onChange={(hex) => setColorHex(hex)} />
              </div>
            ) : null}

            {tab === 'info' && isEdit ? (
              <div
                id="arc-category-modal-panel-info"
                role="tabpanel"
                aria-labelledby="arc-category-modal-tab-info"
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

            {error && !hasDuplicateNameError ? (
              <p className="hint-error arc-category-modal-error">{error}</p>
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
                <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose} disabled={isSaving}>
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
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose} disabled={isSaving}>
                <span className="btn-ds__value">Отмена</span>
              </button>
              <button
                type="button"
                className="btn btn-brand btn-ds btn-s"
                disabled={primarySaveDisabled}
                onClick={() => void submit()}
              >
                <span className="btn-ds__value">{isSaving ? 'Сохранение…' : 'Добавить'}</span>
              </button>
            </footer>
          )}
          </section>
        )}
      </ArcAnimatedModalHost>

      {deleteConfirmOpen && isEdit ? (
        <ConfirmDeleteCategoryModal
          categoryName={state.category.name}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            await onDelete(state.category.id);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
