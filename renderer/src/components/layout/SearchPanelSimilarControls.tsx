import { useCallback, useState } from 'react';
import { isImportableMediaPath } from '../../media/allowedImportExtensions';
import { extractDroppedFilePaths } from '../../media/droppedFilePaths';
import {
  FULL_SIMILAR_CROP,
  setSimilarUploadPath,
  type SimilarCropRect
} from '../../search/similarSearchSession';
import SearchPanelFullBleedSep from './SearchPanelFullBleedSep';
import SearchPanelRecentCards from './SearchPanelRecentCards';
import SimilarImageCropper from './SimilarImageCropper';

type SearchPanelSimilarControlsProps = {
  crop: SimilarCropRect;
  hasQuery: boolean;
  previewSrc: string | null;
  onCropChange: (crop: SimilarCropRect) => void;
  onUploadStaged: (stagedPath: string) => void;
  onClearQuery: () => void;
  onConfirmSearch: () => void;
  onRecentClear: () => void;
  recentViewedIds: string[];
  onSelectRecentCard: (cardId: string) => void;
};

function mediaAbsUrl(absPath: string): string {
  const origin = window.arc?.getMediaServerOrigin?.()?.replace(/\/$/, '') ?? 'arc-media://localhost';
  return `${origin}/?abs=${encodeURIComponent(absPath)}`;
}

async function stageDroppedPaths(paths: string[]): Promise<string | null> {
  const imagePath = paths.find((p) => isImportableMediaPath(p) && /\.(png|jpe?g|webp|gif|bmp)$/i.test(p));
  if (!imagePath || !window.arc?.aiSimilarStageFile) return null;
  const result = await window.arc.aiSimilarStageFile(imagePath);
  if (!result || result.ok !== true) return null;
  return result.stagedPath;
}

/** Dropzone / cropper для поиска по совпадениям (Figma 892-11454, 892-12002). */
export default function SearchPanelSimilarControls({
  crop,
  hasQuery,
  previewSrc,
  onCropChange,
  onUploadStaged,
  onClearQuery,
  onConfirmSearch,
  onRecentClear,
  recentViewedIds,
  onSelectRecentCard
}: SearchPanelSimilarControlsProps) {
  const [dragOver, setDragOver] = useState(false);

  const pickImage = useCallback(async () => {
    if (!window.arc?.pickImageFiles) return;
    const paths = await window.arc.pickImageFiles();
    if (!paths.length) return;
    const staged = await stageDroppedPaths(paths);
    if (!staged) return;
    setSimilarUploadPath(staged);
    onUploadStaged(staged);
    onCropChange(FULL_SIMILAR_CROP);
  }, [onCropChange, onUploadStaged]);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const paths = extractDroppedFilePaths(e.dataTransfer);
      const staged = await stageDroppedPaths(paths);
      if (!staged) return;
      setSimilarUploadPath(staged);
      onUploadStaged(staged);
      onCropChange(FULL_SIMILAR_CROP);
    },
    [onCropChange, onUploadStaged]
  );

  const showRecent = recentViewedIds.length > 0;

  return (
    <div className="arc-search-panel-similar">
      <div className="arc-search-panel-similar-header">
        <h3 className="h3 arc-search-panel-mode-header__title">Поиск по совпадениям</h3>
        {hasQuery ? (
          <div className="arc-search-panel-similar-actions" data-btn-size="s">
            <button type="button" className="btn btn-outline btn-ds" onClick={onClearQuery}>
              <span className="btn-ds__value">Очистить</span>
            </button>
            <button type="button" className="btn btn-brand btn-ds" onClick={onConfirmSearch}>
              <span className="btn-ds__value">Искать</span>
              <span className="btn-ds__icon arc-icon-search" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <SearchPanelFullBleedSep />

      {!hasQuery ? (
        <div
          className={`arc-search-panel-similar-dropzone panel elevation-sunken${dragOver ? ' arc-search-panel-similar-dropzone--dropping' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => void onDrop(e)}
        >
          <p className="typo-p-l arc-search-panel-similar-dropzone__hint">
            Перетащите изображение в поле поиска или нажмите на кнопку, чтобы загрузить файл…
          </p>
          <button type="button" className="btn btn-brand btn-ds" data-btn-size="m" onClick={() => void pickImage()}>
            <span className="btn-ds__value">Выбрать изображение</span>
          </button>
        </div>
      ) : previewSrc ? (
        <SimilarImageCropper imageSrc={previewSrc} crop={crop} onChange={onCropChange} />
      ) : null}

      {showRecent ? <SearchPanelFullBleedSep /> : null}

      {showRecent ? (
        <div className="arc-search-panel-section">
          <div className="arc-search-panel-section__head">
            <span className="text-l">Недавние просмотры</span>
            <button type="button" className="text-s arc-search-panel-section__clear" onClick={onRecentClear}>
              Очистить
            </button>
          </div>
          <SearchPanelRecentCards
            cardIds={recentViewedIds}
            onSelect={(id) => {
              onSelectRecentCard(id);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
