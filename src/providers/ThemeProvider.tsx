import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import { palettes, type ColorScheme, type Palette } from '@/theme/colors';
import { secureStorage } from '@/lib/secureStorage';

const STORAGE_KEY = 'ct.color-scheme';

type ThemeContextValue = {
  scheme: ColorScheme;
  colors: Palette;
  /** True once the stored preference has been read, or found to be absent. */
  ready: boolean;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isScheme = (value: string | null): value is ColorScheme =>
  value === 'light' || value === 'dark';

/**
 * Which palette the app is drawing with.
 *
 * The device setting is the starting point, so a first launch already matches
 * the rest of the phone. Once the user touches the toggle their choice is
 * stored and wins from then on — a preference the OS overrode on every launch
 * would not be a preference.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const deviceScheme = useColorScheme();
  const [stored, setStored] = useState<ColorScheme | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const value = await secureStorage.getItem(STORAGE_KEY);
        if (!cancelled && isScheme(value)) setStored(value);
      } catch {
        // A preference we cannot read is not worth an error state; the device
        // scheme is a perfectly good fallback.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const scheme: ColorScheme = stored ?? (deviceScheme === 'dark' ? 'dark' : 'light');

  const setScheme = useCallback((next: ColorScheme) => {
    // Applied immediately; the write is fire-and-forget so the tap never waits
    // on the keychain.
    setStored(next);
    void secureStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: palettes[scheme],
      ready,
      setScheme,
      toggleScheme: () => setScheme(scheme === 'dark' ? 'light' : 'dark'),
    }),
    [scheme, ready, setScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Falls back to light rather than throwing when no provider is above: the
 * environment-misconfiguration screen renders before any provider mounts, and
 * it should still be able to draw itself.
 */
const FALLBACK: ThemeContextValue = {
  scheme: 'light',
  colors: palettes.light,
  ready: true,
  setScheme: () => undefined,
  toggleScheme: () => undefined,
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}

export function useColors(): Palette {
  return useTheme().colors;
}
