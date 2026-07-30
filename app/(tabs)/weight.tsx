import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { fromKg, toKg, type WeightEntry } from '@/api/weight';
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
import { localDayKey } from '@/lib/date';
import { toUserMessage } from '@/lib/errors';
import { parseNumericInput } from '@/lib/validation';
import { useRequireUser } from '@/providers/AuthProvider';
import type { WeightUnit } from '@/lib/database.types';
import { colors, radius, spacing } from '@/theme';

export default function WeightScreen() {
  const user = useRequireUser();
  const { weightUnit } = useProfile(user.id);
  const updateUnit = useUpdateWeightUnit(user.id);

  const entriesQuery = useWeightEntries(user.id);
  const saveWeight = useSaveWeight(user.id);
  const deleteWeight = useDeleteWeight(user.id);
  const trend = useWeightTrend(entriesQuery.data);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<WeightEntry | null>(null);

  const format = (kg: number) => `${fromKg(kg, weightUnit).toFixed(1)} ${weightUnit}`;

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
      await saveWeight.mutateAsync({
        value,
        unit: weightUnit,
        recordedOn: localDayKey(new Date()),
      });
      setInput('');
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
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => setPendingDelete(item)}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={`${format(item.weightKg)} on ${item.recordedOn}. Long press to delete.`}
          >
            <Text variant="bodyMedium">{format(item.weightKg)}</Text>
            <Text variant="caption" color="tertiary">
              {new Date(`${item.recordedOn}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </Pressable>
        )}
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
                label={`Today's weight (${weightUnit})`}
                value={input}
                onChangeText={setInput}
                keyboardType="decimal-pad"
                placeholder={weightUnit === 'kg' ? '75.0' : '165.0'}
                returnKeyType="done"
                onSubmitEditing={() => void handleSave()}
                error={error ?? undefined}
              />
              <Button
                label="Save weight"
                onPress={() => void handleSave()}
                loading={saveWeight.isPending}
              />
              <Text variant="caption" color="tertiary" style={styles.hint}>
                One weigh-in per day. Saving again replaces today&apos;s.
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
            ? `Remove the ${format(pendingDelete.weightKg)} entry from ${pendingDelete.recordedOn}?`
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
  },
  separator: {
    height: spacing.sm,
  },
  padded: {
    paddingTop: spacing.lg,
  },
});
