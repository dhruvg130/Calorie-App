import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, Button, Input, Text } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { LIMITS, dailyGoalSchema, parseNumericInput } from '@/lib/validation';
import { absoluteFill, colors, radius, spacing } from '@/theme';

type GoalEditSheetProps = {
  visible: boolean;
  currentGoal: number;
  saving: boolean;
  onDismiss: () => void;
  onSave: (goal: number) => Promise<void>;
};

export function GoalEditSheet({
  visible,
  currentGoal,
  saving,
  onDismiss,
  onSave,
}: GoalEditSheetProps) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(String(currentGoal));
  const [error, setError] = useState<string | null>(null);

  // Reset to the stored goal each time the sheet opens, so a cancelled edit
  // does not linger into the next one.
  useEffect(() => {
    if (visible) {
      setValue(String(currentGoal));
      setError(null);
    }
  }, [visible, currentGoal]);

  const handleSave = async () => {
    const numeric = parseNumericInput(value);
    if (numeric === null) {
      setError('Enter a number');
      return;
    }

    const parsed = dailyGoalSchema.safeParse(numeric);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid goal');
      return;
    }

    try {
      await onSave(parsed.data);
      onDismiss();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Tapping the scrim dismisses, matching the platform convention. */}
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityLabel="Close" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.grabber} />

          <Text variant="heading">Daily calorie goal</Text>
          <Text variant="body" color="secondary" style={styles.description}>
            How many calories you aim to eat each day.
          </Text>

          <Input
            value={value}
            onChangeText={(next) => {
              setValue(next);
              setError(null);
            }}
            error={error ?? undefined}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            autoFocus
            selectTextOnFocus
            maxLength={5}
            hint={`Between ${LIMITS.goalMin.toLocaleString()} and ${LIMITS.goalMax.toLocaleString()}`}
            accessibilityLabel="Daily calorie goal"
          />

          {error && error.includes('went wrong') ? <Banner message={error} /> : null}

          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={onDismiss}
              style={styles.action}
              fullWidth={false}
            />
            <Button
              label="Save"
              onPress={handleSave}
              loading={saving}
              style={styles.action}
              fullWidth={false}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...absoluteFill,
    backgroundColor: colors.overlay,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  description: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  action: {
    flex: 1,
  },
});
