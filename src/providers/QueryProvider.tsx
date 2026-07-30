import { AuthError } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useEffect, useMemo, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Retrying a 401/403 is pointless — the session is bad, not the network — and
 * it delays the sign-out redirect while burning requests. Everything else gets
 * two retries with backoff.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof AuthError) return false;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === '42501' || code.startsWith('PGRST3')) return false;
  }
  return failureCount < 2;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Calorie data changes only when the user acts, and every mutation
        // invalidates explicitly, so a short stale window avoids refetch churn
        // while keeping totals correct.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const client = useMemo(createQueryClient, []);

  // React Query's focus detection is web-oriented; wire it to AppState so
  // returning from the background refreshes today's totals.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
