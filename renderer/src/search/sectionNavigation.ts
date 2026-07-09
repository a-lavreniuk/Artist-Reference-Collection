/** Ручная навигация по разделам (navbar / меню) — тур не должен откатывать маршрут. */
let manualSectionNavigationEpoch = 0;

export function beginManualSectionNavigation(): void {
  manualSectionNavigationEpoch += 1;
}

export function getManualSectionNavigationEpoch(): number {
  return manualSectionNavigationEpoch;
}
