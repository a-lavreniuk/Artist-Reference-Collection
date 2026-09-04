import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CardDetailAnnotationsSection from './CardDetailAnnotationsSection';

const annot = {
  id: 'a1',
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  text: 'CTA',
  createdAt: '2026-01-01T00:00:00.000Z'
};

describe('CardDetailAnnotationsSection', () => {
  it('keeps interactive rows keyboard reachable', () => {
    const html = renderToString(
      <CardDetailAnnotationsSection
        annotations={[annot]}
        hoveredId={null}
        focusedId={null}
        isVideo={false}
        onSelect={() => undefined}
        onHover={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });

  it('does not expose read-only rows as buttons', () => {
    const html = renderToString(
      <CardDetailAnnotationsSection
        annotations={[annot]}
        hoveredId={null}
        focusedId={null}
        isVideo={false}
        readOnly
        compact
        onSelect={() => undefined}
        onHover={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(html).not.toContain('role="button"');
    expect(html).not.toContain('tabindex="0"');
    expect(html).toContain('CTA');
  });
});
