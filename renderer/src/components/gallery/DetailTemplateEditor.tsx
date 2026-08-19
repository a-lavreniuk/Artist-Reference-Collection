import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  DETAIL_BUILTIN_FIELD_LABELS,
  createBuiltinTemplateField,
  createCustomTemplateField,
  customFieldTypeIconClass,
  missingBuiltinFieldIds,
  reorderTemplateFields,
  reorderVisibleTemplateFields,
  sanitizeDetailCardTemplate,
  templateFieldIconClass,
  templateFieldLabel,
  templateFieldTypeLabel,
  type CustomFieldType,
  type DetailBuiltinFieldId,
  type DetailCardTemplateV1,
  type DetailTemplateCustomField,
  type DetailTemplateField
} from '@arc-main-shared/detailCardTemplate';
import {
  ContextMenu,
  ContextMenuHeader,
  ContextMenuInput,
  ContextMenuItem,
  ContextMenuSeparator
} from '../context-menu';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type DragState = {
  dragId: string;
  insertIndex: number;
  ghostX: number;
  ghostY: number;
  ghostWidth: number;
  label: string;
};

type MenuView = 'field' | 'type';

type Props = {
  template: DetailCardTemplateV1;
  onChange: (next: DetailCardTemplateV1) => void;
  onRequestDelete?: (fieldId: string) => void;
  variant?: 'card' | 'settings';
  readOnly?: boolean;
  renderValue?: (field: DetailTemplateField) => ReactNode;
};

const DRAG_THRESHOLD_PX = 4;

