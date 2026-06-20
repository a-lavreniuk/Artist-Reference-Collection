export type MediaSectionTab = 'gallery' | 'collections' | 'moodboard';

let activeTab: MediaSectionTab | null = 'gallery';
let mediaGeneration = 0;

export function setActiveMediaTab(tab: MediaSectionTab | null): void {
  if (activeTab !== tab) {
    mediaGeneration += 1;
  }
  activeTab = tab;
}

export function getActiveMediaTab(): MediaSectionTab | null {
  return activeTab;
}

export function getMediaGeneration(): number {
  return mediaGeneration;
}

/** Превью с ?sect= — только для активной вкладки (скрытая галерея не блокирует IPC). */
export function isArcMediaSectionAllowed(section: string | null): boolean {
  if (!section) return true;
  if (section !== 'gallery' && section !== 'collections' && section !== 'moodboard') return true;
  return activeTab === section;
}