import { useLayoutEffect, useRef, useState } from 'react';
import {
  templateFieldLabel,
  type CustomFieldsMap,
  type DetailCardTemplateV1,
  type DetailTemplateField
} from '@arc-main-shared/detailCardTemplate';
import { Datepicker } from '../datepicker';
import { ContextMenu } from '../context-menu';
import ContextMenuItem from '../context-menu/ContextMenuItem';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import LinkInput from '../ui/LinkInput';
import CardRatingStars from './CardRatingStars';
import DetailTemplateEditor from './DetailTemplateEditor';
import type { PaletteSwatch } from './cardDetailPalette';

const EMPTY_PLACEHOLDER = 'Пусто';

type Props = {
  template: DetailCardTemplateV1;
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
  onTemplateChange: (next: DetailCardTemplateV1) => void;
  onRequestDeleteField: (fieldId: string) => void;
};

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
  const fieldRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const filled = Boolean(value.trim());

  useLayoutEffect(() => {
    if (fieldRef.current) void hydrateArcNavbarIcons(fieldRef.current);
  }, [filled, open]);

  return (
    <div
      ref={fieldRef}
      className={`field selector-field${filled ? ' has-value' : ''}`}
    >
      <button
        ref={anchorRef}
        type="button"
        className="input pseudo-select input-slots"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        disabled={disabled}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (filled && target.closest('.selector-clear')) {
            onChange('');
            return;
          }
          setOpen((prev) => !prev);
        }}
      >
        <span className="selector-value slot-value">{filled ? value : EMPTY_PLACEHOLDER}</span>
        <span className="selector-actions slot-trailing">
          {filled && !disabled ? (
            <span className="selector-clear" aria-hidden="true" />
          ) : null}
          <span
            className="selector-caret arc-icon-chevron arc-selector-dropdown-caret"
            aria-hidden="true"
          />
        </span>
      </button>
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        ariaLabel={label}
        aboveModal
        anchorPlacement="belowAnchor"
        anchorAlign="start"
      >
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
    </div>
  );
}

function TextValue({
  label,
  value,
  disabled,
  multiline,
  textareaRef,
  onChange
}: {
  label: string;
  value: string;
  disabled: boolean;
  multiline?: boolean;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  onChange: (next: string) => void;
}) {
  if (multiline) {
    return (
      <label className="field">
        <textarea
          ref={textareaRef}
          className="input textarea arc-card-detail-description-textarea"
          placeholder={EMPTY_PLACEHOLDER}
          aria-label={label}
          rows={3}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }
  return (
    <label className={`field input-live${value.trim() ? ' has-value' : ''}`} data-live-input>
      <input
        className="input"
        type="text"
        placeholder={EMPTY_PLACEHOLDER}
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.trim() && !disabled ? (
        <button
          className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
          type="button"
          aria-label={`Очистить ${label}`}
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            onChange('');
          }}
        />
      ) : null}
    </label>
  );
}

