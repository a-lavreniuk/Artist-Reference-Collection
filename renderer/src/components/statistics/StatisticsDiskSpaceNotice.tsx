import { useNavigate } from 'react-router-dom';
import InlineNotice from '../alert/InlineNotice';
import type { DiskSpacePressureAdvice } from '../../utils/evaluateDiskSpacePressure';

type Props = {
  advice: DiskSpacePressureAdvice;
};

export default function StatisticsDiskSpaceNotice({ advice }: Props) {
  const navigate = useNavigate();
  const variant = advice.level === 'critical' ? 'danger' : 'warning';

  return (
    <InlineNotice
      variant={variant}
      title={advice.title}
      body={advice.body}
      className="arc-stats-disk-notice"
      actions={
        <div data-btn-size="m">
          <button type="button" className="btn btn-outline btn-ds" onClick={() => navigate('/?lib=trash')}>
            <span className="btn-ds__value">Корзина ARC</span>
          </button>
          <button type="button" className="btn btn-outline btn-ds" onClick={() => navigate('/settings/library')}>
            <span className="btn-ds__value">Перенести библиотеку</span>
          </button>
        </div>
      }
    />
  );
}
