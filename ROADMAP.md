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

## 7. Path to becoming a real, certified EHR

**Status: ⛔ not started — mostly 🚫 blocking, this is the section where "EHR"
stops being marketing copy and becomes a load-bearing legal claim.**

Right now Wards is explicitly positioned as a *personal charting aid* —
the Terms/Privacy text says so, and the app tells users to always chart
definitively in their institution's official record system. "EHR" isn't a
feature you turn on; it's a regulated category, and calling Wards one
without doing the work below would be a false claim the moment a hospital
relies on it as their system of record. This section is the honest gap
between where the app is today and where a *real* EHR has to be.

**What "EHR" actually requires, depending on where your hospitals are:**
- 🚫 US: ONC Health IT Certification under the 21st Century Cures Act
  (the "Certified EHR Technology" / CEHRT label hospitals need for
  Meaningful Use / MIPS), plus HIPAA/HITECH compliance.
- 🚫 UK: clinical safety case under DCB0129 (manufacturer) / DCB0160
  (deploying organisation) — a formal, documented risk-management process
  specific to health IT, separate from general software QA.
- 🚫 EU: likely classified as a medical device under the MDR if it's used
  for clinical decision-making, which brings CE marking, a Quality
  Management System (commonly ISO 13485), and a Notified Body review.
- 🚫 All of the above: a lawyer determines which regime(s) actually apply
  to your hospitals — same blocking item as section 1, not a separate one.

**Technical/product gaps between Wards today and real EHR-grade behavior**
— these are things I *can* help build, unlike the certification paperwork
above:
- ⛔ **Append-only clinical entries.** Vitals/notes can currently be edited
  after the fact. Real medical-legal recordkeeping requires corrections as
  addenda (new entry referencing the old one), never silently overwriting
  what was charted — the corrected value and the original both need to
  stay visible with who/when for each.
- ⛔ **Fixed, jurisdiction-driven retention — not user-configurable
  auto-purge.** The current "auto-purge archived patients after N days"
  setting is the opposite of what a real record system needs: statutory
  retention periods (often 7-10+ years, sometimes longer for minors) that
  an individual user shouldn't be able to shorten.
- ⛔ **Interoperability (HL7 FHIR).** A real EHR exchanges data with the
  hospital's actual system of record, lab systems, etc. — not a closed
  silo. This is a genuinely large build (a FHIR-conformant API layer).
- ⛔ **Formal downtime/continuity procedure.** Certified EHRs document what
  clinical staff do when the system is unavailable — paper fallback,
  defined RPO/RTO for backups. Section 3's backup function is a start, not
  this.
- 🔨 **Audit trail** — partially there today (who added/removed a patient,
  logged a reading, or logged an escalation, per `firestore.rules`), but
  not yet append-only/tamper-evident in the way a certification review
  would expect, and doesn't yet cover every field edit.
- ⛔ **Independent security certification** (SOC 2 Type II or ISO 27001) —
  hospitals evaluating a real EHR vendor typically require this
  contractually; overlaps with section 2's "independent security review"
  but is a formal, recurring audit, not a one-time pentest.

**Suggested order, if you want to actually pursue this** (distinct from
the main roadmap below, since this is a multi-year, capital-intensive
track most software-first health startups only take on once they have
paying hospital customers who are pushing for it):
1. Talk to the healthcare/data-privacy lawyer from section 1 specifically
   about which certification regime(s) apply and whether your hospitals
   actually need certified status or just "good enough" compliance —
   many pilot/informal deployments never need full certification.
2. If yes: build the technical gaps above first (append-only entries,
   retention policy, audit trail hardening) — these make the product
   better regardless of certification, and de-risk the eventual audit.
3. Budget for a Quality Management System and the certification/audit
   process itself — this is typically a specialized consultant engagement,
   not something either of us can do in this repo.

## 8. Path to publishing Wards on Google Play with subscriptions

