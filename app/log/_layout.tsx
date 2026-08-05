import { Stack } from 'expo-router';

import { useColors } from '@/providers/ThemeProvider';
import { typography } from '@/theme';

export default function LogLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          color: colors.text,
          fontSize: typography.subheading.fontSize,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="search" options={{ title: 'Search food' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan barcode' }} />
      <Stack.Screen name="photo" options={{ title: 'Photo' }} />
      {/* Title is set by the screen itself — it depends on which day is
          selected, which this layout does not know. */}
      <Stack.Screen name="manual" />
      <Stack.Screen name="confirm" />
    </Stack>
  );
}
