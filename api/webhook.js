const Stripe = require("stripe");
const admin = require("firebase-admin");
const { processPartnerCommission } = require("../lib/partner");

// Initialize Firebase Admin (only once)
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

// Vercel needs raw body for Stripe signature verification
module.exports.config = {
  api: { bodyParser: false },
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers["stripe-signature"];

    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      event = JSON.parse(rawBody);
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Webhook verification failed" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const uid = session.metadata?.firebaseUid;
        const referralCode = session.metadata?.referralCode;
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        if (uid) {
          await db.collection("users").doc(uid).set(
            {
              tier: "pro",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: "active",
              subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
              ...(referralCode ? { referredByCode: referralCode } : {}),
            },
            { merge: true }
          );
          console.log(`User ${uid} upgraded to Pro`);

          // Process referral commission if a referral code was used
          if (referralCode) {
            try {
              const codeDoc = await db.collection("referralCodes").doc(referralCode).get();
              if (codeDoc.exists) {
                const codeData = codeDoc.data();
                const referrerId = codeData.userId;
                const commissionRate = codeData.commissionRate || 0.15;

                // Get the payment amount from the session
                const amountTotal = session.amount_total || 0; // in cents
                const commissionAmount = parseFloat(((amountTotal / 100) * commissionRate).toFixed(2));

                // Get the referred user's email for the dashboard
                const referredUserDoc = await db.collection("users").doc(uid).get();
                const referredEmail = referredUserDoc.exists ? referredUserDoc.data().email : session.customer_email || "";

                // Determine which plan they subscribed to
                let plan = "Pro";
                if (amountTotal === 1499) plan = "Monthly";
                else if (amountTotal === 3999) plan = "Quarterly";
                else if (amountTotal === 11999) plan = "Yearly";

                // Create a referral record
                await db.collection("referrals").add({
                  referrerId: referrerId,
                  referredUserId: uid,
                  referredEmail: referredEmail,
                  referralCode: referralCode,
                  commissionRate: commissionRate,
                  commissionAmount: commissionAmount,
                  paymentAmount: amountTotal / 100,
                  plan: plan,
                  status: "active",
                  stripeSessionId: session.id,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Update referrer's total earnings
                await db.collection("users").doc(referrerId).set(
                  {
                    totalReferralEarnings: admin.firestore.FieldValue.increment(commissionAmount),
                    totalReferrals: admin.firestore.FieldValue.increment(1),
                  },
                  { merge: true }
                );

                console.log(`Referral commission: ${referralCode} → $${commissionAmount} for user ${referrerId}`);

                // Marketing Partner Program — if this creator is recruited
                // by a partner, create a parallel partner commission.
                try {
                  const partnerResult = await processPartnerCommission({
                    db,
                    admin,
                    creatorId: referrerId,
                    referredUserId: uid,
                    paymentAmount: amountTotal / 100,
                    plan,
                    type: "initial",
                    store: "STRIPE",
                    sourceIds: { stripeSessionId: session.id },
                  });
                  if (partnerResult) {
                    console.log(
                      `Partner commission: $${partnerResult.commissionAmount} → partner ${partnerResult.partnerId} (${partnerResult.tier}, ${partnerResult.activeCount} active)`
                    );
                  }
                } catch (partnerErr) {
                  console.error("Partner commission error (non-fatal):", partnerErr.message);
                }
              }
            } catch (refErr) {
              console.error("Referral processing error (non-fatal):", refErr.message);
              // Don't fail the webhook over referral errors
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        // Find user by stripeCustomerId
        const snapshot = await db
          .collection("users")
          .where("stripeCustomerId", "==", customerId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          const tier = status === "active" ? "pro" : "free";
          await userDoc.ref.update({
            tier,
            subscriptionStatus: status,
          });
          console.log(`Subscription updated for customer ${customerId}: ${status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const snapshot = await db
          .collection("users")
          .where("stripeCustomerId", "==", customerId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          await userDoc.ref.update({
            tier: "free",
            subscriptionStatus: "canceled",
          });
          console.log(`Subscription canceled for customer ${customerId}`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const amountPaid = invoice.amount_paid || 0; // in cents

        // Skip $0 invoices (trials, etc)
        if (amountPaid <= 0) break;

        // Skip the first invoice — that's already handled by checkout.session.completed
        // billing_reason: "subscription_create" = first payment, "subscription_cycle" = recurring
        if (invoice.billing_reason === "subscription_create") {
          console.log(`Skipping first invoice for ${customerId} (handled by checkout)`);
          break;
        }

        // Find the paying user
        const paidSnapshot = await db
          .collection("users")
          .where("stripeCustomerId", "==", customerId)
          .limit(1)
          .get();

        if (!paidSnapshot.empty) {
          const payingUser = paidSnapshot.docs[0];
          const payingUserData = payingUser.data();
          const referredByCode = payingUserData.referredByCode;

          // If this user was referred, create a recurring commission
          if (referredByCode) {
            try {
              const codeDoc = await db.collection("referralCodes").doc(referredByCode).get();
              if (codeDoc.exists) {
                const codeData = codeDoc.data();
                const referrerId = codeData.userId;
                const commissionRate = codeData.commissionRate || 0.15;
                const commissionAmount = parseFloat(((amountPaid / 100) * commissionRate).toFixed(2));

                // Determine plan from amount
                let plan = "Pro";
                if (amountPaid === 1499) plan = "Monthly";
                else if (amountPaid === 3999) plan = "Quarterly";
                else if (amountPaid === 11999) plan = "Yearly";

                // Create a recurring referral commission record
                await db.collection("referrals").add({
                  referrerId: referrerId,
                  referredUserId: payingUser.id,
                  referredEmail: payingUserData.email || "",
                  referralCode: referredByCode,
                  commissionRate: commissionRate,
                  commissionAmount: commissionAmount,
                  paymentAmount: amountPaid / 100,
                  plan: plan,
                  type: "recurring",
                  status: "active",
                  stripeInvoiceId: invoice.id,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                // Update referrer's total earnings
                await db.collection("users").doc(referrerId).set(
                  {
                    totalReferralEarnings: admin.firestore.FieldValue.increment(commissionAmount),
                  },
                  { merge: true }
                );

                console.log(`Recurring referral commission: ${referredByCode} → $${commissionAmount} from ${customerId}`);

                // Marketing Partner Program — recurring partner commission
                try {
                  const partnerResult = await processPartnerCommission({
                    db,
                    admin,
                    creatorId: referrerId,
                    referredUserId: payingUser.id,
                    paymentAmount: amountPaid / 100,
                    plan,
                    type: "recurring",
                    store: "STRIPE",
                    sourceIds: { stripeInvoiceId: invoice.id },
                  });
                  if (partnerResult) {
                    console.log(
                      `Recurring partner commission: $${partnerResult.commissionAmount} → partner ${partnerResult.partnerId}`
                    );
                  }
                } catch (partnerErr) {
                  console.error("Partner recurring commission error (non-fatal):", partnerErr.message);
                }
              }
            } catch (refErr) {
              console.error("Recurring referral error (non-fatal):", refErr.message);
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const snapshot = await db
          .collection("users")
          .where("stripeCustomerId", "==", customerId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          await userDoc.ref.update({
            subscriptionStatus: "past_due",
          });
          console.log(`Payment failed for customer ${customerId}`);
        }
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err.message, err.stack);
    return res.status(500).json({ error: "Webhook processing failed: " + err.message });
  }
};
