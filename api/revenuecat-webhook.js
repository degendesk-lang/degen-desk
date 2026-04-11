/**
 * RevenueCat webhook — syncs Apple IAP entitlements to Firestore users.
 *
 * Configure at: https://app.revenuecat.com → Project Settings → Integrations → Webhooks
 *   URL:    https://degendesk.xyz/api/revenuecat-webhook
 *   Header: Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 *
 * Event reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 *
 * What we do:
 *   - On any "entitlement active" event  → set tier=pro, subscriptionStatus=active
 *   - On expiration/cancellation events  → set tier=free, subscriptionStatus=canceled
 *   - Always stamp revenueCatUserId, latest productId, expiresAt, store=APP_STORE
 *
 * The Firebase uid is stored as RevenueCat's app_user_id because iap.js calls
 * Purchases.logIn({ appUserID: firebaseUid }) after sign-in. If the purchase
 * happened while the user was anonymous, RevenueCat will send both the
 * original_app_user_id and the current app_user_id; we use app_user_id.
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();
const ENTITLEMENT_ID = "pro";

// Event types that imply the user SHOULD have pro access after the event.
const ACTIVE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "NON_RENEWING_PURCHASE",
  "TRIAL_STARTED",
  "TRIAL_CONVERTED",
]);

// Event types that imply the user should LOSE pro access.
const INACTIVE_EVENTS = new Set([
  "EXPIRATION",
  "CANCELLATION", // user canceled — access remains until expiration, but mark status
  "SUBSCRIPTION_PAUSED",
  "TRIAL_CANCELLED",
]);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- Auth: RevenueCat sends the configured Authorization header verbatim ---
  const expected = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.authorization || "";
    const bearer = got.startsWith("Bearer ") ? got.slice(7) : got;
    if (bearer !== expected) {
      console.warn("[RC] webhook auth failed");
      return res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    console.warn("[RC] REVENUECAT_WEBHOOK_SECRET not set — skipping auth check");
  }

  const payload = req.body;
  const event = payload && payload.event;
  if (!event || !event.type) {
    return res.status(400).json({ error: "Missing event payload" });
  }

  const type = event.type;
  // Prefer the current app_user_id (should be the Firebase uid after logIn).
  // Fall back to original_app_user_id for safety.
  const uid = event.app_user_id || event.original_app_user_id;
  const productId = event.product_id || null;
  const expiresAtMs = event.expiration_at_ms || null;
  const entitlementIds = Array.isArray(event.entitlement_ids) ? event.entitlement_ids : [];

  // Ignore events that aren't about our "pro" entitlement (if the field is set).
  if (entitlementIds.length > 0 && !entitlementIds.includes(ENTITLEMENT_ID)) {
    console.log(`[RC] ignoring ${type} — not for entitlement "${ENTITLEMENT_ID}"`);
    return res.status(200).json({ received: true, ignored: true });
  }

  // TEST event from the RevenueCat dashboard — just 200 it.
  if (type === "TEST") {
    console.log("[RC] TEST event received");
    return res.status(200).json({ received: true });
  }

  if (!uid) {
    console.warn(`[RC] ${type} without app_user_id — cannot map to Firebase user`);
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const userRef = db.collection("users").doc(uid);

    if (ACTIVE_EVENTS.has(type)) {
      // Load the user's current doc to check for a referral code and to avoid
      // double-crediting a referrer on RENEWAL events.
      const existingUserSnap = await userRef.get();
      const existingUserData = existingUserSnap.exists ? existingUserSnap.data() : {};
      const wasAlreadyPro = existingUserData.tier === "pro";

      await userRef.set(
        {
          tier: "pro",
          subscriptionStatus: "active",
          subscriptionStore: "APP_STORE",
          revenueCatUserId: uid,
          appleProductId: productId,
          appleExpiresAt: expiresAtMs ? new Date(expiresAtMs) : null,
          subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`[RC] ${type} → user ${uid} upgraded to Pro (${productId})`);

      // Referral commission processing — Apple IAP path.
      //
      // We credit the referrer on:
      //   - INITIAL_PURCHASE → signup commission (mirrors Stripe checkout.session.completed)
      //   - TRIAL_CONVERTED  → first real payment after free trial
      //   - RENEWAL          → recurring commission (mirrors Stripe invoice.payment_succeeded)
      //
      // Apple takes 30% (15% after Small Business Program) before we see the money,
      // so we calculate commission on the NET amount the user is charged, not gross.
      // RevenueCat's webhook gives us `price` in USD (the customer-facing price) and
      // we use that as the basis, matching the Stripe flow.
      const referredByCode = existingUserData.referredByCode;
      const priceUsd = typeof event.price === "number" ? event.price : null;

      const isCommissionableEvent =
        type === "INITIAL_PURCHASE" ||
        type === "TRIAL_CONVERTED" ||
        type === "RENEWAL";

      if (referredByCode && isCommissionableEvent && priceUsd && priceUsd > 0) {
        try {
          const codeDoc = await db.collection("referralCodes").doc(referredByCode).get();
          if (codeDoc.exists) {
            const codeData = codeDoc.data();
            const referrerId = codeData.userId;
            const commissionRate = codeData.commissionRate || 0.15;

            // Don't credit self-referrals (shouldn't happen because of apply-code
            // guard, but defense in depth).
            if (referrerId && referrerId !== uid) {
              const commissionAmount = parseFloat((priceUsd * commissionRate).toFixed(2));

              // Determine plan label from the product ID
              let plan = "Pro";
              if (productId && productId.includes("monthly")) plan = "Monthly";
              else if (productId && productId.includes("yearly")) plan = "Yearly";

              const referralType =
                type === "INITIAL_PURCHASE" || type === "TRIAL_CONVERTED" ? "initial" : "recurring";

              await db.collection("referrals").add({
                referrerId,
                referredUserId: uid,
                referredEmail: existingUserData.email || "",
                referralCode: referredByCode,
                commissionRate,
                commissionAmount,
                paymentAmount: priceUsd,
                plan,
                type: referralType,
                status: "active",
                store: "APP_STORE",
                appleProductId: productId,
                revenueCatEventType: type,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              // Increment referrer totals. Only bump totalReferrals counter on
              // the initial purchase, not on each recurring renewal.
              const referrerUpdate = {
                totalReferralEarnings: admin.firestore.FieldValue.increment(commissionAmount),
              };
              if (referralType === "initial") {
                referrerUpdate.totalReferrals = admin.firestore.FieldValue.increment(1);
              }
              await db.collection("users").doc(referrerId).set(referrerUpdate, { merge: true });

              console.log(
                `[RC] referral commission: ${referredByCode} → $${commissionAmount} (${referralType}) for user ${referrerId}`
              );
            }
          }
        } catch (refErr) {
          // Don't fail the webhook over referral errors — entitlement sync is
          // more important than commission tracking.
          console.error("[RC] referral processing error (non-fatal):", refErr.message);
        }
      }
    } else if (INACTIVE_EVENTS.has(type)) {
      // For CANCELLATION the user still has access until expiresAt — but we
      // flip status so the UI can show "Canceling on …". EXPIRATION fully
      // downgrades to free.
      const downgrade = type === "EXPIRATION" || type === "SUBSCRIPTION_PAUSED" || type === "TRIAL_CANCELLED";
      await userRef.set(
        {
          ...(downgrade ? { tier: "free" } : {}),
          subscriptionStatus: downgrade ? "canceled" : "canceling",
          subscriptionStore: "APP_STORE",
          revenueCatUserId: uid,
          appleExpiresAt: expiresAtMs ? new Date(expiresAtMs) : null,
        },
        { merge: true }
      );
      console.log(`[RC] ${type} → user ${uid} (${downgrade ? "downgraded" : "marked canceling"})`);
    } else if (type === "BILLING_ISSUE") {
      await userRef.set(
        {
          subscriptionStatus: "past_due",
          subscriptionStore: "APP_STORE",
          revenueCatUserId: uid,
        },
        { merge: true }
      );
      console.log(`[RC] BILLING_ISSUE → user ${uid} marked past_due`);
    } else if (type === "TRANSFER") {
      // Purchase moved from one app_user_id to another (e.g. restore on a new
      // device). RevenueCat sends the new owner in transferred_to; the
      // previous owner loses the entitlement.
      const transferredTo = Array.isArray(event.transferred_to) ? event.transferred_to[0] : null;
      const transferredFrom = Array.isArray(event.transferred_from) ? event.transferred_from[0] : null;
      if (transferredFrom) {
        await db.collection("users").doc(transferredFrom).set(
          { tier: "free", subscriptionStatus: "transferred" },
          { merge: true }
        );
      }
      if (transferredTo) {
        await db.collection("users").doc(transferredTo).set(
          {
            tier: "pro",
            subscriptionStatus: "active",
            subscriptionStore: "APP_STORE",
            revenueCatUserId: transferredTo,
            appleProductId: productId,
            appleExpiresAt: expiresAtMs ? new Date(expiresAtMs) : null,
          },
          { merge: true }
        );
      }
      console.log(`[RC] TRANSFER ${transferredFrom || "?"} → ${transferredTo || "?"}`);
    } else {
      console.log(`[RC] unhandled event type: ${type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[RC] webhook processing error:", err.message, err.stack);
    return res.status(500).json({ error: "Webhook processing failed: " + err.message });
  }
};
