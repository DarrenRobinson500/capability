import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, auth } from '../api/client';
import type { CurrentUser } from '../api/types';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth
      .csrf()
      .then(() => auth.me())
      .then(setUser)
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 403)) {
          console.error('Failed to restore session', error);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const loggedInUser = await auth.login(username, password);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(async () => {
    // Clear local state even if the request itself fails — the user should
    // never get stuck on a "logged in" screen just because the logout call
    // hit a network hiccup or a server error. Worst case, a stale session
    // cookie lingers server-side until it expires on its own.
    try {
      await auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
