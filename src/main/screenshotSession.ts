let captureInFlight = false;

export function setScreenshotCaptureInFlight(inFlight: boolean): void {
  captureInFlight = inFlight;
}

export function isScreenshotCaptureInFlight(): boolean {
  return captureInFlight;
}
