import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { isWhoopConfigured } from '@/api/whoop';
import { colors, spacing, typography } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          // Android draws no safe-area padding of its own here; iOS needs less
          // because the tab bar already sits above the home indicator.
          paddingTop: spacing.sm,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Ionicons name="today" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add food',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="weight"
        options={{
          title: 'Weight',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="whoop"
        options={{
          title: 'Recovery',
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse" size={size} color={color} />,
          // A build with no WHOOP client ID does not show a tab that can only
          // explain why it is empty. `href: null` removes the route entirely
          // rather than rendering a disabled-looking tab.
          href: isWhoopConfigured ? undefined : null,
        }}
      />
    </Tabs>
  );
}
