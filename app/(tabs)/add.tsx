import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { colors, radius, shadows, spacing } from '@/theme';

type Method = {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const METHODS: Method[] = [
  {
    href: '/log/search',
    icon: 'search',
    title: 'Search food',
    description: 'Look it up in the USDA nutrition database.',
  },
  {
    href: '/log/scan',
    icon: 'barcode-outline',
    title: 'Scan barcode',
    description: 'Point your camera at a packaged product.',
  },
  {
    href: '/log/photo',
    icon: 'camera-outline',
    title: 'Take a picture',
    description: 'Snap your meal and estimate its calories.',
  },
];

export default function AddScreen() {
  const router = useRouter();

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="title">Add food</Text>
        <Text variant="body" color="secondary">
          Pick how you want to log this meal.
        </Text>
      </View>

      <View style={styles.methods}>
        {METHODS.map((method) => (
          <Pressable
            key={method.title}
            onPress={() => router.push(method.href)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={method.title}
            accessibilityHint={method.description}
          >
            <View style={styles.iconTile}>
              <Ionicons name={method.icon} size={22} color={colors.primary} />
            </View>

            <View style={styles.cardText}>
              <Text variant="subheading">{method.title}</Text>
              <Text variant="caption" color="secondary">
                {method.description}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  methods: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
});
