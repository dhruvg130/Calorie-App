import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/lib/supabase';
import { signInSchema, signUpSchema } from '@/lib/validation';

type SignUpResult = { status: 'signed-in' } | { status: 'confirmation-required' };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the persisted session has been read from secure storage. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    // Restoring from SecureStore is async; until it resolves we must not decide
    // the user is signed out, or every cold start would flash the login screen.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setInitializing(false);

      // Cached rows belong to the user who fetched them. Dropping the cache on
      // sign-out stops the next account from briefly seeing them, and clears
      // them from memory.
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    const credentials = signInSchema.parse({ email, password });
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<SignUpResult> => {
    const credentials = signUpSchema.parse({ email, password });
    const { data, error } = await supabase.auth.signUp(credentials);
    if (error) throw error;

    // With "Confirm email" enabled, Supabase returns a user but no session.
    // Reporting that honestly beats pretending the user is signed in and then
    // failing on the first query.
    return data.session ? { status: 'signed-in' } : { status: 'confirmation-required' };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    // A already-expired session cannot be revoked server-side, but the local
    // tokens are gone either way — treat that as success rather than trapping
    // the user in the app.
    if (error && error.status !== 401 && error.status !== 403) throw error;
    setSession(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signIn,
      signUp,
      signOut,
    }),
    [session, initializing, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

/**
 * For screens that only render behind the auth gate. Throwing here converts a
 * would-be `user!.id` non-null assertion into a real runtime guarantee.
 */
export function useRequireUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('This screen requires an authenticated user');
  return user;
}
