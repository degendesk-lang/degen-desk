/**
 * Marketing Partner Program — HTTP API.
 *
 *   GET  /api/partner?uid=<partner-uid>
 *       → Partner dashboard: tier, rate, active creator count, totals,
 *         linked creators (with per-creator earnings), and recent commissions.
 *         Only returns data if the user has isPartner === true.
 *
 *   POST /api/partner  { action: "promote",  adminKey, targetUid }
 *       → Admin: flag a user as a marketing partner. Resets tier/rate to
 *         standard (10%) and initialises partner counters.
 *
 *   POST /api/partner  { action: "demote",   adminKey, targetUid }
 *       → Admin: clear the partner flag. Historical commissions stay
 *         (for audit / payouts) but no new ones will be created.
 *
 *   POST /api/partner  { action: "link",     adminKey, partnerUid, creatorUid }
 *       → Admin: link a creator to a partner. Sets creatorUser.recruitedByUid.
 *         Partner commissions on future paying referrals from that creator
 *         will flow to this partner.
 *
 *   POST /api/partner  { action: "unlink",   adminKey, creatorUid }
 *       → Admin: remove the partner link from a creator. Does not touch
 *         historical commissions.
 *
 *   POST /api/partner  { action: "list",     adminKey }
 *       → Admin: list all partners with tier / rate / active creator count.
 *
 * Admin actions are gated by ADMIN_SECRET_KEY, same pattern as
 * api/referral.js PUT. There is no separate admin login.
 */

