import { describe, expect, it } from 'vitest';
import {
  HUD_CARD_H,
  HUD_CARD_W,
  HUD_FLIP_HYSTERESIS,
  HUD_H,
  HUD_ICON,
  HUD_W,
  eyedropperCardOffset,
  eyedropperHudPosition
} from '../hudLayout';

describe('eyedropperHudPosition', () => {
  it('anchors the HUD on the cursor tip and places the card bottom-right', () => {
    expect(eyedropperHudPosition(40, 40, 1920, 1080)).toEqual({
      left: 40,
      top: 40,
      corner: 'bottom-right',
      cardLeft: HUD_ICON,
      cardTop: 0
    });
  });

  it('flips the card to top-right when it would go past the bottom', () => {
    const y = 1080 - 20;
    const placed = eyedropperHudPosition(40, y, 1920, 1080);
    expect(placed.corner).toBe('top-right');
    expect(placed.left).toBe(40);
    expect(placed.top).toBe(y);
    expect(placed.cardLeft).toBe(HUD_ICON);
    expect(placed.cardTop).toBe(-HUD_H);
  });

  it('flips the card to bottom-left when it would go past the right', () => {
    const x = 1920 - 20;
    const placed = eyedropperHudPosition(x, 40, 1920, 1080);
    expect(placed.corner).toBe('bottom-left');
    expect(placed.left).toBe(x);
    expect(placed.top).toBe(40);
    expect(placed.cardLeft).toBe(-HUD_CARD_W);
    expect(placed.cardTop).toBe(0);
  });

  it('flips the card to top-left in the bottom-right corner', () => {
    const x = 1920 - 10;
    const y = 1080 - 10;
    const placed = eyedropperHudPosition(x, y, 1920, 1080);
    expect(placed.corner).toBe('top-left');
    expect(placed.cardLeft).toBe(-HUD_CARD_W);
    expect(placed.cardTop).toBe(-HUD_H);
  });

  it('keeps the card below-right of the tip when it still fits', () => {
    const placed = eyedropperHudPosition(80, 80, 1920, 1080);
    expect(placed.corner).toBe('bottom-right');
    expect(placed.left).toBe(80);
    expect(placed.top).toBe(80);
    expect(placed.cardLeft).toBe(HUD_ICON);
    expect(placed.top + HUD_CARD_H).toBe(80 + HUD_CARD_H);
  });

  it('still flips on a viewport smaller than the HUD', () => {
    const placed = eyedropperHudPosition(10, 10, 100, 80);
    expect(placed.corner).toBe('top-left');
    expect(placed.left).toBe(10);
    expect(placed.top).toBe(10);
    expect(HUD_W).toBeGreaterThan(100);
    expect(HUD_H).toBeGreaterThan(80);
  });

  it('keeps the flipped side until hysteresis clears', () => {
    const edgeX = 1920 - HUD_W + 4;
    const flipped = eyedropperHudPosition(edgeX, 40, 1920, 1080);
    expect(flipped.corner).toBe('bottom-left');
    const stay = eyedropperHudPosition(
      1920 - HUD_W - HUD_FLIP_HYSTERESIS + 1,
      40,
      1920,
      1080,
      'bottom-left'
    );
    expect(stay.corner).toBe('bottom-left');
    const release = eyedropperHudPosition(
      1920 - HUD_W - HUD_FLIP_HYSTERESIS,
      40,
      1920,
      1080,
      'bottom-left'
    );
    expect(release.corner).toBe('bottom-right');
  });
});

describe('eyedropperCardOffset', () => {
  it('places the card around the icon tip for each corner', () => {
    expect(eyedropperCardOffset('bottom-right')).toEqual({ left: HUD_ICON, top: 0 });
    expect(eyedropperCardOffset('top-right')).toEqual({ left: HUD_ICON, top: -HUD_H });
    expect(eyedropperCardOffset('bottom-left')).toEqual({ left: -HUD_CARD_W, top: 0 });
    expect(eyedropperCardOffset('top-left')).toEqual({ left: -HUD_CARD_W, top: -HUD_H });
  });
});
