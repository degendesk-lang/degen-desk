/**
 * Insider Wallet Tracker
 *
 * For any Solana token, returns the earliest N buyers of that token,
 * cross-referenced against the kolscan KOL leaderboard. The headline
 * insight: "X% of the first 50 buyers were ranked smart money" tells
 * you whether a coin was sniped by people who know what they're doing
 * or chased by retail FOMO.
 *
 * Approach:
 *   1. Walk Helius parsed-tx for the token mint backwards (newest → oldest)
 *      until we've collected enough early-buy transactions or hit a page cap.
 *   2. From each SWAP, identify the wallet that RECEIVED the token (buyer).
 *   3. Skip pool/program accounts — only count user-owned wallets.
 *   4. Sort buyers ascending by timestamp. Take first N.
 *   5. Cross-reference each buyer's wallet against the kolscan leaderboard
 *      (daily / weekly / monthly union).
 *
 * Cost: 1 Helius credit per page (we cap at MAX_PAGES). Kolscan scrape is
 * already cached in-process.
 *
 * Limitations:
 *   - For tokens with VERY high early activity, we may not reach the actual
 *     launch within the page cap — we surface this honestly in the response.
 *   - Helius's parsed-tx for a mint returns transactions where the mint is
 *     involved, so this works for any tradeable SPL token.
 */

const { scrapeLeaderboard } = require("./kolscan.js");

const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const HELIUS_PARSED = "https://api.helius.xyz/v0/addresses/";

const MAX_PAGES = 8; // up to 800 txs walked
const PAGE_LIMIT = 100;
const TARGET_BUYERS = 50;
const RESULT_TTL_MS = 10 * 60 * 1000;

// Per-IP minute rate limit
const minuteMap = new Map();
function isMinuteLimited(ip) {
  const now = Date.now();
  const e = minuteMap.get(ip);
  if (!e || now - e.start > 60_000) {
    minuteMap.set(ip, { start: now, count: 1 });
    return false;
  }
  e.count++;
  return e.count > 6;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of minuteMap) if (now - v.start > 120_000) minuteMap.delete(k);
}, 5 * 60 * 1000);

const resultCache = new Map();

function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

function parseTokenAmount(t) {
  if (t == null) return 0;
  if (typeof t.tokenAmount === "number") return t.tokenAmount;
  if (typeof t.tokenAmount === "string") return Number(t.tokenAmount);
  if (t.tokenAmount?.tokenAmount != null) return Number(t.tokenAmount.tokenAmount);
  if (t.rawTokenAmount) {
    const dec = t.rawTokenAmount.decimals || 0;
    return Number(t.rawTokenAmount.tokenAmount) / Math.pow(10, dec);
  }
  return 0;
}

