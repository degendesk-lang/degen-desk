/**
 * Wallet Watch — Pro user's tracked-wallet list
 *
 * Endpoints (all require uid + Pro tier):
 *   GET    /api/wallet-watch?uid=XXX            → list user's watches
 *   POST   /api/wallet-watch                     → add { uid, wallet, label }
 *   DELETE /api/wallet-watch                     → remove { uid, wallet }
 *   POST   /api/wallet-watch?action=check        → poll all of user's watches
 *                                                  for new swaps since last seen
 *
 * Storage: Firestore
 *   walletWatches/{uid}/items/{wallet} = {
 *     wallet, label, addedAt, lastCheckedAt,
 *     lastSeenSignature, notifyEmail
 *   }
 *
 * The "check" action is the manual-refresh path. A separate background cron
 * worker (queued, not yet built — see project_smart_money_tracker.md for the
 * Cloudflare-Worker plan) will eventually invoke the same Helius-diff logic
 * on a 5-min schedule and push notifications via Resend.
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

const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HELIUS_PARSED = "https://api.helius.xyz/v0/addresses/";
const MAX_WATCHES_PER_USER = 10;
const RECENT_TX_LIMIT = 25; // small page for diff polling
const CHECK_RATE_MS = 30 * 1000; // user can manually re-check at most every 30s

// Per-IP minute rate limit (mostly redundant since this is auth-gated, but
// it caps abuse if a Pro account is compromised).
const minuteMap = new Map();
function isMinuteLimited(ip) {
  const now = Date.now();
  const e = minuteMap.get(ip);
  if (!e || now - e.start > 60_000) {
    minuteMap.set(ip, { start: now, count: 1 });
    return false;
  }
  e.count++;
  return e.count > 30;
}

function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

async function checkUserTier(uid) {
  if (!uid || admin.apps.length === 0) return { tier: "anonymous", userRef: null };
  const userRef = admin.firestore().collection("users").doc(uid);
  try {
    const snap = await userRef.get();
    if (!snap.exists) return { tier: "free", userRef };
    const d = snap.data() || {};
    const isPro =
      d.tier === "pro" && d.subscriptionStatus === "active";
    return { tier: isPro ? "pro" : "free", userRef, userData: d };
  } catch (err) {
    console.error("Tier check failed:", err.message);
    return { tier: "anonymous", userRef: null };
  }
}

function watchesCol(uid) {
  return admin
    .firestore()
    .collection("walletWatches")
    .doc(uid)
    .collection("items");
}

// Fetch latest swap-type transactions for a wallet (small page for polling).
async function fetchRecentSwaps(wallet, apiKey, limit = RECENT_TX_LIMIT, before = null) {
  const params = new URLSearchParams({
    "api-key": apiKey,
    limit: String(limit),
  });
  if (before) params.set("before", before);
  const url = `${HELIUS_PARSED}${wallet}/transactions?${params.toString()}`;
  const res = await fetchWithTimeout(url, {}, 10000);
  if (!res.ok) return [];
  const j = await res.json();
  if (!Array.isArray(j)) return [];
  return j.filter((t) => t.type === "SWAP");
}

// Summarize a swap tx into a small alert-friendly object.
function summarizeSwap(tx, owner) {
  const sw = tx.events?.swap;
  const ts = tx.timestamp || 0;
  const SOL_MINT = "So11111111111111111111111111111111111111112";

  let solDelta = 0;
  let tokenMint = null;
  let tokenSymbol = null;
  let kind = null; // "buy" | "sell"

  // Try events.swap first
  if (sw) {
    if (sw.nativeInput?.account === owner) solDelta -= Number(sw.nativeInput.amount || 0);
    if (sw.nativeOutput?.account === owner) solDelta += Number(sw.nativeOutput.amount || 0);

    for (const t of sw.tokenInputs || []) {
      if ((t.userAccount || t.fromUserAccount) !== owner) continue;
      if (t.mint === SOL_MINT) continue;
      tokenMint = tokenMint || t.mint;
    }
    for (const t of sw.tokenOutputs || []) {
      if ((t.userAccount || t.toUserAccount) !== owner) continue;
      if (t.mint === SOL_MINT) continue;
      tokenMint = tokenMint || t.mint;
    }
  }

  // Fallback to tokenTransfers (PUMP_AMM and others)
  if (!tokenMint) {
    for (const tt of tx.tokenTransfers || []) {
      if (tt.mint === SOL_MINT) continue;
      if (tt.fromUserAccount === owner || tt.toUserAccount === owner) {
        tokenMint = tt.mint;
        break;
      }
    }
    for (const nt of tx.nativeTransfers || []) {
      const amt = Number(nt.amount || 0);
      if (nt.toUserAccount === owner) solDelta += amt;
      else if (nt.fromUserAccount === owner) solDelta -= amt;
    }
  }

  if (!tokenMint) return null;
  if (solDelta < 0) kind = "buy";
  else if (solDelta > 0) kind = "sell";
  else return null;

  return {
    signature: tx.signature,
    ts,
    kind,
    tokenMint,
    solAmount: Math.abs(solDelta) / 1e9,
    source: tx.source || null,
  };
}

// =============================================
// HANDLER
// =============================================
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (isMinuteLimited(ip)) {
    return res.status(429).json({ error: "Slow down — too many requests." });
  }

  // uid comes from query for GET, body for POST/DELETE
  const uid =
    (req.method === "GET" ? req.query?.uid : req.body?.uid) || null;
  if (!uid) {
    return res.status(401).json({
      error: "Sign in to use Wallet Watch.",
      requireAuth: true,
    });
  }

  const { tier, userRef, userData } = await checkUserTier(uid);
  if (tier !== "pro") {
    return res.status(403).json({
      error: "Wallet Watch is a Pro feature. Upgrade to track wallets and receive alerts.",
      upgrade: true,
      proRequired: true,
    });
  }

  try {
    if (req.method === "GET") return await handleList(req, res, uid);
    if (req.method === "DELETE") return await handleDelete(req, res, uid);
    if (req.method === "POST") {
      const action = req.query?.action || req.body?.action;
      if (action === "check") return await handleCheck(req, res, uid);
      return await handleAdd(req, res, uid);
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Wallet Watch error:", err.message);
    return res.status(500).json({ error: "Wallet Watch failed. Try again." });
  }
};

async function handleList(req, res, uid) {
  const snap = await watchesCol(uid).orderBy("addedAt", "desc").get();
  const items = snap.docs.map((d) => {
    const v = d.data();
    return {
      wallet: v.wallet,
      label: v.label || null,
      addedAt: v.addedAt?.toMillis ? v.addedAt.toMillis() : v.addedAt || null,
      lastCheckedAt: v.lastCheckedAt?.toMillis ? v.lastCheckedAt.toMillis() : v.lastCheckedAt || null,
      lastSeenSignature: v.lastSeenSignature || null,
      newCount: v.newCount || 0,
      lastAlerts: v.lastAlerts || [],
    };
  });
  return res.status(200).json({
    items,
    count: items.length,
    cap: MAX_WATCHES_PER_USER,
  });
}

async function handleAdd(req, res, uid) {
  const { wallet, label } = req.body || {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  const w = wallet.trim();
  if (!SOLANA_ADDR_RE.test(w)) {
    return res.status(400).json({ error: "That doesn't look like a Solana wallet." });
  }
  const cleanLabel = label && typeof label === "string" ? label.trim().slice(0, 60) : null;

  // Cap per user
  const colRef = watchesCol(uid);
  const countSnap = await colRef.count().get();
  const count = countSnap.data().count;
  // Allow re-adding existing wallet (overwrites label, doesn't increment count)
  const existing = await colRef.doc(w).get();
  if (!existing.exists && count >= MAX_WATCHES_PER_USER) {
    return res.status(409).json({
      error: `You've hit the ${MAX_WATCHES_PER_USER}-wallet watch limit. Remove one to add another.`,
      cap: MAX_WATCHES_PER_USER,
    });
  }

  // Seed lastSeenSignature with the current latest swap so we don't fire
  // alerts for ALL of the wallet's existing history on first add.
  let lastSeenSignature = null;
  try {
    const apiKey = process.env.HELIUS_API_KEY;
    if (apiKey) {
      const recent = await fetchRecentSwaps(w, apiKey, 5);
      if (recent.length > 0) lastSeenSignature = recent[0].signature;
    }
  } catch (err) {
    // non-fatal — first manual check will seed it
  }

  await colRef.doc(w).set(
    {
      wallet: w,
      label: cleanLabel,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSeenSignature,
      newCount: 0,
      lastAlerts: [],
    },
    { merge: true }
  );

  return res.status(200).json({
    success: true,
    wallet: w,
    label: cleanLabel,
    seededSignature: lastSeenSignature,
  });
}

async function handleDelete(req, res, uid) {
  const { wallet } = req.body || {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  const w = wallet.trim();
  await watchesCol(uid).doc(w).delete();
  return res.status(200).json({ success: true, wallet: w });
}

// Manual refresh: poll every watched wallet, find swaps newer than the last
// seen signature, return them as alerts. Also updates lastSeenSignature so
// subsequent checks only return what's truly new.
async function handleCheck(req, res, uid) {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Wallet Watch not configured." });

  const colRef = watchesCol(uid);
  const snap = await colRef.get();
  if (snap.empty) {
    return res.status(200).json({ alerts: [], checked: 0 });
  }

  // Throttle the user: don't allow re-check within 30s.
  // We use the most recent lastCheckedAt across all items.
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const mostRecent = items
    .map((i) => i.lastCheckedAt?.toMillis ? i.lastCheckedAt.toMillis() : 0)
    .reduce((a, b) => Math.max(a, b), 0);
  if (Date.now() - mostRecent < CHECK_RATE_MS) {
    return res.status(429).json({
      error: `Hold on — you can re-check every ${CHECK_RATE_MS / 1000}s.`,
      retryAfterMs: CHECK_RATE_MS - (Date.now() - mostRecent),
    });
  }

  const allAlerts = [];

  await Promise.all(
    items.map(async (item) => {
      try {
        const swaps = await fetchRecentSwaps(item.wallet, apiKey, RECENT_TX_LIMIT);
        if (swaps.length === 0) return;

        // Find new swaps (those above the last seen signature in the page).
        const lastSeen = item.lastSeenSignature || null;
        let newSwaps = [];
        if (!lastSeen) {
          // First check ever — only alert on the most recent N to avoid blasting history
          newSwaps = swaps.slice(0, 3);
        } else {
          const idx = swaps.findIndex((s) => s.signature === lastSeen);
          newSwaps = idx === -1 ? swaps : swaps.slice(0, idx);
        }

        const summarized = newSwaps
          .map((tx) => summarizeSwap(tx, item.wallet))
          .filter(Boolean);

        for (const s of summarized) {
          allAlerts.push({
            wallet: item.wallet,
            label: item.label || null,
            ...s,
          });
        }

        // Persist new lastSeenSignature
        const newestSig = swaps[0]?.signature || lastSeen;
        await colRef.doc(item.wallet).set(
          {
            lastCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastSeenSignature: newestSig,
            newCount: 0, // user is "checking" so reset
            lastAlerts: summarized.slice(0, 5),
          },
          { merge: true }
        );
      } catch (err) {
        console.error(`Check failed for ${item.wallet}:`, err.message);
      }
    })
  );

  // Sort newest first
  allAlerts.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  return res.status(200).json({
    alerts: allAlerts.slice(0, 100),
    checked: items.length,
    generatedAt: new Date().toISOString(),
  });
}
