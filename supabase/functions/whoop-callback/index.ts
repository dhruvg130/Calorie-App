// Supabase Edge Function (Deno) — where WHOOP's browser redirect lands.
//
// WHY THIS IS PUBLIC
// This is a browser redirect, not an API call. It arrives with no session at
// all — no JWT, no cookies — so `verify_jwt` must be false (see config.toml).
// That makes it the one unauthenticated surface in the project, so what it will
// act on is deliberately narrow.
//
// WHAT IDENTIFIES THE USER
// `state`, and only `state`. It is 32 random bytes generated server-side in the
// `whoop` function, stored against the user who began the flow, single-use, and
// valid for ten minutes. That makes it a credential, and it is treated as one:
//
//   * consumed atomically, so two racing callbacks cannot both succeed;
//   * never echoed back in the response, so it cannot leak via a screenshot,
//     browser history, or a shoulder;
//   * unknown or expired values produce the same generic page as a failed
//     exchange, so the endpoint reveals nothing about which states exist.
//
// A stolen `code` is useless on its own — exchanging it requires the client
// secret, which lives only in this project's function secrets.
//
// Deploy (note the flag — this function must NOT verify a JWT):
//   npx supabase functions deploy whoop-callback --no-verify-jwt

import { adminClient, readConfig, requestToken, storeTokens } from '../_shared/whoop.ts';

/**
 * The browser cannot be sent back into the app — Expo Go owns no custom scheme
 * — so this page is the end of the journey. The app notices the connection on
 * its own by polling, which is why this says to close the window rather than
 * offering a link that would not work.
 */
function page(title: string, message: string, ok: boolean): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #F6F7F9; color: #0F172A; padding: 24px;
  }
  .card {
    background: #fff; border-radius: 22px; padding: 32px 28px;
    max-width: 360px; width: 100%; text-align: center;
    box-shadow: 0 8px 30px rgba(15,23,42,.08);
  }
  .mark {
    width: 56px; height: 56px; border-radius: 999px; margin: 0 auto 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; background: ${ok ? '#D1FAE5' : '#FEE2E2'};
  }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0; color: #64748B; font-size: 15px; }
  @media (prefers-color-scheme: dark) {
    body { background: #0F172A; color: #F8FAFC; }
    .card { background: #1E293B; box-shadow: none; }
    p { color: #94A3B8; }
  }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">${ok ? '✓' : '!'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: ok ? 200 : 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // This page is a one-time result tied to a consumed state. Caching it, at
      // any layer, would serve a stale outcome to the next person through.
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

const problem = () =>
  page(
    'Could not connect',
    'That link has expired or was already used. Open the app and tap Connect WHOOP again.',
    false,
  );

type StateRow = {
  state: string;
  user_id: string;
  redirect_uri: string;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const config = readConfig();
  if (!config) {
    console.error('whoop-callback is missing required environment configuration');
    return problem();
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const denied = url.searchParams.get('error');

  if (denied) {
    return page(
      'Access declined',
      'WHOOP access was not granted. You can close this window.',
      false,
    );
  }

  if (!code || !state) return problem();

  const admin = adminClient(config);

  // Consume the state in a single conditional update. Doing this before the
  // exchange, and filtering on `consumed_at is null`, means two callbacks
  // racing with the same state cannot both proceed — only one update matches.
  const { data: claimed, error: claimError } = await admin
    .from('whoop_auth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state', state)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('state, user_id, redirect_uri')
    .maybeSingle<StateRow>();

  if (claimError) {
    console.error('Failed to claim WHOOP auth state', claimError.message);
    return problem();
  }
  // Unknown, already used, or expired — all indistinguishable from outside.
  if (!claimed) return problem();

  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      // Must be byte-identical to the one used at authorization; WHOOP checks.
      redirect_uri: claimed.redirect_uri,
    }),
  );

  if (!tokens) return problem();

  const stored = await storeTokens(admin, claimed.user_id, tokens);
  if (!stored) return problem();

  // Best-effort tidy-up of old rows; failure here must not affect the user.
  void admin.rpc('prune_whoop_auth_states');

  return page(
    'WHOOP connected',
    'You can close this window and go back to the app.',
    true,
  );
});
