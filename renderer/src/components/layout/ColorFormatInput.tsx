import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContextMenu } from '../context-menu';
import { CONTEXT_MENU_COLOR_FORMAT_WIDTH } from '../context-menu/types';
import {
  COLOR_FORMAT_LABELS,
  COLOR_FORMAT_ORDER,
  hexToCmyk,
  hexToHsb,
  hexToHsl,
  hexToRgb,
  normalizeColorHex,
  parseCmykChannels,
  parseHsbChannels,
  parseHslChannels,
  parseRgbChannels,
  type ColorFormat
} from '../../utils/colorFormats';
import { findNearestPantones, formatPantoneCode, pantoneToHex } from '../../utils/pantoneColors';
import { readColorFormatPreference, writeColorFormatPreference } from '../../hooks/useColorFormatPreference';

type Props = {
  value: string;
  onChange: (hex: string) => void;
  format?: ColorFormat;
  onFormatChange?: (format: ColorFormat) => void;
  /** Доступные форматы в переключателе. По умолчанию — базовые (без Pantone). */
  formats?: ColorFormat[];
  inputSize?: 's' | 'm';
  showSwatch?: boolean;
  className?: string;
  ariaLabel?: string;
  onFocus?: () => void;
  onClick?: () => void;
  compact?: boolean;
  /** Без обёртки `.input` — для встраивания в navbar `input-slots`. */
  embedded?: boolean;
};

function digitsOnly(raw: string, max: number): string {
  return raw.replace(/\D/g, '').slice(0, max);
}

function ChannelSep({ compact }: { compact: boolean }) {
  return (
    <span
      className={`arc-color-format-channel-sep${compact ? ' arc-color-format-channel-sep--compact' : ''}`}
      aria-hidden="true"
    />
  );
}

function withChannelSeparators(nodes: ReactNode[], compact: boolean): ReactNode[] {
  const out: ReactNode[] = [];
  nodes.forEach((node, index) => {
    if (index > 0) out.push(<ChannelSep key={`sep-${index}`} compact={compact} />);
    out.push(node);
  });
  return out;
}

