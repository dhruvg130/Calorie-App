import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView. Off for screens that own a FlatList. */
  scroll?: boolean;
  /** Lift content above the keyboard — on for any screen with a text input. */
  avoidKeyboard?: boolean;
  /** Skip top inset when a navigation header already provides it. */
  edges?: { top?: boolean; bottom?: boolean };
  padded?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
};

/**
 * Screen chrome in one place: background colour, safe-area insets, keyboard
 * avoidance. Using `useSafeAreaInsets` rather than fixed padding is what keeps
 * layouts correct across notched iPhones and Android gesture bars.
 */
export function Screen({
  children,
  scroll = false,
  avoidKeyboard = false,
  edges,
  padded = true,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  const insetStyle: ViewStyle = {
    paddingTop: edges?.top === false ? 0 : insets.top,
    paddingBottom: edges?.bottom === false ? 0 : insets.bottom,
  };

  const padding: ViewStyle = padded ? { paddingHorizontal: spacing.lg } : {};

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, padding, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, contentContainerStyle]}>{children}</View>
  );

  const content = avoidKeyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      // iOS moves the whole view; Android's windowSoftInputMode already resizes
      // it, so 'height' there would double-apply the offset.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return <View style={[styles.root, insetStyle, style]}>{content}</View>;
}

const useStyles = makeStyles((colors) => ({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
}));
