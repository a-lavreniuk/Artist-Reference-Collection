/** Abort in-flight llama HTTP calls when indexing is paused. */
let controller: AbortController | null = null;

export function beginAiOpAbort(): AbortSignal {
  controller?.abort();
  controller = new AbortController();
  return controller.signal;
}

export function abortAiOp(): void {
  controller?.abort();
}

export function currentAiOpSignal(): AbortSignal | undefined {
  return controller?.signal;
}

export function isAiOpAborted(): boolean {
  return controller?.signal.aborted === true;
}
