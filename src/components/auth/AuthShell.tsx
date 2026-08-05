import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing } from '@/theme';

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

/** Shared chrome for sign-in and sign-up so the two screens stay identical in
 *  layout and only differ where the behaviour genuinely differs. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <Screen scroll avoidKeyboard contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Ionicons name="nutrition" size={30} color={colors.textInverse} />
        </View>
        <Text variant="title">{title}</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.form}>{children}</View>

      <View style={styles.footer}>{footer}</View>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  content: {
    justifyContent: 'center',
  },
  header: {
    alignItems: 'flex-start',
    paddingTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
}));
