import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import type { FoodEntry } from '@/api/entries';
import { CalorieSummaryCard } from '@/components/CalorieSummaryCard';
import { FoodEntryRow } from '@/components/FoodEntryRow';
import { GoalEditSheet } from '@/components/GoalEditSheet';
import { Button, EmptyState, EntryListSkeleton, ErrorState, Screen, Text } from '@/components/ui';
import { formatDayHeading } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { useDayTotals, useEntriesForDay } from '@/hooks/useEntries';
import { useProfile, useUpdateDailyGoal } from '@/hooks/useProfile';
import { useAuth, useRequireUser } from '@/providers/AuthProvider';
import { colors, spacing } from '@/theme';

export default function HomeScreen() {
  const user = useRequireUser();
  const { signOut } = useAuth();
  const router = useRouter();

  const [goalSheetOpen, setGoalSheetOpen] = useState(false);

  const entriesQuery = useEntriesForDay(user.id);
  const { dailyGoal, isLoading: profileLoading } = useProfile(user.id);
  const updateGoal = useUpdateDailyGoal(user.id);

  const totals = useDayTotals(entriesQuery.data, dailyGoal);

  const handleSaveGoal = useCallback(
    async (goal: number) => {
      await updateGoal.mutateAsync(goal);
    },
    [updateGoal],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out', 'You will need to sign in again to see your entries.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut().catch((error: unknown) => {
            Alert.alert('Could not sign out', toUserMessage(error));
          });
        },
      },
    ]);
  }, [signOut]);

  const openEntry = useCallback(
    (entry: FoodEntry) => router.push(`/entry/${entry.id}`),
    [router],
  );

  const loading = entriesQuery.isPending || profileLoading;

  return (
    <Screen padded={false} edges={{ bottom: false }}>
      <FlatList
        data={entriesQuery.data ?? []}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <FoodEntryRow entry={item} onPress={openEntry} />}
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
                  {formatDayHeading()}
                </Text>
                <Text variant="title">Today</Text>
              </View>

              <Pressable
                onPress={handleSignOut}
                hitSlop={10}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
              >
                <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <CalorieSummaryCard
              consumed={totals.consumed}
              goal={dailyGoal}
              remaining={totals.remaining}
              progress={totals.progress}
              isOver={totals.isOver}
              onEditGoal={() => setGoalSheetOpen(true)}
            />

            <Text variant="overline" color="secondary" style={styles.sectionLabel}>
              {entriesQuery.data?.length ? `${entriesQuery.data.length} logged` : 'Logged today'}
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
              title="Nothing logged yet"
              description="Add your first meal and it will show up here with a running total."
              action={<Button label="Add food" onPress={() => router.push('/add')} />}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  separator: {
    height: spacing.sm,
  },
  stateWrapper: {
    paddingTop: spacing.sm,
  },
});
