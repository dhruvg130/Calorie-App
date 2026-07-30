import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { earnedCalories, isWhoopConfigured } from '@/api/whoop';
import { CombinedTrendChart } from '@/components/CombinedTrendChart';
import { DayStepper } from '@/components/DayStepper';
import { RecoveryGuidanceCard } from '@/components/RecoveryGuidanceCard';
import { WhoopCard } from '@/components/WhoopCard';
import { Card, EmptyState, ErrorState, EntryListSkeleton, Screen, Text } from '@/components/ui';
import { useProfile } from '@/hooks/useProfile';
import { useDayTotalsForDays } from '@/hooks/useEntries';
import { useWeightEntries } from '@/hooks/useWeight';
import { useWhoopConnection, useWhoopDay, useWhoopDays } from '@/hooks/useWhoop';
import { addDays, formatCompactDay, localDayKey } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { useDaySelection, useSelectedDay } from '@/providers/SelectedDayProvider';
import { useRequireUser } from '@/providers/AuthProvider';
import { spacing } from '@/theme';

/** Long enough for a pattern to show, short enough to stay legible at 320pt. */
const CHART_DAYS = 30;

/**
 * WHOOP's own screen.
 *
 * It earned one: recovery, strain, sleep and the guidance that comes off them
 * are a different question from "what did I eat", and squeezing them onto the
 * Weight tab pushed that tab's actual job below the fold.
 *
 * The day selection is its own, seeded from the shared day and then
 * independent — the same arrangement the Weight tab uses, for the same reason.
 */
export default function WhoopScreen() {
  const user = useRequireUser();
  const { dailyGoal, weightUnit } = useProfile(user.id);

  const { selectedDay: sharedDay } = useSelectedDay();
  const { selectedDay, setSelectedDay, isViewingToday, resetToToday } = useDaySelection(sharedDay);
  const dayKey = localDayKey(selectedDay);

  const connectionQuery = useWhoopConnection(user.id);
  const daysQuery = useWhoopDays(user.id);
  const day = useWhoopDay(daysQuery.data, dayKey);

  const connected = Boolean(connectionQuery.data) && !connectionQuery.data?.needsReauth;
  const earned = earnedCalories(day);

  // The chart's window. Memoised because `useDayTotalsForDays` keys its query on
  // these dates — a fresh array every render would refetch on every render.
  const chartDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: CHART_DAYS }, (_, i) => addDays(today, -(CHART_DAYS - 1 - i)));
  }, []);

  const weightQuery = useWeightEntries(user.id);
  const totalsQuery = useDayTotalsForDays(user.id, chartDays);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="title">WHOOP</Text>

        {!isWhoopConfigured ? (
          <EmptyState
            icon="pulse-outline"
            title="WHOOP is not set up"
            description="This build has no WHOOP client ID, so the connection cannot be offered."
          />
        ) : (
          <>
            {/* Connection state, and the connect/disconnect controls. */}
            <WhoopCard userId={user.id} day={day} isToday={isViewingToday} />

            {connected ? (
              <>
                <DayStepper date={selectedDay} onChange={setSelectedDay} onToday={resetToToday} />

                {daysQuery.isPending ? (
                  <EntryListSkeleton rows={2} />
                ) : daysQuery.isError ? (
                  <ErrorState
                    message={toUserMessage(daysQuery.error)}
                    onRetry={() => void daysQuery.refetch()}
                  />
                ) : day?.recoveryScore !== null && day?.recoveryScore !== undefined ? (
                  <>
                    <RecoveryGuidanceCard
                      recoveryScore={day.recoveryScore}
                      dailyGoal={dailyGoal}
                    />

                    <Card style={styles.detailCard}>
                      <Text variant="overline" color="secondary">
                        {formatCompactDay(selectedDay)}
                      </Text>

                      <View style={styles.grid}>
                        <Detail label="Strain" value={day.strain?.toFixed(1) ?? '—'} />
                        <Detail
                          label="Sleep"
                          value={
                            day.sleepDurationMin !== null
                              ? `${Math.floor(day.sleepDurationMin / 60)}h ${day.sleepDurationMin % 60}m`
                              : '—'
                          }
                        />
                        <Detail
                          label="Sleep quality"
                          value={day.sleepPerformance !== null ? `${day.sleepPerformance}%` : '—'}
                        />
                        <Detail
                          label="Resting HR"
                          value={day.restingHr !== null ? `${day.restingHr} bpm` : '—'}
                        />
                        <Detail
                          label="HRV"
                          value={day.hrvMs !== null ? `${Math.round(day.hrvMs)} ms` : '—'}
                        />
                        <Detail
                          label="Burned"
                          value={earned > 0 ? `${earned.toLocaleString()} cal` : '—'}
                        />
                      </View>
                    </Card>

                    <CombinedTrendChart
                      weightEntries={weightQuery.data}
                      whoopDays={daysQuery.data}
                      calorieTotals={totalsQuery.data}
                      unit={weightUnit}
                      days={CHART_DAYS}
                    />
                  </>
                ) : (
                  <EmptyState
                    icon="moon-outline"
                    title={isViewingToday ? 'Today is not scored yet' : 'No data for this day'}
                    description={
                      isViewingToday
                        ? 'WHOOP scores recovery after you wake up. Step back a day to see the last one.'
                        : 'WHOOP has no recovery score recorded for this day.'
                    }
                  />
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  detailCard: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  detail: {
    // Two per row, which keeps the labels readable on a narrow phone.
    width: '50%',
    gap: 2,
  },
});
