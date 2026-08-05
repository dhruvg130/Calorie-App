import { StyleSheet } from 'react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { palettes, type ColorScheme, type Palette } from './colors';

type NamedStyles = Parameters<typeof StyleSheet.create>[0];

/**
 * `StyleSheet.create` at module scope freezes whatever colour values were read
 * at import time, which is exactly why a plain `colors` object cannot follow a
 * runtime theme change. This takes the same style object as a function of the
 * palette and returns a hook that hands back the sheet for the active scheme.
 *
 * Both sheets are built once, on first use, and then cached — a theme toggle
 * re-renders, it does not re-create styles.
 *
 * Usage mirrors what it replaces:
 *
 *   const useStyles = makeStyles((colors) => ({ card: { backgroundColor: colors.surface } }));
 *   …
 *   const styles = useStyles();
 */
export function makeStyles<T extends NamedStyles>(factory: (colors: Palette) => T) {
  const cache = new Map<ColorScheme, T>();

  const sheetFor = (scheme: ColorScheme): T => {
    const cached = cache.get(scheme);
    if (cached) return cached;
    const created = StyleSheet.create(factory(palettes[scheme])) as T;
    cache.set(scheme, created);
    return created;
  };

  return function useThemedStyles(): T {
    return sheetFor(useTheme().scheme);
  };
}
