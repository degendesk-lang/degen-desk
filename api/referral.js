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
    // POST — Create a new referral code
    // =========================================
    if (req.method === "POST") {
      const { uid, code } = req.body || {};

      if (!uid || !code) {
        return res.status(400).json({ error: "uid and code are required" });
      }

      // Validate code format: 3-20 chars, alphanumeric + hyphens/underscores
      const cleanCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(cleanCode)) {
        return res.status(400).json({
          error: "Referral code must be 3-20 characters, letters, numbers, hyphens, or underscores only.",
        });
      }

      // Check if code already exists (taken by someone else)
      const existingSnap = await db.collection("referralCodes").doc(cleanCode).get();
      if (existingSnap.exists && existingSnap.data().userId !== uid) {
        return res.status(409).json({ error: "That referral code is already taken. Try another one." });
      }

      // Check if user already has a referral code — once set, it's permanent
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const oldCode = userData.referralCode;

      if (oldCode) {
        return res.status(409).json({ error: "Your referral code is already set and cannot be changed." });
      }

      // Create/update the referral code document
      await db.collection("referralCodes").doc(cleanCode).set({
        userId: uid,
        code: cleanCode,
        commissionRate: userData.customCommissionRate || 0.15, // default 15%, KOLs get custom
        createdAt: existingSnap.exists ? existingSnap.data().createdAt : admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update user doc with their referral code
      await db.collection("users").doc(uid).set(
        {
          referralCode: cleanCode,
          commissionRate: userData.customCommissionRate || 0.15,
        },
        { merge: true }
      );

      return res.status(200).json({
        success: true,
        code: cleanCode,
        commissionRate: userData.customCommissionRate || 0.15,
      });
    }

    // =========================================
    // POST (action=apply) — Apply someone ELSE's referral code to yourself.
    // This is the manual-entry path used on the referrals page for people who
    // installed the app directly (without clicking a ?ref= link) and want to
    // give credit to the friend who sent them.
    //
    // Rules:
    //   - You must be signed in (uid required)
    //   - The code must exist
    //   - The code cannot be your own (no self-referral)
    //   - You cannot apply a code if you already have one saved
    //   - You cannot apply a code if you are already a Pro subscriber (too late)
    // =========================================
    if (req.method === "POST" && (req.body?.action === "apply" || req.query?.action === "apply")) {
      const { uid, code } = req.body || {};

      if (!uid || !code) {
        return res.status(400).json({ error: "uid and code are required" });
      }

      const cleanCode = String(code).trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(cleanCode)) {
        return res.status(400).json({ error: "That doesn't look like a valid referral code." });
      }

      // Look up the code
      const codeSnap = await db.collection("referralCodes").doc(cleanCode).get();
      if (!codeSnap.exists) {
        return res.status(404).json({ error: "That referral code doesn't exist. Double-check the spelling." });
      }
      const codeData = codeSnap.data();

      // Look up the user applying the code
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : {};

      // Rule: can't refer yourself
      if (codeData.userId === uid) {
        return res.status(400).json({ error: "You can't use your own referral code." });
      }

      // Rule: can't change a code once it's set
      if (userData.referredByCode) {
        return res.status(409).json({
          error: "You already have a referral code applied to your account.",
        });
      }

      // Rule: can't apply retroactively if already Pro
      if (userData.tier === "pro" && userData.subscriptionStatus === "active") {
        return res.status(409).json({
          error: "You're already on Pro. Referral codes can only be applied before upgrading.",
        });
      }

      // Save it on the user's doc. The checkout flows (Stripe + RevenueCat)
      // will pick it up from here when the user actually upgrades.
      await userRef.set(
        {
          referredByCode: cleanCode,
          referredByCodeAppliedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({
        success: true,
        code: cleanCode,
        message: "Referral code applied! Your friend will earn commission when you upgrade to Pro.",
      });
    }

    // =========================================
    // PUT — Admin: set custom commission rate for a user (KOL deals)
    // =========================================
    if (req.method === "PUT") {
      const { adminKey, targetUid, commissionRate } = req.body || {};

      // Simple admin auth via secret key
      if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!targetUid || commissionRate === undefined) {
        return res.status(400).json({ error: "targetUid and commissionRate required" });
      }

      const rate = parseFloat(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 0.5) {
        return res.status(400).json({ error: "Commission rate must be between 0 and 0.50 (50%)" });
      }

      // Update user's custom commission rate
      await db.collection("users").doc(targetUid).set(
        { customCommissionRate: rate, commissionRate: rate },
        { merge: true }
      );

      // Update their referral code doc if they have one
      const userDoc = await db.collection("users").doc(targetUid).get();
      const userData = userDoc.data();
      if (userData?.referralCode) {
        await db.collection("referralCodes").doc(userData.referralCode).update({
          commissionRate: rate,
        });
      }

      return res.status(200).json({ success: true, targetUid, commissionRate: rate });
    }

    // =========================================
    // GET — Get referral stats for a user
    // =========================================
    if (req.method === "GET") {
      const uid = req.query?.uid;

      if (!uid) {
        return res.status(400).json({ error: "uid query parameter required" });
      }

      // Get user data
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      const referralCode = userData.referralCode || null;
      const commissionRate = userData.commissionRate || 0.15;

      // Get all referrals for this user
      const referrals = [];
      let totalEarnedAllTime = 0;
      let totalEarnedThisMonth = 0;
      let totalReferrals = 0;

      try {
        const referralsSnap = await db
          .collection("referrals")
          .where("referrerId", "==", uid)
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        referralsSnap.forEach((doc) => {
          const data = doc.data();
          totalReferrals++;

        const commission = data.commissionAmount || 0;
        totalEarnedAllTime += commission;

        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        if (createdAt >= monthStart) {
          totalEarnedThisMonth += commission;
        }

        // Censor the email
        let censoredEmail = "Unknown";
        if (data.referredEmail) {
          const parts = data.referredEmail.split("@");
          if (parts.length === 2) {
            const name = parts[0];
            const censored = name.charAt(0) + "*".repeat(Math.max(name.length - 1, 1));
            censoredEmail = censored + "@" + parts[1];
          }
        }

        referrals.push({
          id: doc.id,
          censoredEmail,
          dateJoined: createdAt.toISOString(),
          plan: data.plan || "N/A",
          commissionAmount: commission,
          commissionRate: data.commissionRate || commissionRate,
          status: data.status || "active",
        });
        });
      } catch (refQueryErr) {
        // Referrals query may fail if index doesn't exist yet — that's OK
        console.error("Referrals query error (non-fatal):", refQueryErr.message);
      }

      return res.status(200).json({
        referralCode,
        commissionRate,
        shareLink: referralCode ? `https://degendesk.xyz/?ref=${referralCode}` : null,
        referredByCode: userData.referredByCode || null,
        tier: userData.tier || "free",
        stats: {
          totalReferrals,
          totalEarnedAllTime: parseFloat(totalEarnedAllTime.toFixed(2)),
          totalEarnedThisMonth: parseFloat(totalEarnedThisMonth.toFixed(2)),
        },
        referrals,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Referral API error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};
