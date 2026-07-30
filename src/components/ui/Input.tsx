import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import { Text } from './Text';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  right?: React.ReactNode;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, containerStyle, right, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="captionMedium" color="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          Boolean(error) && styles.fieldError,
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          accessibilityLabel={label}
          // Announce the validation message to screen readers rather than
          // leaving it as decoration next to the field.
          accessibilityHint={error ?? hint}
          {...rest}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>

      {error ? (
        <Text variant="caption" color="danger" style={styles.message}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="tertiary" style={styles.message}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    marginLeft: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  fieldFocused: {
    borderColor: colors.primary,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    paddingVertical: spacing.md,
  },
  right: {
    marginLeft: spacing.sm,
  },
  message: {
    marginLeft: spacing.xs,
  },
});
