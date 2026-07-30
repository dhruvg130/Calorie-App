import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  WhoopCancelled,
  connectWhoop,
  disconnectWhoop,
  fetchWhoopConnection,
  fetchWhoopDays,
  isWhoopConfigured,
  syncWhoop,
  type WhoopDay,
} from '@/api/whoop';

/** Scoped by user id, like every other key here, so a second account sees none of it. */
export const whoopKeys = {
  connection: (userId: string) => ['whoop', 'connection', userId] as const,
  days: (userId: string) => ['whoop', 'days', userId] as const,
};

export function useWhoopConnection(userId: string) {
  return useQuery({
    queryKey: whoopKeys.connection(userId),
    queryFn: fetchWhoopConnection,
    // Pointless to ask when the build has no client ID — the connect button is
    // not offered, so there can be nothing to report.
    enabled: isWhoopConfigured,
    staleTime: 60_000,
  });
}

export function useWhoopDays(userId: string, enabled = true) {
  return useQuery({
    queryKey: whoopKeys.days(userId),
    queryFn: () => fetchWhoopDays(90),
    enabled: isWhoopConfigured && enabled,
    staleTime: 60_000,
  });
}

function invalidateWhoop(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  void queryClient.invalidateQueries({ queryKey: whoopKeys.connection(userId) });
  void queryClient.invalidateQueries({ queryKey: whoopKeys.days(userId) });
}

/**
 * Connect, then immediately pull recent history.
 *
 * Syncing as part of connecting matters: a connection that shows nothing until
 * some later refresh reads as broken. The sync failing does not fail the
 * connection, though — the tokens are stored either way, and a retry is one tap.
 */
export function useConnectWhoop(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await connectWhoop();
      try {
        await syncWhoop(30);
      } catch {
        // Swallowed on purpose; see above.
      }
    },
    onSuccess: () => invalidateWhoop(queryClient, userId),
  });
}

export function useSyncWhoop(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (days?: number) => syncWhoop(days ?? 14),
    onSuccess: () => invalidateWhoop(queryClient, userId),
  });
}

export function useDisconnectWhoop(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: disconnectWhoop,
    onSuccess: () => invalidateWhoop(queryClient, userId),
  });
}

/** Backing out of the WHOOP browser sheet is not an error worth showing. */
export const isWhoopCancellation = (error: unknown): boolean =>
  error instanceof WhoopCancelled;

/** The synced metrics for one local day key, or undefined if that day has none. */
export function useWhoopDay(days: WhoopDay[] | undefined, dayKey: string): WhoopDay | undefined {
  return useMemo(() => days?.find((day) => day.day === dayKey), [days, dayKey]);
}
