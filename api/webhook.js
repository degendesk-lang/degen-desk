const Stripe = require("stripe");
const admin = require("firebase-admin");

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
