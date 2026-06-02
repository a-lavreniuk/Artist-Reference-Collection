import { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import arcUiKitMainHtml from './arcUiKitMain.html?raw';
import { mountArcUiKitDemo, refreshArcUiKitGlyphs } from './arcUiKitBoot';
import {
  applyUiKitScopeDataset,
  parseUiKitElevation,
  parseUiKitSize,
  UI_KIT_URL
} from './uiKitToolbarSearch';

export default function UiKitPage() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();

  /** Один и тот же объект — иначе при каждом ререндере React снова ставит innerHTML и стирает SVG из injectButtonIcons. */
  const uiKitMarkup = useMemo(() => ({ __html: arcUiKitMainHtml.trim() }), []);

  const elevation = parseUiKitElevation(searchParams.get(UI_KIT_URL.elevation));
  const size = parseUiKitSize(searchParams.get(UI_KIT_URL.size));

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const ac = new AbortController();
    mountArcUiKitDemo(scope, { signal: ac.signal });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    applyUiKitScopeDataset(scope, elevation, size);
    refreshArcUiKitGlyphs(scope)?.catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[arc-ui] hydrateInputGlyphs:', err);
      }
    });
  }, [elevation, size]);

  return (
    <div className="arc-tags-outlet arc-ui-kit-route">
      <div
        ref={scopeRef}
        className="arc-ui-kit-scope"
        data-typo-role="primary"
        data-typo-tone="white"
        data-typo-state="default"
        data-elevation={elevation}
        data-btn-size={size}
        data-input-size={size}
        dangerouslySetInnerHTML={uiKitMarkup}
      />
    </div>
  );
}
