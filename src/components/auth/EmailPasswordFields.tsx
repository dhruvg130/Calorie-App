import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, type TextInput } from 'react-native';

import { Input } from '@/components/ui';
import { colors } from '@/theme';

type EmailPasswordFieldsProps = {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  emailError?: string;
  passwordError?: string;
  passwordHint?: string;
  /** 'new-password' lets password managers offer to generate and save one. */
  passwordAutoComplete: 'current-password' | 'new-password';
  onSubmit: () => void;
  editable?: boolean;
};

export function EmailPasswordFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  emailError,
  passwordError,
  passwordHint,
  passwordAutoComplete,
  onSubmit,
  editable = true,
}: EmailPasswordFieldsProps) {
  const [visible, setVisible] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  return (
    <>
      <Input
        label="Email"
        value={email}
        onChangeText={onEmailChange}
        error={emailError}
        editable={editable}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        placeholder="you@example.com"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />

      <Input
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={onPasswordChange}
        error={passwordError}
        hint={passwordError ? undefined : passwordHint}
        editable={editable}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={passwordAutoComplete}
        textContentType={passwordAutoComplete === 'new-password' ? 'newPassword' : 'password'}
        placeholder="••••••••"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        right={
          <Pressable
            onPress={() => setVisible((current) => !current)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textTertiary}
            />
          </Pressable>
        }
      />
    </>
  );
}
