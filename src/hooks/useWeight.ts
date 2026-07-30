import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  deleteWeight,
  fetchWeightEntries,
  saveWeight,
  weightTrend,
  type WeightEntry,
} from '@/api/weight';
import type { WeightUnit } from '@/lib/database.types';

/** Scoped by user id, like entries, so a second account cannot read cached rows. */
export const weightKeys = {
  all: (userId: string) => ['weight', userId] as const,
};

export function useWeightEntries(userId: string) {
  return useQuery({
    queryKey: weightKeys.all(userId),
    queryFn: () => fetchWeightEntries(90),
    staleTime: 60_000,
  });
}

export function useSaveWeight(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      value,
      unit,
      recordedOn,
    }: {
      value: number;
      unit: WeightUnit;
      recordedOn: string;
    }) => saveWeight(value, unit, recordedOn),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: weightKeys.all(userId) });
    },
  });
}

export function useDeleteWeight(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWeight(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: weightKeys.all(userId) });
    },
  });
}

export function useWeightTrend(entries: WeightEntry[] | undefined) {
  return useMemo(() => weightTrend(entries ?? []), [entries]);
}
