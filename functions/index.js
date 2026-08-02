/**
 * Cloud Functions for the Wards/Rounds Firebase project.
 *
 * Two independent features live here:
 *   1. scheduledFirestoreBackup -- a daily export of the whole database
 *      to Cloud Storage, so a bad delete or bug isn't unrecoverable.
 *   2. Stripe subscription billing (createCheckoutSession, stripeWebhook,
 *      createPortalSession) -- per-hospital subscriptions. See
 *      README.md in this folder for the one-time setup both features
 *      need before they'll actually run (Blaze billing, a Storage
 *      bucket, a Stripe account and its secrets). Nothing here deploys
 *      itself -- `firebase deploy --only functions` from this repo,
 *      with the secrets configured first.
 *
 * None of this code is reachable by a normal app user: scheduled
 * functions only run on their cron, callable functions require a
 * signed-in Firebase Auth user (checked explicitly below on top of
 * Firebase's own verification), and the webhook verifies Stripe's
 * signature before trusting anything in the request body.
 */

const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onCall, onRequest, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret, defineString} = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const {v1: firestoreAdminV1} = require('@google-cloud/firestore');

admin.initializeApp();

/* ============================================================
   1. Scheduled Firestore -> Cloud Storage backup
   ============================================================ */

// Name of the Cloud Storage bucket to export into -- create it once
// (see README.md), then set this either by editing the default below
// before first deploy, or via:
//   firebase functions:config:set backup.bucket="YOUR_BUCKET_NAME"
// or simplest: just hardcode your bucket name here, it's not a secret.
const BACKUP_BUCKET = defineString('BACKUP_BUCKET', {
  description: 'Cloud Storage bucket name (no gs:// prefix) that nightly Firestore exports are written into.',
});

const firestoreAdminClient = new firestoreAdminV1.FirestoreAdminClient();

exports.scheduledFirestoreBackup = onSchedule(
  {
    schedule: '0 3 * * *', // 03:00 every day
    timeZone: 'Etc/UTC',
    // Backups are cheap but not free, and this is the kind of function
    // that should never silently stop working -- retry once on
    // transient failure instead of just skipping a night.
    retryCount: 1,
  },
  async (event) => {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const bucketName = BACKUP_BUCKET.value();
    if (!bucketName) {
      logger.error('scheduledFirestoreBackup: BACKUP_BUCKET is not configured -- see functions/README.md. Skipping.');
      return;
    }

    const databaseName = firestoreAdminClient.databasePath(projectId, '(default)');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputUriPrefix = `gs://${bucketName}/firestore-exports/${timestamp}`;

    logger.info(`Starting Firestore export to ${outputUriPrefix}`);
    const [operation] = await firestoreAdminClient.exportDocuments({
      name: databaseName,
      outputUriPrefix,
      // Empty = every collection. Fine for a database this size; if it
      // ever gets large enough that this matters, list specific
      // top-level collections here instead.
      collectionIds: [],
    });
    logger.info(`Export operation started: ${operation.name}`);
  }
);

/* ============================================================
   2. Stripe subscription billing -- per hospital, not per user.
   ============================================================
   Model: creating a hospital and its first ward group is always free
   (see isValidNewGroup in firestore.rules -- unchanged). Creating a
   *department* (multi-team organization within a hospital) requires
   hospitals/{hospitalId}.subscriptionStatus == 'active' (see
   isValidNewDepartment in firestore.rules). That field is written
   ONLY below, via the Admin SDK from the Stripe webhook -- there is
   no client write path for it, so a user can never grant themselves
   the paid tier.
   ============================================================ */

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_PRICE_ID = defineSecret('STRIPE_PRICE_ID');

function stripeClient() {
  // Lazy require + construct so a missing secret only breaks the
  // functions that actually need Stripe, not the whole file (the
  // scheduled backup above has nothing to do with Stripe).
  const Stripe = require('stripe');
  return Stripe(STRIPE_SECRET_KEY.value());
}

