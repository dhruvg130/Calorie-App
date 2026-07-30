/** 4pt spacing scale. Every gap and pad in the app comes from here. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Spreadable equivalent of the old `StyleSheet.absoluteFillObject`, which RN
 * 0.86 no longer exposes. `StyleSheet.absoluteFill` is a registered style ID,
 * so it cannot be spread into a style object.
 */
export const absoluteFill = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;
