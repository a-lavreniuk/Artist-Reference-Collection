import { globalShortcut, ipcMain } from 'electron';

import { openBugReportForm, readBugReportFormUrl } from './feedback/bugReportLink';
import { FEEDBACK_ACCELERATOR } from './shared/shortcutAccelerators';

let ipcRegistered = false;
let shortcutRegistered = false;

export function registerFeedbackShortcut(): void {
  unregisterFeedbackShortcut();

  if (
    !globalShortcut.register(FEEDBACK_ACCELERATOR, () => {
      void openBugReportForm();
    })
  ) {
    shortcutRegistered = false;
    return;
  }

  shortcutRegistered = true;
}

export function unregisterFeedbackShortcut(): void {
  if (shortcutRegistered) {
    globalShortcut.unregister(FEEDBACK_ACCELERATOR);
    shortcutRegistered = false;
  }
}

export function registerFeedbackIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:bug-report-open', () => openBugReportForm());
  ipcMain.handle('arc:bug-report-get-url', () => readBugReportFormUrl());
}

export function applyStoredFeedbackShortcut(): void {
  registerFeedbackShortcut();
}