async function assertHospitalAdmin(uid, hospitalId) {
  if (!hospitalId || typeof hospitalId !== 'string') {
    throw new HttpsError('invalid-argument', 'hospitalId is required.');
  }
  const snap = await admin.firestore().doc(`hospitals/${hospitalId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Hospital not found.');
  const hospital = snap.data();
  if (!hospital.admins || !hospital.admins[uid]) {
    throw new HttpsError('permission-denied', 'Only a hospital admin can manage billing for it.');
  }
  return {ref: snap.ref, hospital};
}

/**
 * Callable from the app: starts (or resumes) a Stripe Checkout session
 * for the given hospital's subscription. Returns {url} to redirect to.
 */
exports.createCheckoutSession = onCall(
  {secrets: [STRIPE_SECRET_KEY, STRIPE_PRICE_ID]},
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const hospitalId = request.data && request.data.hospitalId;
    const {ref, hospital} = await assertHospitalAdmin(request.auth.uid, hospitalId);

    const stripe = stripeClient();
    let customerId = hospital.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {hospitalId},
        email: request.auth.token.email || undefined,
      });
      customerId = customer.id;
      await ref.set({stripeCustomerId: customerId}, {merge: true});
    }

    const successUrl = (request.data && request.data.successUrl) || 'https://example.com/billing-success';
    const cancelUrl = (request.data && request.data.cancelUrl) || 'https://example.com/billing-cancel';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{price: STRIPE_PRICE_ID.value(), quantity: 1}],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: hospitalId,
      subscription_data: {metadata: {hospitalId}},
    });

    return {url: session.url};
  }
);

/**
 * Callable from the app: opens the Stripe-hosted billing portal so a
 * hospital admin can update their card, change plans, or cancel --
 * self-serve, no support ticket needed.
 */
exports.createPortalSession = onCall(
  {secrets: [STRIPE_SECRET_KEY]},
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const hospitalId = request.data && request.data.hospitalId;
    const {hospital} = await assertHospitalAdmin(request.auth.uid, hospitalId);

    if (!hospital.stripeCustomerId) {
      throw new HttpsError('failed-precondition', 'No billing account yet -- start a subscription first.');
    }

    const stripe = stripeClient();
    const returnUrl = (request.data && request.data.returnUrl) || 'https://example.com/';
    const session = await stripe.billingPortal.sessions.create({
      customer: hospital.stripeCustomerId,
      return_url: returnUrl,
    });

    return {url: session.url};
  }
);

/**
 * Stripe webhook -- the only place subscriptionStatus is ever written.
 * Register this function's URL in the Stripe dashboard (see README.md)
 * for events: checkout.session.completed, customer.subscription.created,
 * customer.subscription.updated, customer.subscription.deleted.
 */
exports.stripeWebhook = onRequest(
  {secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET]},
  async (req, res) => {
    const stripe = stripeClient();
    const signature = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET.value());
    } catch (err) {
      logger.error('Stripe webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const hospitalId = session.client_reference_id;
          if (hospitalId) {
            await admin.firestore().doc(`hospitals/${hospitalId}`).set(
              {
                subscriptionStatus: 'active',
                stripeCustomerId: session.customer,
                stripeSubscriptionId: session.subscription,
              },
              {merge: true}
            );
            logger.info(`Hospital ${hospitalId} subscription activated via checkout.`);
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = event.data.object;
          const hospitalId = sub.metadata && sub.metadata.hospitalId;
          if (hospitalId) {
            const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;
            await admin.firestore().doc(`hospitals/${hospitalId}`).set(
              {
                subscriptionStatus: status,
                stripeSubscriptionId: sub.id,
                currentPeriodEnd: sub.current_period_end
                  ? admin.firestore.Timestamp.fromMillis(sub.current_period_end * 1000)
                  : null,
              },
              {merge: true}
            );
            logger.info(`Hospital ${hospitalId} subscription status -> ${status}`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          const hospitalId = sub.metadata && sub.metadata.hospitalId;
          if (hospitalId) {
            await admin.firestore().doc(`hospitals/${hospitalId}`).set(
              {subscriptionStatus: 'canceled'},
              {merge: true}
            );
            logger.info(`Hospital ${hospitalId} subscription canceled.`);
          }
          break;
        }

        default:
          // Unhandled event types are fine to ignore -- Stripe sends a
          // lot of events we don't need to act on.
          break;
      }

      res.json({received: true});
    } catch (err) {
      logger.error('Stripe webhook handler error:', err);
      res.status(500).send('Webhook handler error');
    }
  }
);

/* ============================================================
   3. Account deletion -- required for Play Store publishing (Google
   requires an in-app account-deletion path for any app with account
   creation), and a normal GDPR/DPDP "right to erasure" request either
   way. Has to be a Cloud Function: removing an admin's own uid from a
   hospital/department/ward-group's admins map is blocked client-side
   by firestore.rules' "admins.size() > 0" invariant (the same one that
   stops an admin removing themself as a client write) -- deleting an
   account is legitimately allowed to do that, but only server-side,
   and only after checking it won't orphan the org unit (see below).
   Deleting the actual Firebase Auth user also requires the Admin SDK.
   ============================================================ */
exports.deleteMyAccount = onCall({}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const uid = request.auth.uid;
  const db = admin.firestore();

  // ---- 1. Refuse if deleting this account would leave a hospital,
  // department, or ward group with zero admins -- same invariant
  // firestore.rules already enforces everywhere else an admin can be
  // removed. The user has to add a co-admin, or delete/hand off the
  // org unit, before their account can go.
  const blockers = [];

  // Ward-group admin status is indexed in groupMemberships, so this is
  // a cheap query rather than a collection scan.
  const myGroupAdminships = await db.collection('groupMemberships')
    .where('uid', '==', uid).where('role', '==', 'admin').get();
  for (const doc of myGroupAdminships.docs) {
    const groupId = doc.data().groupId;
    const groupSnap = await db.doc(`wardGroups/${groupId}`).get();
    if (!groupSnap.exists) continue;
    const members = groupSnap.data().members || {};
    const hasOtherAdmin = Object.entries(members).some(([memberUid, m]) => memberUid !== uid && m && m.role === 'admin');
    if (!hasOtherAdmin) blockers.push(`ward group "${groupSnap.data().name || groupId}"`);
  }

  // Hospitals and departments have no admin-uid index (admin status
  // only lives in each doc's own `admins` map) -- this scans both
  // collections. Fine at this app's current scale; add a proper
  // adminOf index if either collection ever gets large enough for that
  // to matter.
  const [hospitalsSnap, departmentsSnap] = await Promise.all([
    db.collection('hospitals').get(),
    db.collection('departments').get(),
  ]);
  for (const doc of hospitalsSnap.docs) {
    const admins = doc.data().admins || {};
    if (admins[uid] && !Object.keys(admins).some((otherUid) => otherUid !== uid)) {
      blockers.push(`hospital "${doc.data().name || doc.id}"`);
    }
  }
  for (const doc of departmentsSnap.docs) {
    const admins = doc.data().admins || {};
    if (admins[uid] && !Object.keys(admins).some((otherUid) => otherUid !== uid)) {
      blockers.push(`department "${doc.data().name || doc.id}"`);
    }
  }

  if (blockers.length) {
    throw new HttpsError(
      'failed-precondition',
      `You're the only admin of ${blockers.join(', ')} -- add a co-admin or delete it before deleting your account.`
    );
  }

  // ---- 2. Not blocked -- remove this uid everywhere it appears.
  const batch = db.batch();

  const myGroupMemberships = await db.collection('groupMemberships').where('uid', '==', uid).get();
  for (const doc of myGroupMemberships.docs) {
    batch.delete(doc.ref);
    batch.update(db.doc(`wardGroups/${doc.data().groupId}`), {
      [`members.${uid}`]: admin.firestore.FieldValue.delete(),
    });
  }
  const myDeptMemberships = await db.collection('departmentMemberships').where('uid', '==', uid).get();
  for (const doc of myDeptMemberships.docs) batch.delete(doc.ref);

  for (const doc of hospitalsSnap.docs) {
    if ((doc.data().admins || {})[uid]) {
      batch.update(doc.ref, {[`admins.${uid}`]: admin.firestore.FieldValue.delete()});
    }
  }
  for (const doc of departmentsSnap.docs) {
    if ((doc.data().admins || {})[uid]) {
      batch.update(doc.ref, {[`admins.${uid}`]: admin.firestore.FieldValue.delete()});
    }
  }

  batch.delete(db.doc(`users/${uid}`));

  await batch.commit();

  // ---- 3. Delete the actual sign-in account. Content this user
  // authored elsewhere (chat messages, audit-log entries, vitals log
  // entries) is deliberately left in place -- those are immutable
  // clinical/audit records other people on the same ward rely on, not
  // personal data tied to a live account, and they already store a
  // plain display name captured at the time rather than a live
  // reference back to this profile.
  await admin.auth().deleteUser(uid);

  return {ok: true};
});