function newFieldId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DetailTemplateEditor({
  template,
  onChange,
  onRequestDelete,
  variant = 'settings',
  readOnly = false,
  renderValue
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const fieldMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const skipClickRef = useRef(false);
  const nameDraftRef = useRef('');
  const optionsDraftRef = useRef<Record<string, string>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [optionsDraft, setOptionsDraft] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [hiddenFieldsExpanded, setHiddenFieldsExpanded] = useState(false);
  const [menuFieldId, setMenuFieldId] = useState<string | null>(null);
  const [menuView, setMenuView] = useState<MenuView>('field');
  const [nameDraft, setNameDraft] = useState('');

  nameDraftRef.current = nameDraft;
  optionsDraftRef.current = optionsDraft;

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [template.fields, drag, variant, readOnly, menuFieldId, addOpen, hiddenFieldsExpanded]);

  useLayoutEffect(() => {
    if (hiddenFieldsExpanded && !template.fields.some((field) => !field.visible)) {
      setHiddenFieldsExpanded(false);
    }
  }, [template.fields, hiddenFieldsExpanded]);

  const commit = (fields: DetailTemplateField[]) => {
    onChange(sanitizeDetailCardTemplate({ version: 1, fields }));
  };

  const hiddenFields = variant === 'card' ? template.fields.filter((field) => !field.visible) : [];
  const showHiddenInList = variant === 'card' && hiddenFieldsExpanded && hiddenFields.length > 0;
  const listFields =
    variant === 'card' && !showHiddenInList
      ? template.fields.filter((field) => field.visible)
      : template.fields;

  const menuField = menuFieldId
    ? template.fields.find((field) => field.id === menuFieldId)
    : undefined;

  const applyFieldMenuEdits = (
    fields: DetailTemplateField[],
    fieldId: string,
    patch?: { visible?: boolean; type?: CustomFieldType }
  ): DetailTemplateField[] => {
    const trimmed = nameDraftRef.current.trim();
    const rawOptions = optionsDraftRef.current[fieldId];
    return fields.map((field) => {
      if (field.id !== fieldId) return field;
      const visible = patch?.visible ?? field.visible;
      if (field.kind === 'builtin') {
        if (!trimmed) return { id: field.id, kind: 'builtin' as const, visible };
        return { ...field, label: trimmed, visible };
      }
      const type = patch?.type ?? field.type;
      const next: DetailTemplateCustomField = {
        ...field,
        type,
        label: trimmed || CUSTOM_FIELD_TYPE_LABELS[type],
        visible
      };
      if (type === 'select' || type === 'multiSelect') {
        next.options =
          rawOptions != null
            ? rawOptions
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
            : (field.options ?? []);
      } else {
        delete next.options;
      }
      return next;
    });
  };

  const persistFieldMenuEdits = (fieldId: string) => {
    commit(applyFieldMenuEdits(template.fields, fieldId));
  };

  const closeFieldMenuOnly = () => {
    setMenuFieldId(null);
    setMenuView('field');
    fieldMenuAnchorRef.current = null;
  };

  const closeFieldMenu = () => {
    if (menuFieldId) persistFieldMenuEdits(menuFieldId);
    closeFieldMenuOnly();
  };

  const openFieldMenu = (field: DetailTemplateField, anchor: HTMLButtonElement) => {
    if (menuFieldId && menuFieldId !== field.id) persistFieldMenuEdits(menuFieldId);
    setAddOpen(false);
    fieldMenuAnchorRef.current = anchor;
    setMenuFieldId(field.id);
    setMenuView('field');
    setNameDraft(templateFieldLabel(field));
    if (field.kind === 'custom' && (field.type === 'select' || field.type === 'multiSelect')) {
      setOptionsDraft((prev) => ({
        ...prev,
        [field.id]: prev[field.id] ?? (field.options ?? []).join('\n')
      }));
    }
  };

  const toggleVisible = (id: string) => {
    const current = template.fields.find((field) => field.id === id);
    if (!current) return;
    const fields =
      menuFieldId === id
        ? applyFieldMenuEdits(template.fields, id, { visible: !current.visible })
        : template.fields.map((field) =>
            field.id === id ? { ...field, visible: !field.visible } : field
          );
    commit(fields);
  };

  const changeCustomType = (id: string, type: CustomFieldType) => {
    commit(applyFieldMenuEdits(template.fields, id, { type }));
    setMenuView('field');
  };

  const duplicateField = (field: DetailTemplateCustomField) => {
    const fields = applyFieldMenuEdits(template.fields, field.id);
    const source = fields.find((item) => item.id === field.id);
    if (!source || source.kind !== 'custom') return;
    const copy = createCustomTemplateField(source.type, newFieldId());
    copy.label = templateFieldLabel(source);
    copy.visible = source.visible;
    if (source.options) copy.options = [...source.options];
    const index = fields.findIndex((item) => item.id === field.id);
    const next = [...fields];
    next.splice(index < 0 ? next.length : index + 1, 0, copy);
    commit(next);
  };

  const addCustom = (type: CustomFieldType) => {
    commit([...template.fields, createCustomTemplateField(type, newFieldId())]);
    setAddOpen(false);
  };

  const addBuiltin = (id: DetailBuiltinFieldId) => {
    if (template.fields.some((field) => field.id === id)) return;
    commit([...template.fields, createBuiltinTemplateField(id)]);
    setAddOpen(false);
  };

  const startDrag = (args: {
    id: string;
    label: string;
    handleEl: HTMLElement;
    rowEl: HTMLElement;
  }) => {
    if (readOnly) return;
    const listEl = listRef.current;
    if (!listEl) return;
    const rowRect = args.rowEl.getBoundingClientRect();
    const handleRect = args.handleEl.getBoundingClientRect();
    const offsetX = handleRect.left - rowRect.left + handleRect.width / 2;
    const offsetY = handleRect.top - rowRect.top + handleRect.height / 2;
    const nodes = Array.from(listEl.querySelectorAll<HTMLElement>('[data-template-field-row]'));
    const insertIndex = nodes.findIndex((node) => node.dataset.templateFieldRow === args.id);
    setDrag({
      dragId: args.id,
      insertIndex: Math.max(0, insertIndex),
      ghostX: rowRect.left,
      ghostY: rowRect.top,
      ghostWidth: rowRect.width,
      label: args.label
    });

    const onMove = (e: PointerEvent) => {
      const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-template-field-row]'));
      let nextInsert = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const rect = rows[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          nextInsert = i;
          break;
        }
      }
      setDrag({
        dragId: args.id,
        insertIndex: nextInsert,
        ghostX: e.clientX - offsetX,
        ghostY: e.clientY - offsetY,
        ghostWidth: rowRect.width,
        label: args.label
      });
    };
    const onUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const rows = Array.from(listEl.querySelectorAll<HTMLElement>('[data-template-field-row]'));
      let nextInsert = rows.length;
      for (let i = 0; i < rows.length; i++) {
        const rect = rows[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          nextInsert = i;
          break;
        }
      }
      if (variant === 'card' && !showHiddenInList) {
        commit(reorderVisibleTemplateFields(template.fields, args.id, nextInsert));
      } else {
        commit(reorderTemplateFields(template.fields, args.id, nextInsert));
      }
      setDrag(null);
      const swallowClick = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        skipClickRef.current = false;
        window.removeEventListener('click', swallowClick, true);
      };
      window.addEventListener('click', swallowClick, true);
      window.setTimeout(() => {
        window.removeEventListener('click', swallowClick, true);
        skipClickRef.current = false;
      }, 0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const bindLabelPointerDown = (field: DetailTemplateField, label: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (readOnly || e.button !== 0) return;
    const labelEl = e.currentTarget;
    const rowEl = labelEl.closest('[data-template-field-row]') as HTMLElement | null;
    if (!rowEl) return;
    const originX = e.clientX;
    const originY = e.clientY;
    let started = false;

    const onMove = (ev: PointerEvent) => {
      if (started) return;
      if (Math.hypot(ev.clientX - originX, ev.clientY - originY) < DRAG_THRESHOLD_PX) return;
      started = true;
      skipClickRef.current = true;
      setAddOpen(false);
      try {
        labelEl.setPointerCapture(ev.pointerId);
      } catch {
        /* already released */
      }
      startDrag({
        id: field.id,
        label,
        handleEl: labelEl,
        rowEl
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const missingBuiltins = missingBuiltinFieldIds(template);
  const showSelectOptions =
    menuField?.kind === 'custom' &&
    (menuField.type === 'select' || menuField.type === 'multiSelect');

  return (
    <div ref={rootRef} className={`arc-detail-template-editor arc-detail-template-editor--${variant}`}>
      <div
        ref={listRef}
        className={`arc-card-detail-prop-list${
          drag != null && drag.insertIndex === listFields.length ? ' is-drop-end' : ''
        }`}
      >
        {listFields.map((field, rowIndex) => {
          const label = templateFieldLabel(field);
          const insertBefore = drag != null && drag.insertIndex === rowIndex && drag.dragId !== field.id;
          const menuOpen = menuFieldId === field.id;
          return (
            <div
              key={field.id}
              className={`arc-card-detail-prop-row${variant === 'card' ? '' : ' arc-card-detail-prop-row--schema'}${
                drag?.dragId === field.id ? ' is-dragging' : ''
              }${insertBefore ? ' is-drop-before' : ''}`}
              data-template-field-row={field.id}
            >
              <div className="arc-card-detail-prop-row__name">
                {readOnly ? (
                  <span className="arc-card-detail-prop-row__label">
                    <span
                      className={`tab-icon ${templateFieldIconClass(field)}`}
                      data-arc-icon-size="m"
                      aria-hidden="true"
                    />
                    <span className="arc-card-detail-prop-row__label-text">{label}</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="arc-card-detail-prop-row__label"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label={label}
                    onPointerDown={bindLabelPointerDown(field, label)}
                    onClick={(e) => {
                      if (skipClickRef.current) {
                        skipClickRef.current = false;
                        return;
                      }
                      openFieldMenu(field, e.currentTarget);
                    }}
                  >
                    <span
                      className={`tab-icon ${templateFieldIconClass(field)}`}
                      data-arc-icon-size="m"
                      aria-hidden="true"
                    />
                    <span className="arc-card-detail-prop-row__label-text">{label}</span>
                  </button>
                )}
                {variant === 'settings' ? (
                  <button
                    type="button"
                    className="arc-card-detail-prop-row__visibility"
                    aria-label={field.visible ? `Скрыть ${label}` : `Показать ${label}`}
                    aria-pressed={field.visible}
                    onClick={() => toggleVisible(field.id)}
                  >
                    <span
                      className={`tab-icon ${field.visible ? 'arc-icon-eye' : 'arc-icon-eye-off'}`}
                      aria-hidden="true"
                      data-arc-icon-size="m"
                    />
                  </button>
                ) : null}
              </div>
              {variant === 'card' && renderValue ? (
                <div className="arc-card-detail-prop-row__value">{renderValue(field)}</div>
              ) : null}
            </div>
          );
        })}
      </div>
      {!readOnly ? (
        <div className="arc-detail-template-editor__footer">
          <button
            ref={addBtnRef}
            type="button"
            className="btn btn-outline btn-ds arc-detail-template-editor__add-btn"
            aria-haspopup="menu"
            aria-expanded={addOpen}
            onClick={() => {
              if (menuFieldId) closeFieldMenu();
              setAddOpen(true);
            }}
          >
            <span className="btn-ds__value">Добавить свойство</span>
            <span className="btn-ds__icon arc-icon-plus-square" aria-hidden="true" />
          </button>
          {hiddenFields.length > 0 ? (
            <button
              type="button"
              className="btn btn-outline btn-ds"
              aria-pressed={showHiddenInList}
              aria-label={
                showHiddenInList
                  ? `Скрыть поля, ${hiddenFields.length}`
                  : `Показать скрытые поля, ${hiddenFields.length}`
              }
              onClick={() => {
                if (menuFieldId) closeFieldMenu();
                setAddOpen(false);
                setHiddenFieldsExpanded((prev) => !prev);
              }}
            >
              <span className="btn-ds__value">{showHiddenInList ? 'Скрыть' : 'Скрыто'}</span>
              <span className="btn-ds__counter">{hiddenFields.length}</span>
              <span
                className={`btn-ds__icon ${showHiddenInList ? 'arc-icon-eye' : 'arc-icon-eye-off'}`}
                aria-hidden="true"
              />
            </button>
          ) : null}
        </div>
      ) : null}

      <ContextMenu
        open={Boolean(menuField) && !readOnly}
        anchorRef={fieldMenuAnchorRef}
        onClose={closeFieldMenu}
        ariaLabel="Параметры свойства"
        aboveModal
        anchorAlign="start"
        anchorPlacement="belowAnchor"
      >
        {menuField && menuView === 'type' && menuField.kind === 'custom' ? (
          <>
            <ContextMenuItem
              label="Назад"
              iconClass="arc-icon-chevron-left"
              onSelect={() => setMenuView('field')}
            />
            <ContextMenuHeader>Тип свойства</ContextMenuHeader>
            {CUSTOM_FIELD_TYPES.map((type) => (
              <ContextMenuItem
                key={type}
                label={CUSTOM_FIELD_TYPE_LABELS[type]}
                iconClass={customFieldTypeIconClass(type)}
                selected={menuField.type === type}
                onSelect={() => changeCustomType(menuField.id, type)}
              />
            ))}
          </>
        ) : null}
        {menuField && menuView === 'field' ? (
          <>
            <ContextMenuInput
              variant="live"
              placeholder={templateFieldTypeLabel(menuField)}
              value={nameDraft}
              autoFocus
              onChange={setNameDraft}
            />
            <ContextMenuHeader>Тип свойства</ContextMenuHeader>
            <ContextMenuItem
              label={templateFieldTypeLabel(menuField)}
              iconClass={templateFieldIconClass(menuField)}
              disabled={menuField.kind !== 'custom'}
              onSelect={() => {
                if (menuField.kind !== 'custom') return;
                setMenuView('type');
              }}
            />
            {showSelectOptions ? (
              <ContextMenuInput
                variant="textarea"
                placeholder="Каждый вариант с новой строки"
                value={optionsDraft[menuField.id] ?? (menuField.options ?? []).join('\n')}
                onChange={(value) => setOptionsDraft((prev) => ({ ...prev, [menuField.id]: value }))}
              />
            ) : null}
            <ContextMenuSeparator />
            <ContextMenuItem
              label={menuField.visible ? 'Скрыть' : 'Показать'}
              iconClass={menuField.visible ? 'arc-icon-eye-off' : 'arc-icon-eye'}
              onSelect={() => {
                const wasVisible = menuField.visible;
                toggleVisible(menuField.id);
                if (variant === 'card' && wasVisible) closeFieldMenuOnly();
              }}
            />
            {menuField.kind === 'custom' ? (
              <ContextMenuItem
                label="Создать копию"
                iconClass="arc-icon-copy"
                onSelect={() => duplicateField(menuField)}
              />
            ) : null}
            {onRequestDelete ? (
              <ContextMenuItem
                label="Удалить"
                iconClass="arc-icon-trash"
                onSelect={() => {
                  const id = menuField.id;
                  closeFieldMenu();
                  onRequestDelete(id);
                }}
              />
            ) : null}
          </>
        ) : null}
      </ContextMenu>

      <ContextMenu
        open={addOpen && !readOnly}
        anchorRef={addBtnRef}
        onClose={() => setAddOpen(false)}
        ariaLabel="Добавить свойство"
        aboveModal
        anchorAlign="start"
        anchorPlacement="belowAnchor"
      >
        <ContextMenuHeader>Тип свойства</ContextMenuHeader>
        {missingBuiltins.map((id) => (
          <ContextMenuItem
            key={id}
            label={DETAIL_BUILTIN_FIELD_LABELS[id]}
            iconClass={templateFieldIconClass(createBuiltinTemplateField(id))}
            onSelect={() => addBuiltin(id)}
          />
        ))}
        {CUSTOM_FIELD_TYPES.map((type) => (
          <ContextMenuItem
            key={type}
            label={CUSTOM_FIELD_TYPE_LABELS[type]}
            iconClass={customFieldTypeIconClass(type)}
            onSelect={() => addCustom(type)}
          />
        ))}
      </ContextMenu>

      {drag
        ? createPortal(
            <div
              className="arc-card-detail-prop-row-ghost"
              style={{ left: drag.ghostX, top: drag.ghostY, width: drag.ghostWidth }}
            >
              <span className="text-s">{drag.label}</span>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
