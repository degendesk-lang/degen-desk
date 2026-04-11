const Stripe = require("stripe");
const admin = require("firebase-admin");

// Initialize Firebase Admin (only once) — used to look up a manually-applied
// referral code stored on the user's Firestore doc, so commissions still work
// for users who entered a code in the referrals page instead of clicking a link.
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
}
const db = admin.apps.length > 0 ? admin.firestore() : null;

const PLANS = {
  monthly: { amount: 1499, interval: "month", interval_count: 1, name: "Degen Desk Pro - Monthly" },
  yearly: { amount: 14999, interval: "year", interval_count: 1, name: "Degen Desk Pro - Yearly" },
};

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://degendesk.xyz", "https://www.degendesk.xyz", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set");
    return res.status(500).json({ error: "Server configuration error: missing Stripe key" });
  }

  const stripe = new Stripe(key);
  const { plan, uid, email, referralCode } = req.body;

  if (!plan || !uid || !email) {
    return res.status(400).json({ error: "Missing plan, uid, or email" });
  }

  const planData = PLANS[plan];
  if (!planData) {
    return res.status(400).json({ error: "Invalid plan. Use: monthly or yearly" });
  }

  // Resolve the effective referral code. Precedence:
  //   1. Code passed in the request body (legacy localStorage ?ref= capture)
  //   2. referredByCode saved on the user's Firestore doc (manual-entry path)
  let effectiveReferralCode = referralCode ? String(referralCode).toUpperCase() : null;
  if (!effectiveReferralCode && db) {
    try {
      const userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const saved = userDoc.data().referredByCode;
        if (saved) effectiveReferralCode = String(saved).toUpperCase();
      }
    } catch (err) {
      console.warn("create-checkout: referredByCode lookup failed:", err.message);
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: planData.name },
          unit_amount: planData.amount,
          recurring: {
            interval: planData.interval,
            interval_count: planData.interval_count,
          },
        },
        quantity: 1,
      }],
      success_url: `${req.headers.origin || "https://degendesk.xyz"}/pricing.html?success=true`,
      cancel_url: `${req.headers.origin || "https://degendesk.xyz"}/pricing.html?canceled=true`,
      metadata: {
        firebaseUid: uid,
        ...(effectiveReferralCode ? { referralCode: effectiveReferralCode } : {}),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message, err.type);
    return res.status(500).json({ error: "Stripe error: " + err.message });
  }
};
