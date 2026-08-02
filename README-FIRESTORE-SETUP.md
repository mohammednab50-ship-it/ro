# Firestore setup for ward/group access control

This is a single shared Firebase project (`wards-a4e41`) built for **true
multi-hospital tenancy** — many separate hospitals can use it at once, each
fully isolated from the others' data, with no cross-hospital backdoor of any
kind. This covers the one thing I can't do for you from this environment (no
CLI access to your Firebase project): publishing the security rules.

## 1. Publish the security rules

**Now that `firebase.json`/`.firebaserc` exist in this repo (added
alongside the billing/backup Cloud Functions — see `functions/README.md`),
the easiest way is the CLI, once you have it installed and logged in
(`npm install -g firebase-tools`, then `firebase login`):**

```
firebase deploy --only firestore:rules
```

Run from the repo root. This replaces the manual copy-paste below and
avoids the clipboard-corruption class of bug we ran into earlier (a
console paste once failed with "Unexpected 'match'" purely from how the
browser handled the paste, not a real bug in the file).

**If you don't have the CLI set up yet**, the console still works the same
as before:

1. Open the [Firestore Rules editor](https://console.firebase.google.com/project/wards-a4e41/firestore/rules)
   for the `wards-a4e41` project.
2. Select all the existing text in the editor and delete it.
3. Copy the entire contents of `firestore.rules` (in this repo) and paste it in.
4. Click **Publish**.

Whenever the rules in `firestore.rules` change in the repo (I'll flag it when
it happens), repeat whichever method you're using.

## 2. Becoming a hospital's admin — self-service, no console step

There is no manual bootstrap anymore. Creating a hospital *in the app* is how
you become its admin:

1. Sign in to Wards (the cloud-sync icon next to Display settings in the
   header — same account works for Rounds too).
2. In the sync panel, click **Create hospital…**, give it a name, and submit.
   You're immediately that hospital's sole admin — server-enforced by the
   rules, not just something the app claims.
3. That's it. You can now create ward groups under your hospital from the
   same panel (select your hospital, then **Create ward group…**).

Each hospital is a fully separate tenant sharing the one Firestore project:
a hospital's admin can only ever see and manage that hospital's own
departments and ward groups, never another hospital's — there is no
"super-admin who can see everything" role in this model at all. If you need
more than one hospital admin, or a department-admin tier, that's still done
by hand in the Firestore console for now (see "what's still pending" below)
— only the *very first* admin of each hospital needs zero console work,
which is the whole point of this change.

**Note if you set this project up before this change:** the old
`users/{uid}.superAdmin` flag no longer means anything and has been removed
from the rules entirely — nobody has bootstrapped it yet on this fresh
project, so there's nothing to migrate. If you had already flipped it by
hand, it's simply ignored now; create a hospital instead.

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
email/password or Google) and, once signed in, a "Hospital" section and a
"Ward group" selector in the cloud-sync panel (the icon next to Display
settings in the header). A user with no ward group selected keeps using
Wards exactly as before — 100% local, no account required. Selecting a
group makes new patients sync to `wardGroups/{groupId}/patients/{patientId}`
in real time (`onSnapshot`, with Firestore's own offline persistence turned
on via `enablePersistence`), and writes a lightweight audit entry to
`wardGroups/{groupId}/auditLog` for patient add/remove, a new vitals
reading, and an escalation logged. A small dot on the cloud-sync icon
shows sync status (grey = not syncing, amber pulsing = writes pending,
green = synced, red = error), driven by Firestore's own
`SnapshotMetadata.hasPendingWrites` rather than a hand-rolled queue.

Ward groups now always belong to a hospital (`hospitalId`, required by the
rules) — create or select your hospital in the same panel before creating a
ward group. See "Becoming a hospital's admin" above.

**Re-publish `firestore.rules`** (step 1 above) if you haven't since the
multi-hospital tenancy model (`hospitals/{hospitalId}`, and the removal of
the global `superAdmin` flag) was added — repeat the copy/paste/Publish
steps whenever this file changes.

**A real tenant-isolation gap was found and fixed before anyone published
these rules, so nothing was ever exposed live.** The first version of the
multi-hospital rules had `allow list: if signedIn()` on `hospitals`,
`departments`, and `wardGroups`, inherited unchanged from the old
single-hospital rules. In Firestore, `list` is a separate rule from `get`/
`read` and isn't filtered per-document the way a comment in the old file
implied — a condition with no check on the actual document data allows an
*unconstrained* query, so any signed-in user (any hospital, or none) could
have run something like `.collection('hospitals').get()` and received
every hospital's name and full admin list (uids + emails) across the whole
project, not just their own — same for departments and ward groups. Fixed
by checking what the app actually queries (`wards.html` never lists these
collections in bulk — it only ever reads a specific document by an ID it
already has, except `groupMemberships`, which does a real
`.where('uid','==',uid)` query) and tightening the rules to match: `list`
is now denied outright on `hospitals`/`departments`/`wardGroups`/`invites`
(unused, and unsafe if ever allowed unconstrained), and `groupMemberships`'
`list` rule now actually checks `resource.data.uid == request.auth.uid` to
match its real query instead of a blanket `signedIn()`.

