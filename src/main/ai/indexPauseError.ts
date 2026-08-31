export const INDEX_PAUSE_ERROR = 'Индексация приостановлена';

export function isIndexPauseError(message: string | null | undefined): boolean {
  return message === INDEX_PAUSE_ERROR;
}
