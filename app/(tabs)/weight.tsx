import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { fromKg, toKg, type WeightEntry } from '@/api/weight';
import { DayStepper } from '@/components/DayStepper';
import { WeightChart } from '@/components/WeightChart';
import {
  Banner,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  EntryListSkeleton,
  ErrorState,
  Input,
  Screen,
  Text,
} from '@/components/ui';
import { useDeleteWeight, useSaveWeight, useWeightEntries, useWeightTrend } from '@/hooks/useWeight';
import { useProfile, useUpdateWeightUnit } from '@/hooks/useProfile';
import { dayKeyToDate, formatCompactDay, localDayKey } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { parseNumericInput } from '@/lib/validation';
import { useRequireUser } from '@/providers/AuthProvider';
import { useDaySelection, useSelectedDay } from '@/providers/SelectedDayProvider';
import type { WeightUnit } from '@/lib/database.types';
import { colors, radius, spacing } from '@/theme';

export default function WeightScreen() {
  const user = useRequireUser();
  const { weightUnit, isLoading: profileLoading } = useProfile(user.id);
  const updateUnit = useUpdateWeightUnit(user.id);

  const entriesQuery = useWeightEntries(user.id);
  const saveWeight = useSaveWeight(user.id);
  const deleteWeight = useDeleteWeight(user.id);
  const trend = useWeightTrend(entriesQuery.data);

  // Seeded from the day Home is on, then independent of it — see useDaySelection.
  const { selectedDay: homeDay } = useSelectedDay();
  const { selectedDay, setSelectedDay, isViewingToday, resetToToday } = useDaySelection(homeDay);
  const dayKey = localDayKey(selectedDay);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WeightEntry | null>(null);

  const format = (kg: number) => `${fromKg(kg, weightUnit).toFixed(1)} ${weightUnit}`;

  const entryForDay = useMemo(
    () => (entriesQuery.data ?? []).find((entry) => entry.recordedOn === dayKey) ?? null,
    [entriesQuery.data, dayKey],
  );

  /**
   * The field always shows what is stored for the selected day, so stepping
   * onto a day you have already weighed puts you straight into editing it
   * rather than facing a blank box.
   *
   * Guarded by a signature rather than a plain dependency list: a unit switch
   * must not re-run this, because `handleUnitChange` has already converted
   * whatever the user typed and re-syncing here would throw that away.
   *
   * Held back until the profile resolves, because `weightUnit` reads as the
   * default until then. Filling 165.0 in under a "kg" label is not just untidy
   * — save it and 165 kg is what gets stored.
   */
  const signature = `${dayKey}:${entryForDay?.id ?? ''}:${entryForDay?.weightKg ?? ''}`;
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (profileLoading || syncedRef.current === signature) return;
    syncedRef.current = signature;
    setInput(entryForDay ? fromKg(entryForDay.weightKg, weightUnit).toFixed(1) : '');
    setError(null);
  }, [profileLoading, signature, entryForDay, weightUnit]);

  /**
   * Switching units converts whatever is already typed rather than clearing it.
   * Stored weights are unaffected — they are kilograms either way, so this is
   * purely a display preference.
   */
  const handleUnitChange = async (next: WeightUnit) => {
    if (next === weightUnit) return;

    const typed = parseNumericInput(input);
    if (typed !== null && typed > 0) {
      setInput(fromKg(toKg(typed, weightUnit), next).toFixed(1));
    }

    setError(null);
    try {
      await updateUnit.mutateAsync(next);
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  const handleSave = async () => {
    const value = parseNumericInput(input);
    if (value === null || value <= 0) {
      setError('Enter a weight.');
      return;
    }

    setError(null);
    try {
      await saveWeight.mutateAsync({ value, unit: weightUnit, recordedOn: dayKey });
      // Left in place rather than cleared: the field is now showing the day's
      // stored weight, which is exactly what was just saved.
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteWeight.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch (caught) {
      setPendingDelete(null);
      setError(toUserMessage(caught));
    }
  };

  const change = trend.changeKg;

  return (
    <Screen padded={false}>
      <FlatList
        data={entriesQuery.data ?? []}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const day = dayKeyToDate(item.recordedOn);
          const selected = item.recordedOn === dayKey;

          return (
            <Pressable
              onPress={() => setSelectedDay(day)}
              onLongPress={() => setPendingDelete(item)}
              style={[styles.row, selected && styles.rowSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${format(item.weightKg)} on ${formatCompactDay(day)}`}
              accessibilityHint="Opens this day for editing. Long press to delete."
            >
              <Text variant="bodyMedium">{format(item.weightKg)}</Text>
              <Text variant="caption" color={selected ? 'primary' : 'tertiary'}>
                {formatCompactDay(day)}
              </Text>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text variant="title">Weight</Text>

              <View style={styles.unitToggle}>
                {(['lb', 'kg'] as WeightUnit[]).map((unit) => {
                  const active = weightUnit === unit;
                  return (
                    <Pressable
                      key={unit}
                      onPress={() => void handleUnitChange(unit)}
                      disabled={updateUnit.isPending}
                      style={[styles.unitOption, active && styles.unitOptionActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Show weights in ${unit === 'lb' ? 'pounds' : 'kilograms'}`}
                    >
                      <Text variant="captionMedium" color={active ? 'inverse' : 'secondary'}>
                        {unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <DayStepper date={selectedDay} onChange={setSelectedDay} onToday={resetToToday} />

            <Card elevation="md" style={styles.summary}>
              <Text variant="overline" color="secondary">
                Latest
              </Text>
              <Text variant="display">
                {trend.latest ? format(trend.latest.weightKg) : '—'}
              </Text>

              {change !== null ? (
                <View style={styles.changeRow}>
                  <Ionicons
                    name={change > 0 ? 'trending-up' : change < 0 ? 'trending-down' : 'remove'}
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text variant="caption" color="secondary">
                    {change > 0 ? '+' : ''}
                    {fromKg(Math.abs(change), weightUnit).toFixed(1)} {weightUnit} over{' '}
                    {(entriesQuery.data ?? []).length} weigh-ins
                  </Text>
                </View>
              ) : (
                <Text variant="caption" color="tertiary">
                  Log twice to see a trend.
                </Text>
              )}
            </Card>

            {entriesQuery.data ? (
              <WeightChart entries={entriesQuery.data} unit={weightUnit} />
            ) : null}

            <Card style={styles.entryCard}>
              <Input
                label={
                  isViewingToday
                    ? `Today's weight (${weightUnit})`
                    : `Weight for ${formatCompactDay(selectedDay)} (${weightUnit})`
                }
                value={input}
                onChangeText={setInput}
                keyboardType="decimal-pad"
                placeholder={weightUnit === 'kg' ? '75.0' : '165.0'}
                returnKeyType="done"
                onSubmitEditing={() => void handleSave()}
                error={error ?? undefined}
              />
              <Button
                label={entryForDay ? 'Update weight' : 'Save weight'}
                onPress={() => void handleSave()}
                loading={saveWeight.isPending}
              />
              <Text variant="caption" color="tertiary" style={styles.hint}>
                {entryForDay
                  ? `Replaces the ${format(entryForDay.weightKg)} already logged for this day.`
                  : 'One weigh-in per day. Pick a past day above to fill one in.'}
              </Text>
            </Card>

            {(entriesQuery.data ?? []).length > 1 ? (
              <Banner
                tone="info"
                message="Daily weight swings with water and food in transit. Judge progress by the direction over weeks, not day to day."
              />
            ) : null}

            {(entriesQuery.data ?? []).length > 0 ? (
              <Text variant="overline" color="secondary" style={styles.historyLabel}>
                History
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          entriesQuery.isPending ? (
            <View style={styles.padded}>
              <EntryListSkeleton rows={3} />
            </View>
          ) : entriesQuery.isError ? (
            <ErrorState
              message={toUserMessage(entriesQuery.error)}
              onRetry={() => void entriesQuery.refetch()}
            />
          ) : (
            <EmptyState
              icon="analytics-outline"
              title="No weigh-ins yet"
              description="Log your weight above and a trend will build up over time."
            />
          )
        }
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete weigh-in"
        message={
          pendingDelete
            ? `Remove the ${format(pendingDelete.weightKg)} entry from ${formatCompactDay(
                dayKeyToDate(pendingDelete.recordedOn),
              )}?`
            : ''
        }
        confirmLabel="Delete"
        destructive
        loading={deleteWeight.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    padding: 3,
  },
  unitOption: {
    minWidth: 44,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitOptionActive: {
    backgroundColor: colors.primary,
  },
  summary: {
    gap: spacing.xs,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  entryCard: {
    gap: spacing.md,
  },
  hint: {
    textAlign: 'center',
  },
  historyLabel: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // Transparent rather than absent so selecting a row does not resize it.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  separator: {
    height: spacing.sm,
  },
  padded: {
    paddingTop: spacing.lg,
  },
});
