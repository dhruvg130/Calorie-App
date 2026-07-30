import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Replaces `Alert.alert` for confirmations.
 *
 * react-native-web ships `class Alert { static alert() {} }` — an empty
 * function — so every `Alert.alert` confirmation silently did nothing on web:
 * the button appeared dead. A Modal behaves identically on iOS, Android and
 * web, and lets the dialog match the rest of the app rather than looking like
 * an OS popup.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android hardware back and iOS swipe-to-dismiss should cancel, not
      // leave the dialog stuck open.
      onRequestClose={onCancel}
statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={loading ? undefined : onCancel}
        accessibilityLabel="Dismiss"
      >
        {/* Stops a tap inside the card from closing the dialog. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text variant="heading" style={styles.title}>
            {title}
          </Text>
          <Text variant="body" color="secondary" style={styles.message}>
            {message}
          </Text>

          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              onPress={onConfirm}
            />
            <Button
              label={cancelLabel}
              variant="secondary"
              disabled={loading}
              onPress={onCancel}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  title: {
    marginBottom: spacing.sm,
  },
  message: {
    marginBottom: spacing.xl,
  },
  actions: {
    gap: spacing.md,
  },
});
