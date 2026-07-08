import { useRef } from 'react';
import type { TagRecord } from '../../services/db';
import { Tooltip } from '../tooltip/Tooltip';
import { TagTooltipBody } from '../tooltip/TagTooltipBody';

type Props = {
  tag: TagRecord;
  categoryColorHex: string;
  draggingTagIds: ReadonlySet<string> | null;
  selected?: boolean;
  dragDisabled?: boolean;
  onEdit: (tag: TagRecord) => void;
  onChipPointerDown?: (tag: TagRecord, event: React.PointerEvent<HTMLButtonElement>) => boolean;
  onContextMenu?: (tag: TagRecord, event: React.MouseEvent<HTMLButtonElement>) => void;
  onDragStart: (tagId: string, dataTransfer: DataTransfer) => void;
  onDragEnd: () => void;
};

export default function TagManageChip({
  tag,
  categoryColorHex,
  draggingTagIds,
  selected = false,
  dragDisabled = false,
  onEdit,
  onChipPointerDown,
  onContextMenu,
  onDragStart,
  onDragEnd
}: Props) {
  const isDragging = draggingTagIds?.has(tag.id) ?? false;
  const suppressClickRef = useRef(false);

  const hasTipText = Boolean(tag.description?.trim());
  const hasTipImage = Boolean(tag.tooltipImageDataUrl?.startsWith('data:image/'));
  const canShowTooltip = hasTipText || hasTipImage;

  const hintParts = [tag.description?.trim()].filter(Boolean) as string[];
  if (tag.tooltipImageDataUrl) {
    hintParts.push('Есть изображение для подсказки');
  }
  const titleHint = hintParts.length ? hintParts.join(' — ') : 'Открыть настройки метки';

  const chip = (
    <button
      type="button"
      className={`chip${isDragging ? ' arc-tag-chip--dragging' : ''}${selected ? ' arc-tag-chip--selected' : ''}`}
      draggable={!dragDisabled}
      aria-label={`Редактировать метку «${tag.name}»`}
      aria-grabbed={isDragging}
      aria-pressed={selected}
      onPointerDown={(event) => {
        onChipPointerDown?.(tag, event);
      }}
      onClick={(event) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onEdit(tag);
      }}
      onContextMenu={(event) => {
        if (dragDisabled || isDragging) return;
        onContextMenu?.(tag, event);
      }}
      onDragStart={(e) => {
        if (dragDisabled) {
          e.preventDefault();
          return;
        }
        suppressClickRef.current = true;
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(tag.id, e.dataTransfer);
      }}
      onDragEnd={() => {
        suppressClickRef.current = true;
        onDragEnd();
      }}
    >
      <span className="chip-color" style={{ background: categoryColorHex }} aria-hidden="true" />
      <span>{tag.name}</span>
      <span className="chip-count">{tag.usageCount}</span>
    </button>
  );

  // Обёртка Tooltip и сам узел кнопки остаются стабильными при перетаскивании:
  // на время drag прячем только содержимое подсказки (content=null), не пересоздавая DOM,
  // иначе браузер отменяет нативный drag.
  const tooltipContent = isDragging
    ? null
    : canShowTooltip
      ? <TagTooltipBody description={tag.description} imageDataUrl={tag.tooltipImageDataUrl} />
      : titleHint;

  return (
    <Tooltip
      content={tooltipContent}
      delay={canShowTooltip ? 1000 : 500}
      position="top"
      variant={canShowTooltip ? 'rich' : 'default'}
    >
      {chip}
    </Tooltip>
  );
}
