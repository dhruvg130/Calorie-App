import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useColors } from '@/providers/ThemeProvider';
import { typography, type Palette, type TypographyVariant } from '@/theme';

type TextColor = 'primary' | 'default' | 'secondary' | 'tertiary' | 'inverse' | 'danger' | 'over';

/** Names rather than values, so this stays a module constant: Text renders on
 *  every row of every list, and building a palette map per render would not. */
const PALETTE_KEY: Record<TextColor, keyof Palette> = {
  default: 'text',
  primary: 'primary',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  inverse: 'textInverse',
  danger: 'danger',
  over: 'over',
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
  const colors = useColors();

  return (
    <RNText
      style={StyleSheet.flatten([
        typography[variant],
        { color: colors[PALETTE_KEY[color]] },
        style,
      ])}
      {...rest}
    />
  );
}
