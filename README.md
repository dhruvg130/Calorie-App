# Calorie Tracker

A React Native calorie tracking app. Expo SDK 57, TypeScript, Expo Router, Supabase.

## Getting started

```bash
npm install
```

Then follow [`supabase/README.md`](./supabase/README.md) to create the project, apply the
schema, and get your keys. Copy `.env.example` to `.env` and fill it in.

```bash
npx expo start
```

Until `.env` is filled in, the app shows a setup screen explaining what is missing
rather than crashing.

| Command | What it does |
| --- | --- |
| `npm start` | Dev server |
| `npm run tunnel` | Dev server over a tunnel — use this to open the app on a phone that isn't on your Wi-Fi |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run web` | Run in a browser |

## Architecture

### Row Level Security is the security boundary — not the anon key

The anon key is compiled into the JS bundle and can be extracted from any shipped
build. That is expected: it is designed to be public. What actually keeps one user's
data away from another is Postgres RLS, enforced on every table in
[`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql).

Consequences that shaped the code:

- **Queries don't filter by user.** `fetchEntriesForDay` has no `.eq('user_id', …)`.
  RLS scopes the result. Adding a client-side filter would imply the client enforces
  isolation, which it does not.
- **Inserts don't send `user_id`.** The column defaults to `auth.uid()` and the RLS
  `WITH CHECK` rejects any value that disagrees with the session, so ownership is
  decided by the database rather than asserted by the client.
- **`total_calories` is a generated column.** Postgres computes
  `calories_per_serving × serving_quantity`; the client cannot write it. A tampered
  request cannot store a total that disagrees with its parts.

### Secrets live server-side; the USDA key never enters the bundle

Open Food Facts (barcodes) needs no key, so it is called directly. USDA FoodData
Central does, so it is proxied through the `usda-search` Edge Function.

The function does **not** rely on `verify_jwt` alone. That setting only proves the
request carries a JWT signed by the project — and the anon key *is* such a JWT,
shipped in every copy of the app. The function resolves the token to a real user and
rejects anything else, so the API quota cannot be drained by anyone who unzips the app.

### Session tokens go in the Keychain, chunked

Supabase sessions are stored via `expo-secure-store` (iOS Keychain / Android
Keystore) rather than AsyncStorage, which is plaintext. SecureStore caps values at
around 2 KB and a session with its JWTs exceeds that, so
[`src/lib/secureStorage.ts`](./src/lib/secureStorage.ts) transparently splits values
across numbered chunks — and clears stale chunks when a shorter value replaces a
longer one, which would otherwise splice old ciphertext onto a fresh session.

### Validation exists twice, deliberately

Every bound in [`src/lib/validation.ts`](./src/lib/validation.ts) has a matching
`CHECK` constraint in the migration. The zod schema gives fast, specific feedback in
the UI; the constraint is the actual enforcement, because a client-side rule is only
a suggestion to anyone holding the anon key. Change one, change the other.

### Errors are mapped, never forwarded

`toUserMessage` in [`src/lib/errors.ts`](./src/lib/errors.ts) is the only thing that
reaches the UI. Postgres errors name tables and constraints; auth errors can
distinguish "no such user" from "wrong password". Both become generic sentences, so
the screens cannot be used to map the schema or enumerate accounts. Raw errors are
logged only under `__DEV__`, so release builds leak nothing to logcat or Console.

### Images: private bucket, path-scoped, signed URLs

Meal photos are stored at `meal-images/<user_id>/<uuid>.jpg` in a private bucket.
Three independent things enforce ownership: the storage RLS policies check the first
path segment against `auth.uid()`, `food_entries.image_path` has a CHECK constraint
requiring the same prefix, and the bucket itself caps size at 5 MB and allows only
JPEG/PNG/WebP. The database stores the *path*; display goes through short-lived
signed URLs, so no permanent public link exists. EXIF is stripped at capture, so GPS
coordinates never leave the phone.

### One save path

`app/log/confirm.tsx` is the only screen that writes a food entry, reached identically
from search, barcode and photo. `ServingForm` is shared with the edit screen. Validation,
image upload and cache invalidation therefore exist once instead of four times.

### Nutrition sources sit behind an adapter

Both providers normalise to one `NutritionItem` shape, bound in
[`src/services/nutrition/index.ts`](./src/services/nutrition/index.ts). Screens never
import a vendor module, so swapping a provider is a change to that one file.

Photo recognition is the same shape: `FoodRecognizer` in
[`src/services/recognition/`](./src/services/recognition/) currently returns a clearly
labelled placeholder estimate that the user is asked to correct. The photo genuinely
uploads and the entry genuinely saves — only identification is stubbed. Implementing
the interface against a vision model (from an Edge Function, so that key also stays
server-side) is a one-file change.

### "Today" is local, storage is UTC

`consumed_at` is `timestamptz`. [`src/lib/date.ts`](./src/lib/date.ts) converts the
device's local calendar day into the UTC instant range to filter on, so a meal logged
at 11pm stays on the day it was eaten. Known limitation: crossing timezones can move
which day a past entry falls under.

## Layout

```
app/                     routes (Expo Router)
  (auth)/                sign-in, sign-up
  (tabs)/                Today, Add food
  log/                   search, scan, photo, confirm
  entry/[id].tsx         edit + delete
src/
  api/                   all Supabase access lives here
  components/ui/         design-system primitives
  hooks/                 React Query bindings
  lib/                   client, env, validation, errors, dates, storage
  providers/             auth + query providers
  services/              nutrition providers, photo recognition
  theme/                 colors, spacing, typography, shadows
supabase/
  migrations/            schema + RLS
  functions/usda-search/ Edge Function holding the USDA key
```
