import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing } from '@/theme';

import { Text } from './Text';

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text variant="subheading" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="secondary" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  action: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
}));
