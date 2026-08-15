let detailQueueOpen = false;

export function getDetailQueueOpen(): boolean {
  return detailQueueOpen;
}

export function setDetailQueueOpen(next: boolean): void {
  detailQueueOpen = next;
}
