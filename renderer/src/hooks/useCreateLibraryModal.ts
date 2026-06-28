import { useCallback, useState } from 'react';
import { ONBOARDING_DEFAULT_LIBRARY_NAME } from '../content/onboarding';
import { getNavbarMetrics, invalidateLibraryCache } from '../services/db';

async function resolveDefaultLibraryFolderName(): Promise<string> {
  const fromMain = await window.arc?.getDefaultLibraryFolderName?.();
  return fromMain?.trim() || ONBOARDING_DEFAULT_LIBRARY_NAME;
}

type CreateLibraryModalState = {
  folderName: string;
  busy: boolean;
  emptySubmitted: boolean;
  showExistingConfirm: boolean;
  pendingExistingPath: string | null;
};

function joinLibraryPath(parent: string, name: string): string {
  const sep = parent.includes('\\') ? '\\' : '/';
  return `${parent.replace(/[/\\]+$/, '')}${sep}${name.replace(/^[/\\]+/, '')}`;
}

export function useCreateLibraryModal(onSuccess: () => void) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CreateLibraryModalState>({
    folderName: ONBOARDING_DEFAULT_LIBRARY_NAME,
    busy: false,
    emptySubmitted: false,
    showExistingConfirm: false,
    pendingExistingPath: null
  });

  const openModal = useCallback(() => {
    void (async () => {
      const folderName = await resolveDefaultLibraryFolderName();
      setState({
        folderName,
        busy: false,
        emptySubmitted: false,
        showExistingConfirm: false,
        pendingExistingPath: null
      });
      setOpen(true);
    })();
  }, []);

  const closeModal = useCallback(() => {
    if (state.busy) return;
    setOpen(false);
  }, [state.busy]);

  const applyLibraryPath = useCallback(async (absPath: string) => {
    if (!window.arc) return false;
    setState((prev) => ({ ...prev, busy: true, emptySubmitted: false }));
    try {
      const res = await window.arc.setLibraryPath(absPath);
      if (!res.ok) return false;
      invalidateLibraryCache();
      await getNavbarMetrics();
      window.dispatchEvent(new CustomEvent('arc:library-changed'));
      setOpen(false);
      onSuccess();
      return true;
    } finally {
      setState((prev) => ({ ...prev, busy: false }));
    }
  }, [onSuccess]);

  const submit = useCallback(async () => {
    if (!window.arc || state.busy) return;
    const name = state.folderName.trim();
    if (!name) {
      setState((prev) => ({ ...prev, emptySubmitted: true }));
      return;
    }

    const parent = await window.arc.pickLibraryFolder();
    if (!parent) return;

    const absPath = joinLibraryPath(parent, name);
    const valid = await window.arc.validateLibraryFolder(absPath);
    if (valid.ok && valid.valid) {
      setState((prev) => ({
        ...prev,
        pendingExistingPath: absPath,
        showExistingConfirm: true
      }));
      return;
    }

    await applyLibraryPath(absPath);
  }, [applyLibraryPath, state.busy, state.folderName]);

  const confirmExistingLibrary = useCallback(async () => {
    if (!state.pendingExistingPath) return;
    setState((prev) => ({ ...prev, showExistingConfirm: false }));
    const target = state.pendingExistingPath;
    setState((prev) => ({ ...prev, pendingExistingPath: null }));
    await applyLibraryPath(target);
  }, [applyLibraryPath, state.pendingExistingPath]);

  const cancelExistingLibrary = useCallback(() => {
    setState((prev) => ({ ...prev, showExistingConfirm: false, pendingExistingPath: null }));
  }, []);

  return {
    open,
    openModal,
    closeModal,
    state,
    setFolderName: (folderName: string) => setState((prev) => ({ ...prev, folderName, emptySubmitted: false })),
    submit,
    confirmExistingLibrary,
    cancelExistingLibrary
  };
}

export async function runOnboardingRestoreFlow(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!window.arc) return { ok: false, message: 'Доступно только в приложении ARC' };
  const first = await window.arc.pickBackupArchive();
  if (!first) return { ok: false, message: '' };
  const dest = await window.arc.pickLibraryFolder();
  if (!dest) return { ok: false, message: '' };
  if (!(await window.arc.dirIsEmpty(dest))) {
    return { ok: false, message: 'Папка восстановления должна быть пустой.' };
  }
  const res = await window.arc.restoreLibrary({ firstPartPath: first, destDir: dest });
  if (!res.ok) {
    return { ok: false, message: res.error?.trim() ? res.error : 'Не удалось восстановить библиотеку.' };
  }
  return { ok: true };
}

export async function runOnboardingOpenLibraryFlow(
  onSuccess: () => void
): Promise<{ ok: true } | { ok: false; message?: string }> {
  if (!window.arc) return { ok: false, message: 'Доступно только в приложении ARC' };
  const picked = await window.arc.pickLibraryFolder();
  if (!picked) return { ok: false };
  const validation = await window.arc.validateLibraryFolder(picked);
  if (!validation.valid) {
    return { ok: false, message: 'В выбранной папке нет библиотеки ARC.' };
  }
  const res = await window.arc.setLibraryPath(picked);
  if (!res.ok) {
    return { ok: false, message: res.error?.trim() ? res.error : 'Не удалось открыть библиотеку.' };
  }
  invalidateLibraryCache();
  await getNavbarMetrics();
  window.dispatchEvent(new CustomEvent('arc:library-changed'));
  onSuccess();
  return { ok: true };
}
