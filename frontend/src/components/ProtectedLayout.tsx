import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Layout />;
}
