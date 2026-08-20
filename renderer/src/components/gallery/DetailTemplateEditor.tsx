import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  DETAIL_BUILTIN_FIELD_LABELS,
  FIELD_VISIBILITY_LABELS,
  FIELD_VISIBILITY_MODES,
  createBuiltinTemplateField,
  createCustomTemplateField,
  customFieldTypeIconClass,
  fieldEditorNameDraft,
  fieldLabelFromEditorDraft,
  isFieldInMainList,
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
  type DetailTemplateField,
  type FieldVisibilityMode
} from '@arc-main-shared/detailCardTemplate';
import {
  ContextMenu,
  ContextMenuHeader,
  ContextMenuInput,
  ContextMenuItem,
  ContextMenuSeparator
} from '../context-menu';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { resolveDetailFieldSubmenuPosition } from './detailFieldSubmenuPosition';

type DragState = {
  dragId: string;
  insertIndex: number;
  ghostX: number;
  ghostY: number;
  ghostWidth: number;
  label: string;
};

const FIELD_TYPE_ROW_KEY = 'field-type';
const FIELD_VISIBILITY_ROW_KEY = 'field-visibility';
const FIELD_MENU_SLOT_CLASS = 'arc-detail-field-menu-slot';
const FIELD_MENU_NAME_SLOT_CLASS = `${FIELD_MENU_SLOT_CLASS} arc-detail-field-menu-slot--after-type`;

type DetailFieldTypeRowProps = {
  field: DetailTemplateField;
  submenuOpen?: boolean;
  onOpenSubmenu?: () => void;
};

function DetailFieldTypeRow({ field, submenuOpen = false, onOpenSubmenu }: DetailFieldTypeRowProps) {
  const label = templateFieldTypeLabel(field);
  const iconClass = templateFieldIconClass(field);
  const canOpen = Boolean(onOpenSubmenu);

  return (
    <button
      type="button"
      role="menuitem"
      className={`context-menu__item arc-detail-field-menu-type-row${
        canOpen ? '' : ' is-disabled'
      }${submenuOpen ? ' is-active' : ''}`}
      data-context-menu-key={FIELD_TYPE_ROW_KEY}
      disabled={!canOpen}
      onClick={() => {
        if (!canOpen) return;
        onOpenSubmenu?.();
      }}
    >
      <span className="context-menu__item-inner">
        <span
          className={`arc-detail-field-menu-type-row__lead tab-icon ${iconClass}`}
          data-arc-icon-size="m"
          aria-hidden="true"
        />
        <span className="context-menu__item-label-cluster">
          <span className="context-menu__item-label">{label}</span>
        </span>
        {canOpen ? (
          <span
            className="context-menu__item-icon tab-icon arc-icon-chevron arc-chevron-point-right"
            data-arc-icon-size="m"
            aria-hidden="true"
          />
        ) : null}
      </span>
    </button>
  );
}

