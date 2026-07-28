import { useEffect, useState } from 'react';

/**
 * Delays propagating a value until it stops changing. Used to keep each
 * keystroke from firing an Edge Function call — that would burn the upstream
 * API quota and race responses out of order.
 */
export function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
