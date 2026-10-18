import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth, onAuthStateChanged, signOut, type User } from './firebase';

const AuthContext = createContext<{ ready: boolean; user: User | null; signingOut: boolean; logout: () => Promise<void> }>({
  ready: false, user: null, signingOut: false, logout: async () => {},
});

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const client = useQueryClient();
  useEffect(() => {
    let previous: string | null | undefined;
    return onAuthStateChanged(auth, (next) => {
      if (previous !== undefined && previous !== (next?.uid ?? null)) client.clear();
      previous = next?.uid ?? null;
      setUser(next);
      if (next) setSigningOut(false);
      setReady(true);
    });
  }, [client]);
  const logout = async () => {
    setSigningOut(true);
    try { await signOut(auth); client.clear(); }
    catch (error) { setSigningOut(false); throw error; }
  };
  return <AuthContext.Provider value={{ ready, user, signingOut, logout }}>{children}</AuthContext.Provider>;
}

export const useAuthSession = () => useContext(AuthContext);
