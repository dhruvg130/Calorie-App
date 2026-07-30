# Privacy Policy — Calorie Tracker

**Last updated:** 30 July 2026

This policy explains what Calorie Tracker ("the app") collects, where it is stored, and what
control you have over it. Contact: **dhruvguptadhruv@yahoo.com**

## What the app collects

**Account.** Your email address and password, handled by our authentication provider (Supabase).
Passwords are stored as salted hashes — nobody, including us, can read your password.

**Food you log.** The food's name and brand, calories, protein, carbohydrate and fat figures, the
serving size you entered, the barcode if you scanned one, and the date and time you logged it.

**Weight.** Weigh-ins you enter, stored in kilograms, with the calendar day each belongs to, plus
whether you prefer to see pounds or kilograms.

**Your daily calorie goal.**

**Meal photos**, if you attach one. Photos are stored in private storage readable only by your
account.

**WHOOP data**, only if you choose to connect a WHOOP account. With your permission we retrieve
your workouts, daily cycle summary, recovery scores and sleep summaries. You choose whether to
connect, and you can disconnect at any time.

## What the app does not do

- No advertising, and no advertising identifiers.
- No analytics, tracking, or behavioural profiling. There is no third-party analytics SDK in the
  app.
- Your data is never sold, rented, or shared with data brokers.
- No access to your contacts, location, or browsing activity.

## Where your data lives

Data is stored in a Postgres database and object storage hosted by
[Supabase](https://supabase.com). Every table is protected by Row Level Security, which means the
database itself enforces that your rows can only be read by your account — not merely the app's
code.

## Who else sees your data

- **Supabase** — our hosting and database provider, acting as a processor on our behalf.
- **Open Food Facts** — when you scan a barcode, that barcode number is sent to the Open Food Facts
  database to look up nutrition information. No account information, and nothing identifying you, is
  sent with it.
- **WHOOP** — only if you connect a WHOOP account, and only to retrieve the data listed above using
  the permissions you approve.

That is the complete list. There are no other recipients.

## Camera and photo permissions

The camera is used to scan barcodes and, where offered, to photograph meals. The photo library is
used only to attach a picture you pick. Nothing is uploaded unless you attach it to an entry.

## Keeping and deleting your data

Your entries are kept until you delete them or delete your account. Deleting an entry removes it
immediately. Deleting your account removes your profile, every food entry, every weigh-in, and any
meal photos — deletion cascades in the database, so nothing is left orphaned behind.

Disconnecting WHOOP stops any further sync and deletes the WHOOP data we have stored for you. You
can also revoke the app's access from your WHOOP account settings at any time.

To request deletion, or a copy of your data, email **dhruvguptadhruv@yahoo.com**.

## Your rights

Depending on where you live, you may have the right to access, correct, export, or delete your
personal data, and to withdraw consent for optional processing such as the WHOOP connection. Email
us at the address above and we will action it.

## Changes

If this policy changes materially, the "last updated" date above will change and the new version
will be published at this URL.
