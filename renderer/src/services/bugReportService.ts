import { showAppNotification } from './notificationService';

export async function openBugReportForm(): Promise<void> {
  if (!window.arc?.openBugReportForm) {
    showAppNotification({
      message: 'Отправка отчётов недоступна в этой сборке',
      variant: 'danger',
      skipPrefCheck: true
    });
    return;
  }

  const result = await window.arc.openBugReportForm();
  if (!result.ok) {
    showAppNotification({
      message: result.error,
      variant: 'danger',
      skipPrefCheck: true
    });
  }
}
