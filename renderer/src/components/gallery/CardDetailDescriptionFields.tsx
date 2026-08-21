import { useLayoutEffect, useRef, useState } from 'react';
import {
  customFieldValueIsFilled,
  templateFieldLabel,
  type CustomFieldsMap,
  type DetailCardTemplateV1,
  type DetailTemplateField
} from '@arc-main-shared/detailCardTemplate';
import { Datepicker } from '../datepicker';
import { todayLocalDateOnly } from '../datepicker/dateRangeText';
import { ContextMenu } from '../context-menu';
import ContextMenuItem from '../context-menu/ContextMenuItem';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Tooltip } from '../tooltip/Tooltip';
import LinkInput from '../ui/LinkInput';
import { toOpenableLinkUrl } from '../../utils/linkInput';
import CardRatingStars from './CardRatingStars';
import DetailTemplateEditor from './DetailTemplateEditor';
import type { PaletteSwatch } from './cardDetailPalette';

const EMPTY_PLACEHOLDER = 'Пусто';

type Props = {
  cardId: string;
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
  onRequestTypeChange?: (fieldId: string, type: DetailTemplateField['type']) => void;
};

function openExternalUrl(raw: string): void {
  const url = toOpenableLinkUrl(raw);
  if (!url) return;
  if (window.arc?.openExternalUrl) {
    void window.arc.openExternalUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function CustomSelect({
  label,
  value,
  options,
  disabled,
  onChange,
  onRequestEditField
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (next: string) => void;
  onRequestEditField?: () => void;
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
        {options.length === 0 ? (
          <ContextMenuItem
            label="Добавить варианты"
            iconClass="arc-icon-plus"
            onSelect={() => {
              setOpen(false);
              onRequestEditField?.();
            }}
          />
        ) : (
          options.map((option) => (
            <ContextMenuItem
              key={option}
              label={option}
              selected={option === value}
              onSelect={() => {
                onChange(option);
                setOpen(false);
              }}
            />
          ))
        )}
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
  placeholder = EMPTY_PLACEHOLDER,
  onChange
}: {
  label: string;
  value: string;
  disabled: boolean;
  multiline?: boolean;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  if (multiline) {
    return (
      <label className="field">
        <textarea
          ref={textareaRef}
          className="input textarea arc-card-detail-description-textarea"
          placeholder={placeholder}
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
        placeholder={placeholder}
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

function DateFieldValue({
  instanceKey,
  label,
  value,
  disabled,
  onChange
}: {
  instanceKey: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const today = todayLocalDateOnly();
  const [clearedKey, setClearedKey] = useState<string | null>(null);
  const trimmed = value.trim();
  const userCleared = clearedKey === instanceKey;

  useLayoutEffect(() => {
    if (disabled || userCleared || trimmed) return;
    onChange(today);
  }, [disabled, userCleared, trimmed, today, onChange]);

  return (
    <Datepicker
      size="m"
      mode="single"
      placeholder={EMPTY_PLACEHOLDER}
      value={trimmed ? { from: trimmed } : userCleared || disabled ? null : { from: today }}
      disabled={disabled}
      onChange={(next) => {
        const nextVal = next?.from?.trim() ?? '';
        setClearedKey(nextVal ? null : instanceKey);
        onChange(nextVal);
      }}
      aria-label={label}
    />
  );
}

function PropertyValue(
  props: Props & { field: DetailTemplateField; onRequestEditField?: () => void }
) {
  const { field } = props;
  const label = templateFieldLabel(field);
  const disabled = props.inTrash;

  if (field.id === 'name') {
    return (
      <TextValue
        label={label}
        value={props.draftName}
        disabled={disabled}
        onChange={props.onNameChange}
      />
    );
  }

  if (field.id === 'description') {
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

  const raw = props.customFields[field.id];
  const text = typeof raw === 'string' ? raw : '';
  const multi = Array.isArray(raw) ? raw : [];

  if (field.id === 'link' || field.type === 'url') {
    const value = field.id === 'link' ? props.draftLink : text;
    const canOpen = field.id === 'link' ? props.canOpenLink : Boolean(toOpenableLinkUrl(value));
    return (
      <LinkInput
        value={value}
        disabled={disabled}
        ariaLabel={label}
        onChange={field.id === 'link' ? props.onLinkChange : (next) => props.onCustomFieldChange(field.id, next)}
        onOpen={field.id === 'link' ? props.onOpenLink : () => openExternalUrl(value)}
        canOpen={canOpen}
      />
    );
  }

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

  if (field.type === 'shortText') {
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
      <DateFieldValue
        instanceKey={`${props.cardId}:${field.id}`}
        label={label}
        value={text}
        disabled={disabled}
        onChange={(next) => props.onCustomFieldChange(field.id, next)}
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
        onRequestEditField={props.onRequestEditField}
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
        onRequestEditField={props.onRequestEditField}
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
  onChange,
  onRequestEditField
}: {
  label: string;
  options: string[];
  selected: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
  onRequestEditField?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filled = selected.length > 0;
  const queryNorm = query.trim().toLowerCase();
  const filtered = queryNorm
    ? options.filter((option) => option.toLowerCase().includes(queryNorm))
    : options;

  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const skipFieldClickRef = useRef(false);

  const toggleOption = (option: string) => {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
    setQuery('');
  };

  const removeOption = (option: string) => {
    onChange(selected.filter((item) => item !== option));
  };

  return (
    <div className={`field${filled ? ' has-value' : ''}`}>
      <div
        ref={anchorRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        aria-disabled={disabled || undefined}
        className={`input input-multiselect input-slots${disabled ? ' is-disabled' : ''}`}
        onClick={(e) => {
          if (disabled) return;
          if (skipFieldClickRef.current) {
            skipFieldClickRef.current = false;
            return;
          }
          if ((e.target as HTMLElement).closest('.chip')) return;
          focusInput();
          openMenu();
        }}
      >
        {selected.map((option) => (
          <button
            key={option}
            type="button"
            className="chip chip-active"
            disabled={disabled}
            aria-label={`Убрать ${option}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              skipFieldClickRef.current = true;
              window.setTimeout(() => {
                skipFieldClickRef.current = false;
              }, 0);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (disabled) return;
              removeOption(option);
            }}
          >
            <span>{option}</span>
            <span className="chip-remove" aria-hidden="true">
              ✕
            </span>
          </button>
        ))}
        <input
          ref={inputRef}
          className="search-inner slot-value"
          type="text"
          placeholder={filled ? '' : EMPTY_PLACEHOLDER}
          aria-label={label}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            openMenu();
          }}
          onFocus={openMenu}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === 'Backspace' && query === '' && selected.length > 0) {
              e.preventDefault();
              onChange(selected.slice(0, -1));
              openMenu();
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = filtered[0];
              if (first) toggleOption(first);
              else openMenu();
            }
          }}
        />
      </div>
      <ContextMenu
        open={open && !disabled}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        ariaLabel={label}
        aboveModal
        anchorPlacement="belowAnchor"
        anchorAlign="start"
        rows={
          options.length === 0
            ? [
                {
                  type: 'item' as const,
                  key: 'add-options',
                  label: 'Добавить варианты',
                  iconClass: 'arc-icon-plus',
                  onSelect: () => {
                    setOpen(false);
                    onRequestEditField?.();
                  }
                }
              ]
            : filtered.map((option) => ({
                type: 'item' as const,
                key: option,
                label: option,
                selected: selected.includes(option),
                closeOnSelect: false,
                onSelect: () => toggleOption(option)
              }))
        }
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
        onRequestTypeChange={props.inTrash ? undefined : props.onRequestTypeChange}
        fieldHasValue={(field) => {
          if (field.id === 'name') return props.draftName.trim().length > 0;
          if (field.id === 'link') return props.draftLink.trim().length > 0;
          if (field.id === 'description') return props.description.trim().length > 0;
          return customFieldValueIsFilled(props.customFields[field.id]);
        }}
        renderValue={(field, { openFieldMenu }) => (
          <PropertyValue {...props} field={field} onRequestEditField={openFieldMenu} />
        )}
      />
    </div>
  );
}
