import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { makeStyles, radius, shadows, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  padded?: boolean;
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
};

export function Card({ children, padded = true, elevation = 'sm', style }: CardProps) {
  const styles = useStyles();

  return (
    <View
      style={[styles.card, shadows[elevation], padded && styles.padded, style]}
      // Shadows on Android need a background colour to render; keeping it here
      // rather than on callers avoids invisible cards.
    >
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.lg,
  },
}));
