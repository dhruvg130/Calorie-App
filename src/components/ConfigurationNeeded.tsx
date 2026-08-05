import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing } from '@/theme';

/**
 * Shown instead of the app when Supabase environment variables are missing or
 * malformed. Failing here — visibly, with instructions — beats a blank screen
 * or a crash on the first network call.
 */
export function ConfigurationNeeded({ problems }: { problems: string[] }) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="construct-outline" size={28} color={colors.warning} />
        </View>
        <Text variant="title">Finish setup</Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          Calorie Tracker needs your Supabase project details before it can start.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text variant="overline" color="secondary">
          What&apos;s missing
        </Text>
        <View style={styles.problems}>
          {problems.map((problem) => (
            <View key={problem} style={styles.problemRow}>
              <Ionicons name="close-circle" size={16} color={colors.danger} />
              <Text variant="caption" color="secondary" style={styles.problemText}>
                {problem}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="overline" color="secondary">
          How to fix it
        </Text>
        <View style={styles.steps}>
          <Step index={1} text="Copy .env.example to .env in the project root." />
          <Step
            index={2}
            text="Paste your Project URL and anon key from Supabase → Project Settings → API."
          />
          <Step index={3} text="Restart the dev server with: npx expo start --clear" />
        </View>
      </Card>
    </Screen>
  );
}

function Step({ index, text }: { index: number; text: string }) {
  const styles = useStyles();

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text variant="captionMedium" color="primary">
          {index}
        </Text>
      </View>
      <Text variant="body" color="secondary" style={styles.stepText}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  card: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  problems: {
    gap: spacing.sm,
  },
  problemRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  problemText: {
    flex: 1,
  },
  steps: {
    gap: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
}));
