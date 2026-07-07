export const ARC_INTERFACE_TOUR_REPLAY_EVENT = 'arc:interface-tour-replay';
export const ARC_INTERFACE_TOUR_SETUP_COMPLETED_EVENT = 'arc:interface-tour-setup-completed';

export function requestInterfaceTourReplay(): void {
  window.dispatchEvent(new CustomEvent(ARC_INTERFACE_TOUR_REPLAY_EVENT));
}

/** После завершения настройки библиотеки — надёжный сигнал автостарта тура (AppLayout может смонтироваться позже patch prefs). */
export function dispatchInterfaceTourSetupCompleted(): void {
  window.dispatchEvent(new CustomEvent(ARC_INTERFACE_TOUR_SETUP_COMPLETED_EVENT));
}