function DetailFieldVisibilityRow({
  field,
  submenuOpen = false,
  onOpenSubmenu
}: {
  field: DetailTemplateField;
  submenuOpen?: boolean;
  onOpenSubmenu?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`context-menu__item arc-detail-field-menu-type-row${submenuOpen ? ' is-active' : ''}`}
      data-context-menu-key={FIELD_VISIBILITY_ROW_KEY}
      onClick={() => onOpenSubmenu?.()}
    >
      <span className="context-menu__item-inner">
        <span className="context-menu__item-label-cluster">
          <span className="context-menu__item-label">Видимость</span>
        </span>
        <span className="context-menu__item-shortcut">{FIELD_VISIBILITY_LABELS[field.visibility]}</span>
        <span
          className="context-menu__item-icon tab-icon arc-icon-chevron arc-chevron-point-right"
          data-arc-icon-size="m"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

type Props = {
  template: DetailCardTemplateV1;
  onChange: (next: DetailCardTemplateV1) => void;
  onRequestDelete?: (fieldId: string) => void;
  variant?: 'card' | 'settings';
  readOnly?: boolean;
  renderValue?: (
    field: DetailTemplateField,
    helpers: { openFieldMenu: () => void }
  ) => ReactNode;
  fieldHasValue?: (field: DetailTemplateField) => boolean;
  onRequestTypeChange?: (fieldId: string, type: CustomFieldType) => void;
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
  renderValue,
  fieldHasValue,
  onRequestTypeChange
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
  const [typeSubmenuOpen, setTypeSubmenuOpen] = useState(false);
  const [typeSubmenuPosition, setTypeSubmenuPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [visibilitySubmenuOpen, setVisibilitySubmenuOpen] = useState(false);
  const [visibilitySubmenuPosition, setVisibilitySubmenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  nameDraftRef.current = nameDraft;
  optionsDraftRef.current = optionsDraft;

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [template.fields, drag, variant, readOnly, menuFieldId, addOpen, hiddenFieldsExpanded]);

  useLayoutEffect(() => {
    if (
      hiddenFieldsExpanded &&
      !template.fields.some((field) => !isFieldInMainList(field, fieldHasValue?.(field) ?? true))
    ) {
      setHiddenFieldsExpanded(false);
    }
  }, [template.fields, hiddenFieldsExpanded, fieldHasValue]);

  const commit = (fields: DetailTemplateField[]) => {
    onChange(sanitizeDetailCardTemplate({ version: 1, fields }));
  };

  useLayoutEffect(() => {
    if (!menuFieldId || !listRef.current) return;
    const btn = listRef.current.querySelector<HTMLButtonElement>(
      `[data-template-field-row="${menuFieldId}"] button.arc-card-detail-prop-row__label`
    );
    if (btn) fieldMenuAnchorRef.current = btn;
  }, [template.fields, menuFieldId, hiddenFieldsExpanded]);

  const hiddenFields =
    variant === 'card'
      ? template.fields.filter((field) => !isFieldInMainList(field, fieldHasValue?.(field) ?? true))
      : [];
  const showHiddenInList = variant === 'card' && hiddenFieldsExpanded && hiddenFields.length > 0;
  const listFields =
    variant === 'card' && !showHiddenInList
      ? template.fields.filter((field) => isFieldInMainList(field, fieldHasValue?.(field) ?? true))
      : template.fields;

  const menuField = menuFieldId
    ? template.fields.find((field) => field.id === menuFieldId)
    : undefined;

  const applyFieldMenuEdits = (
    fields: DetailTemplateField[],
    fieldId: string,
    patch?: { visibility?: FieldVisibilityMode; type?: CustomFieldType; showInFilters?: boolean }
  ): DetailTemplateField[] => {
    const trimmed = nameDraftRef.current.trim();
    const rawOptions = optionsDraftRef.current[fieldId];
    return fields.map((field) => {
      if (field.id !== fieldId) return field;
      const type = patch?.type ?? field.type;
      const next: DetailTemplateField = {
        ...field,
        type,
        label: fieldLabelFromEditorDraft(trimmed, type),
        visibility: patch?.visibility ?? field.visibility,
        showInFilters: patch?.showInFilters ?? field.showInFilters
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

  const closeTypeSubmenu = () => {
    setTypeSubmenuOpen(false);
    setTypeSubmenuPosition(null);
  };

  const closeVisibilitySubmenu = () => {
    setVisibilitySubmenuOpen(false);
    setVisibilitySubmenuPosition(null);
  };

  const closeFieldMenuOnly = () => {
    setMenuFieldId(null);
    closeTypeSubmenu();
    closeVisibilitySubmenu();
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
    closeTypeSubmenu();
    closeVisibilitySubmenu();
    setNameDraft(fieldEditorNameDraft(field));
    if (field.type === 'select' || field.type === 'multiSelect') {
      setOptionsDraft((prev) => ({
        ...prev,
        [field.id]: prev[field.id] ?? (field.options ?? []).join('\n')
      }));
    }
  };

  const setVisibility = (id: string, visibility: FieldVisibilityMode) => {
    const current = template.fields.find((field) => field.id === id);
    const hasValue = current ? (fieldHasValue?.(current) ?? true) : true;
    if (current && !isFieldInMainList({ ...current, visibility }, hasValue)) {
      setHiddenFieldsExpanded(true);
    }
    commit(applyFieldMenuEdits(template.fields, id, { visibility }));
    closeVisibilitySubmenu();
  };

  const toggleShowInFilters = (id: string) => {
    const current = template.fields.find((field) => field.id === id);
    if (!current) return;
    commit(applyFieldMenuEdits(template.fields, id, { showInFilters: !current.showInFilters }));
  };

  const changeCustomType = (id: string, type: CustomFieldType) => {
    const current = template.fields.find((item) => item.id === id);
    if (current && current.type !== type && onRequestTypeChange) {
      closeTypeSubmenu();
      onRequestTypeChange(id, type);
      return;
    }
    commit(applyFieldMenuEdits(template.fields, id, { type }));
    closeTypeSubmenu();
    if (type === 'select' || type === 'multiSelect') {
      const field = template.fields.find((item) => item.id === id);
      if (field) {
        setOptionsDraft((prev) => ({
          ...prev,
          [id]: prev[id] ?? (field.options ?? []).join('\n')
        }));
      }
    }
  };

  const openTypeSubmenu = () => {
    const pos = resolveDetailFieldSubmenuPosition(FIELD_TYPE_ROW_KEY);
    if (!pos) return;
    setTypeSubmenuPosition(pos);
    setTypeSubmenuOpen(true);
  };

  const openVisibilitySubmenu = () => {
    const pos = resolveDetailFieldSubmenuPosition(FIELD_VISIBILITY_ROW_KEY);
    if (!pos) return;
    setVisibilitySubmenuPosition(pos);
    setVisibilitySubmenuOpen(true);
  };

  const duplicateField = (field: DetailTemplateField) => {
    const fields = applyFieldMenuEdits(template.fields, field.id);
    const source = fields.find((item) => item.id === field.id);
    if (!source) return;
    const copy = createCustomTemplateField(source.type, newFieldId());
    copy.label = templateFieldLabel(source);
    copy.visibility = source.visibility;
    copy.showInFilters = source.showInFilters;
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
        commit(
          reorderVisibleTemplateFields(template.fields, args.id, nextInsert, (field) =>
            isFieldInMainList(field, fieldHasValue?.(field) ?? true)
          )
        );
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
  const showSelectOptions = menuField?.type === 'select' || menuField?.type === 'multiSelect';

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
              </div>
              {variant === 'card' && renderValue ? (
                <div className="arc-card-detail-prop-row__value">
                  {renderValue(field, {
                    openFieldMenu: () => {
                      const btn = listRef.current?.querySelector<HTMLButtonElement>(
                        `[data-template-field-row="${field.id}"] button.arc-card-detail-prop-row__label`
                      );
                      if (btn) openFieldMenu(field, btn);
                    }
                  })}
                </div>
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
        panelClassName="arc-detail-field-menu"
        inputSize="m"
      >
        {menuField ? (
          <>
            <ContextMenuHeader>Тип свойства</ContextMenuHeader>
            <DetailFieldTypeRow
              field={menuField}
              submenuOpen={typeSubmenuOpen}
              onOpenSubmenu={openTypeSubmenu}
            />
            <ContextMenuInput
              variant="live"
              slotClassName={FIELD_MENU_NAME_SLOT_CLASS}
              placeholder={CUSTOM_FIELD_TYPE_LABELS[menuField.type]}
              value={nameDraft}
              autoFocus
              onChange={setNameDraft}
            />
            {showSelectOptions ? (
              <ContextMenuInput
                variant="textarea"
                slotClassName={FIELD_MENU_SLOT_CLASS}
                placeholder="Перечислите каждый вариант с новой строки"
                value={optionsDraft[menuField.id] ?? (menuField.options ?? []).join('\n')}
                autoGrow
                autoGrowMinPx={64}
                autoGrowMaxPx={234}
                onChange={(value) => setOptionsDraft((prev) => ({ ...prev, [menuField.id]: value }))}
              />
            ) : null}
            <ContextMenuSeparator />
            <ContextMenuHeader>Опции</ContextMenuHeader>
            <DetailFieldVisibilityRow
              field={menuField}
              submenuOpen={visibilitySubmenuOpen}
              onOpenSubmenu={openVisibilitySubmenu}
            />
            <ContextMenuItem
              label="Показывать в фильтрах"
              selected={menuField.showInFilters}
              onSelect={() => toggleShowInFilters(menuField.id)}
            />
            <ContextMenuItem
              label="Создать копию"
              iconClass="arc-icon-copy"
              onSelect={() => duplicateField(menuField)}
            />
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
        open={typeSubmenuOpen && Boolean(menuField) && !readOnly && typeSubmenuPosition != null}
        position={typeSubmenuPosition}
        onClose={closeTypeSubmenu}
        ariaLabel="Список свойств"
        aboveModal
      >
        {menuField ? (
          <>
            <ContextMenuHeader>Список свойств</ContextMenuHeader>
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
      </ContextMenu>

      <ContextMenu
        open={
          visibilitySubmenuOpen && Boolean(menuField) && !readOnly && visibilitySubmenuPosition != null
        }
        position={visibilitySubmenuPosition}
        onClose={closeVisibilitySubmenu}
        ariaLabel="Видимость"
        aboveModal
      >
        {menuField ? (
          <>
            <ContextMenuHeader>Видимость</ContextMenuHeader>
            {FIELD_VISIBILITY_MODES.map((mode) => (
              <ContextMenuItem
                key={mode}
                label={FIELD_VISIBILITY_LABELS[mode]}
                selected={menuField.visibility === mode}
                onSelect={() => setVisibility(menuField.id, mode)}
              />
            ))}
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
