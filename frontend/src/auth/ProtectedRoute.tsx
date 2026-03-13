import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute(): React.ReactElement {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
