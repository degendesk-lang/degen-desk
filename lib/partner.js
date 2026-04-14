/**
 * Marketing Partner Program — shared helpers.
 *
 * A marketing partner is an external recruiter who brings creators (referral
 * code owners) to Degen Desk. When one of THEIR creators drives a paying
 * subscription, we pay a parallel commission to the partner on top of the
 * creator's own referral cut. Partners earn nothing directly from users.
 *
 * Tiers (per-month active creator count, reset on month rollover):
 *   - standard  → < 15 active creators → 10%
 *   - elite     → ≥ 15 active creators → 12%
 *
 * "Active" = the creator has driven ≥1 paying subscription THIS calendar month.
 * The count is tracked on the partner's user doc as `partnerActiveCreatorCount`
 * scoped to `partnerActiveCountMonth` (YYYY-MM). A stale month key triggers a
 * full reset.
 *
 * This file is required from both api/webhook.js (Stripe) and
 * api/revenuecat-webhook.js (Apple IAP) so the logic stays in one place.
 */

function currentMonthKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function rateForActiveCount(count) {
  return count >= 15 ? 0.12 : 0.10;
}

function tierForActiveCount(count) {
  return count >= 15 ? "elite" : "standard";
}

/**
 * Process a partner commission for a just-created referral.
 *
 * Call this AFTER you've already written the creator's referral record. It
 * looks up whether the creator is linked to a partner (`users.recruitedByUid`),
 * computes the partner's current per-month active-creator count (with month
 * rollover), recalculates their tier/rate, writes a `partnerCommissions`
 * record, and increments the partner's running totals.
 *
 * Returns `null` when no partner commission applies, or an info object on
 * success. Errors are thrown — the caller should catch and log them
 * non-fatally (webhook entitlement sync is more important than commission
 * tracking).
 *
 * @param {object} params
 * @param {FirebaseFirestore.Firestore} params.db
 * @param {typeof import("firebase-admin")} params.admin
 * @param {string} params.creatorId        The uid of the referral code owner
 *                                         (the "creator" in partner parlance).
 * @param {string} params.referredUserId   The paying user's uid.
 * @param {number} params.paymentAmount    Gross payment in USD (e.g. 14.99).
 * @param {string} params.plan             Plan label ("Monthly" / "Yearly" / etc.)
 * @param {"initial"|"recurring"} params.type
 * @param {"STRIPE"|"APP_STORE"} params.store
 * @param {object} [params.sourceIds]      { stripeSessionId?, stripeInvoiceId?,
 *                                           appleProductId?, revenueCatEventType? }
 */
async function processPartnerCommission(params) {
  const {
    db,
    admin,
    creatorId,
    referredUserId,
    paymentAmount,
    plan,
    type,
    store,
    sourceIds = {},
  } = params;

  if (!creatorId || !referredUserId || !paymentAmount || paymentAmount <= 0) {
    return null;
  }

  // 1. Find the creator's partner link.
  const creatorRef = db.collection("users").doc(creatorId);
  const creatorSnap = await creatorRef.get();
  if (!creatorSnap.exists) return null;

  const creatorData = creatorSnap.data();
  const partnerId = creatorData.recruitedByUid;
  if (!partnerId) return null;

  // Don't credit the partner if the paying user IS the partner
  // (self-referral defense in depth).
  if (partnerId === referredUserId) return null;

  // 2. Load the partner and verify they're still active.
  const partnerRef = db.collection("users").doc(partnerId);
  const partnerSnap = await partnerRef.get();
  if (!partnerSnap.exists) return null;
  const partnerData = partnerSnap.data();
  if (!partnerData.isPartner) return null;

  // 3. Compute the active-creator count for THIS month.
  const monthKey = currentMonthKey();
  const lastActiveMonth = creatorData.lastActiveMonth;
  const isFirstCommissionThisMonth = lastActiveMonth !== monthKey;

  const partnerCountMonth = partnerData.partnerActiveCountMonth;
  let activeCount;
  if (partnerCountMonth !== monthKey) {
    // Stale month → reset and start fresh this month.
    activeCount = isFirstCommissionThisMonth ? 1 : 0;
  } else {
    activeCount = partnerData.partnerActiveCreatorCount || 0;
    if (isFirstCommissionThisMonth) activeCount += 1;
  }

  const rate = rateForActiveCount(activeCount);
  const tier = tierForActiveCount(activeCount);
  const commissionAmount = parseFloat((paymentAmount * rate).toFixed(2));

  // 4. Write the creator's lastActiveMonth stamp if it moved.
  if (isFirstCommissionThisMonth) {
    await creatorRef.set({ lastActiveMonth: monthKey }, { merge: true });
  }

  // 5. Upsert the partner's active count + tier + rate.
  const partnerUpdate = {
    partnerActiveCreatorCount: activeCount,
    partnerActiveCountMonth: monthKey,
    partnerTier: tier,
    partnerCommissionRate: rate,
    totalPartnerEarnings: admin.firestore.FieldValue.increment(commissionAmount),
  };
  if (type === "initial") {
    partnerUpdate.totalPartnerReferrals = admin.firestore.FieldValue.increment(1);
  }
  await partnerRef.set(partnerUpdate, { merge: true });

  // 6. Write the commission record.
  const commissionRecord = {
    partnerId,
    creatorId,
    referredUserId,
    commissionRate: rate,
    commissionAmount,
    paymentAmount,
    plan,
    type,
    status: "active",
    store,
    tierAtCommission: tier,
    activeCreatorCountAtCommission: activeCount,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (sourceIds.stripeSessionId) commissionRecord.stripeSessionId = sourceIds.stripeSessionId;
  if (sourceIds.stripeInvoiceId) commissionRecord.stripeInvoiceId = sourceIds.stripeInvoiceId;
  if (sourceIds.appleProductId) commissionRecord.appleProductId = sourceIds.appleProductId;
  if (sourceIds.revenueCatEventType) commissionRecord.revenueCatEventType = sourceIds.revenueCatEventType;

  await db.collection("partnerCommissions").add(commissionRecord);

  return {
    partnerId,
    commissionAmount,
    rate,
    tier,
    activeCount,
  };
}

module.exports = {
  processPartnerCommission,
  currentMonthKey,
  rateForActiveCount,
  tierForActiveCount,
};
