import type { ComponentProps } from 'react';
import { ErrorBoundary } from '../error-boundary';
import CardDetailOverlay from './CardDetailOverlay';

/** Деталка с локальным ErrorBoundary: сбой overlay не роняет всю галерею. */
export default function CardInspectModal(props: ComponentProps<typeof CardDetailOverlay>) {
  return (
    <ErrorBoundary isolate>
      <CardDetailOverlay {...props} />
    </ErrorBoundary>
  );
}
