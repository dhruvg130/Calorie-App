import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { addDays, formatCompactDay, isFutureDay, isToday } from '@/lib/date';
import { colors, radius, spacing } from '@/theme';

type DayStepperProps = {
  date: Date;
  onChange: (date: Date) => void;
  onToday: () => void;
};

/**
 * One-line day picker: back, the day itself, forward, and a jump home.
 *
 * Deliberately not the Home tab's CalendarStrip. This sits above a summary
 * card, a chart, an input and a history list, and an expanded month grid would
 * push the input the screen exists for below the fold. Reaching a specific
 * far-back day is what the tappable history rows are for.
 */
export function DayStepper({ date, onChange, onToday }: DayStepperProps) {
  const viewingToday = isToday(date);
  // Nothing has been weighed tomorrow.
  const nextDisabled = isFutureDay(addDays(date, 1));

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onChange(addDays(date, -1))}
        hitSlop={8}
        style={styles.arrow}
        accessibilityRole="button"
        accessibilityLabel="Previous day"
      >
        <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
      </Pressable>

      <Text variant="bodyMedium" style={styles.label} numberOfLines={1}>
        {formatCompactDay(date)}
      </Text>

      <Pressable
        onPress={() => onChange(addDays(date, 1))}
        disabled={nextDisabled}
        hitSlop={8}
        style={styles.arrow}
        accessibilityRole="button"
        accessibilityState={{ disabled: nextDisabled }}
        accessibilityLabel="Next day"
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={nextDisabled ? colors.border : colors.textSecondary}
        />
      </Pressable>

      {/* Held in the layout rather than unmounted, so the date does not shift
          sideways as you step on and off today. */}
      <Pressable
        onPress={onToday}
        disabled={viewingToday}
        hitSlop={8}
        style={[styles.today, viewingToday && styles.todayHidden]}
        accessibilityElementsHidden={viewingToday}
        importantForAccessibility={viewingToday ? 'no-hide-descendants' : 'yes'}
        accessibilityRole="button"
        accessibilityLabel="Jump to today"
      >
        <Text variant="captionMedium" color="secondary">
          Today
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  arrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  label: {
    flex: 1,
    textAlign: 'center',
  },
  today: {
    minWidth: 52,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
  },
  todayHidden: {
    opacity: 0,
  },
});
