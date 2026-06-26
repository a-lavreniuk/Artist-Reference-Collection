export type IslandRect = {
  top: number;
  bottom: number;
  left: number;
  width: number;
};

export type PanelLayout = {
  top: number;
  left: number;
  width: number;
};

export function computePanelLayout(islandRect: IslandRect, gapBelowInput: number): PanelLayout {
  return {
    top: islandRect.bottom + gapBelowInput,
    left: islandRect.left,
    width: islandRect.width
  };
}
