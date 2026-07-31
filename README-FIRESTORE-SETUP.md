# Firestore setup for ward/group access control

This covers the two things I can't do for you (no CLI access to your Firebase
project from this environment): publishing the security rules, and
bootstrapping the very first super-admin.

## 1. Publish the security rules

1. Open the [Firestore Rules editor](https://console.firebase.google.com/project/rounds-46bd6/firestore/rules)
   for the `rounds-46bd6` project.
2. Select all the existing text in the editor and delete it.
3. Copy the entire contents of `firestore.rules` (in this repo) and paste it in.
4. Click **Publish**.

Whenever the rules in `firestore.rules` change in the repo (I'll flag it when
it happens), repeat this — there's no automatic deploy from the repo to your
project without CLI credentials I don't have.

## 2. Bootstrap the first super-admin

The super-admin flag can only be granted by an *existing* super-admin — which
means the very first one has to be set by hand, once, directly in the
database. After that, they can promote/demote others from inside the app.

1. Sign in to Rounds as whoever should be the first super-admin (the
   hospital's choice, per your earlier answer — could be you, could be
   someone else). This creates their `users/{uid}` profile document
   automatically.
2. Open the [Firestore Data browser](https://console.firebase.google.com/project/rounds-46bd6/firestore/data)
   and find that person's document under the `users` collection — the
   document ID is their Firebase Auth UID. If you're not sure which one is
   theirs, check the `email` field on each doc, or find their UID under
   **Authentication → Users** in the console (the UID column) and match it.
3. Open that document, edit the `superAdmin` field, and set it to the boolean
   value `true` (not the string `"true"` — use the type dropdown next to the
   field to make sure it's Boolean).
4. Save. That person is now a super-admin and can manage every department and
   every ward group — across all patient departments (General/ICU/Surgery/
   Pediatrics/Maternity, tagged per-patient in one unified system) — from
   within the app, and can grant/revoke super-admin status for others going
   forward.

Department admins don't need this manual step — once a super-admin exists,
they create departments and assign department admins entirely from within
the app; only the very first hospital-wide super-admin needs this one-time
console edit.

## 3. Google Drive backups (admin-owned, not the live database)

Per your direction, the live data stays in Firestore (so real per-ward
security, real-time sync, and safe multi-user writes keep working) — Google
Drive is a periodic/on-demand **backup destination** that a department or
hospital admin connects with their own Google account, giving them a copy of
their data that they own and control outside of Firestore entirely.

How this will work once built: an admin clicks "Connect Google Drive" in the
app, which requests the narrow `drive.file` OAuth scope (the app can only see
files it created itself — not your whole Drive) via the same Google
sign-in already wired into the app. Backups then get written as JSON files
into a folder the app creates in that admin's Drive.

One real limitation worth knowing now: this app has no server component (no
backend beyond Firestore + these rules), so a backup can only run when an
admin has the app open — either a manual "Back up now" button, or a
"due for backup" check that fires next time they open the app, not a true
schedule that runs at 2am whether anyone's logged in or not. A genuinely
scheduled server-side backup would need a paid Firebase plan (Blaze) plus a
Cloud Function on a Cloud Scheduler trigger — possible later if it turns out
to matter, but out of scope for the client-only build happening now.

## Status: Wards is now wired to Firestore (optional, opt-in)

Wards now has its own sign-in (same Firebase project/accounts as Rounds —
email/password or Google) and, once signed in, a "Ward group" selector in
the cloud-sync panel (the icon next to Display settings in the header). A
user with no ward group selected keeps using Wards exactly as before —
100% local, no account required. Selecting a group makes new patients
sync to `wardGroups/{groupId}/patients/{patientId}` in real time
(`onSnapshot`, with Firestore's own offline persistence turned on via
`enablePersistence`), and writes a lightweight audit entry to
`wardGroups/{groupId}/auditLog` for patient add/remove, a new vitals
reading, and an escalation logged. A small dot on the cloud-sync icon
shows sync status (grey = not syncing, amber pulsing = writes pending,
green = synced, red = error), driven by Firestore's own
`SnapshotMetadata.hasPendingWrites` rather than a hand-rolled queue.

**Re-publish `firestore.rules`** (step 1 above) if you haven't since the
`auditLog` subcollection rules were added — repeat the copy/paste/Publish
steps whenever this file changes.

**What's still pending:**
- Rounds (`index.html`) has Firebase Auth but its own bookmarks are not
  yet synced to Firestore — that's a separate, not-yet-built piece of work
  distinct from the Wards patient-sync work described above.
- The department tier (department admins, `departments/{deptId}`) has no
  in-app UI yet — only the ward-group tier (create/join/select a group) is
  wired up. A department admin or super-admin still has to be set up by
  hand in the Firestore console for now.
- Invites (`wardGroups/{groupId}/invites`) have rules but no in-app UI —
  for now, adding a teammate to a ward group's `members` map has to be
  done by hand in the Firestore console (or by whoever built this next).
- The Google Drive backup feature described below hasn't been built.
- Both apps have an optional app-level lock (WebAuthn platform
  authenticator with a salted-PIN fallback, in Settings) — separate from
  Firebase sign-in, gating the UI itself rather than server access.
