import { useMemo, useState } from 'react';
import {
  templateFieldLabel,
  type CustomFieldsMap,
  type DetailCardTemplateV1,
  type DetailTemplateField
} from '@arc-main-shared/detailCardTemplate';
import { Datepicker } from '../datepicker';
import { ContextMenu } from '../context-menu';
import ContextMenuItem from '../context-menu/ContextMenuItem';
import { Tooltip } from '../tooltip/Tooltip';
import CardRatingStars from './CardRatingStars';
import type { PaletteSwatch } from './cardDetailPalette';

type Props = {
  template: DetailCardTemplateV1;
  editMode: boolean;
  inTrash: boolean;
  rating: number;
  onRatingChange: (value: number) => void;
  palette: PaletteSwatch[];
  onPaletteClick: (hex: string) => void;
  draftName: string;
  onNameChange: (value: string) => void;
  draftLink: string;
  onLinkChange: (value: string) => void;
  onOpenLink: () => void;
  canOpenLink: boolean;
  description: string;
  onDescriptionChange: (value: string) => void;
  descriptionTextareaRef: React.Ref<HTMLTextAreaElement>;
  customFields: CustomFieldsMap;
  onCustomFieldChange: (fieldId: string, value: string | string[]) => void;
};

function emptyDash(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : '—';
}

function viewValueForField(field: DetailTemplateField, props: Props): string {
  if (field.kind === 'builtin') {
    if (field.id === 'name') return emptyDash(props.draftName);
    if (field.id === 'link') return emptyDash(props.draftLink);
    return emptyDash(props.description);
  }
  const raw = props.customFields[field.id];
  if (Array.isArray(raw)) return raw.length ? raw.join(', ') : '—';
  return emptyDash(typeof raw === 'string' ? raw : '');
}

function CustomSelect({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <div className={`field selector-field${value ? ' has-value' : ''}`}>
        <button
          ref={setAnchor}
          type="button"
          className="input pseudo-select input-slots"
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="selector-value slot-value">{value || label}</span>
        </button>
      </div>
      <ContextMenu open={open} anchorRef={{ current: anchor }} onClose={() => setOpen(false)} ariaLabel={label}>
        {options.map((option) => (
          <ContextMenuItem
            key={option}
            label={option}
            selected={option === value}
            onSelect={() => {
              onChange(option);
              setOpen(false);
            }}
          />
        ))}
      </ContextMenu>
    </>
  );
}

