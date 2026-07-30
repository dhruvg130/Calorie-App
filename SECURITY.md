# Security review

Reviewed against the project's security requirements. Every claim below was
verified by running it against the live Supabase project, not by reading code.

**Result: no critical or high findings. Three items to address before shipping,
all configuration rather than code.**

---

## Threat model in one paragraph

The mobile app ships with the Supabase anon key compiled into its JavaScript
bundle, where anyone can extract it. The app is therefore **not** a trust
boundary: an attacker can craft arbitrary PostgREST and Storage requests with a
valid key. Everything that protects user data has to live in the database —
Row Level Security, column privileges, and CHECK constraints. The review below
is mostly an audit of that assumption holding.

---

## Verified

### Data isolation between accounts

Tested with two real accounts against the live database.

| Attempt by user B | Result |
| --- | --- |
| List user A's entries | 0 rows |
| Read A's entry by direct id | 0 rows |
| Update A's entry | 0 rows affected |
| Delete A's entry | 0 rows affected |
| Read A's profile | 0 rows |
| Upload into A's storage folder | Rejected |
| A's data intact afterwards | Confirmed |

### Anonymous access

| Target | Result |
| --- | --- |
| `GET /rest/v1/food_entries` with anon key | `401` — `permission denied` (`42501`) |
| `GET /rest/v1/profiles` with anon key | `401` — `permission denied` (`42501`) |
| `POST /storage/v1/object/list/meal-images` | `200` returning `[]` |

The storage `200` is correct rather than a leak: the endpoint succeeds and RLS
filters every row out. It was checked explicitly because a 200 here would
otherwise look alarming.

### Ownership cannot be forged

| Attempt | Result |
| --- | --- |
| Insert an entry with someone else's `user_id` | Rejected (`42501`) |
| Reassign `user_id` on an existing entry | Rejected (`42501`) |
| Create a `profiles` row for another user | Rejected (`42501`) |

`user_id` defaults to `auth.uid()` in the database and the RLS `WITH CHECK`
clause rejects any value that disagrees with the session, so ownership is
decided server-side and never asserted by the client.

### Data integrity

| Attempt (sent directly to the API, bypassing the app) | Result |
| --- | --- |
| Write `total_calories` directly | Rejected (`428C9`, generated column) |
| Negative calories | Rejected (`23514`) |
| Zero serving quantity | Rejected (`23514`) |
| Invalid `source` value | Rejected (`23514`) |
| Empty name | Rejected (`23514`) |
| `consumed_at` far in the future | Rejected (`23514`) |
| Daily goal of 999999 | Rejected (`23514`) |

`total_calories` is `GENERATED ALWAYS AS (calories_per_serving * serving_quantity)`,
and INSERT/UPDATE on that column is revoked from `authenticated`. Verified:
95 × 2.5 stored as 237.5, and a direct write attempt fails.

Every bound in `src/lib/validation.ts` has a matching CHECK constraint. The zod
schema is for fast feedback; the constraint is the enforcement.

### Secrets

- No secrets in tracked files. The only matches for secret-shaped patterns are
  the warnings in `.env.example` and `supabase/README.md` telling you *not* to
  use the `service_role` key.
- **No secrets anywhere in git history** (0 matches across all commits).
- `.env` is gitignored and untracked.
- `USDA_API_KEY` appears nowhere in app code — it exists only as an Edge
  Function secret.

The `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` values *are*
in the bundle. That is by design; the anon key is meant to be public and RLS is
the actual boundary.

### Edge Function authentication

| Request | Result |
| --- | --- |
| No `Authorization` header | `401` |
| Anon key as the bearer token | `401` |
| Real user session | `200` |

This is the subtle one. `verify_jwt = true` only proves a request carries a
JWT signed by this project — and the anon key **is** such a JWT, shipped in
every copy of the app. Relying on it alone would let anyone drain the USDA
quota. The function resolves the token to an actual user and rejects anything
else.

### Token handling

- Sessions are stored via `expo-secure-store` (iOS Keychain / Android Keystore),
  not plaintext AsyncStorage.
- SecureStore caps values near 2KB and a Supabase session exceeds that, so the
  adapter chunks it — and deletes stale chunks when a shorter value replaces a
  longer one, which would otherwise splice old ciphertext onto a fresh session.
  A torn record is treated as absent rather than handed to Supabase.
- `detectSessionInUrl: false` — no URL parsing in a native app.
- Auto-refresh is suspended while the app is backgrounded.
- Sign-out clears the React Query cache, so a second account on the same device
  cannot see the previous account's rows.
