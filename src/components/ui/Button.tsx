import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
  type ViewStyle,
} from 'react-native';

import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing, typography, type Palette } from '@/theme';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  accessibilityHint?: string;
};

const backgroundFor = (colors: Palette): Record<Variant, string> => ({
  primary: colors.primary,
  secondary: colors.surfaceMuted,
  ghost: 'transparent',
  danger: colors.dangerLight,
});

const LABEL_COLORS: Record<Variant, 'inverse' | 'default' | 'primary' | 'danger'> = {
  primary: 'inverse',
  secondary: 'default',
  ghost: 'primary',
  danger: 'danger',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = true,
  icon,
  style,
  accessibilityHint,
}: ButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const inactive = disabled || loading;

  const handlePress = () => {
    if (inactive) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        size === 'md' ? styles.md : styles.lg,
        { backgroundColor: backgroundFor(colors)[variant] },
        variant === 'ghost' && styles.ghost,
        fullWidth && styles.fullWidth,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.textInverse : colors.primary}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            variant={size === 'lg' ? 'subheading' : 'bodyMedium'}
            color={LABEL_COLORS[variant]}
            style={styles.label}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: {
    minHeight: 54,
    paddingHorizontal: spacing.xl,
  },
  md: {
    // 44pt is the minimum comfortable touch target on both platforms.
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  ghost: {
    minHeight: 44,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    textAlign: 'center',
    lineHeight: typography.subheading.lineHeight,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.45,
  },
}));
