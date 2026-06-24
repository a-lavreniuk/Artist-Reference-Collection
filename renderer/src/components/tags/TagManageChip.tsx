import { Fragment } from 'react';
import type { TagRecord } from '../../services/db';
import { Tooltip } from '../tooltip/Tooltip';
import { TagTooltipBody } from '../tooltip/TagTooltipBody';

type Props = {
  tag: TagRecord;
  categoryColorHex: string;
  draggingTagId: string | null;
  dragDisabled?: boolean;
  onEdit: (tag: TagRecord) => void;
  onContextMenu?: (tag: TagRecord, event: React.MouseEvent<HTMLButtonElement>) => void;
  onDragStart: (tagId: string) => void;
  onDragEnd: () => void;
};

export default function TagManageChip({
  tag,
  categoryColorHex,
  draggingTagId,
  dragDisabled = false,
  onEdit,
  onContextMenu,
  onDragStart,
  onDragEnd
}: Props) {
  const hasTipText = Boolean(tag.description?.trim());
  const hasTipImage = Boolean(tag.tooltipImageDataUrl?.startsWith('data:image/'));
  const canShowTooltip = hasTipText || hasTipImage;
  const useCustomTooltip = canShowTooltip && draggingTagId !== tag.id;

  const hintParts = [tag.description?.trim()].filter(Boolean) as string[];
  if (tag.tooltipImageDataUrl) {
    hintParts.push('Есть изображение для подсказки');
  }
  const titleHint = hintParts.length ? hintParts.join(' — ') : 'Открыть настройки метки';

  const chip = (
    <button
      type="button"
      className={`chip${draggingTagId === tag.id ? ' arc-tag-chip--dragging' : ''}`}
      draggable={!dragDisabled}
      aria-label={`Редактировать метку «${tag.name}»`}
      aria-grabbed={draggingTagId === tag.id}
      onClick={() => onEdit(tag)}
      onContextMenu={(event) => {
        if (dragDisabled || draggingTagId === tag.id) return;
        onContextMenu?.(tag, event);
      }}
      onDragStart={(e) => {
        if (dragDisabled) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('application/tag-id', tag.id);
        e.dataTransfer.setData('text/plain', tag.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(tag.id);
      }}
      onDragEnd={() => onDragEnd()}
    >
      <span className="chip-color" style={{ background: categoryColorHex }} aria-hidden="true" />
      <span>{tag.name}</span>
      <span className="chip-count">{tag.usageCount}</span>
    </button>
  );

  return (
    <Fragment>
      {useCustomTooltip ? (
        <Tooltip
          content={<TagTooltipBody description={tag.description} imageDataUrl={tag.tooltipImageDataUrl} />}
          delay={1000}
          position="top"
          variant="rich"
        >
          {chip}
        </Tooltip>
      ) : !canShowTooltip ? (
        <Tooltip content={titleHint} delay={500} position="top">
          {chip}
        </Tooltip>
      ) : (
        chip
      )}
    </Fragment>
  );
}
