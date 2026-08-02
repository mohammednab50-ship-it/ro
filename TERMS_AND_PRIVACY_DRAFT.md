# Terms of Use & Privacy Policy — DRAFT

**This is a drafted starting point, not a finished legal document.** It was
written to accurately describe what Rounds and Wards actually do today, but
it has not been reviewed by a lawyer. Before this is shown to real users
(especially in any setting where Wards handles real patient information),
have it reviewed by legal counsel familiar with healthcare data rules in
your jurisdiction (e.g. HIPAA in the US, UK GDPR/Data Protection Act,
India's DPDP Act, or your local equivalent) — the right obligations differ
a lot by country and by whether "de-identified charting aid" or "covered
entity health record" is the more accurate description of how your
hospital actually uses this. Placeholders that need a real decision are
marked `[NEEDS INPUT: ...]`.

---

## Terms of Use

**Last updated:** [NEEDS INPUT: date of actual publication]

By creating an account or using Rounds or Wards ("the apps"), you agree to
these terms.

### What the apps are

Rounds is a clinical-reference and study tool (drug/condition lookup,
spaced-repetition study aids, quizzes) for healthcare professionals. Wards
is a ward-based patient-charting tool (serial vitals, notes, and related
department-specific fields for General/ICU/Surgery/Pediatrics/Maternity
patients), with an optional feature to sync data to a shared database for
your care team.

**Neither app is a certified medical device, a replacement for your
institution's official electronic health record (EHR) or nursing
flowsheet, or a source of clinical guidance to be followed without your
own independent clinical judgment.** Content in Rounds (drug information,
condition summaries, interaction checks, dosing calculators) is a
reference aid only — always verify against your institution's protocols
and current primary sources before acting on it. Wards is a charting
convenience for your own workflow — your institution's official record
system remains the definitive medical record; always chart there as
required by your employer's policy.

### Accounts

Creating an account requires a valid email address (or a Google account,
if you choose that sign-in method). You're responsible for keeping your
account credentials secure and for anything done using your account.
Wards additionally offers an optional device-level PIN/biometric lock —
this is separate from your account and does not replace normal account
security practices (a strong password, not sharing your login).

### Acceptable use

Don't use the apps to store or process real patient information unless
you're authorized by your institution to do so and are complying with
your institution's own data-handling policies and any applicable law.
Don't attempt to access another user's, ward's, or hospital's data beyond
what you're a legitimate member/admin of. Don't use the multi-hospital
tenancy feature to create a "hospital" you don't have real authority to
administer.

### [NEEDS INPUT: liability/warranty disclaimer language]

Standard boilerplate ("provided as-is, no warranty, limitation of
liability to the extent permitted by law") belongs here — this needs
actual legal drafting specific to your jurisdiction and risk tolerance,
not a placeholder written by an AI assistant.

### Changes to these terms

If these terms change in a way that matters, you'll be asked to review
and re-accept them the next time you sign in.

---

## Privacy Policy

**Last updated:** [NEEDS INPUT: date of actual publication]

This section describes what data the apps actually collect and where it
goes, as accurately as the current app code supports.

### Rounds

- **Account data:** your email address (and display name, if you sign in
  with Google), handled by Firebase Authentication. This is the only
  identifying data Rounds' account system stores.
- **Everything else is local-only.** Bookmarks, notes on saved entries,
  quiz/study history, settings, and all other Rounds data are
  stored only in your browser/device's local storage. **None of it is
  currently synced to any server** — if you clear your browser data or
  switch devices, it does not carry over. [NEEDS INPUT: update this
  section if/when bookmark sync to Firestore is built — as of this
  writing it is not.]
- Rounds makes outbound requests to PubMed/NCBI (for literature search) and
  openFDA (for some drug data) when you use those specific features — these
  requests go to those third-party services directly from your device, not
  through any server we operate, and are subject to those services' own
  terms.

### Wards

- **Account data:** same as above — email (and display name via Google
  sign-in), via Firebase Authentication.
- **By default, Wards is 100% local-only** — no account required, no data
  leaves your device, patient data lives only in local browser/device
  storage.
- **If you sign in and select or create a "hospital" and a "ward group"**
  (an explicit, opt-in action), patient data you enter for that ward group
  syncs to a shared cloud database (Google Firebase/Firestore) so your
  care team can see the same records in real time. This includes: patient
  identifiers you enter (name, bed, MRN if provided), vitals readings,
  clinical notes, and department-specific fields. **A private "nickname"
  field and a private "something that went well" reflection note are
  deliberately excluded from sync and from every export/print/SBAR
  feature** — those stay local-only by design.
- **Data isolation:** each "hospital" in this system is a fully separate,
  isolated tenant — hospital admins can only see and manage their own
  hospital's data, never another hospital's, enforced by server-side
  security rules, not just app behavior.
- **Who can see synced data:** members of the specific ward group a
  patient belongs to, that group's department admin (if any), and that
  hospital's admin(s). [NEEDS INPUT: confirm this matches your
  institution's actual data-governance expectations — e.g. does your
  hospital require broader or narrower visibility than "ward group
  members + department/hospital admins"?]
- **Audit trail:** for synced ward groups, Wards writes a lightweight log
  of who added/removed a patient, logged a reading, or logged an
  escalation, readable by that group's admin and above, for oversight
  purposes.
- **We (the software's operator) do not access your data ourselves** in
  the ordinary course of operating the app — Firestore access is governed
  entirely by the security rules described above, scoped to your own
  account's memberships. [NEEDS INPUT: if there's ever a legitimate
  operational reason for the software operator to access data — e.g.
  responding to a legal request, debugging a reported bug with the
  account holder's permission — that should be stated explicitly here,
  not left implicit.]
- **Data retention:** you can configure an automatic purge of archived
  (discharged) patient records after a set number of days, from within
  the app. [NEEDS INPUT: what happens to data on account deletion — is
  there a deletion process today? If not, that's a gap worth closing
  before this is a real, published privacy policy.]

### Both apps

- **No advertising, no data sale, no third-party analytics/tracking SDKs**
  are integrated into either app as of this writing.
- **Local device data** (settings, local-only patients/bookmarks, the app
  lock PIN hash, etc.) never leaves your device regardless of sign-in
  status, except via a backup/export feature you explicitly trigger
  yourself (e.g. "Export all data," CSV export) — those produce a file
  you control, not an automatic upload anywhere.

### [NEEDS INPUT: data subject rights section]

Depending on jurisdiction, you likely need an explicit section on how a
user can request access to, correction of, or deletion of their data —
this needs real operational backing (an actual process for handling such
a request), not just a policy statement.

### Contact

[NEEDS INPUT: a real contact — email address or process — for privacy
questions or data requests.]
