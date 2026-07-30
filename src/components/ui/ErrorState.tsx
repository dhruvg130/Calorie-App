import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

type ErrorStateProps = {
  /** Must already be a user-safe string — pass output of `toUserMessage`. */
  message: string;
  onRetry?: () => void;
  compact?: boolean;
};

export function ErrorState({ message, onRetry, compact = false }: ErrorStateProps) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={compact ? 20 : 28} color={colors.danger} />
      </View>
      <Text variant="body" color="secondary" style={styles.message}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          label="Try again"
          variant="secondary"
          size="md"
          fullWidth={false}
          onPress={onRetry}
          style={styles.retry}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  compact: {
    paddingVertical: spacing.lg,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  message: {
    textAlign: 'center',
    maxWidth: 300,
  },
  retry: {
    marginTop: spacing.lg,
  },
});
