import { useCallback, useState } from 'react';
import { isImportableMediaPath } from '../../media/allowedImportExtensions';
import { extractDroppedFilePaths } from '../../media/droppedFilePaths';
import {
  FULL_SIMILAR_CROP,
  setSimilarUploadPath,
  type SimilarCropRect
} from '../../search/similarSearchSession';
import { SEARCH_MODE_META } from '../../search/navbarSearchMode';
import SearchPanelFullBleedSep from './SearchPanelFullBleedSep';
import SearchPanelModeHeader from './SearchPanelModeHeader';
import SearchPanelRecentCards from './SearchPanelRecentCards';
import SearchPanelSection from './SearchPanelSection';
import SimilarImageCropper from './SimilarImageCropper';

type SearchPanelSimilarControlsProps = {
  crop: SimilarCropRect;
  hasQuery: boolean;
  previewSrc: string | null;
  onCropChange: (crop: SimilarCropRect) => void;
  onUploadStaged: (stagedPath: string) => void;
  onClearQuery: () => void;
  onRecentClear: () => void;
  recentViewedIds: string[];
  onSelectRecentCard: (cardId: string) => void;
};

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
  const showSimilarWorkspace = hasQuery || Boolean(previewSrc);

  return (
    <div className="arc-search-panel-similar">
      <div className="arc-search-panel-similar-intro">
        <div className="arc-search-panel-similar-header">
          <SearchPanelModeHeader mode="similar" />
          {showSimilarWorkspace ? (
            <button type="button" className="btn btn-outline btn-ds" data-btn-size="s" onClick={onClearQuery}>
              <span className="btn-ds__value">Очистить</span>
            </button>
          ) : null}
        </div>
        <p className="arc-search-panel-hint">{SEARCH_MODE_META.similar.panelHint}</p>
      </div>

      <SearchPanelFullBleedSep />

      {!showSimilarWorkspace ? (
        <div className="arc-search-panel-similar-dropzone-host">
          <div
            className={`arc-import-dropzone arc-search-panel-similar-dropzone${dragOver ? ' arc-import-dropzone--dropping' : ''}`}
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
            <div className="arc-import-dropzone-cta-wrap">
              <button
                type="button"
                className="btn btn-brand btn-ds arc-import-dropzone-cta"
                data-btn-size="m"
                onClick={() => void pickImage()}
              >
                <span className="btn-ds__value">Выбрать изображение</span>
                <span className="btn-ds__icon arc-import-dropzone-plus-icon" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : previewSrc ? (
        <SimilarImageCropper imageSrc={previewSrc} crop={crop} onChange={onCropChange} />
      ) : (
        <div className="arc-search-panel-similar-loading" role="status" aria-label="Загрузка изображения">
          <span className="loader" />
        </div>
      )}

      {showRecent ? <SearchPanelFullBleedSep /> : null}

      {showRecent ? (
        <SearchPanelSection title="Недавние просмотры" onClear={onRecentClear}>
          <SearchPanelRecentCards
            cardIds={recentViewedIds}
            onSelect={(id) => {
              onSelectRecentCard(id);
            }}
          />
        </SearchPanelSection>
      ) : null}
    </div>
  );
}
