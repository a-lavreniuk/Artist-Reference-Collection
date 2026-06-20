import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HistoryEntityType, HistoryEntry, HistorySegment } from '../../services/historyTypes';

type Props = {
  entry: HistoryEntry;
};

function useHistoryEntityNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (entityType: HistoryEntityType, id: string) => {
      if (entityType === 'collection') {
        navigate(`/collections/${id}`);
        return;
      }
      if (entityType === 'card') {
        navigate({ pathname: '/gallery', search: `?detail=${encodeURIComponent(id)}` });
        return;
      }
      if (entityType === 'tag') {
        navigate(`/tags?tag=${encodeURIComponent(id)}`);
        return;
      }
      if (entityType === 'category') {
        navigate(`/tags?category=${encodeURIComponent(id)}`);
      }
    },
    [navigate]
  );
}

export default function HistoryMessage({ entry }: Props) {
  const navigateEntity = useHistoryEntityNavigate();
  const segments = entry.segments;

  if (!segments || segments.length === 0) {
    return <p className="typo-p-m arc-history-message">{entry.message}</p>;
  }

  return (
    <p className="typo-p-m arc-history-message">
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return <span key={`t-${i}`}>{seg.text}</span>;
        }
        return (
          <button
            key={`e-${seg.id}-${i}`}
            type="button"
            className="inline-link"
            onClick={() => navigateEntity(seg.entityType, seg.id)}
          >
            {seg.label}
          </button>
        );
      })}
    </p>
  );
}
