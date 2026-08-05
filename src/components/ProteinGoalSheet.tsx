import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, Button, Input, Text } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { LIMITS, parseNumericInput, proteinGoalSchema } from '@/lib/validation';
import { absoluteFill, makeStyles, radius, spacing } from '@/theme';

type ProteinGoalSheetProps = {
  visible: boolean;
  /** The stored custom goal in grams, or null when the target is derived. */
  currentGoal: number | null;
  /** What the bodyweight calculation suggests, shown as the alternative. */
  suggestedGrams: number | null;
  saving: boolean;
  onDismiss: () => void;
  /** `null` clears the custom goal and returns to the derived target. */
  onSave: (goal: number | null) => Promise<void>;
};

/**
 * Sets a protein goal by hand.
 *
 * The derived target — bodyweight × a multiplier picked by the day's strain —
 * stays the default, and this sheet is how you override it. Clearing the field
 * is not an error state but the way back to that default, so it gets its own
 * button rather than being something you have to guess at.
 */
export function ProteinGoalSheet({
  visible,
  currentGoal,
  suggestedGrams,
  saving,
  onDismiss,
  onSave,
}: ProteinGoalSheetProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const [value, setValue] = useState(currentGoal === null ? '' : String(currentGoal));
  const [error, setError] = useState<string | null>(null);

  // Reset each time the sheet opens, so a cancelled edit does not linger.
  useEffect(() => {
    if (visible) {
      setValue(currentGoal === null ? '' : String(currentGoal));
      setError(null);
    }
  }, [visible, currentGoal]);

  const handleSave = async () => {
    const numeric = parseNumericInput(value);
    if (numeric === null) {
      setError('Enter a number');
      return;
    }

    const parsed = proteinGoalSchema.safeParse(numeric);
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

  const handleUseAutomatic = async () => {
    setError(null);
    try {
      await onSave(null);
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
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityLabel="Close" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.grabber} />

          <Text variant="heading">Daily protein goal</Text>
          <Text variant="body" color="secondary" style={styles.description}>
            {suggestedGrams === null
              ? 'How many grams of protein you aim to eat each day.'
              : `Your bodyweight and training suggest ${suggestedGrams} g today. Set your own number to use that instead.`}
          </Text>

          <Input
            value={value}
            onChangeText={(next) => {
              setValue(next);
              setError(null);
            }}
            error={error ?? undefined}
            keyboardType="number-pad"
            onSubmitEditing={handleSave}
            autoFocus
            selectTextOnFocus
            maxLength={3}
            placeholder={suggestedGrams === null ? '150' : String(suggestedGrams)}
            hint={`Between ${LIMITS.proteinGoalMin} and ${LIMITS.proteinGoalMax} g`}
            accessibilityLabel="Daily protein goal in grams"
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

          {/* Only offered when there is something to fall back to. */}
          {currentGoal !== null ? (
            <Button
              label="Use the automatic target"
              variant="ghost"
              onPress={() => void handleUseAutomatic()}
              disabled={saving}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
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
}));
