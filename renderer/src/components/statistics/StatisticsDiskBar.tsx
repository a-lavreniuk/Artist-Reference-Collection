import { useMemo, useRef } from 'react';
import type { DiskBarSegment } from '../../utils/buildDiskBarModel';
import { useDiskBarMotion } from '../../motion';

type Props = {
  segments: DiskBarSegment[];
};

export default function StatisticsDiskBar({ segments }: Props) {
  const visibleSegments = useMemo(
    () => segments.filter((segment) => segment.bytes > 0),
    [segments]
  );
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const flexValues = useMemo(
    () => visibleSegments.map((segment) => Math.max(segment.bytes, 1)),
    [visibleSegments]
  );

  useDiskBarMotion(segmentRefs, flexValues, visibleSegments.length > 0);

  return (
    <div className="arc-stats-disk-bar" aria-hidden="true">
      <div className="arc-stats-disk-bar__shell">
        <div className="arc-stats-disk-bar__track">
          {visibleSegments.map((segment, index) => {
            const isFree = segment.tone === 'free';
            return (
              <span
                key={segment.id}
                ref={(el) => {
                  segmentRefs.current[index] = el;
                }}
                className={[
                  'arc-stats-disk-bar__segment',
                  `arc-stats-disk-bar__segment--${segment.tone}`,
                  isFree ? null : 'arc-stats-disk-bar__segment--occupied'
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ flexGrow: Math.max(segment.bytes, 1), flexBasis: 0 }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
