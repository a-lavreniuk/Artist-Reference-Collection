let cached: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getPrefersReducedMotion(): boolean {
  if (cached === null) cached = readReducedMotion();
  return cached;
}

export function subscribePrefersReducedMotion(onChange: (value: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = () => {
    cached = mq.matches;
    onChange(mq.matches);
  };
  mq.addEventListener('change', handler);
  listeners.add(onChange);
  return () => {
    mq.removeEventListener('change', handler);
    listeners.delete(onChange);
  };
}
