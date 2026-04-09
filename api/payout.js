const admin = require("firebase-admin");

// Initialize Firebase Admin (only once)
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
const MINIMUM_PAYOUT = 10; // $10 minimum

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://degendesk.xyz", "https://www.degendesk.xyz", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!db) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    // =========================================
    // POST — Request a payout
    // =========================================
    if (req.method === "POST") {
      const { uid, paymentMethod, paymentDetails } = req.body || {};

      if (!uid || !paymentMethod || !paymentDetails) {
        return res.status(400).json({ error: "uid, paymentMethod, and paymentDetails are required" });
      }

      // Validate payment method
      const validMethods = ["paypal", "solana", "ethereum", "venmo", "cashapp"];
      if (!validMethods.includes(paymentMethod)) {
        return res.status(400).json({ error: "Invalid payment method. Use: paypal, solana, ethereum, venmo, or cashapp" });
      }

      if (paymentDetails.trim().length < 3) {
        return res.status(400).json({ error: "Please enter valid payment details." });
      }

      // Get user data to check available balance
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      const totalEarnings = userData.totalReferralEarnings || 0;
      const totalPaidOut = userData.totalPaidOut || 0;
      const availableBalance = parseFloat((totalEarnings - totalPaidOut).toFixed(2));

      if (availableBalance < MINIMUM_PAYOUT) {
        return res.status(400).json({
          error: `Minimum payout is $${MINIMUM_PAYOUT}. Your available balance is $${availableBalance.toFixed(2)}.`,
        });
      }

      // Check for pending payout already
      const pendingSnap = await db
        .collection("payoutRequests")
        .where("userId", "==", uid)
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (!pendingSnap.empty) {
        return res.status(409).json({
          error: "You already have a pending payout request. Please wait for it to be processed.",
        });
      }

      // Create payout request
      const payoutRef = await db.collection("payoutRequests").add({
        userId: uid,
        email: userData.email || "",
        referralCode: userData.referralCode || "",
        amount: availableBalance,
        paymentMethod: paymentMethod,
        paymentDetails: paymentDetails.trim(),
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Save preferred payment method on user profile for next time
      await db.collection("users").doc(uid).set(
        {
          preferredPaymentMethod: paymentMethod,
          preferredPaymentDetails: paymentDetails.trim(),
        },
        { merge: true }
      );

      console.log(`Payout requested: $${availableBalance} for user ${uid} via ${paymentMethod}`);

      return res.status(200).json({
        success: true,
        payoutId: payoutRef.id,
        amount: availableBalance,
        paymentMethod,
        status: "pending",
      });
    }

    // =========================================
    // GET — Get payout history for a user
    // =========================================
    if (req.method === "GET") {
      const uid = req.query?.uid;

      if (!uid) {
        return res.status(400).json({ error: "uid query parameter required" });
      }

      // Get user balance info
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const totalEarnings = userData.totalReferralEarnings || 0;
      const totalPaidOut = userData.totalPaidOut || 0;
      const availableBalance = parseFloat((totalEarnings - totalPaidOut).toFixed(2));

      // Get payout history
      const payoutsSnap = await db
        .collection("payoutRequests")
        .where("userId", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

      const payouts = [];
      payoutsSnap.forEach((doc) => {
        const data = doc.data();
        payouts.push({
          id: doc.id,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          paymentDetails: data.paymentDetails,
          status: data.status,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
          processedAt: data.processedAt?.toDate ? data.processedAt.toDate().toISOString() : null,
        });
      });

      return res.status(200).json({
        availableBalance,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        totalPaidOut: parseFloat(totalPaidOut.toFixed(2)),
        minimumPayout: MINIMUM_PAYOUT,
        preferredPaymentMethod: userData.preferredPaymentMethod || null,
        preferredPaymentDetails: userData.preferredPaymentDetails || null,
        payouts,
      });
    }

    // =========================================
    // PUT — Admin: approve/complete a payout
    // =========================================
    if (req.method === "PUT") {
      const { adminKey, payoutId, action } = req.body || {};

      if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!payoutId || !action) {
        return res.status(400).json({ error: "payoutId and action required" });
      }

      const payoutDoc = await db.collection("payoutRequests").doc(payoutId).get();
      if (!payoutDoc.exists) {
        return res.status(404).json({ error: "Payout request not found" });
      }

      const payoutData = payoutDoc.data();

      if (action === "complete") {
        // Mark as completed and update user's totalPaidOut
        await db.collection("payoutRequests").doc(payoutId).update({
          status: "completed",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection("users").doc(payoutData.userId).set(
          {
            totalPaidOut: admin.firestore.FieldValue.increment(payoutData.amount),
          },
          { merge: true }
        );

        console.log(`Payout completed: $${payoutData.amount} for user ${payoutData.userId}`);
        return res.status(200).json({ success: true, status: "completed" });
      }

      if (action === "reject") {
        await db.collection("payoutRequests").doc(payoutId).update({
          status: "rejected",
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Payout rejected: ${payoutId}`);
        return res.status(200).json({ success: true, status: "rejected" });
      }

      return res.status(400).json({ error: "Invalid action. Use: complete or reject" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Payout API error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};
