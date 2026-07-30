// Shared between the `whoop` function (which the app calls) and
// `whoop-callback` (which WHOOP's browser redirect hits). Both need to talk to
// WHOOP's token endpoint and both write the same two tables, so that lives here
// rather than being copied and left to drift.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
export const WHOOP_AUTHORIZE_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
export const WHOOP_API = 'https://api.prod.whoop.com/developer';

export const WHOOP_SCOPES = [
  'read:workout',
  'read:cycles',
  'read:recovery',
  'read:sleep',
  'read:body_measurement',
  // Without `offline`, WHOOP issues no refresh token and the connection dies
  // about an hour later.
  'offline',
].join(' ');

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Generic messages only — never echo WHOOP's errors to the client. */
export function fail(status: number, message: string): Response {
  return json({ error: message }, status);
}

export type WhoopConfig = {
  clientId: string;
  clientSecret: string;
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

/** Null when anything is missing, so callers fail closed rather than half-configured. */
export function readConfig(): WhoopConfig | null {
  const clientId = Deno.env.get('WHOOP_CLIENT_ID');
  const clientSecret = Deno.env.get('WHOOP_CLIENT_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!clientId || !clientSecret || !supabaseUrl || !anonKey || !serviceRoleKey) return null;
  return { clientId, clientSecret, supabaseUrl, anonKey, serviceRoleKey };
}

/** Service-role client: the only thing that can reach whoop_tokens. */
export function adminClient(config: WhoopConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type WhoopTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

export async function requestToken(body: URLSearchParams): Promise<WhoopTokenResponse | null> {
  let response: Response;
  try {
    response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error('WHOOP token request failed', error);
    return null;
  }

  if (!response.ok) {
    // Status only. Some error shapes echo the client secret back, and this
    // lands in logs.
    console.error('WHOOP token endpoint responded with status', response.status);
    return null;
  }

  const data = (await response.json()) as WhoopTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    console.error('WHOOP token response was missing tokens');
    return null;
  }
  return data;
}

export function expiryFrom(expiresIn: number | undefined): string {
  const seconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * Persists a freshly issued token pair and marks the connection live.
 *
 * Returns false on any failure so the caller can report a problem rather than
 * leaving the user believing they are connected when nothing was stored.
 */
export async function storeTokens(
  admin: SupabaseClient,
  userId: string,
  tokens: WhoopTokenResponse,
): Promise<boolean> {
  const { error: tokenError } = await admin.from('whoop_tokens').upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiryFrom(tokens.expires_in),
      scope: tokens.scope ?? null,
    },
    { onConflict: 'user_id' },
  );

  if (tokenError) {
    console.error('Failed to store WHOOP tokens', tokenError.message);
    return false;
  }

  const { error: connectionError } = await admin.from('whoop_connections').upsert(
    {
      user_id: userId,
      scope: tokens.scope ?? null,
      connected_at: new Date().toISOString(),
      needs_reauth: false,
    },
    { onConflict: 'user_id' },
  );

  if (connectionError) {
    console.error('Failed to store WHOOP connection', connectionError.message);
    return false;
  }

  return true;
}
