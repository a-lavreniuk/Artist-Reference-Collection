import { useEffect, useRef } from 'react';
import type { Context } from 'gsap';
import { ensureGsapSetup } from './gsapSetup';

export function useGsapContext(scope?: React.RefObject<Element | null>): Context {
  const ctxRef = useRef<Context | null>(null);

  useEffect(() => {
    const gsap = ensureGsapSetup();
    const scopeEl = scope?.current ?? undefined;
    ctxRef.current = gsap.context(() => undefined, scopeEl);
    return () => {
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
  }, [scope]);

  return ctxRef.current!;
}
