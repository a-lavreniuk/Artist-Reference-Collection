import { CARD_DETAIL_SETTINGS_WIDTH_MIN } from './cardDetailSettingsWidth';

/** Ширина панели настроек, достаточная для тулбара без перекрытия кнопок. */
export function measureCardDetailToolbarMinWidth(optionsLeftEl: HTMLElement | null): number {
  if (!optionsLeftEl) return CARD_DETAIL_SETTINGS_WIDTH_MIN;

  const toolbar = optionsLeftEl.closest('.arc-card-detail-options');
  if (!(toolbar instanceof HTMLElement)) return CARD_DETAIL_SETTINGS_WIDTH_MIN;

  const prevWidth = optionsLeftEl.style.width;
  const prevMinWidth = optionsLeftEl.style.minWidth;
  const prevFlex = optionsLeftEl.style.flex;

  optionsLeftEl.style.width = 'max-content';
  optionsLeftEl.style.minWidth = 'max-content';
  optionsLeftEl.style.flex = 'none';

  const contentWidth = Math.ceil(optionsLeftEl.scrollWidth);

  optionsLeftEl.style.width = prevWidth;
  optionsLeftEl.style.minWidth = prevMinWidth;
  optionsLeftEl.style.flex = prevFlex;

  const toolbarStyle = getComputedStyle(toolbar);
  const paddingLeft = Number.parseFloat(toolbarStyle.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(toolbarStyle.paddingRight) || 0;

  return Math.max(CARD_DETAIL_SETTINGS_WIDTH_MIN, Math.ceil(contentWidth + paddingLeft + paddingRight));
}
