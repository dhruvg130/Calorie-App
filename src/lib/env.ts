import { z } from 'zod';

/**
 * Expo statically inlines `process.env.EXPO_PUBLIC_*` at build time, so these
 * must be written as complete member expressions — destructuring or dynamic
 * indexing into `process.env` yields undefined in a release bundle.
 *
 * Everything here is public by definition: `EXPO_PUBLIC_` values are embedded
 * in the JS bundle and can be extracted from a shipped app. Only the Supabase
 * URL and anon key belong here. The anon key is *designed* for client exposure —
 * Row Level Security, not key secrecy, is what protects user data. Any value
 * that must stay secret (e.g. the USDA API key) lives in an Edge Function
 * secret instead, never in this file.
 */
const rawEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

const envSchema = z.object({
  supabaseUrl: z
    .url('EXPO_PUBLIC_SUPABASE_URL must be a valid URL like https://<project-ref>.supabase.co')
    .refine((value) => value.startsWith('https://'), {
      message: 'EXPO_PUBLIC_SUPABASE_URL must use https',
    })
    // The dashboard shows the Data API endpoint as `https://<ref>.supabase.co/rest/v1/`,
    // which is easy to copy verbatim. supabase-js appends `/rest/v1/` itself, so
    // keeping the path would produce `/rest/v1//rest/v1/...` and 404 on every
    // query. Normalise to the origin rather than failing on a natural mistake.
    .transform((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return value.replace(/\/+$/, '');
      }
    }),
  supabaseAnonKey: z
    .string('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set')
    .min(20, 'EXPO_PUBLIC_SUPABASE_ANON_KEY is too short to be a valid key'),
});

const parsed = envSchema.safeParse(rawEnv);

/**
 * Only ever the issue *messages* — never the values — so a misconfigured build
 * cannot leak credentials into logs or a crash reporter.
 */
export const envErrors: string[] = parsed.success
  ? []
  : parsed.error.issues.map((issue) => issue.message);

export const isEnvConfigured = parsed.success;

/**
 * Placeholders keep module initialisation total: the Supabase client can be
 * constructed, and the root layout renders a "finish setup" screen instead of
 * the app. Nothing can accidentally talk to this host — it does not resolve.
 */
export const env = parsed.success
  ? parsed.data
  : { supabaseUrl: 'https://unconfigured.invalid', supabaseAnonKey: 'unconfigured' };
