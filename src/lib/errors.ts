import { AuthError, PostgrestError } from '@supabase/supabase-js';

/**
 * Translates anything thrown by Supabase, fetch, or our own validation into a
 * short sentence that is safe to render.
 *
 * Nothing derived from the raw error reaches the UI: Postgres messages name
 * tables, columns and constraints, and auth errors can distinguish "no such
 * user" from "wrong password" — both are handed to the user as one generic
 * message so the screen cannot be used to enumerate accounts or map the schema.
 */

const GENERIC = 'Something went wrong. Please try again.';

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email or password is incorrect.',
  email_not_confirmed: 'Please confirm your email address, then sign in.',
  user_already_exists: 'An account with this email already exists.',
  email_exists: 'An account with this email already exists.',
  weak_password: 'That password is too weak. Use at least 8 characters.',
  over_email_send_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute and try again.',
  same_password: 'That is already your current password.',
  session_expired: 'Your session expired. Please sign in again.',
  session_not_found: 'Your session expired. Please sign in again.',
};

const POSTGRES_MESSAGES: Record<string, string> = {
  '23505': 'That entry already exists.',
  '23514': 'Some of those values are out of range. Please check and try again.',
  '23503': 'That item is no longer available.',
  '22003': 'That number is too large.',
  '42501': 'You do not have permission to do that.',
  PGRST116: 'We could not find that item.',
  PGRST301: 'Your session expired. Please sign in again.',
};

/** Thrown deliberately by our own code when the message is already user-safe. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('abort')
  );
}

export function toUserMessage(error: unknown): string {
  logForDeveloper(error);

  if (error instanceof AppError) return error.message;

  if (isNetworkError(error)) {
    return 'No internet connection. Check your network and try again.';
  }

  if (error instanceof AuthError) {
    const byCode = error.code ? AUTH_MESSAGES[error.code] : undefined;
    if (byCode) return byCode;
    // Supabase has been migrating from prose messages to stable codes; fall
    // back to matching the legacy strings so older projects behave the same.
    const message = error.message.toLowerCase();
    if (message.includes('invalid login credentials')) return AUTH_MESSAGES.invalid_credentials!;
    if (message.includes('email not confirmed')) return AUTH_MESSAGES.email_not_confirmed!;
    if (message.includes('already registered')) return AUTH_MESSAGES.user_already_exists!;
    if (message.includes('rate limit')) return AUTH_MESSAGES.over_request_rate_limit!;
    return 'We could not complete that request. Please try again.';
  }

  if (isPostgrestError(error)) {
    return POSTGRES_MESSAGES[error.code] ?? GENERIC;
  }

  return GENERIC;
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'details' in error
  );
}

/**
 * Raw errors are only ever printed during development. Release bundles strip
 * this branch, so production logs cannot leak tokens, schema details or stack
 * traces to logcat / Console.app.
 */
function logForDeveloper(error: unknown): void {
  if (__DEV__) {
    console.warn('[handled error]', error);
  }
}
