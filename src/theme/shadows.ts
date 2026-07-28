import { Platform, type ViewStyle } from 'react-native';

/**
 * iOS and Android express elevation differently — iOS needs shadow* props while
 * Android only honours `elevation`. Branching once here keeps every component
 * free of Platform checks.
 */
const make = (
  elevation: number,
  opacity: number,
  radius: number,
  offsetY: number,
): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#0F172A',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: { elevation },
    default: {},
  }) ?? {};

export const shadows = {
  none: {} as ViewStyle,
  sm: make(1, 0.05, 4, 1),
  md: make(3, 0.07, 12, 4),
  lg: make(8, 0.11, 24, 10),
} as const;