export default function ColorFormatInput({
  value,
  onChange,
  format: controlledFormat,
  onFormatChange,
  formats = COLOR_FORMAT_ORDER,
  inputSize = 'm',
  showSwatch = true,
  className = '',
  ariaLabel = 'Цвет',
  onFocus,
  onClick,
  compact = false,
  embedded = false
}: Props) {
  const safeHex = normalizeColorHex(value) ?? '#F3F3F4';
  const [internalFormat, setInternalFormat] = useState<ColorFormat>(() => readColorFormatPreference());
  const format = controlledFormat ?? internalFormat;
  const prependRef = useRef<HTMLButtonElement>(null);
  const [formatMenuOpen, setFormatMenuOpen] = useState(false);

  const rgb = hexToRgb(safeHex) ?? { r: 243, g: 243, b: 244 };
  const cmyk = hexToCmyk(safeHex) ?? { c: 0, m: 0, y: 0, k: 4 };
  const hsl = hexToHsl(safeHex) ?? { h: 0, s: 0, l: 95 };
  const hsb = hexToHsb(safeHex) ?? { h: 0, s: 0, b: 95 };

  const [hexDraft, setHexDraft] = useState(safeHex.replace(/^#/, ''));
  const [rgbDraft, setRgbDraft] = useState({ r: String(rgb.r), g: String(rgb.g), b: String(rgb.b) });
  const [cmykDraft, setCmykDraft] = useState({
    c: String(cmyk.c),
    m: String(cmyk.m),
    y: String(cmyk.y),
    k: String(cmyk.k)
  });
  const [hslDraft, setHslDraft] = useState({ h: String(hsl.h), s: String(hsl.s), l: String(hsl.l) });
  const [hsbDraft, setHsbDraft] = useState({ h: String(hsb.h), s: String(hsb.s), b: String(hsb.b) });
  const [pantoneDraft, setPantoneDraft] = useState(() => {
    const nearest = findNearestPantones(safeHex, 1)[0];
    return nearest ? formatPantoneCode(nearest.code) : '';
  });
  const [pantoneEditing, setPantoneEditing] = useState(false);

  useEffect(() => {
    const nextHex = normalizeColorHex(value);
    if (!nextHex) return;
    setHexDraft(nextHex.replace(/^#/, ''));
    const nextRgb = hexToRgb(nextHex);
    const nextCmyk = hexToCmyk(nextHex);
    const nextHsl = hexToHsl(nextHex);
    const nextHsb = hexToHsb(nextHex);
    if (nextRgb) {
      setRgbDraft({ r: String(nextRgb.r), g: String(nextRgb.g), b: String(nextRgb.b) });
    }
    if (nextCmyk) {
      setCmykDraft({
        c: String(nextCmyk.c),
        m: String(nextCmyk.m),
        y: String(nextCmyk.y),
        k: String(nextCmyk.k)
      });
    }
    if (nextHsl) {
      setHslDraft({ h: String(nextHsl.h), s: String(nextHsl.s), l: String(nextHsl.l) });
    }
    if (nextHsb) {
      setHsbDraft({ h: String(nextHsb.h), s: String(nextHsb.s), b: String(nextHsb.b) });
    }
    if (!pantoneEditing) {
      const nearest = findNearestPantones(nextHex, 1)[0];
      setPantoneDraft(nearest ? formatPantoneCode(nearest.code) : '');
    }
  }, [value, pantoneEditing]);

  const setFormat = (next: ColorFormat) => {
    if (!controlledFormat) {
      setInternalFormat(next);
      writeColorFormatPreference(next);
    }
    onFormatChange?.(next);
  };

  const commitHex = (raw: string) => {
    const parsed = normalizeColorHex(raw);
    if (!parsed) {
      setHexDraft(safeHex.replace(/^#/, ''));
      return;
    }
    setHexDraft(parsed.replace(/^#/, ''));
    onChange(parsed);
  };

  const commitPantone = (raw: string) => {
    setPantoneEditing(false);
    const parsed = pantoneToHex(raw);
    if (parsed) {
      onChange(parsed);
      return;
    }
    const nearest = findNearestPantones(safeHex, 1)[0];
    setPantoneDraft(nearest ? formatPantoneCode(nearest.code) : '');
  };

  const formatRows = useMemo(
    () =>
      formats.map((item) => ({
        type: 'item' as const,
        key: item,
        label: COLOR_FORMAT_LABELS[item],
        selected: format === item,
        onSelect: () => setFormat(item)
      })),
    [format, formats]
  );

  const swatchStyle = { background: safeHex };

  const sharedInputProps = {
    onFocus,
    onClick,
    spellCheck: false as const
  };

  const inputClass = (base = 'color-value-input slot-value') =>
    `${base}${compact ? ' arc-color-format-input--compact' : ''}`;

  const renderChannelInputs = <K extends string>(
    fields: Array<{ key: K; label: string; max: number }>,
    draft: Record<K, string>,
    setDraft: (next: Record<K, string>) => void,
    parse: (draft: Record<K, string>) => string | null,
    onCommit: () => void
  ) =>
    withChannelSeparators(
      fields.map((field) => (
        <input
          key={field.key}
          {...sharedInputProps}
          type="text"
          inputMode="numeric"
          className={inputClass()}
          value={draft[field.key]}
          aria-label={`${ariaLabel}, ${field.label}`}
          onChange={(e) => {
            const next = digitsOnly(e.target.value, field.max);
            const nextDraft = { ...draft, [field.key]: next };
            setDraft(nextDraft);
            const parsed = parse(nextDraft);
            if (parsed) onChange(parsed);
          }}
          onBlur={onCommit}
        />
      )),
      compact
    );

  const renderSlots = () => {
    if (format === 'hex') {
      return (
        <input
          {...sharedInputProps}
          type="text"
          className={`${inputClass()} arc-color-format-hex-value`}
          value={hexDraft}
          aria-label={`${ariaLabel}, HEX`}
          onChange={(e) => {
            const next = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6);
            setHexDraft(next);
            const parsed = normalizeColorHex(next);
            if (parsed) onChange(parsed);
          }}
          onBlur={() => commitHex(hexDraft)}
        />
      );
    }

    if (format === 'rgb') {
      return renderChannelInputs(
        [
          { key: 'r', label: 'R', max: 3 },
          { key: 'g', label: 'G', max: 3 },
          { key: 'b', label: 'B', max: 3 }
        ],
        rgbDraft,
        setRgbDraft,
        (draft) => parseRgbChannels(draft.r, draft.g, draft.b),
        () => {
          const parsed = parseRgbChannels(rgbDraft.r, rgbDraft.g, rgbDraft.b);
          if (parsed) onChange(parsed);
        }
      );
    }

    if (format === 'cmyk') {
      return renderChannelInputs(
        [
          { key: 'c', label: 'C', max: 3 },
          { key: 'm', label: 'M', max: 3 },
          { key: 'y', label: 'Y', max: 3 },
          { key: 'k', label: 'K', max: 3 }
        ],
        cmykDraft,
        setCmykDraft,
        (draft) => parseCmykChannels(draft.c, draft.m, draft.y, draft.k),
        () => {
          const parsed = parseCmykChannels(cmykDraft.c, cmykDraft.m, cmykDraft.y, cmykDraft.k);
          if (parsed) onChange(parsed);
        }
      );
    }

    if (format === 'hsl') {
      return renderChannelInputs(
        [
          { key: 'h', label: 'H', max: 3 },
          { key: 's', label: 'S', max: 3 },
          { key: 'l', label: 'L', max: 3 }
        ],
        hslDraft,
        setHslDraft,
        (draft) => parseHslChannels(draft.h, draft.s, draft.l),
        () => {
          const parsed = parseHslChannels(hslDraft.h, hslDraft.s, hslDraft.l);
          if (parsed) onChange(parsed);
        }
      );
    }

    if (format === 'pantone') {
      return (
        <input
          {...sharedInputProps}
          type="text"
          className={`${inputClass()} arc-color-format-pantone-value`}
          value={pantoneDraft}
          placeholder="185-C"
          aria-label={`${ariaLabel}, Pantone`}
          onChange={(e) => {
            setPantoneEditing(true);
            setPantoneDraft(e.target.value.slice(0, 20));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitPantone(pantoneDraft);
          }}
          onBlur={() => commitPantone(pantoneDraft)}
        />
      );
    }

    return renderChannelInputs(
      [
        { key: 'h', label: 'H', max: 3 },
        { key: 's', label: 'S', max: 3 },
        { key: 'b', label: 'B', max: 3 }
      ],
      hsbDraft,
      setHsbDraft,
      (draft) => parseHsbChannels(draft.h, draft.s, draft.b),
      () => {
        const parsed = parseHsbChannels(hsbDraft.h, hsbDraft.s, hsbDraft.b);
        if (parsed) onChange(parsed);
      }
    );
  };

  const openFormatMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setFormatMenuOpen(true);
  };

  const fieldsBody = (
    <>
      <button
        ref={prependRef}
        type="button"
        className="color-prepend slot-prepend arc-color-format-prepend"
        aria-label={`Формат цвета: ${COLOR_FORMAT_LABELS[format]}`}
        aria-haspopup="menu"
        aria-expanded={formatMenuOpen}
        onClick={openFormatMenu}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {COLOR_FORMAT_LABELS[format]}
      </button>
      <div
        className={
          format === 'hex' || format === 'pantone'
            ? 'arc-color-format-channels arc-color-format-channels--hex'
            : `arc-color-format-channels${compact ? ' arc-color-format-channels--compact' : ''}`
        }
      >
        {renderSlots()}
      </div>
      {showSwatch ? (
        <span className="color-swatch-inline slot-trailing" style={swatchStyle} aria-hidden="true" />
      ) : null}
    </>
  );

  return (
    <>
      {embedded ? (
        fieldsBody
      ) : (
        <div
          className={`input color-input input-slots arc-color-format-input${className ? ` ${className}` : ''}`}
          data-input-size={inputSize}
          aria-label={ariaLabel}
        >
          {fieldsBody}
        </div>
      )}

      <ContextMenu
        open={formatMenuOpen}
        anchorRef={prependRef}
        onClose={() => setFormatMenuOpen(false)}
        ariaLabel="Формат цвета"
        rows={formatRows}
        noDragClassName="arc-navbar-no-drag"
        menuWidth={CONTEXT_MENU_COLOR_FORMAT_WIDTH}
        anchorAlign="start"
        anchorPlacement="belowAnchor"
        panelClassName="context-menu--color-format"
      />
    </>
  );
}
