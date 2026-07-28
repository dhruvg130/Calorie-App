# Supabase setup

Everything the backend needs, in the order to do it. Takes about 10 minutes.

---

## 1. Create the project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. Name it `calorie-tracker`, pick a region near you, and let it generate a
   database password. **Save that password in your password manager** — you
   cannot view it again, and you need it for the CLI later.
3. Wait for provisioning to finish (~2 minutes).

---

## 2. Apply the schema

1. In the dashboard sidebar, open **SQL Editor** → **New query**.
2. Paste the entire contents of [`migrations/0001_init.sql`](./migrations/0001_init.sql).
3. Click **Run**. You should see `Success. No rows returned`.

The script is idempotent, so re-running it after an edit is safe.

### Verify it worked

Run this in the SQL Editor. Every row must show `rls_enabled = true`:

```sql
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;
```

And confirm the policies exist — expect 3 for `profiles`, 4 for `food_entries`:

```sql
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

---

## 3. Get your app credentials

In the dashboard: **Project Settings → API**.

| What you need | Where | Goes in |
| --- | --- | --- |
| Project URL | "Project URL" | `EXPO_PUBLIC_SUPABASE_URL` |
| Anon / public key | "Project API keys" → `anon` `public` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |

Then, in the project root:

```bash
cp .env.example .env
```

Fill in both values and restart the dev server with `npx expo start --clear`
(environment variables are inlined at bundle time, so a plain reload will not
pick them up).

> **Never copy the `service_role` key into this project.** It bypasses Row Level
> Security completely. It has no legitimate use in a mobile app — if it ends up
> in the bundle, every user's data is readable by anyone who unzips the APK.

---

## 4. Email confirmation

New Supabase projects require email confirmation by default. The app handles
this properly (it tells the user to check their inbox rather than pretending
sign-up failed), but the confirmation emails from Supabase's shared SMTP are
heavily rate-limited and often land in spam.

**For development**, turning it off makes testing much faster:
**Authentication → Sign In / Providers → Email → toggle off "Confirm email"**.

**Before you ship**, turn it back on and configure your own SMTP provider under
**Project Settings → Auth → SMTP Settings**. Without confirmation, anyone can
register an account against someone else's email address.

---

## 5. Deploy the USDA search function

Food search runs through an Edge Function so the USDA API key never enters the
app bundle. See the header comment in
[`functions/usda-search/index.ts`](./functions/usda-search/index.ts) for why the
function re-verifies the caller rather than trusting `verify_jwt` alone.

1. Get a free key (instant, emailed): <https://fdc.nal.usda.gov/api-key-signup>

2. Link the CLI to your project — this opens a browser to log in, then asks for
   the database password from step 1:

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

   Your project ref is the subdomain of your Project URL:
   `https://abcdefghijklm.supabase.co` → `abcdefghijklm`.

3. Store the key as a secret (this stays server-side, never in git):

   ```bash
   npx supabase secrets set USDA_API_KEY=your-usda-key-here
   ```

4. Deploy:

   ```bash
   npx supabase functions deploy usda-search
   ```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected into the function runtime
automatically — you do not set those yourself.

---

## Storage

`0001_init.sql` already creates the `meal-images` bucket as **private**, capped
at 5 MB per file and restricted to JPEG/PNG/WebP, with policies scoping every
user to a folder named after their user ID.

To confirm, run:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'meal-images';
```

`public` must be `false`. If it is `true`, images would be readable by anyone
with the URL.

---

## Troubleshooting

**"permission denied for table objects"** when running the migration — your SQL
Editor session lacks ownership of `storage.objects`. Create the four storage
policies through **Storage → Policies** in the dashboard UI instead; the
migration file shows the exact `USING` / `WITH CHECK` expressions to copy.

**Sign-up succeeds but no profile row appears** — the `on_auth_user_created`
trigger did not fire. Re-run the migration and check:

```sql
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass;
```

**Food search returns "temporarily unavailable"** — check the function logs in
**Edge Functions → usda-search → Logs**. The most common cause is a missing or
mistyped `USDA_API_KEY` secret.
