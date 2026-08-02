# Setup: automated backups + Stripe billing

This is the part I can't do for you from this environment — I don't have
credentials to your Firebase/GCP project or your Stripe account. Everything
below is a one-time setup, done from your own machine. None of it is
complicated, but it does need to happen in order.

If you're new to this: `firebase deploy` is the same idea as
"push my code changes live" — you run it from a terminal on your own
computer, logged in as yourself, and it uploads whatever's in this folder
(and `firestore.rules`) to your actual project.

## 0. Prerequisites (do this once)

1. Install Node.js 20 if you don't have it: https://nodejs.org
2. Install the Firebase CLI: `npm install -g firebase-tools`
3. Log in: `firebase login` (opens a browser, sign in with the same Google
   account that owns the `wards-a4e41` project)
4. From the repo root: `firebase use wards-a4e41` (tells the CLI which
   project subsequent commands apply to)
5. Install the functions' own dependencies: `cd functions && npm install`

## 1. Enable Blaze billing

Scheduled functions and outbound network calls (to Stripe) require the
**Blaze (pay-as-you-go)** plan — the free Spark plan can't run either
feature. In the Firebase console: **Project settings → Usage and
billing → Modify plan → Blaze**. You'll attach a credit card, but at this
app's current scale the actual bill should be a few dollars a month at
most (Firestore export operations and function invocations are both
priced per-use and cheap at low volume). Set a budget alert while you're
in there (**Billing → Budgets & alerts**) so you get an email if usage
ever spikes unexpectedly — cheap insurance against a runaway bug.

## 2. Automated backups

1. **Create a Cloud Storage bucket** for backups (pick a globally-unique
   name, e.g. `wards-a4e41-firestore-backups`):
   ```
   gsutil mb -l us-central1 gs://wards-a4e41-firestore-backups
   ```
   (or create it in the console: **Cloud Storage → Buckets → Create**)
2. **Grant the Firestore export permission.** In the GCP Console → IAM,
   find the service account named
   `wards-a4e41@appspot.gserviceaccount.com` (the default App Engine
   service account — Cloud Functions run as this by default) and add the
   role **Cloud Datastore Import Export Admin**. It also needs write
   access to the bucket you just made — that's covered automatically if
   the bucket is in the same project, but if you see permission errors in
   the function logs later, add **Storage Object Admin** on that specific
   bucket to the same service account.
3. **Set the bucket name** the function should use:
   ```
   firebase functions:config:set backup.bucket="wards-a4e41-firestore-backups"
   ```
   Actually — this repo uses the newer `defineString` params style, which
   reads from a `.env` file instead. Create `functions/.env` (this file is
   gitignored, never commit it) with:
   ```
   BACKUP_BUCKET=wards-a4e41-firestore-backups
   ```
4. **Deploy just this function:**
   ```
   firebase deploy --only functions:scheduledFirestoreBackup
   ```
5. **Verify it once manually** instead of waiting for 3am: in the Firebase
   console → Functions, find `scheduledFirestoreBackup`, and use the
   "Test function" / trigger-now option (or `gcloud scheduler jobs run
   <job-name>` from the CLI). Check the bucket for a new
   `firestore-exports/<timestamp>/` folder afterward.

Restoring from a backup (hopefully you never need this, but know where it
is): `gcloud firestore import gs://wards-a4e41-firestore-backups/firestore-exports/<timestamp>`
— this is a destructive operation on the live database, so treat it like
you would any disaster-recovery step: only when you actually need it.

## 3. Stripe billing

1. **Create a Stripe account** at https://stripe.com if you don't have
   one. Stay in **Test mode** (toggle top-right of the dashboard) for
   everything below until you're ready to charge real hospitals.
2. **Create a Product + Price**: Dashboard → Product catalog → Add
   product. Name it something like "Wards — Hospital plan", set it to
   **Recurring**, pick monthly or annual, and your price. After saving,
   copy the **Price ID** (starts with `price_`).
3. **Get your API keys**: Dashboard → Developers → API keys. Copy the
   **Secret key** (starts with `sk_test_` while in test mode).
4. **Set these as Firebase secrets** (encrypted, never stored in your
   repo — this is the correct way to hand a Cloud Function a real secret):
   ```
   firebase functions:secrets:set STRIPE_SECRET_KEY
   firebase functions:secrets:set STRIPE_PRICE_ID
   ```
   (it'll prompt you to paste each value)
5. **Deploy the billing functions** (webhook secret comes after, see
   next step — deploy once now so you get the webhook's URL):
   ```
   firebase deploy --only functions:createCheckoutSession,functions:createPortalSession,functions:stripeWebhook
   ```
   The deploy output prints a URL for `stripeWebhook`, something like
   `https://us-central1-wards-a4e41.cloudfunctions.net/stripeWebhook`.
   Copy it.
6. **Register the webhook in Stripe**: Dashboard → Developers → Webhooks
   → Add endpoint. Paste the URL from the previous step. Select these
   events: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   After creating it, click into the endpoint and copy its **Signing
   secret** (starts with `whsec_`).
7. **Set that as a secret too, then redeploy** so the function picks it
   up:
   ```
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   firebase deploy --only functions:stripeWebhook
   ```
8. **Test it end to end** while still in Stripe test mode: sign in to
   Wards, create/select a hospital, open the sync panel, click "Upgrade
   hospital…". Stripe's test card is `4242 4242 4242 4242`, any future
   expiry, any CVC. After checkout completes, the "Plan" line in the sync
   panel should flip to "Active" within a few seconds (the webhook fires,
   writes `subscriptionStatus: 'active'` on the hospital doc, and the
   panel already re-reads it live) — and "Create department…" should stop
   being blocked.
9. **Go live**: flip Stripe out of test mode, repeat steps 2-7 with your
   live keys/price (test and live are separate objects in Stripe — a
   test-mode price ID won't work in live mode), and redeploy.

## Why departments specifically are the paywall

Every hospital gets its own tenant, its own admin, and one ward group for
free, forever — core patient charting should never be held hostage behind
a paywall. The paid tier (`subscriptionStatus == 'active'` on the hospital
doc) unlocks **departments**: organizing multiple ward groups under named
departments within one hospital, which is the feature that actually
matters once a hospital has real multi-team scale. See
`isValidNewDepartment()` in `firestore.rules` for the exact server-side
check — it's the only place `subscriptionStatus` is ever read for access
control, and `subscriptionStatus` is only ever written by `stripeWebhook`
using the Admin SDK, which bypasses these rules — no client write path
exists for it, so nobody can grant themselves the paid tier by hand.

If you want a different split (e.g. gate ward-group count instead, or gate
co-admin invites), that's a rules change plus a small tweak to
`isValidNewDepartment`/wherever you move the check — ask and I can wire it
differently.
