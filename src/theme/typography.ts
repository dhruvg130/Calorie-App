import { Platform, type TextStyle } from 'react-native';

/**
 * System fonts keep the app feeling native on each platform and avoid shipping
 * font files. `-apple-system` equivalents are the RN defaults, so we only need
 * to pin the numeric font family used for large calorie readouts.
 */
const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const fontFamilyMedium = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});

export const typography = {
  display: {
    fontFamily: fontFamilyMedium,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  title: {
    fontFamily: fontFamilyMedium,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: fontFamilyMedium,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  subheading: {
    fontFamily: fontFamilyMedium,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontFamily,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily: fontFamilyMedium,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  caption: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  captionMedium: {
    fontFamily: fontFamilyMedium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  /** All-caps section labels. */
  overline: {
    fontFamily: fontFamilyMedium,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
