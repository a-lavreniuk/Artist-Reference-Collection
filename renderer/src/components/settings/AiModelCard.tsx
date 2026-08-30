import { memo, useMemo, useRef, useState, type ReactNode } from 'react';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { InfoSplitCard } from '../info-card';
import ArcRadio from '../ui/ArcRadio';

export type AiModelCardProgress = {
  title: string;
  percent: number;
  /** «512 Кб/с» — только пока идёт скачивание файлов. */
  speedLabel?: string | null;
};

export type AiModelCardChip = {
  label: string;
  count?: string | number;
};

type Props = {
  title: string;
  description: string;
  chips: AiModelCardChip[];
  /** Установлена и доступна для выбора. */
  selectable?: boolean;
  selected?: boolean;
  recommended?: boolean;
  unavailableReason?: string | null;
  disabled?: boolean;
  progress?: AiModelCardProgress | null;
  onSelect?: () => void;
  onInstall?: () => void;
  onPauseDownload?: () => void;
  onResumeDownload?: () => void;
  onCancelDownload?: () => void;
  downloadPaused?: boolean;
  canPauseDownload?: boolean;
  optionsRows?: ContextMenuRow[];
  /** Радио выбора активной модели. Для единственной карточки автотегов — false. */
  showRadio?: boolean;
  /** Кастомные действия вместо Установить / Опции (редко). */
  actions?: ReactNode;
};

export function buildAiModelCardOptionsRows(args: {
  isTesting: boolean;
  disabled: boolean;
  updateAvailable: boolean;
  onTest: () => void;
  onReload: () => void;
  onDelete: () => void;
}): ContextMenuRow[] {
  if (args.isTesting) {
    return [
      {
        type: 'item',
        key: 'testing',
        label: 'Идёт проверка…',
        disabled: true,
        loading: true
      }
    ];
  }
  return [
    {
      type: 'item',
      key: 'test',
      label: 'Проверить',
      disabled: args.disabled,
      closeOnSelect: false,
      onSelect: args.onTest
    },
    {
      type: 'item',
      key: 'reload',
      label: args.updateAvailable ? 'Обновить' : 'Перезагрузить',
      disabled: args.disabled,
      onSelect: args.onReload
    },
    {
      type: 'item',
      key: 'delete',
      label: 'Удалить',
      disabled: args.disabled,
      onSelect: args.onDelete
    }
  ];
}

/** Карточка модели поиска: InfoSplitCard + состояния макета. */
function AiModelCard({
  title,
  description,
  chips,
  selectable = false,
  selected = false,
  recommended = false,
  unavailableReason = null,
  disabled = false,
  progress = null,
  onSelect,
  onInstall,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  downloadPaused = false,
  canPauseDownload = true,
  optionsRows,
  showRadio = true,
  actions
}: Props) {
  const optionsAnchorRef = useRef<HTMLButtonElement>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const unavailable = Boolean(unavailableReason);
  const downloading = Boolean(progress);

  const badge = useMemo(() => {
    if (unavailable) {
      return (
        <span className="arc-info-card__badge arc-ui-kit-scope" data-btn-size="s">
          <span className="btn btn-danger btn-ds" aria-hidden="true">
            <span className="btn-ds__value">Недоступно. {unavailableReason}</span>
          </span>
        </span>
      );
    }
    if (recommended && !downloading) {
      return (
        <span className="arc-info-card__badge arc-ui-kit-scope" data-btn-size="s">
          <span className="btn btn-success btn-ds" aria-hidden="true">
            <span className="btn-ds__value">Рекомендуется</span>
          </span>
        </span>
      );
    }
    return null;
  }, [downloading, recommended, unavailable, unavailableReason]);

  const footerActions = useMemo(() => {
    if (actions) return actions;
    if (downloading) {
      return (
        <div className="btn-group btn-group-ds">
          {canPauseDownload ? (
            <button
              type="button"
              className="btn btn-outline btn-ds"
              onClick={(event) => {
                event.stopPropagation();
                if (downloadPaused) onResumeDownload?.();
                else onPauseDownload?.();
              }}
            >
              <span className="btn-ds__value">{downloadPaused ? 'Продолжить' : 'Остановить'}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline btn-ds"
            onClick={(event) => {
              event.stopPropagation();
              onCancelDownload?.();
            }}
          >
            <span className="btn-ds__value">Отменить</span>
          </button>
        </div>
      );
    }
    if (selectable) {
      return (
        <>
          <button
            ref={optionsAnchorRef}
            type="button"
            className="btn btn-outline btn-ds"
            aria-expanded={optionsOpen}
            aria-haspopup="menu"
            onClick={(event) => {
              event.stopPropagation();
              setOptionsOpen((v) => !v);
            }}
          >
            <span className="btn-ds__value">Опции</span>
          </button>
          {optionsRows ? (
            <ContextMenu
              open={optionsOpen}
              anchorRef={optionsAnchorRef}
              onClose={() => setOptionsOpen(false)}
              rows={optionsRows}
              ariaLabel={`Опции: ${title}`}
              anchorAlign="end"
            />
          ) : null}
        </>
      );
    }
    return (
      <button
        type="button"
        className="btn btn-outline btn-ds"
        disabled={disabled || unavailable}
        onClick={(event) => {
          event.stopPropagation();
          onInstall?.();
        }}
      >
        <span className="btn-ds__value">Установить</span>
      </button>
    );
  }, [
    actions,
    canPauseDownload,
    disabled,
    downloadPaused,
    downloading,
    onCancelDownload,
    onInstall,
    onPauseDownload,
    onResumeDownload,
    optionsOpen,
    optionsRows,
    selectable,
    title,
    unavailable
  ]);

  return (
    <InfoSplitCard
      interactive={selectable && showRadio && !downloading && !unavailable}
      disabled={disabled && !downloading}
      title={title}
      description={description}
      badge={badge}
      headerAside={selectable && showRadio && !downloading ? <ArcRadio checked={selected} /> : null}
      mid={
        progress ? (
          <div className="arc-settings-ai-status-head" aria-live="polite">
            <div className="arc-settings-ai-status-head__status">
              <p className="text-m arc-settings-ai-status-head__title">{progress.title}</p>
              <span className="text-m arc-settings-ai-status-head__percent" data-typo-role="secondary">
                {progress.percent}%
              </span>
            </div>
            {progress.speedLabel ? (
              <div className="arc-settings-ai-status-head__status">
                <p className="text-m arc-settings-ai-status-head__title">Скорость</p>
                <span className="text-m arc-settings-ai-status-head__percent" data-typo-role="secondary">
                  {progress.speedLabel}
                </span>
              </div>
            ) : null}
          </div>
        ) : null
      }
      chips={
        <>
          {chips.map((chip) => (
            <span key={chip.label} className="chip">
              {chip.label}
              {chip.count != null ? <span className="chip-count">{chip.count}</span> : null}
            </span>
          ))}
        </>
      }
      actions={footerActions}
      onClick={() => {
        if (selectable && !downloading && !unavailable) onSelect?.();
      }}
    />
  );
}

export default memo(AiModelCard);
