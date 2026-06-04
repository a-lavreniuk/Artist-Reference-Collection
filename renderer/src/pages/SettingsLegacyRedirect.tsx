import { Navigate, useSearchParams } from 'react-router-dom';
import SettingsStubPage from './SettingsStubPage';

const SF_MAP: Record<string, string> = {
  storage: '/storage',
  statistics: '/statistics',
  history: '/history',
  duplicates: '/duplicates'
};

export default function SettingsLegacyRedirect() {
  const [searchParams] = useSearchParams();
  const sf = searchParams.get('sf');
  if (sf && SF_MAP[sf]) {
    return <Navigate to={SF_MAP[sf]} replace />;
  }
  return <SettingsStubPage />;
}
