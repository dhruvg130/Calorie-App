import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigurationNeeded } from '@/components/ConfigurationNeeded';
import { SplashGate } from '@/components/SplashGate';
import { envErrors, isEnvConfigured } from '@/lib/env';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { colors } from '@/theme';

export default function RootLayout() {
  // Rendering the setup screen before any provider mounts means a misconfigured
  // build shows instructions instead of failing on its first network call.
  if (!isEnvConfigured) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ConfigurationNeeded problems={envErrors} />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryProvider>
          {/* AuthProvider sits inside QueryProvider because signing out clears
              the query cache. */}
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * `Stack.Protected` is declarative routing: a signed-out user cannot reach the
 * tab screens because those routes are not registered at all, rather than being
 * mounted and then redirected away from. There is no frame in which somebody
 * unauthenticated has a data screen on the stack.
 */
function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) return <SplashGate />;

  const isSignedIn = session !== null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log" />
        <Stack.Screen
          name="entry/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
