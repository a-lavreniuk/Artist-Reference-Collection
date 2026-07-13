/** Electron accelerator strings — shared source for main process registrations. */
export const SCREENSHOT_AREA_ACCELERATOR = 'CommandOrControl+Shift+1';
export const SCREENSHOT_FULLSCREEN_ACCELERATOR = 'CommandOrControl+Shift+2';
export const SCREENSHOT_WINDOW_ACCELERATOR = 'CommandOrControl+Shift+3';

/** Best-effort system keys (Windows); may fail to register in globalShortcut. */
export const SCREENSHOT_FULLSCREEN_PRTSCR_ACCELERATOR = 'PrintScreen';
export const SCREENSHOT_WINDOW_ALT_PRTSCR_ACCELERATOR = 'Alt+PrintScreen';

export const FEEDBACK_ACCELERATOR = 'CommandOrControl+Shift+B';

export const DEVTOOLS_ACCELERATORS = ['F12', 'CommandOrControl+Shift+I'] as const;
