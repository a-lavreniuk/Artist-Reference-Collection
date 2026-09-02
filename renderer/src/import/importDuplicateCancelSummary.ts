import { pluralFilesRu } from './importQueue';

export type DuplicateResolveKind = 'replace' | 'keep-existing' | 'keep-both';

export type DuplicateCancelCounts = {
  cleanAdded: number;
  replaceCount: number;
  keepBothCount: number;
  keepExistingCount: number;
  remaining: number;
};

export type DuplicateCancelSummary = {
  added: number;
  notAdded: number;
};

export function emptyDuplicateSessionCounts(): Omit<DuplicateCancelCounts, 'remaining'> {
  return {
    cleanAdded: 0,
    replaceCount: 0,
    keepBothCount: 0,
    keepExistingCount: 0
  };
}

export function applyDuplicateResolve(
  session: Omit<DuplicateCancelCounts, 'remaining'>,
  kind: DuplicateResolveKind
): void {
  if (kind === 'replace') session.replaceCount += 1;
  else if (kind === 'keep-both') session.keepBothCount += 1;
  else session.keepExistingCount += 1;
}

export function summarizeDuplicateCancel(counts: DuplicateCancelCounts): DuplicateCancelSummary {
  return {
    added: counts.cleanAdded + counts.replaceCount + counts.keepBothCount,
    notAdded: counts.keepExistingCount + counts.remaining
  };
}

export function duplicateCancelToastMessage(added: number, notAdded: number): string {
  if (added > 0) {
    return `Добавлено ${added}, не добавлено ${notAdded}`;
  }
  if (notAdded === 1) {
    return 'Файл не добавлен';
  }
  return `Не добавлено ${notAdded} ${pluralFilesRu(notAdded)}`;
}
