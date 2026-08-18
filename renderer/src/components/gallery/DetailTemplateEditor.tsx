import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  createCustomTemplateField,
  reorderTemplateFields,
  sanitizeDetailCardTemplate,
  templateFieldLabel,
  type CustomFieldType,
  type DetailCardTemplateV1,
  type DetailTemplateField
} from '@arc-main-shared/detailCardTemplate';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';

type DragState = {
  dragId: string;
  insertIndex: number;
  ghostX: number;
  ghostY: number;
  ghostWidth: number;
  label: string;
};

type Props = {
  template: DetailCardTemplateV1;
  onChange: (next: DetailCardTemplateV1) => void;
  onDeleteCustomField?: (fieldId: string) => void;
  variant?: 'menu' | 'settings';
};

function newFieldId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function DetailTemplateEditor({
  template,
  onChange,
  onDeleteCustomField,
  variant = 'menu'
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [optionsDraft, setOptionsDraft] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    if (listRef.current) void hydrateArcNavbarIcons(listRef.current);
  }, [template.fields, drag, variant]);

  const commit = (fields: DetailTemplateField[]) => {
    onChange(sanitizeDetailCardTemplate({ version: 1, fields }));
  };

  const toggleVisible = (id: string) => {
    commit(
      template.fields.map((field) => (field.id === id ? { ...field, visible: !field.visible } : field))
    );
  };

  const addField = (type: CustomFieldType) => {
    commit([...template.fields, createCustomTemplateField(type, newFieldId())]);
  };

  const rename = (id: string, label: string) => {
    commit(
      template.fields.map((field) =>
        field.kind === 'custom' && field.id === id ? { ...field, label } : field
      )
    );
  };

  const commitOptions = (id: string, raw: string) => {
    const options = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    commit(
      template.fields.map((field) =>
        field.kind === 'custom' && field.id === id ? { ...field, options } : field
      )
    );
  };

  const startDrag = (args: {
    id: string;
    label: string;
    handleEl: HTMLElement;
    rowEl: HTMLElement;
  }) => {
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
      commit(reorderTemplateFields(template.fields, args.id, nextInsert));
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <>
      <div
        ref={listRef}
        className={`context-menu__filter-options-list${variant === 'settings' ? ' arc-detail-template-editor' : ''}${drag ? ' is-drop-end' : ''}`}
      >
        {template.fields.map((field, rowIndex) => {
          const label = templateFieldLabel(field);
          const visible = field.visible;
          const insertBefore = drag != null && drag.insertIndex === rowIndex && drag.dragId !== field.id;
          return (
            <div
              key={field.id}
              className={`context-menu__filter-row${drag?.dragId === field.id ? ' is-dragging' : ''}${insertBefore ? ' is-drop-before' : ''}`}
              data-template-field-row={field.id}
            >
              <div className="context-menu__filter-row-inner">
                <button
                  type="button"
                  className="context-menu__filter-row-handle"
                  aria-label={`Переместить ${label}`}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    startDrag({
                      id: field.id,
                      label,
                      handleEl: e.currentTarget,
                      rowEl: e.currentTarget.closest('[data-template-field-row]') as HTMLElement
                    });
                  }}
                >
                  <span
                    className="context-menu__filter-row-handle-icon tab-icon arc-icon-chevrons-up-down"
                    data-arc-icon-size="m"
                    aria-hidden="true"
                  />
                </button>
                {variant === 'settings' && field.kind === 'custom' ? (
                  <label className={`field input-live${field.label.trim() ? ' has-value' : ''}`} data-live-input>
                    <input
                      className="input"
                      type="text"
                      placeholder={CUSTOM_FIELD_TYPE_LABELS[field.type]}
                      value={field.label}
                      onChange={(e) => rename(field.id, e.target.value)}
                    />
                  </label>
                ) : (
                  <span className="context-menu__filter-row-label">{label}</span>
                )}
                <button
                  type="button"
                  className="context-menu__filter-row-visibility"
                  aria-label={visible ? `Скрыть ${label}` : `Показать ${label}`}
                  aria-pressed={visible}
                  onClick={() => toggleVisible(field.id)}
                >
                  <span
                    className={`context-menu__filter-row-visibility-icon tab-icon ${visible ? 'arc-icon-eye' : 'arc-icon-eye-off'}`}
                    data-arc-icon-size="m"
                    aria-hidden="true"
                  />
                </button>
                {field.kind === 'custom' && onDeleteCustomField ? (
                  <Tooltip content="Удалить поле" position="top">
                    <button
                      type="button"
                      className="btn btn-outline btn-icon-only btn-ds"
                      aria-label={`Удалить ${label}`}
                      onClick={() => onDeleteCustomField(field.id)}
                    >
                      <span className="btn-icon-only__glyph arc-icon-close" aria-hidden="true" />
                    </button>
                  </Tooltip>
                ) : null}
              </div>
              {variant === 'settings' &&
              field.kind === 'custom' &&
              (field.type === 'select' || field.type === 'multiSelect') ? (
                <label className="field arc-detail-template-editor__options">
                  <textarea
                    className="input textarea"
                    rows={3}
                    placeholder="Варианты, каждый с новой строки"
                    value={optionsDraft[field.id] ?? (field.options ?? []).join('\n')}
                    onChange={(e) => setOptionsDraft((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    onBlur={(e) => commitOptions(field.id, e.target.value)}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="arc-detail-template-editor__add">
        {CUSTOM_FIELD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className="btn btn-outline btn-ds btn-s"
            onClick={() => addField(type)}
          >
            <span className="btn-ds__value">{CUSTOM_FIELD_TYPE_LABELS[type]}</span>
          </button>
        ))}
      </div>
      {drag
        ? createPortal(
            <div
              className="context-menu__filter-row-ghost"
              style={{ left: drag.ghostX, top: drag.ghostY, width: drag.ghostWidth }}
            >
              <span className="context-menu__filter-row-label">{drag.label}</span>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
