import { describe, expect, it } from 'vitest';
import { resolveChromeTitle } from './useChromeTitle';

describe('resolveChromeTitle', () => {
  it('shows trash label on gallery trash scope', () => {
    expect(resolveChromeTitle('/gallery', 'lib=trash')).toBe('Корзина');
  });

  it('shows combined trash and card title when inspect is open in trash', () => {
    expect(resolveChromeTitle('/gallery', 'lib=trash&detail=abcd1234-ef56-7890-abcd-ef1234567890')).toBe(
      'Корзина / Карточка +abcd1234'
    );
  });

  it('shows card title without trash prefix outside trash', () => {
    expect(resolveChromeTitle('/gallery', 'detail=abcd1234-ef56-7890-abcd-ef1234567890')).toBe(
      'Карточка +abcd1234'
    );
  });

  it('shows all-library label by default', () => {
    expect(resolveChromeTitle('/gallery', '')).toBe('Вся библиотека');
  });
});
