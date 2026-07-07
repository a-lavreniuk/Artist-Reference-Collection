import { useCallback, useEffect, useRef, useState } from 'react';
import { isImportableMediaPath } from '../../media/allowedImportExtensions';
import { extractDroppedFilePaths } from '../../media/droppedFilePaths';
import {
  FULL_SIMILAR_CROP,
  setSimilarUploadPath,
  type SimilarCropRect
} from '../../search/similarSearchSession';
import { SEARCH_MODE_META } from '../../search/navbarSearchMode';
import { Loader } from '../loader';
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
  const showSimilarWorkspace = hasQuery || Boolean(previewSrc);
  const showSimilarWorkspaceRef = useRef(showSimilarWorkspace);
  showSimilarWorkspaceRef.current = showSimilarWorkspace;

  const applyStagedUpload = useCallback(
    async (paths: string[]) => {
      const staged = await stageDroppedPaths(paths);
      if (!staged) return;
      setSimilarUploadPath(staged);
      onUploadStaged(staged);
      onCropChange(FULL_SIMILAR_CROP);
    },
    [onCropChange, onUploadStaged]
  );

  useEffect(() => {
    if (!window.arc?.onFileDrop) return undefined;
    return window.arc.onFileDrop((paths) => {
      if (!document.body.classList.contains('arc-similar-search-panel-open')) return;
      if (showSimilarWorkspaceRef.current) return;
      void applyStagedUpload(paths);
    });
  }, [applyStagedUpload]);

  const pickImage = useCallback(async () => {
    if (!window.arc?.pickImageFiles) return;
    const paths = await window.arc.pickImageFiles();
    if (!paths.length) return;
    await applyStagedUpload(paths);
  }, [applyStagedUpload]);

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      await applyStagedUpload(extractDroppedFilePaths(e.dataTransfer));
    },
    [applyStagedUpload]
  );

  const showRecent = recentViewedIds.length > 0;

  return (
    <div className="arc-search-panel-similar">
      <div className="arc-search-panel-intro">
        <div className="arc-search-panel-similar-header">
          <SearchPanelModeHeader mode="similar" />
          <div className="arc-search-panel-similar-actions arc-ui-kit-scope" data-btn-size="s">
            <button
              type="button"
              className={`btn btn-outline btn-ds arc-search-panel-similar-clear${showSimilarWorkspace ? '' : ' arc-search-panel-similar-clear--reserved'}`}
              onClick={onClearQuery}
              tabIndex={showSimilarWorkspace ? 0 : -1}
              aria-hidden={!showSimilarWorkspace}
              disabled={!showSimilarWorkspace}
            >
              <span className="btn-ds__value">Очистить</span>
            </button>
          </div>
        </div>
        <p className="text-m arc-search-panel-hint">{SEARCH_MODE_META.similar.panelHint}</p>
      </div>

      <SearchPanelFullBleedSep />

      <div className="arc-search-panel-similar-workspace">
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
              onDragLeave={(e) => {
                const next = e.relatedTarget;
                if (next instanceof Node && e.currentTarget.contains(next)) return;
                setDragOver(false);
              }}
              onDrop={(e) => void onDrop(e)}
            >
              <p className="text-l arc-search-panel-similar-dropzone__hint">
                Перетащите изображение в поле поиска или нажмите на кнопку, чтобы загрузить файл…
              </p>
              <div className="arc-import-dropzone-cta-wrap arc-ui-kit-scope" data-btn-size="m">
                <button
                  type="button"
                  className={`btn btn-ds arc-import-dropzone-cta${dragOver ? ' btn-brand' : ' btn-primary'}`}
                  onClick={() => void pickImage()}
                >
                  <span className="btn-ds__value">Выбрать изображение</span>
                </button>
              </div>
            </div>
          </div>
        ) : previewSrc ? (
          <SimilarImageCropper imageSrc={previewSrc} crop={crop} onChange={onCropChange} />
        ) : (
          <div className="arc-search-panel-similar-loading">
            <Loader size="m" label="Загрузка изображения" />
          </div>
        )}
      </div>

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
