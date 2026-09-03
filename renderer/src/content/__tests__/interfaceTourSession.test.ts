import { describe, expect, it } from 'vitest';
import {
  ENABLED_INTERFACE_TOUR_STEPS,
  INTERFACE_TOUR_THANKS_STEP,
  isCardTourStep,
  isRestTourStep,
  resolveAutoStartSegment,
  shouldIncludeThanksStep,
  stepsForSegment
} from '../onboardingTour';
import {
  restPrefsAfterChromePause,
  restPrefsAfterFullFinish,
  restPrefsAfterLater,
  restPrefsAfterReplay,
  shouldResumeRestTour,
  shouldShowRestTourOffer
} from '../interfaceTourSession';

describe('interface tour segments', () => {
  it('keeps card and trailing steps out of chrome', () => {
    const chrome = stepsForSegment('chrome');
    expect(chrome.some(isRestTourStep)).toBe(false);
    expect(chrome.some(isCardTourStep)).toBe(false);
    expect(chrome.map((step) => step.id)).not.toContain('card_open');
    expect(chrome.map((step) => step.id)).not.toContain('bug_report');
    expect(chrome.map((step) => step.id)).not.toContain('category_settings');
    expect(chrome.map((step) => step.id)).not.toContain('statistics');
  });

  it('rest segment is cards then bug report', () => {
    const rest = stepsForSegment('rest');
    expect(rest.map((step) => step.id)).toEqual(['card_open', 'card_fields', 'card_actions', 'bug_report']);
  });

  it('drops removed tour steps from the enabled list', () => {
    const ids = ENABLED_INTERFACE_TOUR_STEPS.map((step) => step.id);
    expect(ids).not.toContain('category_settings');
    expect(ids).not.toContain('card_similar');
    expect(ids).not.toContain('statistics');
    expect(ids).not.toContain('history');
  });

  it('full segment matches enabled steps', () => {
    expect(stepsForSegment('full').map((step) => step.id)).toEqual(
      ENABLED_INTERFACE_TOUR_STEPS.map((step) => step.id)
    );
  });

  it('uses empty-library copy on the grid step', () => {
    const grid = ENABLED_INTERFACE_TOUR_STEPS.find((step) => step.id === 'gallery_grid');
    expect(grid?.bodyEmptyLibrary).toMatch(/Пока библиотека пуста/);
  });

  it('starts full tour when the library already has cards', () => {
    expect(resolveAutoStartSegment(true)).toBe('full');
    expect(resolveAutoStartSegment(false)).toBe('chrome');
  });

  it('places grid and moodboard steps in the viewport center', () => {
    expect(ENABLED_INTERFACE_TOUR_STEPS.find((step) => step.id === 'gallery_grid')?.placement).toBe('center');
    expect(ENABLED_INTERFACE_TOUR_STEPS.find((step) => step.id === 'moodboard')?.placement).toBe('center');
  });

  it('describes the redesigned details panel', () => {
    const fields = ENABLED_INTERFACE_TOUR_STEPS.find((step) => step.id === 'card_fields');
    expect(fields?.body).toMatch(/Детали/);
    expect(fields?.body).toMatch(/аннотации/i);
    expect(fields?.body).not.toMatch(/Открыть ссылку/);
  });

  it('appends the thanks step only for the first-run rest or full tour', () => {
    expect(stepsForSegment('full').map((step) => step.id)).not.toContain('thanks');
    expect(stepsForSegment('chrome', { includeThanks: true }).map((step) => step.id)).not.toContain('thanks');
    expect(stepsForSegment('full', { includeThanks: true }).at(-1)?.id).toBe('thanks');
    expect(stepsForSegment('full', { includeThanks: true }).at(-2)?.id).toBe('bug_report');
    expect(stepsForSegment('rest', { includeThanks: true }).at(-1)?.id).toBe('thanks');
    expect(stepsForSegment('rest', { includeThanks: true }).at(-2)?.id).toBe('bug_report');
    expect(INTERFACE_TOUR_THANKS_STEP.body).toMatch(/Спасибо/);
    expect(shouldIncludeThanksStep({ replay: true, segment: 'full' })).toBe(false);
    expect(shouldIncludeThanksStep({ replay: false, segment: 'full' })).toBe(true);
    expect(shouldIncludeThanksStep({ replay: false, segment: 'rest' })).toBe(true);
    expect(shouldIncludeThanksStep({ replay: false, segment: 'chrome' })).toBe(false);
  });
});

describe('interface tour rest prefs', () => {
  it('shows offer after chrome pause once cards exist', () => {
    const prefs = {
      ...restPrefsAfterChromePause(),
      onboardingRestTourOfferDismissed: false
    };
    expect(shouldShowRestTourOffer(prefs, true, false)).toBe(true);
    expect(shouldShowRestTourOffer(prefs, false, false)).toBe(false);
    expect(shouldShowRestTourOffer(prefs, true, true)).toBe(false);
  });

  it('does not offer again after Later', () => {
    const prefs = {
      onboardingTourCompleted: true,
      onboardingRestTourPending: true,
      ...restPrefsAfterLater()
    };
    expect(shouldShowRestTourOffer(prefs, true, false)).toBe(false);
    expect(shouldResumeRestTour(prefs, true)).toBe(false);
  });

  it('finishing the full tour clears the rest queue', () => {
    const prefs = restPrefsAfterFullFinish();
    expect(prefs.onboardingRestTourPending).toBe(false);
    expect(shouldShowRestTourOffer(prefs, true, false)).toBe(false);
  });

  it('replay from settings clears the rest queue so Later does not stick', () => {
    const prefs = restPrefsAfterReplay();
    expect(shouldShowRestTourOffer(prefs, true, false)).toBe(false);
    expect(shouldResumeRestTour(prefs, true)).toBe(false);
  });
});
