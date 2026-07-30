import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme';

type TextColor = 'primary' | 'default' | 'secondary' | 'tertiary' | 'inverse' | 'danger' | 'over';

const COLOR_MAP: Record<TextColor, string> = {
  default: colors.text,
  primary: colors.primary,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  inverse: colors.textInverse,
  danger: colors.danger,
  over: colors.over,
};

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
};

/**
 * Single entry point for text so every screen pulls from the same type scale
 * and palette rather than hand-rolling `fontSize`/`color` per component.
 */
export function Text({
  variant = 'body',
  color = 'default',
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      style={StyleSheet.flatten([typography[variant], { color: COLOR_MAP[color] }, style])}
      {...rest}
    />
  );
}