- No code logs a session or token (grepped).

### Error handling

`toUserMessage()` is the only path to the UI. Postgres errors, which name
tables and constraints, and auth errors, which distinguish "no such user" from
"wrong password", are both mapped to generic text. Sign-in with a non-existent
account returns the same message as a wrong password, so the screen cannot be
used to enumerate accounts. Raw errors are logged **only** under `__DEV__`
(verified: the single `console.warn` in the codebase sits inside that guard).

### Privacy and least privilege

- Only an email address and a calorie goal are collected. No name, no body
  metrics, no analytics, no third-party SDKs.
- `exif: false` on image capture strips GPS and device metadata **before** the
  photo leaves the phone.
- Camera permission is requested at the moment of use, with a purpose string.
- Microphone is explicitly disabled (`recordAudioAndroid: false`) — the camera
  is only ever used for stills and barcodes.
- No `android.permissions` are declared beyond what the plugins require.
- `profiles` has no DELETE policy: a user has no reason to delete their settings
  row, and account deletion cascades anyway.

### Image storage

- Bucket is **private**, capped at 5MB, restricted to JPEG/PNG/WebP — all
  enforced by the storage API, not the client.
- Paths are `<user_id>/<uuid>.jpg`, scoped two independent ways: storage
  policies key on the first path segment, and a CHECK constraint on
  `food_entries.image_path` requires the same prefix.
- Reads go through short-lived signed URLs (1 hour); no public URL is ever
  stored.
- Images are re-encoded to JPEG before upload, so the declared MIME type always
  matches the actual bytes.

---

## To address before shipping

### 1. Email confirmation is OFF — High, configuration

Verified live: sign-up returns a session immediately. Anyone can register an
account against **someone else's email address**.

This was switched off deliberately so automated testing could run, and is fine
for development. Before any real user touches this:
**Authentication → Sign In / Providers → Email → enable "Confirm email"**, and
configure your own SMTP under **Project Settings → Auth → SMTP** (the shared
Supabase mailer is heavily rate-limited).

The app already handles the confirmation state properly — it tells the user to
check their inbox rather than pretending sign-up failed.

### 2. Test accounts still exist — Low, hygiene

Roughly eight `calorietest.*`, `fntest.*`, `ranktest.*`, `rank2.*`, `sec.*` and
`dhruv.uitest.001@` accounts remain from testing, plus a test "Bananas, raw"
entry on July 28. Delete them in **Authentication → Users**. This requires the
`service_role` key, so it has to be done from the dashboard.

### 3. No rate limiting on the search function — Low

`food-search` is authenticated, so it cannot be abused anonymously, but a
signed-in user can call it in a loop and burn the USDA quota (3600 req/hour).
Acceptable for a personal app. If this goes public, add a per-user counter or
put Supabase's built-in function rate limiting in front of it.

---

## Noted, not action items

**Dependency audit reports 20 high / 10 moderate.** Every one is build tooling —
`@expo/cli`, `@expo/config*`, `@jest/transform`, `@react-native/babel-*`. These
run on your machine during bundling and are not shipped inside the app. They are
also transitive dependencies of `expo` itself and cannot be upgraded
independently without breaking the SDK 54 pin. Worth re-checking when you next
move SDK versions; not worth forcing now.

**The anon key is in the bundle.** Intentional and unavoidable — see the threat
model above.

**Signed URLs last one hour.** Anyone who obtains the URL within that window can
view that image. Shortening the window is a trade against re-fetching; one hour
is a reasonable default for a private app.

---

## Not covered by this review

Stated plainly so the gaps are not mistaken for passes:

- **Meal-photo read path with real data.** No photo has been uploaded and saved
  yet, so cross-account *download* of an existing image was never exercised.
  The *upload* block was tested and passed, and the policies are symmetric, but
  this is inference rather than a test.
- **Android.** Out of scope by decision; nothing was verified there.
- **Penetration testing.** This is a code and configuration review plus targeted
  live probes, not an adversarial assessment.
- **Supabase's own infrastructure**, which is assumed sound.

---

## Re-running these checks

The isolation and constraint probes are worth repeating after any schema change.
Confirm RLS is still on with:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```

Both tables must report `true`. `0001_init.sql` also sets `force row level
security`, so the policies apply even to the table owner — which closes the gap
where a `SECURITY DEFINER` function would otherwise see every row.
