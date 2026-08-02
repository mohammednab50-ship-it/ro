# Rounds / Wards — path to a real multi-hospital product

Reference doc for turning this from a working prototype into something you
can sell and run across real hospitals with real patient data. Written for
you as the founder/sole doctor behind this, not as legal or financial advice
— the compliance and business-formation sections below need a real lawyer
and accountant, not an AI assistant.

**Status legend:** ✅ done · 🔨 in progress / partially built · ⛔ not started
· 🚫 blocking (needs a human professional, not code)

---

## 1. Legal & compliance — blocking

Nothing here can be finished by writing code. This is the one category
where real hospitals with real patient data are waiting on you, not on me.

- 🚫 **Healthcare/data-privacy lawyer.** Which regime applies depends on
  where your hospitals are: HIPAA (US), DPDP Act (India), UK GDPR, etc. —
  they set different rules for breach notification, required contracts,
  and data residency. Get this before your first real (non-pilot) hospital.
- 🚫 **Business Associate Agreement (US) or equivalent data-processing
  agreement** — a contract with each hospital defining who's liable for
  what if data leaks.
- 🔨 **Terms of Use / Privacy Policy** — `TERMS_AND_PRIVACY_DRAFT.md` in
  this repo is an accurate *description* of what the app does, written by
  me, but it is explicitly **not reviewed by a lawyer** and has
  `[NEEDS INPUT]` placeholders. Needs real legal review before real PHI
  flows through it.
- 🚫 **Tech E&O / cyber liability insurance.** Ask your insurer whether a
  charting tool needs anything malpractice-adjacent even though it's
  positioned as "not the official medical record."
- 🚫 **A company entity** (LLC, Pvt Ltd, etc.) — don't sell hospital
  software as an individual with unlimited personal liability.

## 2. Technical hardening for production

- ⛔ **Firebase Blaze plan** (pay-as-you-go) — required for scheduled
  Cloud Functions (backups, billing webhooks) and for real production
  reliability. The free Spark plan doesn't support what's in section 3-4
  below.
- 🔨 **Automated backups** — `functions/` in this repo now has a scheduled
  Firestore→Cloud Storage export function. See `functions/README.md` for
  the one-time setup (bucket, IAM, enabling Blaze) — I can write the code
  but can't click the buttons in your GCP/Firebase console myself.
- ⛔ **Real deploy pipeline.** Right now, publishing `firestore.rules`
  means copy-pasting into the console by hand. Fine solo; risky once
  mistakes are expensive. Firebase CLI + a simple CI job (or even just you
  running `firebase deploy` locally with the CLI installed) fixes this.
- ⛔ **Independent security review** of `firestore.rules` before real PHI
  flows through — I've reasoned through it carefully and validated it
  against a local emulator, but that's not the same bar as a paid,
  independent pentest, which hospitals may require contractually anyway.
- ⛔ **Error monitoring** (e.g. Sentry) — find out about a bug before a
  nurse does.
- ⛔ **Production-signed Android build + Play Store listing.** The APKs
  built so far are debug/sideload only. Health-data apps get extra Play
  Store review (Data Safety form, sensitive permissions declarations).
- ⛔ **iOS build** — doesn't exist yet. Needs a separate Capacitor iOS
  project, a Mac, Xcode, and an Apple Developer account ($99/yr).

## 3. Automated backups

**Status: 🔨 code written, needs your one-time GCP setup to activate.**

`functions/index.js` exports `scheduledFirestoreBackup`, a Cloud Function
on a daily cron that exports the entire Firestore database to a Cloud
Storage bucket via the Firestore Admin API. See `functions/README.md` for
exact setup steps (create the bucket, grant IAM roles, deploy). This needs
Blaze billing enabled — exports themselves are usually pennies for a
database this size, but Blaze is required to run scheduled functions at
all.

## 4. Subscription billing

**Status: 🔨 code written, needs your Stripe account to activate.**

Model chosen (see `functions/README.md` for the reasoning): billing is
**per hospital**, not per user. Core patient charting (adding patients,
logging vitals, one ward group) stays free forever — never hold basic
patient-safety charting behind a paywall. The paid tier unlocks
multi-department organization and is where real hospital-scale usage
naturally needs it.

- `functions/index.js` — `createCheckoutSession`, `stripeWebhook`,
  `createPortalSession` (Stripe Checkout + Customer Portal, the standard
  low-code Stripe integration for subscriptions).
- `firestore.rules` — department creation now checks
  `hospitals/{hospitalId}.subscriptionStatus == 'active'`.
- `wards.html` — a "Billing" section in the sync panel: current plan,
  "Upgrade" (opens Stripe Checkout), "Manage billing" (opens the Stripe
  Customer Portal for self-serve plan changes/cancellation).
- **You still need to:** create a Stripe account, create a Product/Price
  in the Stripe dashboard, set the secret key and webhook secret as
  Firebase function secrets, and register the webhook URL in Stripe. All
  covered step by step in `functions/README.md`.

## 5. Business model

- **Per-hospital subscription** (chosen) — simplest to reason about,
  matches how hospitals actually buy software (one budget line, one
  admin), and how the code above is wired.
- Alternative models considered: per-seat/per-user pricing, or a
  Rounds-free / Wards-paid split. Both are viable later; per-hospital is
  the simplest starting point.

## 6. Go-to-market

- **Your own network is the real unlock.** Start with 1-2 hospitals you
  already have a relationship with, run a free pilot, get real feedback
  and a testimonial/case study before spending money on anything else.
- Bottom-up (individual doctors/nurses adopt informally) vs. top-down
  (sell to hospital administration) are different sales motions —
  bottom-up is faster to start, top-down is what pays for real
  multi-hospital licensing.
- Standard channels for B2B health software: conferences, medical
  associations, LinkedIn content aimed at hospital administrators/CNOs,
  and word of mouth from pilot hospitals. Paid ads rarely move the needle
  here.

## Suggested order of operations

1. Talk to a healthcare/data-privacy lawyer; get real Terms/Privacy and a
   data-processing agreement template. *(Blocking — do this now, in
   parallel with everything below.)*
2. Form a company entity.
3. Meanwhile: enable Blaze, deploy the backup function, set up Stripe and
   deploy the billing functions (all in `functions/README.md`).
4. Run a free pilot with 1 hospital (yours) to find bugs and workflow
   gaps with real users before charging anyone.
5. Production-signed build, Play Store listing.
6. Then: paid onboarding of a handful of hospitals, and only then real
   marketing spend.
