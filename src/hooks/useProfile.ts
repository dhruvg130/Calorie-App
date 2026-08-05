import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { WeightUnit } from '@/lib/database.types';

import {
  DEFAULT_DAILY_GOAL,
  DEFAULT_WEIGHT_UNIT,
  fetchProfile,
  updateDailyGoal,
  updateProteinGoal,
  updateWeightUnit,
  type Profile,
} from '@/api/profile';

export const profileKeys = {
  detail: (userId: string) => ['profile', userId] as const,
};

export function useProfile(userId: string) {
  const query = useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => fetchProfile(userId),
    // The goal changes rarely; refetching it on every focus is wasted traffic.
    staleTime: 5 * 60_000,
  });

  return {
    ...query,
    // Home should render immediately with a sensible target rather than
    // showing a blank goal while the profile is in flight.
    dailyGoal: query.data?.dailyCalorieGoal ?? DEFAULT_DAILY_GOAL,
    // No default: null means "no custom goal", which is what makes the derived
    // bodyweight target the fallback rather than a number invented here.
    proteinGoal: query.data?.dailyProteinGoal ?? null,
    weightUnit: query.data?.weightUnit ?? DEFAULT_WEIGHT_UNIT,
  };
}

export function useUpdateDailyGoal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goal: number) => updateDailyGoal(userId, goal),
    onSuccess: (profile: Profile) => {
      queryClient.setQueryData(profileKeys.detail(userId), profile);
    },
  });
}

/** `null` clears the custom goal and hands the target back to the bodyweight
 *  calculation. */
export function useUpdateProteinGoal(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goal: number | null) => updateProteinGoal(userId, goal),
    onSuccess: (profile: Profile) => {
      queryClient.setQueryData(profileKeys.detail(userId), profile);
    },
  });
}

export function useUpdateWeightUnit(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unit: WeightUnit) => updateWeightUnit(userId, unit),
    // Write straight into the cache rather than invalidating: the unit drives
    // every number on the screen, and a refetch round-trip would show the old
    // unit for a beat after the tap.
    onSuccess: (profile: Profile) => {
      queryClient.setQueryData(profileKeys.detail(userId), profile);
    },
  });
}
