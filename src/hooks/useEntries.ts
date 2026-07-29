import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  createEntry,
  deleteEntry,
  fetchDayTotals,
  fetchEntriesForDay,
  fetchEntry,
  updateEntry,
  type DayTotals,
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
  // Nested under the same prefix as everything else, so the existing
  // invalidateQueries({ queryKey: all(userId) }) in every mutation refreshes
  // the calendar rings too — no separate bookkeeping to forget.
  totals: (userId: string, fromKey: string, toKey: string) =>
    ['entries', userId, 'totals', fromKey, toKey] as const,
};

export function useEntriesForDay(userId: string, date: Date = new Date()) {
  const dayKey = localDayKey(date);

  return useQuery({
    queryKey: entryKeys.day(userId, dayKey),
    queryFn: () => fetchEntriesForDay(date),
  });
}

/**
 * Calories per day across the calendar's visible range, for the goal rings.
 *
 * Keyed on the first and last visible day so paging to another week or month
 * fetches once and is then served from cache on the way back.
 */
export function useDayTotalsForDays(userId: string, days: Date[]) {
  const fromKey = days.length ? localDayKey(days[0]!) : '';
  const toKey = days.length ? localDayKey(days[days.length - 1]!) : '';

  return useQuery<DayTotals>({
    queryKey: entryKeys.totals(userId, fromKey, toKey),
    queryFn: () => fetchDayTotals(days),
    enabled: days.length > 0,
    // Rings are ambient context, not the headline number — a slightly stale
    // ring is fine, and mutations invalidate this key anyway.
    staleTime: 60_000,
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
    const rows = entries ?? [];
    const consumed = rows.reduce((sum, entry) => sum + entry.totalCalories, 0);
    const remaining = goal - consumed;

    // Macros are per serving in the row, so scale by the serving multiplier —
    // the same arithmetic Postgres applies to produce total_calories. Entries
    // whose source reported no macros contribute nothing rather than zero.
    const macros = rows.reduce(
      (acc, entry) => ({
        proteinG: acc.proteinG + (entry.proteinG ?? 0) * entry.servingQuantity,
        carbsG: acc.carbsG + (entry.carbsG ?? 0) * entry.servingQuantity,
        fatG: acc.fatG + (entry.fatG ?? 0) * entry.servingQuantity,
      }),
      { proteinG: 0, carbsG: 0, fatG: 0 },
    );

    return {
      consumed: Math.round(consumed),
      remaining: Math.round(remaining),
      // Guard against a zero/negative goal producing Infinity or NaN in the bar.
      progress: goal > 0 ? consumed / goal : 0,
      isOver: consumed > goal,
      macros,
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
