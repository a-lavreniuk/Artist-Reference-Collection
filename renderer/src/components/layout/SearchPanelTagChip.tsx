import type { CategoryRecord, TagRecord } from '../../services/db';
import { formatNavbarTabCount } from '../../search/formatNavbarTabCount';
import { splitTagNameForHighlight } from '../../search/rankSearchTags';
import { Tooltip } from '../tooltip/Tooltip';
import { TagTooltipBody } from '../tooltip/TagTooltipBody';

type Props = {
  tag: TagRecord;
  category: CategoryRecord;
  selected: boolean;
  onToggle: () => void;
  showCount?: boolean;
  /** Подсветка совпадения в имени при вводе запроса (Search Menu, Figma 890-9941). */
  highlightQuery?: string;
  /**
   * Режим «Недавних»: клик по ✕ убирает метку только из localStorage.
   * Клик по остальной области чипа — onToggle (как у категорий).
   */
  onRemoveFromRecent?: () => void;
};

/**
 * Чип метки в панели поиска (ui-kit): при выборе — chip-remove;
 * в режиме недавних ✕ обрабатывается отдельно от переключения фильтра.
 */
export default function SearchPanelTagChip({
  tag,
  category,
  selected,
  onToggle,
  showCount = true,
  highlightQuery,
  onRemoveFromRecent
}: Props) {
  const hasTipText = Boolean(tag.description?.trim());
  const hasTipImage = Boolean(tag.tooltipImageDataUrl?.startsWith('data:image/'));
  const canShowRichTooltip = hasTipText || hasTipImage;

  const count = tag.usageCount ?? 0;
  const countLabel = count > 0 ? formatNavbarTabCount(count) : null;

  const handleChipClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (
      onRemoveFromRecent &&
      selected &&
      (e.target as HTMLElement).closest('.chip-remove')
    ) {
      e.preventDefault();
      onRemoveFromRecent();
      return;
    }
    onToggle();
  };

  const nameLabel =
    highlightQuery && highlightQuery.trim().length > 0 ? (
      <span className="arc-search-tag-pill__name">
        {splitTagNameForHighlight(tag.name, highlightQuery).map((seg, i) => (
          <span
            key={i}
            className={
              seg.match ? 'arc-search-tag-pill__name-match' : 'arc-search-tag-pill__name-rest'
            }
          >
            {seg.text}
          </span>
        ))}
      </span>
    ) : (
      <span>{tag.name}</span>
    );

  const chip = (
    <button
      type="button"
      className={`chip arc-search-tag-pill${selected ? ' chip-active' : ''}`}
      aria-label={
        onRemoveFromRecent
          ? `Метка «${tag.name}». Снять фильтр — клик по чипу; убрать из недавних — по ✕`
          : selected
            ? `Снять метку «${tag.name}»`
            : `Выбрать метку «${tag.name}»`
      }
      aria-pressed={selected}
      onClick={handleChipClick}
    >
      <span className="chip-color" style={{ background: category.colorHex }} aria-hidden="true" />
      {nameLabel}
      {showCount && countLabel ? <span className="chip-count">{countLabel}</span> : null}
      {selected ? (
        <span className="chip-remove" aria-hidden="true">
          ✕
        </span>
      ) : null}
    </button>
  );

  if (canShowRichTooltip) {
    return (
      <Tooltip
        content={<TagTooltipBody description={tag.description} imageDataUrl={tag.tooltipImageDataUrl} />}
        delay={1000}
        position="top"
        variant="rich"
      >
        {chip}
      </Tooltip>
    );
  }

  return chip;
}
