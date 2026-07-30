import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfigurationNeeded } from '@/components/ConfigurationNeeded';
import { SplashGate } from '@/components/SplashGate';
import { envErrors, isEnvConfigured } from '@/lib/env';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { SelectedDayProvider } from '@/providers/SelectedDayProvider';
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
            {/* Above the navigator so Home, the Add tab, the three method
                screens and confirm all agree on which day is being logged. */}
            <SelectedDayProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </SelectedDayProvider>
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
/**
 * How long the splash is held even when there is nothing left to wait for.
 *
 * The animation's full sequence — ring sweep, mark, wordmark — lands at about
 * 900ms. Without a floor, a warm start resolves the session in a fraction of
 * that and unmounts the splash mid-sweep, which reads as a flicker rather than
 * an intro.
 *
 * This is a real cost: every launch is now at least this long, whether or not
 * anything is loading. That is the trade for the animation being seen at all.
 * Lower it to taste, or set it to 0 to go back to "as fast as possible".
 */
// Annotated as `number` rather than left to infer the literal `1300`, so the
// `=== 0` checks below stay legal when someone edits this to disable the hold.
const MINIMUM_SPLASH_MS: number = 1300;

function RootNavigator() {
  const { session, initializing } = useAuth();
  const [splashFinished, setSplashFinished] = useState(MINIMUM_SPLASH_MS === 0);

  useEffect(() => {
    if (MINIMUM_SPLASH_MS === 0) return;
    const timer = setTimeout(() => setSplashFinished(true), MINIMUM_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Both conditions, so a slow session read still holds past the floor.
  if (initializing || !splashFinished) return <SplashGate />;

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
