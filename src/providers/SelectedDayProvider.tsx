import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { isToday, startOfLocalDay, withTimeOfDay } from '@/lib/date';

type SelectedDayContextValue = {
  /** The day Home is showing, and the day new entries are logged to. */
  selectedDay: Date;
  setSelectedDay: (date: Date) => void;
  isViewingToday: boolean;
  /** Timestamp to store for a new entry logged right now, on the selected day. */
  timestampForNewEntry: () => Date;
  resetToToday: () => void;
};

const SelectedDayContext = createContext<SelectedDayContextValue | null>(null);

/**
 * Shared above the tabs because the logging flow spans them: Home picks the
 * day, but the Add tab, the three method screens and the confirm screen all
 * need it to save to the right date. Passing it through route params would
 * break the moment the user reaches Add via the tab bar instead of Home's
 * button, since the tab bar carries no params.
 */
export function SelectedDayProvider({ children }: { children: ReactNode }) {
  const [selectedDay, setSelectedDayState] = useState(() => startOfLocalDay(new Date()));

  const setSelectedDay = useCallback((date: Date) => {
    setSelectedDayState(startOfLocalDay(date));
  }, []);

  const resetToToday = useCallback(() => {
    setSelectedDayState(startOfLocalDay(new Date()));
  }, []);

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
    () => ({
      selectedDay,
      setSelectedDay,
      isViewingToday: isToday(selectedDay),
      timestampForNewEntry,
      resetToToday,
    }),
    [selectedDay, setSelectedDay, timestampForNewEntry, resetToToday],
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
