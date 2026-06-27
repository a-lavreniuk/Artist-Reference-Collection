export const ARC_INTERFACE_TOUR_REPLAY_EVENT = 'arc:interface-tour-replay';

export function requestInterfaceTourReplay(): void {
  window.dispatchEvent(new CustomEvent(ARC_INTERFACE_TOUR_REPLAY_EVENT));
}
