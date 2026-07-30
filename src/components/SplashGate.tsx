import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/**
 * Held on screen while the persisted session is read out of secure storage.
 * Without it, every cold start would flash the sign-in screen before the
 * restored session arrives.
 */
export function SplashGate() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
