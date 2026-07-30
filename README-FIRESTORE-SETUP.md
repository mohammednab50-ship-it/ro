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
4. Save. That person is now a super-admin and can manage all wards/groups in
   both Vitals and Maternity from within the app, and can grant/revoke
   super-admin status for others going forward.

## What's still pending

The rules above describe the target data model, but the app's actual data
layer (Vitals/Maternity tabs) hasn't been migrated from local-only storage to
Firestore yet — that's the next piece of work. Nothing in the app will use
these collections until that migration lands, so it's safe to publish these
rules now; they won't affect anything currently working.