**Status: ⛔ not published yet — three blockers below, plus the setup
checklist that was already tracked in section 2.**

### Blockers specific to publishing (beyond section 2's general checklist)

- 🚫 **Google Play billing policy vs. the in-app Stripe upgrade button.**
  Play generally requires Google Play Billing (their cut: 15-30%) for
  subscriptions purchased *inside* the app, and restricts linking out to
  external payment for that purpose. A B2B, per-hospital-seat model like
  this one may qualify for Play's business/enterprise exemption, but
  that's a policy determination, not a code change — needs checking
  against Play's current Payments policy before the existing Stripe flow
  (`wards.html`'s "Upgrade hospital…" button, `functions/index.js`'s
  `createCheckoutSession`) is safe to ship as-is. If it doesn't qualify,
  the usual safe pattern is: hospital admins subscribe on a **web portal
  outside the app**, and the app only *reads* `subscriptionStatus` — a
  real architecture change, not a tweak, so worth resolving this first.
- ✅ **Account deletion.** Play requires an in-app path to delete an
  account for any app that supports creating one — done: Settings →
  Account → "Delete account…" in the signed-in cloud-sync panel, backed
  by `functions/index.js`'s `deleteMyAccount` callable. It blocks deletion
  if the user is the sole admin of a hospital/department/ward group
  (same "never zero admins" invariant `firestore.rules` already enforces
  elsewhere), otherwise removes their account, memberships, and admin
  status everywhere, and deletes the Firebase Auth user. Historical
  content they authored (chat, audit-log entries) stays, as shared
  clinical/audit record rather than personal account data — see the
  updated Terms/Privacy text for the user-facing version of this.
  **Still needed:** Play also wants a *web-accessible* deletion URL (not
  just in-app) — a small hosted page hitting the same callable, or
  documenting the in-app path on your public Terms/Privacy page.
- 🚫 **Published Terms/Privacy Policy at a public URL.** Play requires a
  privacy policy link on the store listing. The current text
  (`WARDS_TERMS_AND_PRIVACY_HTML` in `wards.html`) is in-app only,
  lawyer-unreviewed, and still has `[NEEDS INPUT]` placeholders — same
  blocker as section 1, surfaced again here because it specifically
  blocks store submission, not just "real" legal safety.

### Setup checklist (yours — no console/account access on my end)

Same items as section 2, called out again because they're the literal
list between here and a Play Store listing: Firebase Blaze plan, deploy
`firestore.rules` and the Cloud Functions in this file (backup + Stripe +
the new `deleteMyAccount`), a Stripe account/Product/Price/webhook, a
Play Console account, a **release signing keystore** (`android-wards`'s
`build.gradle` has an empty `release` block right now — no signing
config at all), OAuth consent screen branding (the `firebaseapp.com`
popup from earlier), and the Play Data Safety / Health apps declaration
forms (health-data apps get extra review). `versionCode`/`versionName`
in `android-wards/app/build.gradle` are still the untouched defaults
(`1`, `"1.0"`) — needs a real versioning scheme before first upload.

### Other product gaps worth closing before charging real hospitals

- ⛔ **Subscription-lapse UX.** Today, if a hospital's `subscriptionStatus`
  stops being `'active'`, department creation just starts failing at the
  rules layer with no explanatory in-app messaging — a bad experience
  mid-shift.
- ⛔ **Free trial.** The webhook already treats Stripe's `trialing` status
  as active; `createCheckoutSession` just needs to request a trial period
  when creating the session.
- ⛔ **Offline queue for chat sends** — they currently just fail with a
  toast on a dropped connection.
- ⛔ **Push notifications** — needs the native FCM path (see the earlier
  conversation); blocked on registering the Android app in Firebase
  Console and downloading `google-services.json`.
- ⛔ **Error monitoring** (e.g. Sentry) — carried over from section 2,
  worth prioritizing once real hospitals are paying.

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