const admin = require("firebase-admin");
const { currentMonthKey, rateForActiveCount, tierForActiveCount } = require("../lib/partner");

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
  const allowedOrigins = [
    "https://degendesk.xyz",
    "https://www.degendesk.xyz",
    "http://localhost:3000",
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!db) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    // =========================================
    // GET — Partner dashboard
    // =========================================
    if (req.method === "GET") {
      const uid = req.query?.uid;
      if (!uid) return res.status(400).json({ error: "uid query parameter required" });

      const userSnap = await db.collection("users").doc(uid).get();
      if (!userSnap.exists) return res.status(404).json({ error: "User not found" });

      const userData = userSnap.data();
      if (!userData.isPartner) {
        return res.status(200).json({ isPartner: false });
      }

      // If the stored month is stale, reset the active count for this response
      // (the definitive reset happens on the next commission write, this just
      // makes the dashboard show the correct number between month boundaries).
      const monthKey = currentMonthKey();
      let activeCreatorCount = userData.partnerActiveCreatorCount || 0;
      let currentMonthIsStale = false;
      if (userData.partnerActiveCountMonth !== monthKey) {
        activeCreatorCount = 0;
        currentMonthIsStale = true;
      }

      const displayRate = rateForActiveCount(activeCreatorCount);
      const displayTier = tierForActiveCount(activeCreatorCount);

      // Linked creators
      const creatorsSnap = await db
        .collection("users")
        .where("recruitedByUid", "==", uid)
        .get();

      const linkedCreators = [];
      for (const doc of creatorsSnap.docs) {
        const c = doc.data();
        linkedCreators.push({
          uid: doc.id,
          email: c.email || null,
          referralCode: c.referralCode || null,
          totalReferralEarnings: c.totalReferralEarnings || 0,
          totalReferrals: c.totalReferrals || 0,
          isActiveThisMonth: c.lastActiveMonth === monthKey,
        });
      }

      // Recent partner commissions (last 50)
      const commissions = [];
      let totalEarnedThisMonth = 0;
      try {
        const commissionsSnap = await db
          .collection("partnerCommissions")
          .where("partnerId", "==", uid)
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        commissionsSnap.forEach((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date(data.createdAt);
          if (createdAt >= monthStart) {
            totalEarnedThisMonth += data.commissionAmount || 0;
          }
          commissions.push({
            id: doc.id,
            creatorId: data.creatorId,
            commissionAmount: data.commissionAmount,
            commissionRate: data.commissionRate,
            paymentAmount: data.paymentAmount,
            plan: data.plan,
            type: data.type,
            store: data.store,
            tier: data.tierAtCommission,
            createdAt: createdAt.toISOString(),
          });
        });
      } catch (err) {
        // Query may fail if composite index isn't created yet — degrade gracefully.
        console.warn("[partner] commissions query failed:", err.message);
      }

      const totalEarnings = userData.totalPartnerEarnings || 0;
      const totalPaidOut = userData.totalPartnerPaidOut || 0;
      const availableBalance = parseFloat((totalEarnings - totalPaidOut).toFixed(2));

      return res.status(200).json({
        isPartner: true,
        tier: displayTier,
        commissionRate: displayRate,
        activeCreatorCount,
        totalCreators: linkedCreators.length,
        currentMonth: monthKey,
        currentMonthIsStale,
        stats: {
          totalEarnings: parseFloat(totalEarnings.toFixed(2)),
          totalPaidOut: parseFloat(totalPaidOut.toFixed(2)),
          availableBalance,
          totalEarnedThisMonth: parseFloat(totalEarnedThisMonth.toFixed(2)),
          totalReferrals: userData.totalPartnerReferrals || 0,
        },
        leaderboard: {
          optIn: !!userData.leaderboardOptIn,
          displayName: userData.leaderboardDisplayName || "",
          socials: Array.isArray(userData.leaderboardSocials) ? userData.leaderboardSocials : [],
        },
        linkedCreators,
        commissions,
        nextTier:
          displayTier === "standard"
            ? { label: "Elite (12%)", activeCreatorsNeeded: Math.max(0, 15 - activeCreatorCount) }
            : null,
      });
    }

    // =========================================
    // POST — actions (most are admin-gated)
    // =========================================
    if (req.method === "POST") {
      const body = req.body || {};
      const action = body.action;

      if (!action) return res.status(400).json({ error: "action required" });

      // ------------- updateLeaderboard (self-service, NOT admin-gated) -------------
      // Lets a partner update their own public leaderboard preferences:
      //   - opt-in / opt-out
      //   - display name shown on the leaderboard
      //   - up to 3 social links (from the approved platform list)
      //
      // Auth via Firebase ID token, NOT admin key. The token's uid must
      // match the user being modified, and that user must already be a
      // partner (isPartner === true). Validation matches /api/leaderboard.
      if (action === "updateLeaderboard") {
        const authHeader = req.headers.authorization || "";
        const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (!tokenMatch) {
          return res.status(401).json({ error: "Missing Authorization Bearer token" });
        }

        let decoded;
        try {
          decoded = await admin.auth().verifyIdToken(tokenMatch[1]);
        } catch (err) {
          return res.status(401).json({ error: "Invalid token" });
        }
        const uid = decoded.uid;

        // Confirm the caller is a partner.
        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists || !userSnap.data().isPartner) {
          return res.status(403).json({ error: "Only partners can edit leaderboard preferences" });
        }

        // Validate inputs.
        const optIn = !!body.leaderboardOptIn;

        let displayName = String(body.leaderboardDisplayName || "").trim();
        if (displayName.length > 50) {
          return res.status(400).json({ error: "Display name must be 50 characters or fewer" });
        }
        if (!displayName) displayName = userSnap.data().partnerCode || "";

        const ALLOWED_PLATFORMS = new Set([
          "x", "tiktok", "youtube", "instagram", "discord", "telegram", "twitch",
        ]);
        const rawSocials = Array.isArray(body.leaderboardSocials) ? body.leaderboardSocials : [];
        const socials = [];
        for (const s of rawSocials) {
          if (!s || typeof s !== "object") continue;
          const platform = String(s.platform || "").toLowerCase().trim();
          const url = String(s.url || "").trim();
          if (!ALLOWED_PLATFORMS.has(platform)) continue;
          if (!/^https?:\/\//i.test(url)) {
            return res.status(400).json({
              error: `Invalid URL for ${platform} — must start with https://`,
            });
          }
          if (url.length > 300) {
            return res.status(400).json({ error: "URLs must be 300 characters or fewer" });
          }
          socials.push({ platform, url });
          if (socials.length >= 3) break;
        }

        await userRef.set(
          {
            leaderboardOptIn: optIn,
            leaderboardDisplayName: displayName,
            leaderboardSocials: socials,
            leaderboardUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return res.status(200).json({
          success: true,
          action: "updateLeaderboard",
          uid,
          leaderboardOptIn: optIn,
          leaderboardDisplayName: displayName,
          leaderboardSocials: socials,
        });
      }

      // All POST actions below are admin-gated.
      const adminKey = body.adminKey;
      if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // ------------- promote -------------
      if (action === "promote") {
        const { targetUid } = body;
        if (!targetUid) return res.status(400).json({ error: "targetUid required" });

        const userRef = db.collection("users").doc(targetUid);
        const snap = await userRef.get();
        if (!snap.exists) return res.status(404).json({ error: "Target user not found" });

        await userRef.set(
          {
            isPartner: true,
            partnerTier: "standard",
            partnerCommissionRate: 0.10,
            partnerActiveCreatorCount: snap.data().partnerActiveCreatorCount || 0,
            partnerActiveCountMonth: snap.data().partnerActiveCountMonth || currentMonthKey(),
            totalPartnerEarnings: snap.data().totalPartnerEarnings || 0,
            totalPartnerPaidOut: snap.data().totalPartnerPaidOut || 0,
            totalPartnerReferrals: snap.data().totalPartnerReferrals || 0,
            partnerPromotedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return res.status(200).json({ success: true, action: "promote", targetUid });
      }

      // ------------- demote -------------
      if (action === "demote") {
        const { targetUid } = body;
        if (!targetUid) return res.status(400).json({ error: "targetUid required" });

        await db.collection("users").doc(targetUid).set(
          {
            isPartner: false,
            partnerDemotedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return res.status(200).json({ success: true, action: "demote", targetUid });
      }

      // ------------- link -------------
      // Attach a creator to a partner so future commissions flow upward.
      if (action === "link") {
        const { partnerUid, creatorUid } = body;
        if (!partnerUid || !creatorUid) {
          return res.status(400).json({ error: "partnerUid and creatorUid required" });
        }
        if (partnerUid === creatorUid) {
          return res.status(400).json({ error: "A partner cannot recruit themselves" });
        }

        // Verify partner is a partner
        const partnerSnap = await db.collection("users").doc(partnerUid).get();
        if (!partnerSnap.exists || !partnerSnap.data().isPartner) {
          return res.status(400).json({ error: "partnerUid is not a registered partner" });
        }

        // Verify creator exists
        const creatorSnap = await db.collection("users").doc(creatorUid).get();
        if (!creatorSnap.exists) {
          return res.status(404).json({ error: "Creator user not found" });
        }

        await db.collection("users").doc(creatorUid).set(
          {
            recruitedByUid: partnerUid,
            recruitedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return res.status(200).json({ success: true, action: "link", partnerUid, creatorUid });
      }

      // ------------- unlink -------------
      if (action === "unlink") {
        const { creatorUid } = body;
        if (!creatorUid) return res.status(400).json({ error: "creatorUid required" });

        await db.collection("users").doc(creatorUid).set(
          {
            recruitedByUid: admin.firestore.FieldValue.delete(),
            recruitedAt: admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        );
        return res.status(200).json({ success: true, action: "unlink", creatorUid });
      }

      // ------------- list -------------
      if (action === "list") {
        const snap = await db.collection("users").where("isPartner", "==", true).get();
        const partners = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            uid: doc.id,
            email: d.email || null,
            tier: d.partnerTier || "standard",
            commissionRate: d.partnerCommissionRate || 0.10,
            activeCreatorCount: d.partnerActiveCreatorCount || 0,
            totalPartnerEarnings: d.totalPartnerEarnings || 0,
            totalPartnerPaidOut: d.totalPartnerPaidOut || 0,
          };
        });
        return res.status(200).json({ partners });
      }

      // ------------- listRates -------------
      // Admin helper: return every user who has a customCommissionRate set,
      // so the admin console can show a monitoring table of who has what %.
      // A missing field means "default 15%" and is excluded from this list.
      if (action === "listRates") {
        const snap = await db
          .collection("users")
          .where("customCommissionRate", ">=", 0)
          .get();
        const users = snap.docs.map((doc) => {
          const d = doc.data();
          return {
            uid: doc.id,
            email: d.email || null,
            referralCode: d.referralCode || null,
            commissionRate:
              typeof d.commissionRate === "number" ? d.commissionRate : 0.15,
            customCommissionRate:
              typeof d.customCommissionRate === "number"
                ? d.customCommissionRate
                : null,
            isPartner: !!d.isPartner,
          };
        });
        // Sort highest rate first, then alphabetical by email as a tiebreaker.
        users.sort((a, b) => {
          const rateDiff = (b.customCommissionRate || 0) - (a.customCommissionRate || 0);
          if (rateDiff !== 0) return rateDiff;
          return (a.email || "").localeCompare(b.email || "");
        });
        return res.status(200).json({ users });
      }

      // ------------- lookup -------------
      // Admin helper: find a user by email or referral code so the link flow
      // doesn't require the admin to already know Firebase UIDs.
      if (action === "lookup") {
        const { email, referralCode } = body;
        if (!email && !referralCode) {
          return res.status(400).json({ error: "email or referralCode required" });
        }

        let uid = null;
        let userData = null;

        if (referralCode) {
          const codeSnap = await db
            .collection("referralCodes")
            .doc(String(referralCode).trim().toUpperCase())
            .get();
          if (codeSnap.exists) {
            uid = codeSnap.data().userId;
            const u = await db.collection("users").doc(uid).get();
            if (u.exists) userData = u.data();
          }
        } else if (email) {
          const q = await db
            .collection("users")
            .where("email", "==", String(email).trim().toLowerCase())
            .limit(1)
            .get();
          if (!q.empty) {
            uid = q.docs[0].id;
            userData = q.docs[0].data();
          }
        }

        if (!uid || !userData) {
          return res.status(404).json({ error: "User not found" });
        }

        return res.status(200).json({
          uid,
          email: userData.email || null,
          referralCode: userData.referralCode || null,
          isPartner: !!userData.isPartner,
          recruitedByUid: userData.recruitedByUid || null,
          commissionRate:
            typeof userData.commissionRate === "number"
              ? userData.commissionRate
              : 0.15,
          customCommissionRate:
            typeof userData.customCommissionRate === "number"
              ? userData.customCommissionRate
              : null,
        });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Partner API error:", err.message, err.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};
