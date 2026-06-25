/** Сколько пунктов changelog показывать в модалке «Что нового»; остальное — в настройках. */
export const RELEASE_NOTES_MODAL_PREVIEW_LIMIT = 5;

export function getReleaseNotesPreviewChanges(changes: string[]): string[] {
  return changes.slice(0, RELEASE_NOTES_MODAL_PREVIEW_LIMIT);
}

export function hasMoreReleaseNotes(changes: string[]): boolean {
  return changes.length > RELEASE_NOTES_MODAL_PREVIEW_LIMIT;
}
