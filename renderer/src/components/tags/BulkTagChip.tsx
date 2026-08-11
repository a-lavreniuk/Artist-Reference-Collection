import type { BulkTagState } from '../gallery/galleryBulkActions';
import type { TagRecord } from '../../services/db';
import { Tooltip } from '../tooltip/Tooltip';
import { TagTooltipBody } from '../tooltip/TagTooltipBody';

type Props = {
  tag: TagRecord;
  categoryColorHex: string;
  state: BulkTagState;
  disabled?: boolean;
  onToggle: (nextSelected: boolean) => void;
};

function ariaLabelFor(tag: TagRecord, state: BulkTagState): string {
  if (state === 'all') return `Снять метку «${tag.name}» со всех выбранных карточек`;
  if (state === 'some') return `Добавить метку «${tag.name}» всем выбранным карточкам`;
  return `Добавить метку «${tag.name}» выбранным карточкам`;
}

/**
 * Чип метки для массового изменения: «ни у кого» / «у части» / «у всех».
 * Клик из «части» добивает метку до всех, повторный — снимает у всех.
 */
export default function BulkTagChip({
  tag,
  categoryColorHex,
  state,
  disabled,
  onToggle
}: Props) {
  const hasTipText = Boolean(tag.description?.trim());
  const hasTipImage = Boolean(tag.tooltipImageDataUrl?.startsWith('data:image/'));
  const canShowTooltip = hasTipText || hasTipImage;

  const chip = (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false'}
      aria-label={ariaLabelFor(tag, state)}
      className={`chip arc-bulk-tag-chip${state === 'all' ? ' chip-active' : ''}`}
      disabled={disabled}
      onClick={() => onToggle(state !== 'all')}
    >
      <span className="chip-color" style={{ background: categoryColorHex }} aria-hidden="true" />
      <span>{tag.name}</span>
      {state === 'none' ? null : (
        <span
          className={`arc-bulk-tag-chip__state ${state === 'all' ? 'arc-icon-check' : 'arc-icon-minus'}`}
          aria-hidden="true"
        />
      )}
      <span className="chip-count">{tag.usageCount}</span>
    </button>
  );

  if (!canShowTooltip) {
    return chip;
  }

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
