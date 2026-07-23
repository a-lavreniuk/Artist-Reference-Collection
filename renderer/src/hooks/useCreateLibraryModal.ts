import { useCallback, useState } from 'react';
import { ONBOARDING_DEFAULT_LIBRARY_NAME } from '../content/onboarding';
import { getNavbarMetrics, invalidateLibraryCache } from '../services/db';

async function resolveDefaultLibraryFolderName(): Promise<string> {
  const fromMain = await window.arc?.getDefaultLibraryFolderName?.();
  const trimmed = fromMain?.trim();
  if (trimmed && trimmed !== 'Библиотека ARC') return trimmed;
  return ONBOARDING_DEFAULT_LIBRARY_NAME;
}

type CreateLibraryModalState = {
  folderName: string;
  busy: boolean;
  emptySubmitted: boolean;
};

export function useCreateLibraryModal(onSuccess: () => void) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CreateLibraryModalState>({
    folderName: ONBOARDING_DEFAULT_LIBRARY_NAME,
    busy: false,
    emptySubmitted: false
  });

  const openModal = useCallback(() => {
    void (async () => {
      const folderName = await resolveDefaultLibraryFolderName();
      setState({
        folderName,
        busy: false,
        emptySubmitted: false
      });
      setOpen(true);
    })();
  }, []);

  const closeModal = useCallback(() => {
    if (state.busy) return;
    setOpen(false);
  }, [state.busy]);

  const applyLibraryReady = useCallback(async () => {
    invalidateLibraryCache();
    await getNavbarMetrics();
    window.dispatchEvent(new CustomEvent('arc:library-changed'));
    setOpen(false);
    onSuccess();
  }, [onSuccess]);

  const submit = useCallback(async () => {
    if (!window.arc?.createLibraryInContainer || state.busy) return;
    const name = state.folderName.trim();
    if (!name) {
      setState((prev) => ({ ...prev, emptySubmitted: true }));
      return;
    }

    const parent = await window.arc.pickLibraryFolder();
    if (!parent) return;

    setState((prev) => ({ ...prev, busy: true, emptySubmitted: false }));
    try {
      const res = await window.arc.createLibraryInContainer({ name, parentHint: parent });
      if (!res.ok) {
        setState((prev) => ({ ...prev, emptySubmitted: res.fieldError === true }));
        return;
      }
      await applyLibraryReady();
    } finally {
      setState((prev) => ({ ...prev, busy: false }));
    }
  }, [applyLibraryReady, state.busy, state.folderName]);

  return {
    open,
    openModal,
    closeModal,
    state,
    setFolderName: (folderName: string) => setState((prev) => ({ ...prev, folderName, emptySubmitted: false })),
    submit
  };
}

export async function runOnboardingOpenLibraryFlow(
  onSuccess: () => void
): Promise<{ ok: true } | { ok: false; message?: string }> {
  if (!window.arc?.openLibraryOrContainer) return { ok: false, message: 'Доступно только в приложении ARC' };
  const picked = await window.arc.pickLibraryFolder();
  if (!picked) return { ok: false };
  const res = await window.arc.openLibraryOrContainer(picked);
  if (!res.ok) {
    return { ok: false, message: res.error?.trim() ? res.error : 'Не удалось открыть библиотеку.' };
  }
  invalidateLibraryCache();
  await getNavbarMetrics();
  window.dispatchEvent(new CustomEvent('arc:library-changed'));
  onSuccess();
  return { ok: true };
}
