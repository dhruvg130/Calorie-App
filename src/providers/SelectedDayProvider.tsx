import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { isToday, startOfLocalDay, withTimeOfDay } from '@/lib/date';

export type DaySelection = {
  /** The day the screen is showing, and the day its writes are dated to. */
  selectedDay: Date;
  setSelectedDay: (date: Date) => void;
  isViewingToday: boolean;
  resetToToday: () => void;
};

type SelectedDayContextValue = DaySelection & {
  /** Timestamp to store for a new entry logged right now, on the selected day. */
  timestampForNewEntry: () => Date;
};

const SelectedDayContext = createContext<SelectedDayContextValue | null>(null);

/**
 * Day-selection state, on its own so a screen can hold a private copy instead
 * of joining the shared one below.
 *
 * `initialDay` is read once, at mount. That is the point: the Weight tab seeds
 * itself from whatever day Home is on, so arriving there from a back-dated Home
 * view keeps your place — but the two then move independently. Sharing the
 * state outright would mean tapping a weigh-in from March silently retargets
 * where your next meal gets logged.
 */
export function useDaySelection(initialDay?: Date): DaySelection {
  const [selectedDay, setSelectedDayState] = useState(() =>
    startOfLocalDay(initialDay ?? new Date()),
  );

  const setSelectedDay = useCallback((date: Date) => {
    setSelectedDayState(startOfLocalDay(date));
  }, []);

  const resetToToday = useCallback(() => {
    setSelectedDayState(startOfLocalDay(new Date()));
  }, []);

  return useMemo(
    () => ({
      selectedDay,
      setSelectedDay,
      isViewingToday: isToday(selectedDay),
      resetToToday,
    }),
    [selectedDay, setSelectedDay, resetToToday],
  );
}

/**
 * Shared above the tabs because the logging flow spans them: Home picks the
 * day, but the Add tab, the three method screens and the confirm screen all
 * need it to save to the right date. Passing it through route params would
 * break the moment the user reaches Add via the tab bar instead of Home's
 * button, since the tab bar carries no params.
 */
export function SelectedDayProvider({ children }: { children: ReactNode }) {
  const day = useDaySelection();
  const { selectedDay } = day;

  /**
   * Back-dated entries keep the current clock time rather than landing at
   * midnight, so a meal logged this afternoon for yesterday sorts sensibly
   * among that day's other entries instead of jumping to the top.
   */
  const timestampForNewEntry = useCallback(() => {
    const now = new Date();
    return isToday(selectedDay) ? now : withTimeOfDay(selectedDay, now);
  }, [selectedDay]);

  const value = useMemo<SelectedDayContextValue>(
    () => ({ ...day, timestampForNewEntry }),
    [day, timestampForNewEntry],
  );

  return <SelectedDayContext.Provider value={value}>{children}</SelectedDayContext.Provider>;
}

export function useSelectedDay(): SelectedDayContextValue {
  const context = useContext(SelectedDayContext);
  if (!context) {
    throw new Error('useSelectedDay must be used inside <SelectedDayProvider>');
  }
  return context;
}