## 4. Terms of Use / Privacy Policy acceptance gate

Both apps now gate a new or version-mismatched sign-in on agreeing to the
draft content in `TERMS_AND_PRIVACY_DRAFT.md` (an explicit checkbox +
"Agree & continue", not a plain OK; declining signs the user back out).

- **Wards** records this server-side, on `users/{uid}` (`agreedToTermsVersion`,
  `agreedAt` — see the schema comment at the top of `firestore.rules`), so it
  follows the account across devices. No rules change was needed for this —
  the existing self-read/write rule already covers arbitrary new fields.
- **Rounds** has no Firestore at all, so it records the same thing in
  `localStorage` instead (`rounds_terms_agreed_v1_<uid>`), keyed by uid. This
  is weaker than Wards' record: a Rounds user signing in from a different
  device/browser will be re-prompted, since there's nowhere server-side to
  check. That's a known limitation of Rounds' current architecture, not a
  bug — fixing it for real would mean giving Rounds a Firestore user-profile
  doc, which hasn't been built (see "what's still pending" below).
- Both apps re-prompt automatically if the stored version doesn't match the
  app's current version constant (`WARDS_TERMS_VERSION` in `wards.html`,
  `TERMS_VERSION` in `index.html`) — bump that constant any time the terms
  change materially.
- Users can re-read the same content any time from Settings ("Terms &
  Privacy" → View) without re-agreeing.

## 5. Self-service co-admins and ward-group invites

Two more console-only operations are now fully self-service, in-app:

**Adding a second admin to a hospital or department.** Open the cloud-sync
panel, select the hospital (or department), and click **Admins…** next to
it. Enter a colleague's email and click **Add as co-admin** — this resolves
their email to a uid via `usersByEmail` (now actually written to, at
sign-in: `wardsUpsertUsersByEmail` in `wards.html`; previously the
collection existed only in the rules/schema with nothing populating it) and
adds `{[uid]: {role:'admin', email, joinedAt}}` to the doc's `admins` map.
If nobody's signed up with that email yet, the app says so plainly and asks
you to try again once they have — there's no pending-invite tier for this
one, by design (see the Part 1/Part 2 split in the commit that added this).
The same modal lists current admins with a remove (×) button; removing the
last remaining admin is blocked both client-side and server-side
(`admins.size() > 0` in `firestore.rules`) — a hospital or department can
never be left adminless. No rules change was needed for the add/remove
writes themselves: an existing admin's `update` on their own hospital/
department was already unrestricted, so this was purely an app-code gap.

**Inviting a teammate to a specific ward group.** A group admin clicks
**Invite…** next to the ward-group picker and enters an email — this
writes two documents in one batch: `wardGroups/{groupId}/invites/{emailKey}`
(the existing, previously UI-less subcollection) and a new flat
`pendingInvites/{groupId}_{emailKey}` doc, which is what lets the invited
user *find* the invite at all without a collection-group query (see the
schema comment block in `firestore.rules` for the full reasoning). Anyone
signed in sees a "Pending invites for you" list in the cloud-sync panel
(queried via `.where('email','==', myEmail.toLowerCase())`) with Accept/
Decline buttons. Accepting is the one narrow, server-validated way a
not-yet-member can write to a `wardGroups` doc at all
(`isValidInviteAccept()` in `firestore.rules` — a diff-based carve-out that
only allows adding the caller's own uid to `members` with role `'member'`,
never `'admin'`, and touching no other field); declining just deletes both
invite records. An admin revoking a not-yet-accepted invite
(`wardsRevokeInvite` in `wards.html`) reuses the same
`isGroupAdminPath`/`isAboveGroupPath` delete permission the invites
subcollection already had — **note: this function has no admin-facing UI
wired up yet** (no "invites I've sent, with a revoke button" list exists;
an admin can still revoke by other means if this becomes a real need, but
it's a real gap worth closing next, not silently assumed solved).

**What's still pending:**
- Rounds (`index.html`) has Firebase Auth but its own bookmarks are not
  yet synced to Firestore — that's a separate, not-yet-built piece of work
  distinct from the Wards patient-sync work described above.
- ~~The department tier has no in-app UI~~ — fixed: the cloud-sync panel now
  has a "Create department…" button (enabled once a hospital is selected)
  and a department dropdown, same self-service creator-becomes-admin flow
  as hospitals. Creating a ward group under a selected department stamps
  its `departmentId`; picking a different hospital clears the department
  selection if it doesn't belong to the new one.
- ~~There's no in-app UI yet to add a *second* admin to a hospital/
  department~~ — fixed, see "Self-service co-admins and ward-group
  invites" above.
- ~~Invites (`wardGroups/{groupId}/invites`) have rules but no in-app UI~~
  — fixed, see above. The one remaining loose end: an admin has no
  in-app list of invites *they've sent* to revoke a not-yet-accepted one
  (the backend function exists — `wardsRevokeInvite` — just no button
  wired to it yet).
- The Google Drive backup feature described below hasn't been built.
- Both apps have an optional app-level lock (WebAuthn platform
  authenticator with a salted-PIN fallback, in Settings) — separate from
  Firebase sign-in, gating the UI itself rather than server access.
