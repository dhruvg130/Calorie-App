export const colors = {
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
} as const;

export type ColorName = keyof typeof colors;
