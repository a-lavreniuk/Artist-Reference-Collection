import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import SettingsRadioRow from '../settings/SettingsRadioRow';
import { storageCountCardsWithTagIds } from '../../services/storageClient';
import type { CategoryRecord, TagMergeMetadata, TagRecord } from '../../services/db';

type Props = {
  tags: TagRecord[];
  categories: CategoryRecord[];
  onClose: () => void;
  onConfirm: (targetTagId: string, sourceTagIds: string[], metadata: TagMergeMetadata) => Promise<void>;
};

function pluralTagsRu(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'меток';
  if (mod10 === 1) return 'метка';
  if (mod10 >= 2 && mod10 <= 4) return 'метки';
  return 'меток';
}

function pluralCardsRu(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'карточек';
  if (mod10 === 1) return 'карточку';
  if (mod10 >= 2 && mod10 <= 4) return 'карточки';
  return 'карточек';
}

/**
 * Подтверждение слияния меток: выбор целевой, предпросмотр последствий и выбор
 * итоговых имени, описания и картинки подсказки.
 */
export default function TagMergeConfirmModal({ tags, categories, onClose, onConfirm }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [targetTagId, setTargetTagId] = useState(() => tags[0]?.id ?? '');
  const [nameFromTagId, setNameFromTagId] = useState(() => tags[0]?.id ?? '');
  const [descriptionFromTagId, setDescriptionFromTagId] = useState<string | null>(null);
  const [imageFromTagId, setImageFromTagId] = useState<string | null>(null);
  const [affectedCards, setAffectedCards] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = tags.find((t) => t.id === targetTagId) ?? tags[0];
  const sources = useMemo(
    () => tags.filter((t) => t.id !== target?.id),
    [tags, target?.id]
  );

  const descriptionCandidates = useMemo(
    () => tags.filter((t) => Boolean(t.description?.trim())),
    [tags]
  );
  const imageCandidates = useMemo(
    () => tags.filter((t) => t.tooltipImageDataUrl?.startsWith('data:image/')),
    [tags]
  );

  // Значения по умолчанию берутся у целевой метки и сбрасываются при её смене.
  useEffect(() => {
    if (!target) return;
    setNameFromTagId(target.id);
    setDescriptionFromTagId(
      descriptionCandidates.some((t) => t.id === target.id) ? target.id : null
    );
    setImageFromTagId(imageCandidates.some((t) => t.id === target.id) ? target.id : null);
  }, [target?.id, descriptionCandidates, imageCandidates]);

  useEffect(() => {
    let cancelled = false;
    const sourceIds = sources.map((t) => t.id);
    if (sourceIds.length === 0) {
      setAffectedCards(0);
      return undefined;
    }
    void storageCountCardsWithTagIds(sourceIds).then((count) => {
      if (!cancelled) setAffectedCards(count);
    });
    return () => {
      cancelled = true;
    };
  }, [sources]);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [targetTagId, busy, affectedCards]);

  const targetCategory = categories.find((c) => c.id === target?.categoryId);
  const chosenImage = imageCandidates.find((t) => t.id === imageFromTagId)?.tooltipImageDataUrl;

  const handleConfirm = async () => {
    if (busy || !target || sources.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(
        target.id,
        sources.map((t) => t.id),
        {
          name: tags.find((t) => t.id === nameFromTagId)?.name ?? target.name,
          description: descriptionCandidates.find((t) => t.id === descriptionFromTagId)?.description,
          tooltipImageDataUrl: chosenImage
        }
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось объединить метки');
      setBusy(false);
    }
  };

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="tag-merge-confirm-modal"
          className="arc-modal arc-ui-kit-scope"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcTagMergeTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcTagMergeTitle">
              Объединить метки
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>

          <div className="arc-modal__body arc-tag-merge">
            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">Целевая метка</p>
              <div className="context-menu context-menu--static">
                <div className="context-menu__list" role="radiogroup" aria-label="Целевая метка">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      role="radio"
                      aria-checked={tag.id === target?.id}
                      className={`context-menu__item${tag.id === target?.id ? ' is-active' : ''}`}
                      disabled={busy}
                      onClick={() => setTargetTagId(tag.id)}
                    >
                      <span className="context-menu__item-inner">
                        <span
                          className="chip-color"
                          style={{
                            background:
                              categories.find((c) => c.id === tag.categoryId)?.colorHex ?? 'transparent'
                          }}
                          aria-hidden="true"
                        />
                        <span className="context-menu__item-label-cluster">
                          <span className="context-menu__item-label">{tag.name}</span>
                        </span>
                        <span className="context-menu__item-counter">{tag.usageCount}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">
                {sources.length} {pluralTagsRu(sources.length)} исчезнут из каталога:{' '}
                {sources.map((t) => t.name).join(', ')}
              </p>
              <p className="text-s arc-tag-merge__hint">
                Категория результата: {targetCategory?.name ?? '—'}
              </p>
              <p className="text-s arc-tag-merge__hint">
                {affectedCards === null
                  ? 'Считаем затронутые карточки…'
                  : `Затронет ${affectedCards} ${pluralCardsRu(affectedCards)}`}
              </p>
            </div>

            <div className="arc-modal__slot">
              <p className="arc-modal__slot-text">Имя итоговой метки</p>
              {tags.map((tag) => (
                <SettingsRadioRow
                  key={tag.id}
                  label={tag.name}
                  labelSize="s"
                  checked={nameFromTagId === tag.id}
                  disabled={busy}
                  onCheckedChange={() => setNameFromTagId(tag.id)}
                />
              ))}
            </div>

            {descriptionCandidates.length > 0 ? (
              <div className="arc-modal__slot">
                <p className="arc-modal__slot-text">Описание</p>
                {descriptionCandidates.map((tag) => (
                  <SettingsRadioRow
                    key={tag.id}
                    label={`Из метки «${tag.name}»`}
                    labelSize="s"
                    checked={descriptionFromTagId === tag.id}
                    disabled={busy}
                    onCheckedChange={() => setDescriptionFromTagId(tag.id)}
                  />
                ))}
                <SettingsRadioRow
                  label="Без описания"
                  labelSize="s"
                  checked={descriptionFromTagId === null}
                  disabled={busy}
                  onCheckedChange={() => setDescriptionFromTagId(null)}
                />
              </div>
            ) : null}

            {imageCandidates.length > 0 ? (
              <div className="arc-modal__slot">
                <p className="arc-modal__slot-text">Изображение подсказки</p>
                {imageCandidates.map((tag) => (
                  <SettingsRadioRow
                    key={tag.id}
                    label={`Из метки «${tag.name}»`}
                    labelSize="s"
                    checked={imageFromTagId === tag.id}
                    disabled={busy}
                    onCheckedChange={() => setImageFromTagId(tag.id)}
                  />
                ))}
                <SettingsRadioRow
                  label="Без изображения"
                  labelSize="s"
                  checked={imageFromTagId === null}
                  disabled={busy}
                  onCheckedChange={() => setImageFromTagId(null)}
                />
                {chosenImage ? (
                  <img className="arc-tag-merge__preview" src={chosenImage} alt="" />
                ) : null}
              </div>
            ) : null}

            {error ? (
              <div className="arc-modal__slot">
                <p className="text-s arc-tag-merge__error">{error}</p>
              </div>
            ) : null}
          </div>

          <footer className="arc-modal__footer arc-modal__footer--actions-2">
            <button type="button" className="btn btn-outline btn-ds btn-s" disabled={busy} onClick={requestClose}>
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button
              type="button"
              className="btn btn-brand btn-ds btn-s"
              disabled={busy || sources.length === 0}
              onClick={() => void handleConfirm()}
            >
              <span className="btn-ds__value">{busy ? 'Объединяем…' : 'Объединить'}</span>
            </button>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
