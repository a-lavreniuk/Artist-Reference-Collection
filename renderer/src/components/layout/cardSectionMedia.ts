import { createContext, useContext } from 'react';
import type { MainTabKey } from './navbarLayout';

export type CardSectionMediaState = Record<MainTabKey, boolean>;

const defaultState: CardSectionMediaState = {
  gallery: false,
  collections: false,
  moodboard: false
};

export const CardSectionMediaContext = createContext<CardSectionMediaState>(defaultState);

/** Синхронная копия для preloadDecodedImages вне React. */
let mediaActiveSync: CardSectionMediaState = { ...defaultState };

export function syncCardSectionMediaActive(state: CardSectionMediaState): void {
  mediaActiveSync = state;
}

export function isCardSectionMediaActive(tab: MainTabKey): boolean {
  return mediaActiveSync[tab];
}

export function useCardSectionMediaActive(tab: MainTabKey): boolean {
  const state = useContext(CardSectionMediaContext);
  return state[tab];
}
