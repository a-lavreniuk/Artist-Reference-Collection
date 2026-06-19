import { useNavigate } from 'react-router-dom';
import type { DiskSpacePressureAdvice } from '../../utils/evaluateDiskSpacePressure';

type Props = {
  advice: DiskSpacePressureAdvice;
};

export default function StatisticsDiskSpaceNotice({ advice }: Props) {
  const navigate = useNavigate();
  const variant = advice.level === 'critical' ? 'danger' : 'warning';

  return (
    <div className={`alert alert-${variant} arc-stats-disk-notice`} role="status">
      <div className="arc-stats-disk-notice__copy">
        <p className="typo-p-m arc-stats-disk-notice__title">{advice.title}</p>
        <p className="typo-p-m arc-stats-disk-notice__body">{advice.body}</p>
      </div>
      <div className="arc-stats-disk-notice__actions" data-btn-size="m">
        <button
          type="button"
          className="btn btn-outline btn-ds"
          onClick={() => navigate('/?lib=trash')}
        >
          <span className="btn-ds__value">Корзина ARC</span>
        </button>
        <button
          type="button"
          className="btn btn-outline btn-ds"
          onClick={() => navigate('/settings/library')}
        >
          <span className="btn-ds__value">Перенести библиотеку</span>
        </button>
      </div>
    </div>
  );
}
