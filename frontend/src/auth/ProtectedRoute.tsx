import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useTranslation } from '../i18n';

export default function ProtectedRoute(): React.ReactElement {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation('common');
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: 24 }}>{t('messages.loading')}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
