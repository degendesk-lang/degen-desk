/**
 * Public Leaderboard — top 5 marketing partners by total referrals.
 *
 * Returns only partners who have opted in via leaderboardOptIn=true.
 * Each entry includes their public display name, partner code, total
 * referrals, tier, and up to 3 social links they chose to expose.
 *
 *   GET /api/leaderboard
 *
 * Response:
 *   {
 *     leaderboard: [
 *       {
 *         rank: 1,
 *         displayName: "Pop's Community",
 *         partnerCode: "POP",
 *         totalReferrals: 142,
 *         tier: "elite",
 *         socials: [
 *           { platform: "x", url: "https://x.com/example" },
 *           { platform: "discord", url: "https://discord.gg/example" },
 *           ...up to 3
 *         ]
 *       },
 *       ...up to 5
 *     ],
 *     count: 5,
 *     updatedAt: "2026-04-28T..."
 *   }
 *
 * Cached in-memory for 60 seconds to keep this snappy and free.
 */

const admin = require("firebase-admin");

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

const TOP_N = 5;
const ALLOWED_PLATFORMS = new Set([
  "x",
  "tiktok",
  "youtube",
  "instagram",
  "discord",
  "telegram",
  "twitch",
]);
const CACHE_TTL_MS = 60 * 1000; // 60 sec
let cache = { data: null, time: 0 };

function sanitizeSocials(rawSocials) {
  if (!Array.isArray(rawSocials)) return [];
  const cleaned = [];
  for (const s of rawSocials) {
    if (!s || typeof s !== "object") continue;
    const platform = String(s.platform || "").toLowerCase().trim();
    const url = String(s.url || "").trim();
    if (!ALLOWED_PLATFORMS.has(platform)) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (url.length > 300) continue;
    cleaned.push({ platform, url });
    if (cleaned.length >= 3) break;
  }
  return cleaned;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!db) {
    return res.status(503).json({ error: "Database not configured" });
  }

  // Cache hit
  const now = Date.now();
  if (cache.data && now - cache.time < CACHE_TTL_MS) {
    return res.status(200).json(cache.data);
  }

  try {
    // Query top partners who have opted in.
    // Single composite index will be needed: isPartner + leaderboardOptIn + totalPartnerReferrals
    // Fall back to in-memory sort if index isn't ready yet.
    let snap;
    try {
      snap = await db
        .collection("users")
        .where("isPartner", "==", true)
        .where("leaderboardOptIn", "==", true)
        .orderBy("totalPartnerReferrals", "desc")
        .limit(TOP_N)
        .get();
    } catch (indexErr) {
      console.warn("[leaderboard] composite index not ready, falling back:", indexErr.message);
      // Fallback: query all opted-in partners and sort in memory.
      snap = await db
        .collection("users")
        .where("isPartner", "==", true)
        .where("leaderboardOptIn", "==", true)
        .get();
    }

    const partners = [];
    snap.forEach((doc) => {
      const d = doc.data();
      partners.push({
        uid: doc.id,
        displayName: (d.leaderboardDisplayName || d.partnerCode || "Anonymous").slice(0, 50),
        partnerCode: d.partnerCode || null,
        totalReferrals: d.totalPartnerReferrals || 0,
        tier: d.partnerTier || "standard",
        socials: sanitizeSocials(d.leaderboardSocials),
      });
    });

    // Final sort + truncate (works regardless of whether the index served us).
    partners.sort((a, b) => b.totalReferrals - a.totalReferrals);
    const top = partners.slice(0, TOP_N).map((p, i) => ({
      rank: i + 1,
      displayName: p.displayName,
      partnerCode: p.partnerCode,
      totalReferrals: p.totalReferrals,
      tier: p.tier,
      socials: p.socials,
    }));

    const result = {
      leaderboard: top,
      count: top.length,
      maxSlots: TOP_N,
      updatedAt: new Date().toISOString(),
    };

    cache = { data: result, time: now };
    return res.status(200).json(result);
  } catch (err) {
    console.error("[leaderboard] query failed:", err.message);
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
};
