import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import type { FoodEntry } from '@/api/entries';
import type { MealType } from '@/lib/database.types';
import { CalendarStrip } from '@/components/CalendarStrip';
import { MEAL_LABELS, MEAL_TYPES } from '@/components/MealTypePicker';
import { CalorieSummaryCard } from '@/components/CalorieSummaryCard';
import { FoodEntryRow } from '@/components/FoodEntryRow';
import { GoalEditSheet } from '@/components/GoalEditSheet';
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  EntryListSkeleton,
  ErrorState,
  Screen,
  Text,
} from '@/components/ui';
import { formatRelativeDay, isToday } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { useDayTotals, useDayTotalsForDays, useEntriesForDay } from '@/hooks/useEntries';
import { useProfile, useUpdateDailyGoal } from '@/hooks/useProfile';
import { useAuth, useRequireUser } from '@/providers/AuthProvider';
import { useSelectedDay } from '@/providers/SelectedDayProvider';
import { colors, spacing } from '@/theme';

export default function HomeScreen() {
  const user = useRequireUser();
  const { signOut } = useAuth();
  const router = useRouter();

  const { selectedDay: selectedDate, setSelectedDay: setSelectedDate, isViewingToday, resetToToday } =
    useSelectedDay();
  const [visibleDays, setVisibleDays] = useState<Date[]>([]);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const entriesQuery = useEntriesForDay(user.id, selectedDate);
  const { dailyGoal, isLoading: profileLoading } = useProfile(user.id);
  const updateGoal = useUpdateDailyGoal(user.id);

  const totals = useDayTotals(entriesQuery.data, dailyGoal);

  /**
   * Meal sections flattened into one list, so the existing FlatList keeps its
   * virtualisation rather than becoming a ScrollView of sub-lists.
   *
   * Entries logged before meal grouping existed have no meal_type; they fall
   * into a trailing "Other" group rather than being hidden or guessed at.
   */
  const listData = useMemo(() => {
    const entries = entriesQuery.data ?? [];
    if (entries.length === 0) return [];

    const rows: ({ kind: 'header'; key: string; label: string; calories: number }
      | { kind: 'entry'; key: string; entry: FoodEntry })[] = [];

    const groups = new Map<MealType | 'other', FoodEntry[]>();
    for (const entry of entries) {
      const key = (entry.mealType ?? 'other') as MealType | 'other';
      const bucket = groups.get(key);
      if (bucket) bucket.push(entry);
      else groups.set(key, [entry]);
    }

    const order: (MealType | 'other')[] = [...MEAL_TYPES, 'other'];
    for (const meal of order) {
      const bucket = groups.get(meal);
      if (!bucket || bucket.length === 0) continue;
      const calories = bucket.reduce((sum, e) => sum + e.totalCalories, 0);
      rows.push({
        kind: 'header',
        key: `h-${meal}`,
        label: meal === 'other' ? 'Other' : MEAL_LABELS[meal],
        calories: Math.round(calories),
      });
      for (const entry of bucket) rows.push({ kind: 'entry', key: entry.id, entry });
    }

    return rows;
  }, [entriesQuery.data]);
  const dayTotalsQuery = useDayTotalsForDays(user.id, visibleDays);

  const handleSaveGoal = useCallback(
    async (goal: number) => {
      await updateGoal.mutateAsync(goal);
    },
    [updateGoal],
  );

  const confirmSignOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
      // No navigation needed: clearing the session flips the Stack.Protected
      // guard in the root layout, which unmounts every authenticated route.
    } catch (error: unknown) {
      setSignOutError(toUserMessage(error));
      setSignOutOpen(false);
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const openEntry = useCallback(
    (entry: FoodEntry) => router.push(`/entry/${entry.id}`),
    [router],
  );

  const loading = entriesQuery.isPending || profileLoading;

  return (
    <Screen padded={false} edges={{ bottom: false }}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <View style={styles.mealHeader}>
              <Text variant="captionMedium" color="secondary">
                {item.label}
              </Text>
              <Text variant="caption" color="tertiary">
                {item.calories.toLocaleString()} cal
              </Text>
            </View>
          ) : (
            <FoodEntryRow entry={item.entry} onPress={openEntry} />
          )
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={entriesQuery.isRefetching && !entriesQuery.isPending}
            onRefresh={() => void entriesQuery.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.titleText}>
                <Text variant="caption" color="tertiary">
                  {isViewingToday
                    ? selectedDate.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Viewing'}
                </Text>
                <Text variant="title">{formatRelativeDay(selectedDate)}</Text>
              </View>

              <Pressable
                onPress={() => setSignOutOpen(true)}
                hitSlop={10}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {signOutError ? <Banner message={signOutError} /> : null}

            <CalendarStrip
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              totals={dayTotalsQuery.data ?? {}}
              dailyGoal={dailyGoal}
              onVisibleDaysChange={setVisibleDays}
            />

            <CalorieSummaryCard
              consumed={totals.consumed}
              goal={dailyGoal}
              remaining={totals.remaining}
              progress={totals.progress}
              isOver={totals.isOver}
              macros={totals.macros}
              onEditGoal={() => setGoalSheetOpen(true)}
            />

            <Text variant="overline" color="secondary" style={styles.sectionLabel}>
              {entriesQuery.data?.length
                ? `${entriesQuery.data.length} logged`
                : isViewingToday
                  ? 'Logged today'
                  : 'Logged this day'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.stateWrapper}>
              <EntryListSkeleton />
            </View>
          ) : entriesQuery.isError ? (
            <ErrorState
              message={toUserMessage(entriesQuery.error)}
              onRetry={() => void entriesQuery.refetch()}
            />
          ) : (
            <EmptyState
              icon="restaurant-outline"
              title={isViewingToday ? 'Nothing logged yet' : 'Nothing logged that day'}
              description={
                isViewingToday
                  ? 'Add your first meal and it will show up here with a running total.'
                  : 'Nothing was logged on this day. You can still add something to it.'
              }
              action={
                <View style={styles.emptyActions}>
                  <Button label="Add food" onPress={() => router.push('/add')} />
                  {isViewingToday ? null : (
                    <Button label="Back to today" variant="secondary" onPress={resetToToday} />
                  )}
                </View>
              }
            />
          )
        }
      />

      <GoalEditSheet
        visible={goalSheetOpen}
        currentGoal={dailyGoal}
        saving={updateGoal.isPending}
        onDismiss={() => setGoalSheetOpen(false)}
        onSave={handleSaveGoal}
      />

      <ConfirmDialog
        visible={signOutOpen}
        title="Sign out"
        message="You will need to sign in again to see your entries."
        confirmLabel="Sign out"
        destructive
        loading={signingOut}
        onConfirm={() => void confirmSignOut()}
        onCancel={() => setSignOutOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyActions: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  header: {
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleText: {
    gap: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    marginTop: spacing.sm,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  separator: {
    height: spacing.sm,
  },
  stateWrapper: {
    paddingTop: spacing.sm,
  },
});
