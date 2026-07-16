import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CategoryRecord, TagRecord } from '../../services/db';
import { ArcAnimatedModalHost } from '../../motion';
import ConfirmDeleteTagModal from '../layout/ConfirmDeleteTagModal';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { processTagTooltipImageFile } from './tagTooltipImage';

const MAX_IMAGE_BYTES = 1_200_000;

type TabId = 'main' | 'image';

type CreatePayload = {
  categoryId: string;
  name: string;
  description?: string;
  tooltipImageDataUrl?: string;
};

type EditPayload = {
  tagId: string;
  categoryId: string;
  name: string;
  description: string;
  tooltipImageDataUrl?: string;
};

export type TagSettingsModalState =
  | { mode: 'create'; categoryId: string; initialName?: string }
  | { mode: 'edit'; tag: TagRecord };

type Props = {
  state: TagSettingsModalState;
  categories: CategoryRecord[];
  onClose: () => void;
  onCreate: (payload: CreatePayload) => Promise<void>;
  onSave: (payload: EditPayload) => Promise<void>;
  onDelete: (tagId: string) => Promise<void>;
  hostClassName?: string;
};

export default function TagSettingsModal({
  state,
  categories,
  onClose,
  onCreate,
  onSave,
  onDelete,
  hostClassName
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const lastNonEmptyCreateNameRef = useRef('');
  const [tab, setTab] = useState<TabId>('main');
  const [categoryId, setCategoryId] = useState(() =>
    state.mode === 'create' ? state.categoryId : state.tag.categoryId
  );
  const [name, setName] = useState(() =>
    state.mode === 'edit' ? state.tag.name : state.mode === 'create' ? (state.initialName ?? '') : ''
  );
  const [description, setDescription] = useState(() =>
    state.mode === 'edit' ? (state.tag.description ?? '') : ''
  );
  const [tooltipImageDataUrl, setTooltipImageDataUrl] = useState<string | undefined>(() =>
    state.mode === 'edit' ? state.tag.tooltipImageDataUrl : undefined
  );
  const [imageFileName, setImageFileName] = useState<string>(() =>
    state.mode === 'edit' && state.tag.tooltipImageDataUrl ? 'Изображение метки' : ''
  );
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const hasDuplicateNameError = Boolean(error && error.includes('уже есть'));

  const isEdit = state.mode === 'edit';

  const committedBaseline = useMemo(() => {
    if (state.mode !== 'edit') return null;
    return {
      name: state.tag.name,
      description: state.tag.description ?? '',
      categoryId: state.tag.categoryId,
      tooltipImageDataUrl: state.tag.tooltipImageDataUrl
    };
  }, [state]);

  const isDirty =
    isEdit &&
    committedBaseline !== null &&
    (name.trim() !== committedBaseline.name.trim() ||
      description.trim() !== committedBaseline.description.trim() ||
      categoryId !== committedBaseline.categoryId ||
      (tooltipImageDataUrl ?? '') !== (committedBaseline.tooltipImageDataUrl ?? ''));

  useEffect(() => {
    setTab('main');
    setCategoryId(state.mode === 'create' ? state.categoryId : state.tag.categoryId);
    setName(state.mode === 'edit' ? state.tag.name : state.mode === 'create' ? (state.initialName ?? '') : '');
    setDescription(state.mode === 'edit' ? (state.tag.description ?? '') : '');
    setTooltipImageDataUrl(state.mode === 'edit' ? state.tag.tooltipImageDataUrl : undefined);
    setImageFileName(state.mode === 'edit' && state.tag.tooltipImageDataUrl ? 'Изображение метки' : '');
    setError(null);
    setCategoryMenuOpen(false);
    lastNonEmptyCreateNameRef.current = '';
  }, [state]);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [
    tab,
    name,
    description,
    categoryId,
    categoryMenuOpen,
    tooltipImageDataUrl,
    imageFileName,
    error,
    isSaving,
    deleteConfirmOpen,
    isDirty
  ]);

  useEffect(() => {
    if (!categoryMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const el = selectorRef.current;
      if (el && !el.contains(e.target as Node)) {
        setCategoryMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [categoryMenuOpen]);

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? categories[0];

  const onPickFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Выберите файл изображения');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Файл слишком большой для локального хранилища (максимум ~1,2 МБ)');
      return;
    }
    setError(null);
    try {
      const dataUrl = await processTagTooltipImageFile(file);
      setTooltipImageDataUrl(dataUrl);
      setImageFileName(file.name);
    } catch {
      setError('Не удалось загрузить изображение');
    }
  };

  const clearImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTooltipImageDataUrl(undefined);
    setImageFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const submit = async () => {
    const trimmedName = name.trim();
    if (isSaving) return;
    if (!trimmedName) {
      if (isEdit) {
        setName(state.tag.name);
      } else if (lastNonEmptyCreateNameRef.current) {
        setName(lastNonEmptyCreateNameRef.current);
      }
      return;
    }
    setIsSaving(true);
    setError(null);
    const descTrim = description.trim();
    const imgPayload = tooltipImageDataUrl;
    try {
      if (state.mode === 'create') {
        await onCreate({
          categoryId,
          name: trimmedName,
          ...(descTrim ? { description: descTrim } : {}),
          ...(imgPayload ? { tooltipImageDataUrl: imgPayload } : {})
        });
      } else {
        await onSave({
          tagId: state.tag.id,
          categoryId,
          name: trimmedName,
          description: descTrim,
          tooltipImageDataUrl: imgPayload
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить метку');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDisabled = !isEdit || isSaving;
  const primarySaveDisabled = isSaving;

  return (
    <>
      <ArcAnimatedModalHost onClose={onClose} hostClassName={hostClassName}>
        {({ requestClose }) => (
          <FloatingModalPanel
            ref={hostRef}
            panelId="tag-settings-modal"
            className="arc-modal"
            data-elevation="raised"
            data-input-size="m"
            data-btn-size="s"
            role="dialog"
            aria-modal="true"
            aria-label={isEdit ? 'Настройки метки' : 'Новая метка'}
            onClick={(e) => e.stopPropagation()}
          >
          <header className="arc-modal__header arc-modal__header--tabs">
            <div className="arc-modal__header-tabs tabs" role="tablist" aria-label="Разделы настроек метки">
              <button
                type="button"
                className={`tab-button${tab === 'main' ? ' is-active' : ''}`}
                role="tab"
                aria-selected={tab === 'main'}
                id="arc-tag-modal-tab-main"
                aria-controls="arc-tag-modal-panel-main"
                onClick={() => setTab('main')}
              >
                Основное
              </button>
              <button
                type="button"
                className={`tab-button${tab === 'image' ? ' is-active' : ''}`}
                role="tab"
                aria-selected={tab === 'image'}
                id="arc-tag-modal-tab-image"
                aria-controls="arc-tag-modal-panel-image"
                onClick={() => setTab('image')}
              >
                Изображение
              </button>
            </div>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>

          <div className="arc-modal__body">
            {tab === 'main' ? (
              <div
                id="arc-tag-modal-panel-main"
                role="tabpanel"
                aria-labelledby="arc-tag-modal-tab-main"
              >
                <div className="arc-modal__slot">
                  <p className="arc-modal__slot-text">
                    Придумайте название метки и добавьте ей описание.
                  </p>
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
                      onChange={(e) => {
                        const nextValue = e.target.value;
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
                          return;
                        }
                        if (event.key === 'Escape' && !name.trim()) {
                          event.preventDefault();
                          event.stopPropagation();
                          if (isEdit) {
                            setName(state.tag.name);
                          } else if (lastNonEmptyCreateNameRef.current) {
                            setName(lastNonEmptyCreateNameRef.current);
                          }
                          if (hasDuplicateNameError) {
                            setError(null);
                          }
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
                  <div
                    ref={selectorRef}
                    className={`field selector-field${selectedCategory ? ' has-value' : ''}`}
                  >
                    <button
                      type="button"
                      className="input pseudo-select input-slots"
                      aria-expanded={categoryMenuOpen}
                      aria-haspopup="listbox"
                      aria-label="Категория"
                      onClick={() => setCategoryMenuOpen((o) => !o)}
                    >
                      <span className="selector-value slot-value">
                        {selectedCategory ? selectedCategory.name : 'Выберите категорию…'}
                      </span>
                      <span className="selector-actions slot-trailing">
                        <span className="selector-clear" aria-hidden="true" />
                        <span
                          className="selector-caret arc-icon-chevron arc-selector-dropdown-caret"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    <div className="selector-dropdown" hidden={!categoryMenuOpen}>
                      <div className="dropdown-list" role="listbox">
                        {categories.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`dropdown-row${c.id === categoryId ? ' is-checked' : ''}`}
                            role="option"
                            aria-selected={c.id === categoryId}
                            onClick={() => {
                              setCategoryId(c.id);
                              setCategoryMenuOpen(false);
                            }}
                          >
                            <span>{c.name}</span>
                            <span className="dropdown-row-check" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="arc-modal__slot">
                  <label className="field">
                    <textarea
                      className="input textarea"
                      placeholder="Введите описание…"
                      value={description}
                      rows={4}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div
                id="arc-tag-modal-panel-image"
                role="tabpanel"
                aria-labelledby="arc-tag-modal-tab-image"
              >
                <div className="arc-modal__slot">
                  <p className="arc-modal__slot-text">
                    Загрузите опциональное поясняющее изображение. Оно будет отображаться при наведении
                    курсора на метку. Максимальное разрешение изображения 368×207 пикселей.
                  </p>
                </div>
                <div className="arc-modal__slot">
                  <div className={`field uploader-live${imageFileName ? ' has-file' : ''}`}>
                    <button
                      className="input uploader input-slots"
                      type="button"
                      aria-label="Загрузить файл"
                      onClick={triggerFileDialog}
                    >
                      <span className="uploader-prepend slot-prepend">Выберите файл</span>
                      <span className="uploader-value slot-value">
                        {imageFileName || 'Файл не выбран'}
                      </span>
                      <span
                        className="input-inline-icon input-inline-icon--trash uploader-clear slot-trailing arc-icon-trash"
                        aria-hidden={!imageFileName}
                        onClick={
                          imageFileName
                            ? (ev) => {
                                ev.preventDefault();
                                ev.stopPropagation();
                                clearImage(ev);
                              }
                            : undefined
                        }
                      />
                    </button>
                    <input
                      ref={fileInputRef}
                      className="uploader-file-input"
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => void onPickFile(e.target.files)}
                    />
                  </div>
                </div>
                <div className="arc-modal__slot">
                  <div
                    className="arc-tag-preview-frame"
                    aria-hidden={!tooltipImageDataUrl}
                  >
                    {tooltipImageDataUrl ? (
                      <img
                        src={tooltipImageDataUrl}
                        alt="Предпросмотр изображения метки"
                        draggable={false}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            )}
            {error && !hasDuplicateNameError ? <p className="hint-error arc-category-modal-error">{error}</p> : null}
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
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose} disabled={isSaving}>
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
          </FloatingModalPanel>
        )}
      </ArcAnimatedModalHost>

      {deleteConfirmOpen && isEdit ? (
        <ConfirmDeleteTagModal
          tagName={state.tag.name}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            await onDelete(state.tag.id);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