export default function CardDetailDescriptionFields(props: Props) {
  const visibleFields = useMemo(
    () => props.template.fields.filter((field) => field.visible),
    [props.template.fields]
  );

  return (
    <div className="arc-card-detail-description-fields arc-ui-kit-scope" data-input-size="m" data-btn-size="m">
      <CardRatingStars value={props.rating} onChange={props.onRatingChange} disabled={props.inTrash} />
      {props.palette.length > 0 ? (
        <div className="arc-card-detail-palette">
          {props.palette.map((swatch, index) => (
            <Tooltip
              key={`${swatch.hex}-${index}`}
              content={`Поиск по цвету · ${swatch.hex.toUpperCase()} (${swatch.pct}%)`}
              position="top"
            >
              <button
                type="button"
                className="arc-card-detail-palette-swatch"
                style={{ backgroundColor: swatch.hex }}
                aria-label={`Поиск по цвету ${swatch.hex}, ${swatch.pct} процентов`}
                onClick={() => props.onPaletteClick(swatch.hex)}
              />
            </Tooltip>
          ))}
        </div>
      ) : null}

      {visibleFields.map((field) => {
        if (!props.editMode) {
          return (
            <div key={field.id} className="arc-card-detail-field-view">
              <span className="arc-card-detail-field-view__label text-m">{templateFieldLabel(field)}</span>
              <span className="arc-card-detail-field-view__value text-m">{viewValueForField(field, props)}</span>
            </div>
          );
        }

        if (field.kind === 'builtin' && field.id === 'name') {
          return (
            <label
              key={field.id}
              className={`field input-live${props.draftName.trim() ? ' has-value' : ''}`}
              data-live-input
            >
              <input
                className="input"
                type="text"
                placeholder="Имя"
                value={props.draftName}
                disabled={props.inTrash}
                onChange={(e) => props.onNameChange(e.target.value)}
              />
              <button
                className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                type="button"
                aria-label="Очистить"
                disabled={props.inTrash}
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  props.onNameChange('');
                }}
              />
            </label>
          );
        }

        if (field.kind === 'builtin' && field.id === 'link') {
          return (
            <div key={field.id} className="arc-card-detail-link-row">
              <label
                className={`field input-live arc-card-detail-link-field${props.draftLink.trim() ? ' has-value' : ''}`}
                data-live-input
              >
                <input
                  className="input"
                  type="text"
                  placeholder="Ссылка"
                  value={props.draftLink}
                  disabled={props.inTrash}
                  onChange={(e) => props.onLinkChange(e.target.value)}
                />
                <button
                  className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                  type="button"
                  aria-label="Очистить"
                  disabled={props.inTrash}
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    props.onLinkChange('');
                  }}
                />
              </label>
              <Tooltip content="Открыть ссылку" position="top">
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds"
                  aria-label="Открыть ссылку"
                  disabled={!props.canOpenLink}
                  onClick={props.onOpenLink}
                >
                  <span className="btn-icon-only__glyph arc-icon-external-link" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          );
        }

        if (field.kind === 'builtin' && field.id === 'description') {
          return (
            <label key={field.id} className="field">
              <textarea
                ref={props.descriptionTextareaRef}
                className="input textarea arc-card-detail-description-textarea"
                placeholder="Описание"
                rows={4}
                value={props.description}
                disabled={props.inTrash}
                onChange={(e) => props.onDescriptionChange(e.target.value)}
              />
            </label>
          );
        }

        if (field.kind !== 'custom') return null;
        const raw = props.customFields[field.id];
        const text = typeof raw === 'string' ? raw : '';
        const multi = Array.isArray(raw) ? raw : [];
        const disabled = props.inTrash;

        if (field.type === 'longText') {
          return (
            <label key={field.id} className="field">
              <textarea
                className="input textarea"
                placeholder={field.label}
                rows={3}
                value={text}
                disabled={disabled}
                onChange={(e) => props.onCustomFieldChange(field.id, e.target.value)}
              />
            </label>
          );
        }

        if (field.type === 'url') {
          return (
            <div key={field.id} className="arc-card-detail-link-row">
              <label className={`field input-live arc-card-detail-link-field${text.trim() ? ' has-value' : ''}`} data-live-input>
                <input
                  className="input"
                  type="text"
                  placeholder={field.label}
                  value={text}
                  disabled={disabled}
                  onChange={(e) => props.onCustomFieldChange(field.id, e.target.value)}
                />
              </label>
            </div>
          );
        }

        if (field.type === 'date') {
          return (
            <Datepicker
              key={field.id}
              size="m"
              mode="single"
              placeholder={field.label}
              value={text ? { from: text } : null}
              disabled={disabled}
              onChange={(next) => props.onCustomFieldChange(field.id, next?.from ?? '')}
            />
          );
        }

        if (field.type === 'select') {
          return (
            <CustomSelect
              key={field.id}
              label={field.label}
              value={text}
              options={field.options ?? []}
              disabled={disabled}
              onChange={(next) => props.onCustomFieldChange(field.id, next)}
            />
          );
        }

        if (field.type === 'multiSelect') {
          return (
            <div key={field.id} className="arc-detail-custom-chips">
              {(field.options ?? []).map((option) => {
                const selected = multi.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    className={selected ? 'chip chip-active' : 'chip'}
                    disabled={disabled}
                    onClick={() => {
                      const next = selected ? multi.filter((item) => item !== option) : [...multi, option];
                      props.onCustomFieldChange(field.id, next);
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          );
        }

        return (
          <label
            key={field.id}
            className={`field input-live${text.trim() ? ' has-value' : ''}`}
            data-live-input
          >
            <input
              className="input"
              type="text"
              placeholder={field.label}
              value={text}
              disabled={disabled}
              onChange={(e) => props.onCustomFieldChange(field.id, e.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}
