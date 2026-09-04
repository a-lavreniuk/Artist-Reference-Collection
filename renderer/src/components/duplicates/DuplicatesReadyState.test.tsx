import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LibraryListItem } from '../../hooks/useLibraries';
import DuplicatesReadyState from './DuplicatesReadyState';

const libraries: LibraryListItem[] = [
  { id: 'lib-a', name: 'Studio', path: '/studio', active: true },
  { id: 'lib-b', name: 'Archive', path: '/archive', active: false }
];

describe('DuplicatesReadyState library multiselect', () => {
  it('renders selected libraries as chips', () => {
    const html = renderToString(
      <DuplicatesReadyState
        threshold={80}
        onThresholdChange={() => undefined}
        onScan={() => undefined}
        libraries={libraries}
        selectedLibraryIds={['lib-a']}
      />
    );
    expect(html).toContain('input-multiselect');
    expect(html).toContain('chip chip-active');
    expect(html).toContain('Studio');
    expect(html).not.toContain('Archive');
  });

  it('hides the selector when there is only one library', () => {
    const html = renderToString(
      <DuplicatesReadyState
        threshold={80}
        onThresholdChange={() => undefined}
        onScan={() => undefined}
        libraries={[libraries[0]]}
        selectedLibraryIds={['lib-a']}
      />
    );
    expect(html).not.toContain('input-multiselect');
  });

  it('does not render the no-results empty state', () => {
    const html = renderToString(
      <DuplicatesReadyState
        threshold={80}
        onThresholdChange={() => undefined}
        onScan={() => undefined}
        libraries={libraries}
        selectedLibraryIds={['lib-a']}
      />
    );
    expect(html).not.toContain('Совпадений не найдено');
    expect(html).not.toContain('arc-empty-state');
  });

  it('renders an empty selector by default', () => {
    const html = renderToString(
      <DuplicatesReadyState
        threshold={80}
        onThresholdChange={() => undefined}
        onScan={() => undefined}
        libraries={libraries}
      />
    );
    expect(html).toContain('Выберите библиотеки');
    expect(html).not.toContain('chip chip-active');
    expect(html).toContain('disabled');
  });

  it('shows placeholder when nothing is selected', () => {
    const html = renderToString(
      <DuplicatesReadyState
        threshold={80}
        onThresholdChange={() => undefined}
        onScan={() => undefined}
        libraries={libraries}
        selectedLibraryIds={[]}
      />
    );
    expect(html).toContain('Выберите библиотеки');
  });
});
