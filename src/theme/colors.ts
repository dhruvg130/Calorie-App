/**
 * Two palettes with identical keys, so every component can be written once
 * against the shape and rendered in either scheme.
 *
 * A few keys carry a contract that is easy to break when picking dark values:
 *
 *  * `primary` is used both as an accent *on* the background (icons, links) and
 *    as a button *background*. In dark mode it therefore stays bright and
 *    `textInverse` goes dark, rather than the light-mode arrangement.
 *  * `primaryLight` / `dangerLight` / `warningLight` are tint backgrounds, never
 *    text. In dark mode they are deep tints, not pale ones.
 */
export type Palette = {
  primary: string;
  primaryLight: string;
  primaryDark: string;

  background: string;
  surface: string;
  surfaceMuted: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  border: string;
  borderStrong: string;

  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;

  over: string;

  overlay: string;
};

export type ColorScheme = 'light' | 'dark';

export const lightColors: Palette = {
  /** Brand accent — used for progress, primary actions and active tabs. */
  primary: '#059669',
  primaryLight: '#D1FAE5',
  primaryDark: '#047857',

  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',

  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',

  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',

  /** Shown when the daily goal has been exceeded. */
  over: '#EA580C',

  overlay: 'rgba(15, 23, 42, 0.45)',
};

export const darkColors: Palette = {
  // Brighter than the light-mode green: it has to read as an accent against a
  // near-black background, where #059669 goes muddy.
  primary: '#34D399',
  primaryLight: '#0B3B2E',
  primaryDark: '#10B981',

  background: '#0B1120',
  surface: '#161E2E',
  surfaceMuted: '#1F2937',

  text: '#F1F5F9',
  textSecondary: '#98A5B8',
  textTertiary: '#6B7A90',
  // Sits on `primary`, which is light in this scheme — so this one is dark.
  textInverse: '#04231B',

  border: '#26314A',
  borderStrong: '#3A4763',

  danger: '#F87171',
  dangerLight: '#3B1A1D',
  warning: '#FBBF24',
  warningLight: '#3A2A08',

  over: '#FB923C',

  overlay: 'rgba(2, 6, 23, 0.6)',
};

export const palettes: Record<ColorScheme, Palette> = {
  light: lightColors,
  dark: darkColors,
};

/**
 * The light palette, for the handful of places that run outside React and so
 * cannot read the active scheme. Anything rendered in a component should use
 * `useColors()` or `makeStyles` instead, or it will not follow the toggle.
 */
export const colors = lightColors;

export type ColorName = keyof Palette;
