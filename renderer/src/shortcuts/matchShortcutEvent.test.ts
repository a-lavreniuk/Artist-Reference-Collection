import { describe, expect, it } from 'vitest';
import { matchesShortcut } from './matchShortcutEvent';

function keyEvent(init: {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): KeyboardEvent {
  return {
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    altKey: init.altKey ?? false,
    shiftKey: init.shiftKey ?? false,
    code: init.code ?? (init.key === ' ' ? 'Space' : '')
  } as KeyboardEvent;
}

describe('matchesShortcut', () => {
  it('matches global search', () => {
    const e = keyEvent({ key: 'f', ctrlKey: true });
    expect(matchesShortcut(e, 'global.search')).toBe(true);
  });

  it('matches navigation back with Alt+ArrowLeft', () => {
    const e = keyEvent({ key: 'ArrowLeft', altKey: true });
    expect(matchesShortcut(e, 'navigation.back')).toBe(true);
  });

  it('matches grid size shortcuts', () => {
    const e = keyEvent({ key: '2', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(e, 'gallery.gridMedium')).toBe(true);
  });

  it('matches moodboard zoom in with Ctrl+=', () => {
    const equal = keyEvent({ key: '=', ctrlKey: true });
    expect(matchesShortcut(equal, 'moodboard.zoomIn')).toBe(true);
    const plus = keyEvent({ key: '+', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(plus, 'moodboard.zoomIn')).toBe(true);
  });

  it('matches detail arrows without modifiers', () => {
    const left = keyEvent({ key: 'ArrowLeft' });
    expect(matchesShortcut(left, 'detail.previous')).toBe(true);
    const blocked = keyEvent({ key: 'ArrowLeft', ctrlKey: true });
    expect(matchesShortcut(blocked, 'detail.previous')).toBe(false);
  });

  it('matches video player shortcuts', () => {
    expect(matchesShortcut(keyEvent({ key: ' ', code: 'Space' }), 'video.playPause')).toBe(true);
    expect(
      matchesShortcut(keyEvent({ key: 'ArrowLeft', code: 'ArrowLeft', ctrlKey: true }), 'video.seekBack5')
    ).toBe(true);
    expect(matchesShortcut(keyEvent({ key: '[', code: 'BracketLeft' }), 'video.frameBack1')).toBe(true);
    expect(matchesShortcut(keyEvent({ key: ']', code: 'BracketRight' }), 'video.frameForward1')).toBe(true);
  });
});
