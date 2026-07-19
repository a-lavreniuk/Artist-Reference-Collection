import { describe, expect, it } from 'vitest';
import { UNIFORM_GRID_ASPECT_RATIO, uniformGridCellHeight } from '../uniformGridLayout';
import {
  GALLERY_LIST_HEADER_GAP_PX,
  GALLERY_LIST_HEADER_HEIGHT_PX,
  GALLERY_LIST_ROW_GAP_PX,
  GALLERY_LIST_ROW_HEIGHT_PX,
  GALLERY_LIST_ROW_STRIDE_PX,
  GALLERY_LIST_THUMB_SIZE_PX
} from '../galleryListConstants';

describe('uniformGridLayout', () => {
  it('uses landscape 4:3 cells', () => {
    expect(UNIFORM_GRID_ASPECT_RATIO).toBeCloseTo(4 / 3);
    expect(uniformGridCellHeight(400)).toBeCloseTo(300);
    expect(uniformGridCellHeight(0)).toBe(0);
  });
});

describe('galleryListConstants', () => {
  it('uses 64px thumbs, row gap like AI stack, and taller rows', () => {
    expect(GALLERY_LIST_THUMB_SIZE_PX).toBe(64);
    expect(GALLERY_LIST_ROW_HEIGHT_PX).toBeGreaterThanOrEqual(GALLERY_LIST_THUMB_SIZE_PX);
    expect(GALLERY_LIST_ROW_GAP_PX).toBe(8);
    expect(GALLERY_LIST_HEADER_GAP_PX).toBe(8);
    expect(GALLERY_LIST_ROW_STRIDE_PX).toBe(GALLERY_LIST_ROW_HEIGHT_PX + GALLERY_LIST_ROW_GAP_PX);
    expect(GALLERY_LIST_HEADER_HEIGHT_PX).toBe(32);
  });
});
