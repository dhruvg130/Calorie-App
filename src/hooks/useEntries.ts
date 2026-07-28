import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  createEntry,
  deleteEntry,
  fetchEntriesForDay,
  fetchEntry,
  updateEntry,
  type FoodEntry,
  type UpdateEntryInput,
} from '@/api/entries';
import { localDayKey } from '@/lib/date';
import type { FoodEntryInput } from '@/lib/validation';

/**
 * Query keys are scoped by user id so a second account signing in on the same
 * device can never read the previous account's cached rows. The cache is also
 * cleared on sign-out; this is the belt to that braces.
 */
export const entryKeys = {
  all: (userId: string) => ['entries', userId] as const,
  day: (userId: string, dayKey: string) => ['entries', userId, dayKey] as const,
  detail: (userId: string, id: string) => ['entries', userId, 'detail', id] as const,
};

export function useEntriesForDay(userId: string, date: Date = new Date()) {
  const dayKey = localDayKey(date);

  return useQuery({
    queryKey: entryKeys.day(userId, dayKey),
    queryFn: () => fetchEntriesForDay(date),
  });
}

export function useEntry(userId: string, id: string) {
  return useQuery({
    queryKey: entryKeys.detail(userId, id),
    queryFn: () => fetchEntry(id),
    enabled: id.length > 0,
  });
}

/** Totals derived from the day's rows — never stored, so they cannot drift. */
export function useDayTotals(entries: FoodEntry[] | undefined, goal: number) {
  return useMemo(() => {
    const consumed = (entries ?? []).reduce((sum, entry) => sum + entry.totalCalories, 0);
    const remaining = goal - consumed;

    return {
      consumed: Math.round(consumed),
      remaining: Math.round(remaining),
      // Guard against a zero/negative goal producing Infinity or NaN in the bar.
      progress: goal > 0 ? consumed / goal : 0,
      isOver: consumed > goal,
    };
  }, [entries, goal]);
}

export function useCreateEntry(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: FoodEntryInput & { imagePath?: string | null }) => createEntry(input),
    onSuccess: () => {
      // Invalidate the whole user subtree rather than one day: an entry can be
      // logged with a back-dated `consumedAt`, which belongs to another day.
      void queryClient.invalidateQueries({ queryKey: entryKeys.all(userId) });
    },
  });
}

export function useUpdateEntry(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEntryInput }) =>
      updateEntry(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entryKeys.all(userId) });
    },
  });
}

export function useDeleteEntry(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteEntry(id),

    // Optimistic removal so the row and the totals update instantly.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: entryKeys.all(userId) });
      const snapshot = queryClient.getQueriesData<FoodEntry[]>({
        queryKey: entryKeys.all(userId),
      });

      queryClient.setQueriesData<FoodEntry[]>({ queryKey: entryKeys.all(userId) }, (current) =>
        Array.isArray(current) ? current.filter((entry) => entry.id !== id) : current,
      );

      return { snapshot };
    },

    onError: (_error, _id, context) => {
      // Put the row back if the delete failed, so the UI never claims success
      // the database did not agree to.
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: entryKeys.all(userId) });
    },
  });
}
