import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { EmailPasswordFields } from '@/components/auth/EmailPasswordFields';
import { Banner, Button, Text } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { firstIssue, signInSchema } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';

export default function SignInScreen() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;

    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors({
        email: firstIssue(parsed.error, 'email'),
        password: firstIssue(parsed.error, 'password'),
      });
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      // No navigation here: the root layout's guard swaps the routes as soon as
      // the session lands, so there is no window where both stacks exist.
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to keep tracking your day."
      footer={
        <View style={styles.footerRow}>
          <Text variant="body" color="secondary">
            New here?{' '}
          </Text>
          <Link href="/sign-up" replace>
            <Text variant="bodyMedium" color="primary">
              Create an account
            </Text>
          </Link>
        </View>
      }
    >
      <EmailPasswordFields
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        emailError={errors.email}
        passwordError={errors.password}
        passwordAutoComplete="current-password"
        onSubmit={handleSubmit}
        editable={!submitting}
      />

      {formError ? <Banner message={formError} /> : null}

      <Button label="Sign in" onPress={handleSubmit} loading={submitting} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
