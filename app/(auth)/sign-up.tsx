import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { EmailPasswordFields } from '@/components/auth/EmailPasswordFields';
import { Banner, Button, Text } from '@/components/ui';
import { toUserMessage } from '@/lib/errors';
import { LIMITS, firstIssue, signUpSchema } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;

    setFormError(null);
    const parsed = signUpSchema.safeParse({ email, password });
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
      const result = await signUp(parsed.data.email, parsed.data.password);
      // With "Confirm email" on, Supabase creates the user but issues no
      // session. Saying so plainly is better than looking like a silent failure.
      if (result.status === 'confirmation-required') {
        setAwaitingConfirmation(true);
      }
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email}. Open it, then sign in.`}
        footer={
          <Text variant="caption" color="tertiary" style={styles.centered}>
            The link can take a minute to arrive. Check your spam folder too.
          </Text>
        }
      >
        <Button label="Go to sign in" onPress={() => router.replace('/sign-in')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start tracking what you eat in a few seconds."
      footer={
        <View style={styles.footerRow}>
          <Text variant="body" color="secondary">
            Already have an account?{' '}
          </Text>
          <Link href="/sign-in" replace>
            <Text variant="bodyMedium" color="primary">
              Sign in
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
        passwordHint={`At least ${LIMITS.passwordMin} characters, with a letter and a number`}
        passwordAutoComplete="new-password"
        onSubmit={handleSubmit}
        editable={!submitting}
      />

      {formError ? <Banner message={formError} /> : null}

      <Button label="Create account" onPress={handleSubmit} loading={submitting} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});
