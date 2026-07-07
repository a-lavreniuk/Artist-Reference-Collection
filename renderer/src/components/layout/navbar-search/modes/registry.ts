import type { NavbarSearchMode } from '../../../../search/navbarSearchMode';
import type { NavbarSearchModePlugin } from '../types';
import { tagsModePlugin } from './tagsMode';
import { aiModePlugin } from './aiMode';
import { colorModePlugin } from './colorMode';
import { similarModePlugin } from './similarMode';

export const NAVBAR_SEARCH_MODE_PLUGINS: NavbarSearchModePlugin[] = [
  tagsModePlugin,
  aiModePlugin,
  colorModePlugin,
  similarModePlugin
];

export const NAVBAR_SEARCH_MODES: Record<NavbarSearchMode, NavbarSearchModePlugin> = {
  tags: tagsModePlugin,
  ai: aiModePlugin,
  color: colorModePlugin,
  similar: similarModePlugin
};