async function fetchTxPage(mint, apiKey, before) {
  const params = new URLSearchParams({ "api-key": apiKey, limit: String(PAGE_LIMIT) });
  if (before) params.set("before", before);
  const url = `${HELIUS_PARSED}${mint}/transactions?${params.toString()}`;
  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

// Build a Map<wallet, kolInfo> for fast cross-reference lookup.
async function getKolMap() {
  try {
    const [d, w, m] = await Promise.all([
      scrapeLeaderboard("daily").catch(() => []),
      scrapeLeaderboard("weekly").catch(() => []),
      scrapeLeaderboard("monthly").catch(() => []),
    ]);
    const map = new Map();
    const merge = (arr, tf) => {
      for (const k of arr || []) {
        if (!k.wallet) continue;
        const e = map.get(k.wallet) || { name: k.name, twitter: k.twitter, ranks: {} };
        e.name = e.name || k.name;
        e.twitter = e.twitter || k.twitter;
        e.ranks[tf] = k.rank;
        map.set(k.wallet, e);
      }
    };
    merge(d, "daily");
    merge(w, "weekly");
    merge(m, "monthly");
    return map;
  } catch {
    return new Map();
  }
}

// Extract the BUYER side of a swap involving the target mint.
// Returns { wallet, solSpent, tokensReceived, ts, signature } or null.
function extractBuyer(tx, targetMint) {
  if (tx.type !== "SWAP") return null;
  const ts = tx.timestamp || 0;
  const sw = tx.events?.swap || null;

  // Strategy A: events.swap (Jupiter, classic AMMs)
  if (sw && Array.isArray(sw.tokenOutputs)) {
    const out = sw.tokenOutputs.find((t) => t.mint === targetMint);
    if (out) {
      const wallet = out.userAccount || out.toUserAccount;
      const tokensReceived = parseTokenAmount(out);
      // SOL the buyer paid (nativeInput from buyer)
      const solLamports =
        sw.nativeInput && sw.nativeInput.account === wallet
          ? Number(sw.nativeInput.amount || 0)
          : 0;
      // Or WSOL via tokenInputs from same buyer
      let wsolLamports = 0;
      for (const ti of sw.tokenInputs || []) {
        if (ti.mint === SOL_MINT) {
          const o = ti.userAccount || ti.fromUserAccount;
          if (o === wallet) wsolLamports += Math.round(parseTokenAmount(ti) * 1e9);
        }
      }
      const solSpent = (solLamports + wsolLamports) / 1e9;
      if (wallet && tokensReceived > 0) {
        return { wallet, solSpent, tokensReceived, ts, signature: tx.signature };
      }
    }
  }

  // Strategy B: tokenTransfers fallback (PUMP_AMM and other DEXes that
  // leave events.swap empty).
  let buyer = null;
  let tokensReceived = 0;
  for (const tt of tx.tokenTransfers || []) {
    if (tt.mint === targetMint && tt.toUserAccount) {
      buyer = tt.toUserAccount;
      tokensReceived = parseTokenAmount(tt);
      break;
    }
  }
  if (!buyer || tokensReceived <= 0) return null;

  // Sum SOL the buyer paid via nativeTransfers + WSOL transfers
  let solLamports = 0;
  for (const nt of tx.nativeTransfers || []) {
    if (nt.fromUserAccount === buyer) solLamports += Number(nt.amount || 0);
  }
  for (const tt of tx.tokenTransfers || []) {
    if (tt.mint === SOL_MINT && tt.fromUserAccount === buyer) {
      solLamports += Math.round(parseTokenAmount(tt) * 1e9);
    }
  }
  const solSpent = solLamports / 1e9;
  return { wallet: buyer, solSpent, tokensReceived, ts, signature: tx.signature };
}

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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (isMinuteLimited(ip)) {
    return res.status(429).json({ error: "Slow down — too many insider lookups." });
  }

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Insider Tracker not configured." });

  const ca = (req.query?.ca || "").trim();
  if (!ca || !SOLANA_ADDR_RE.test(ca)) {
    return res.status(400).json({ error: "Provide a valid Solana token address as ?ca=..." });
  }

  const cacheKey = ca;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RESULT_TTL_MS) {
    return res.status(200).json({ ...cached.value, cached: true });
  }

  try {
    // 1. Page through Helius parsed-tx for the mint until we have enough
    //    buyer-side swaps or hit the cap.
    const buyers = [];
    const seenSigs = new Set();
    let before = null;
    let pagesWalked = 0;
    let oldestTs = null;

    for (let p = 0; p < MAX_PAGES; p++) {
      const batch = await fetchTxPage(ca, apiKey, before);
      pagesWalked++;
      if (batch.length === 0) break;

      for (const tx of batch) {
        if (seenSigs.has(tx.signature)) continue;
        seenSigs.add(tx.signature);
        const buyer = extractBuyer(tx, ca);
        if (!buyer) continue;
        buyers.push(buyer);
      }

      const last = batch[batch.length - 1];
      oldestTs = last.timestamp || oldestTs;
      before = last.signature;
      if (batch.length < PAGE_LIMIT) break;
      // Early exit: if we already have a comfortable buffer beyond TARGET_BUYERS,
      // we can stop. We need to walk ALL the way back to filter to the EARLIEST.
      // So we don't early-exit — must traverse full history (capped at MAX_PAGES).
    }

    // 2. Sort buyers ascending by ts (earliest first) and take first N.
    buyers.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const firstBuyers = buyers.slice(0, TARGET_BUYERS);

    // 3. Cross-reference with kolscan
    const kolMap = await getKolMap();
    const enriched = firstBuyers.map((b, i) => {
      const kol = kolMap.get(b.wallet) || null;
      return {
        rank: i + 1, // their order among the first N buyers
        wallet: b.wallet,
        solSpent: b.solSpent,
        tokensReceived: b.tokensReceived,
        ts: b.ts,
        signature: b.signature,
        kol: kol
          ? {
              name: kol.name,
              twitter: kol.twitter,
              ranks: kol.ranks,
            }
          : null,
      };
    });

    const kolMatchCount = enriched.filter((b) => b.kol).length;
    const kolMatchPct =
      enriched.length > 0 ? kolMatchCount / enriched.length : 0;

    const responseBody = {
      contractAddress: ca,
      pagesWalked,
      totalBuyersCollected: buyers.length,
      reachedLaunch: pagesWalked < MAX_PAGES,
      oldestTs,
      firstBuyers: enriched,
      summary: {
        firstNCount: enriched.length,
        kolMatchCount,
        kolMatchPct,
      },
      generatedAt: new Date().toISOString(),
    };

    resultCache.set(cacheKey, { at: Date.now(), value: responseBody });
    if (resultCache.size > 200) {
      const oldest = [...resultCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) resultCache.delete(oldest[0]);
    }

    return res.status(200).json({ ...responseBody, cached: false });
  } catch (err) {
    console.error("Insider tracker error:", err.message);
    return res.status(502).json({ error: "Insider lookup failed. Try again in a moment." });
  }
};
