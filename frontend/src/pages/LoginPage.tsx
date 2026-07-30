import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch {
      setError('Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-bold text-orange-600">Capability</h1>
        {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <label className="mb-3 block text-sm">
          Username
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </label>
        <label className="mb-5 block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
