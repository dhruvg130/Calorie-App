import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Text } from './Text';

type Tone = 'danger' | 'success' | 'info';

const TONE_STYLES: Record<
  Tone,
  { background: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }
> = {
  danger: {
    background: colors.dangerLight,
    icon: 'alert-circle',
    iconColor: colors.danger,
  },
  success: {
    background: colors.primaryLight,
    icon: 'checkmark-circle',
    iconColor: colors.primary,
  },
  info: {
    background: colors.warningLight,
    icon: 'information-circle',
    iconColor: colors.warning,
  },
};

type BannerProps = {
  /** Must already be user-safe text — pass the output of `toUserMessage`. */
  message: string;
  tone?: Tone;
};

export function Banner({ message, tone = 'danger' }: BannerProps) {
  const { background, icon, iconColor } = TONE_STYLES[tone];

  return (
    <View
      style={[styles.container, { backgroundColor: background }]}
      // Announces the message when it appears rather than leaving screen reader
      // users to discover it by exploring.
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Ionicons name={icon} size={18} color={iconColor} style={styles.icon} />
      <Text variant="caption" style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  icon: {
    marginTop: 1,
  },
  message: {
    flex: 1,
  },
});
