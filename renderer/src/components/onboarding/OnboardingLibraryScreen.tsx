import { useLayoutEffect, useRef, useState } from 'react';
import MessageModal from '../layout/MessageModal';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import CreateLibraryModal from './CreateLibraryModal';
import OnboardingLibraryPreview from './OnboardingLibraryPreview';
import { runOnboardingOpenLibraryFlow, useCreateLibraryModal } from '../../hooks/useCreateLibraryModal';

type Props = {
  revealed?: boolean;
  animateEnter?: boolean;
  onComplete: () => void;
};

export default function OnboardingLibraryScreen({ revealed = true, animateEnter = false, onComplete }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!animateEnter && revealed);
  const [actionBusy, setActionBusy] = useState(false);
  const [infoModal, setInfoModal] = useState<string | null>(null);
  const libraryModal = useCreateLibraryModal(onComplete);

  useLayoutEffect(() => {
    if (ref.current) void hydrateArcNavbarIcons(ref.current);
  }, [libraryModal.open]);

  useLayoutEffect(() => {
    if (!revealed) {
      setVisible(false);
      return;
    }
    if (!animateEnter) {
      setVisible(true);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [revealed, animateEnter]);

  const runOpenLibrary = async () => {
    setActionBusy(true);
    try {
      const res = await runOnboardingOpenLibraryFlow(onComplete);
      if (!res.ok && res.message) {
        setInfoModal(res.message);
      }
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      <section
        ref={ref}
        className={`arc-onboarding-stage arc-onboarding-stage--library arc-ui-kit-scope${visible ? ' arc-onboarding-stage--revealed' : ''}${!animateEnter ? ' arc-onboarding-stage--instant' : ''}`}
        data-elevation="sunken"
        data-typo-tone="white"
        data-btn-size="l"
      >
        <div className="arc-onboarding-stage__hero arc-onboarding-stage__hero--center arc-onboarding-library-hero">
          <div className="arc-onboarding-stage__copy arc-onboarding-stage__copy--center">
            <h1 className="h1 arc-onboarding-stage__title">Создать библиотеку</h1>
            <p className="text-l arc-onboarding-stage__subtitle">
              В этой папке будут храниться добавляемые файлы. Рекомендуем создавать библиотеку на
              высокоскоростном носителе, для лучшей производительности
            </p>
          </div>
          <div className="arc-onboarding-library-actions">
            <button
              type="button"
              className="btn btn-brand btn-ds"
              onClick={libraryModal.openModal}
              disabled={actionBusy || !window.arc}
            >
              <span className="btn-ds__value">Создать библиотеку</span>
              <span
                className="btn-ds__icon arc-onboarding-library-btn__icon arc-onboarding-library-btn__icon--create"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              className="btn btn-outline btn-ds"
              onClick={() => void runOpenLibrary()}
              disabled={actionBusy || !window.arc}
            >
              <span className="btn-ds__value">Открыть библиотеку</span>
              <span
                className="btn-ds__icon arc-onboarding-library-btn__icon arc-onboarding-library-btn__icon--open"
                aria-hidden="true"
              />
            </button>
          </div>
          <p className="text-s arc-onboarding-library-note">
            Библиотека будет сохранена на вашем устройстве, пожалуйста, резервируйте его регулярно
          </p>
        </div>

        <OnboardingLibraryPreview />
      </section>

      {libraryModal.open ? (
        <CreateLibraryModal
          folderName={libraryModal.state.folderName}
          busy={libraryModal.state.busy}
          emptySubmitted={libraryModal.state.emptySubmitted}
          onFolderNameChange={libraryModal.setFolderName}
          onClose={libraryModal.closeModal}
          onSubmit={() => void libraryModal.submit()}
        />
      ) : null}

      {infoModal ? (
        <MessageModal title="Сообщение" message={infoModal} onClose={() => setInfoModal(null)} closeLabel="Понятно" />
      ) : null}
    </>
  );
}
