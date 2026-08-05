import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';

import type { DayTotals } from '@/api/entries';
import { DayRing } from '@/components/DayRing';
import { Card, Text } from '@/components/ui';
import {
  addDays,
  addMonths,
  formatMonthYear,
  isFutureDay,
  isSameDay,
  isToday as isTodayFn,
  localDayKey,
  monthGrid,
  startOfMonth,
  weekDays,
} from '@/lib/date';
import { useColors } from '@/providers/ThemeProvider';
import { radius, spacing } from '@/theme';

// Old Android needs this opt-in for LayoutAnimation to do anything at all.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type CalendarStripProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** Calories per local day key; drives each ring's sweep. */
  totals: DayTotals;
  dailyGoal: number;
  /** Days the calendar wants loaded — lifted so the parent owns the query. */
  onVisibleDaysChange: (days: Date[]) => void;
};

/**
 * Week strip that expands to a full month.
 *
 * Collapsed it costs ~90pt instead of a month grid's ~350, which leaves the
 * summary and the food list usable on a small phone — the month view is one tap
 * away for when you actually want to jump back further.
 */
export function CalendarStrip({
  selectedDate,
  onSelectDate,
  totals,
  dailyGoal,
  onVisibleDaysChange,
}: CalendarStripProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  // The period being *browsed*, which is not the selection: you can page to
  // last month and look around without changing which day is loaded below.
  const [anchor, setAnchor] = useState(selectedDate);

  const days = useMemo(
    () => (expanded ? monthGrid(anchor) : weekDays(anchor)),
    [expanded, anchor],
  );

  // Report the visible range up so the parent can fetch totals for it. Keyed on
  // the range itself rather than the array identity, which changes every render.
  const daysKey = days.length
    ? `${localDayKey(days[0]!)}_${localDayKey(days[days.length - 1]!)}`
    : '';

  const notify = useRef(onVisibleDaysChange);
  notify.current = onVisibleDaysChange;

  useEffect(() => {
    notify.current(days);
    // `days` is derived from daysKey; depending on it directly would re-fire
    // every render since useMemo returns a new array on each anchor change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);

  const step = (direction: -1 | 1) => {
    setAnchor((current) =>
      expanded ? addMonths(current, direction) : addDays(current, direction * 7),
    );
  };

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((value) => !value);
  };

  const title = expanded
    ? formatMonthYear(anchor)
    : `${formatMonthYear(anchor)}`;

  const currentMonth = startOfMonth(anchor).getMonth();

  return (
    <Card elevation="sm" padded={false} style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => step(-1)}
          hitSlop={12}
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Previous month' : 'Previous week'}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>

        <Pressable
          onPress={toggleExpanded}
          style={styles.titleButton}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${title}. ${expanded ? 'Collapse to week' : 'Expand to month'}`}
        >
          <Text variant="bodyMedium">{title}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={colors.textSecondary}
          />
        </Pressable>

        <Pressable
          onPress={() => step(1)}
          hitSlop={12}
          style={styles.arrow}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Next month' : 'Next week'}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.cell}>
            <Text variant="caption" color="tertiary">
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {days.map((day) => {
          const key = localDayKey(day);
          const consumed = totals[key] ?? 0;
          const disabled = isFutureDay(day);
          // In month view, days spilling in from the neighbouring months are
          // dimmed so the current month still reads as a block.
          const outsideMonth = expanded && day.getMonth() !== currentMonth;

          return (
            <Pressable
              key={key}
              style={[styles.cell, outsideMonth && styles.outside]}
              disabled={disabled}
              onPress={() => onSelectDate(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSameDay(day, selectedDate), disabled }}
              accessibilityLabel={`${day.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}${consumed > 0 ? `, ${Math.round(consumed)} calories logged` : ', nothing logged'}`}
            >
              <DayRing
                label={String(day.getDate())}
                progress={dailyGoal > 0 ? consumed / dailyGoal : 0}
                selected={isSameDay(day, selectedDate)}
                isToday={isTodayFn(day)}
                disabled={disabled}
              />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  arrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  titleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
  },
  cell: {
    // Seven per row; percentage width keeps it aligned on any screen size.
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  outside: {
    opacity: 0.35,
  },
});