function PropertyValue(props: Props & { field: DetailTemplateField }) {
  const { field } = props;
  const label = templateFieldLabel(field);
  const disabled = props.inTrash;

  if (field.kind === 'builtin' && field.id === 'name') {
    return (
      <TextValue
        label={label}
        value={props.draftName}
        disabled={disabled}
        onChange={props.onNameChange}
      />
    );
  }

  if (field.kind === 'builtin' && field.id === 'link') {
    return (
      <LinkInput
        value={props.draftLink}
        disabled={disabled}
        ariaLabel={label}
        onChange={props.onLinkChange}
        onOpen={props.onOpenLink}
        canOpen={props.canOpenLink}
      />
    );
  }

  if (field.kind === 'builtin' && field.id === 'description') {
    return (
      <TextValue
        label={label}
        value={props.description}
        disabled={disabled}
        multiline
        textareaRef={props.descriptionTextareaRef}
        onChange={props.onDescriptionChange}
      />
    );
  }

  if (field.kind !== 'custom') return null;
  const raw = props.customFields[field.id];
  const text = typeof raw === 'string' ? raw : '';
  const multi = Array.isArray(raw) ? raw : [];

  if (field.type === 'longText') {
    return (
      <TextValue
        label={label}
        value={text}
        disabled={disabled}
        multiline
        onChange={(value) => props.onCustomFieldChange(field.id, value)}
      />
    );
  }

  if (field.type === 'url' || field.type === 'shortText') {
    return (
      <TextValue
        label={label}
        value={text}
        disabled={disabled}
        onChange={(value) => props.onCustomFieldChange(field.id, value)}
      />
    );
  }

  if (field.type === 'date') {
    return (
      <Datepicker
        size="m"
        mode="single"
        placeholder={EMPTY_PLACEHOLDER}
        value={text ? { from: text } : null}
        disabled={disabled}
        onChange={(next) => props.onCustomFieldChange(field.id, next?.from ?? '')}
        aria-label={label}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <CustomSelect
        label={label}
        value={text}
        options={field.options ?? []}
        disabled={disabled}
        onChange={(next) => props.onCustomFieldChange(field.id, next)}
      />
    );
  }

  if (field.type === 'multiSelect') {
    return (
      <MultiSelectValue
        label={label}
        options={field.options ?? []}
        selected={multi}
        disabled={disabled}
        onChange={(next) => props.onCustomFieldChange(field.id, next)}
      />
    );
  }

  return (
    <TextValue
      label={label}
      value={text}
      disabled={disabled}
      onChange={(value) => props.onCustomFieldChange(field.id, value)}
    />
  );
}

function MultiSelectValue({
  label,
  options,
  selected,
  disabled,
  onChange
}: {
  label: string;
  options: string[];
  selected: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const filled = selected.length > 0;

  useLayoutEffect(() => {
    if (fieldRef.current) void hydrateArcNavbarIcons(fieldRef.current);
  }, [filled, open, selected]);

  const toggleOption = (option: string) => {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  };

  return (
    <div ref={fieldRef} className={`field selector-field${filled ? ' has-value' : ''}`}>
      <div
        ref={anchorRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        aria-disabled={disabled || undefined}
        className="input input-slots search-multiselect arc-detail-multiselect"
        onClick={() => {
          if (disabled || options.length === 0) return;
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (disabled || options.length === 0) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
      >
        {filled ? (
          <span className="arc-detail-multiselect__chips">
            {selected.map((option) => (
              <button
                key={option}
                type="button"
                className="chip chip-active"
                disabled={disabled}
                aria-label={`Убрать ${option}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(selected.filter((item) => item !== option));
                }}
              >
                <span>{option}</span>
                <span className="chip-remove" aria-hidden="true">
                  ✕
                </span>
              </button>
            ))}
          </span>
        ) : (
          <span className="selector-value slot-value">{EMPTY_PLACEHOLDER}</span>
        )}
        <span className="selector-actions slot-trailing">
          <span
            className="selector-caret arc-icon-chevron arc-selector-dropdown-caret"
            aria-hidden="true"
          />
        </span>
      </div>
      <ContextMenu
        open={open && !disabled && options.length > 0}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        ariaLabel={label}
        aboveModal
        anchorPlacement="belowAnchor"
        anchorAlign="start"
        rows={options.map((option) => ({
          type: 'item' as const,
          key: option,
          label: option,
          selected: selected.includes(option),
          closeOnSelect: false,
          onSelect: () => toggleOption(option)
        }))}
      />
    </div>
  );
}

export default function CardDetailDescriptionFields(props: Props) {
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

      <DetailTemplateEditor
        variant="card"
        template={props.template}
        readOnly={props.inTrash}
        onChange={props.onTemplateChange}
        onRequestDelete={props.inTrash ? undefined : props.onRequestDeleteField}
        renderValue={(field) => <PropertyValue {...props} field={field} />}
      />
    </div>
  );
}
