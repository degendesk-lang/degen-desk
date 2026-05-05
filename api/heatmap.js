/**
 * Smart Money Heatmap
 *
 * Cross-references the kolscan top-trader leaderboard with each KOL's
 * actual current holdings (via Helius DAS getAssetsByOwner) to surface
 * "tokens that 3+ ranked smart-money traders are holding right now."
 *
 * Why this matters: holdings beat tweets. A KOL might tweet about a coin
 * to dump it. A KOL holding a coin right now is putting their own SOL
 * on the line. When 3+ independent ranked KOLs are all holding the same
 * memecoin, that's a signal no other tool surfaces cleanly.
 *
 * Cost: 1 Helius DAS call per ranked KOL we fetch (free tier credits).
 * Cache aggressively — 10 min — since holdings move slower than chats.
 */

const { scrapeLeaderboard } = require("./kolscan.js");

const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=";
const TOP_N_KOLS = 12; // cap to fit Vercel 10s function timeout
const MIN_KOL_COUNT = 3; // surface only tokens held by N+ KOLs
const HOLDINGS_TIMEOUT_MS = 7000;
const RESULT_TTL_MS = 10 * 60 * 1000;

// Tokens to exclude from the consensus surface — major liquid tokens that
// would dominate the list without being interesting "alpha" signals.
const EXCLUDE_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // wSOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // ETH
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", // BTC
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
  "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk", // WEN (already mainstream)
]);

let cache = null;
let cacheAt = 0;

function fetchWithTimeout(url, opts = {}, ms = HOLDINGS_TIMEOUT_MS) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

function normalizeHandle(twitter) {
  if (!twitter) return null;
  let s = String(twitter).trim();
  s = s.replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "");
  s = s.replace(/^@/, "");
  s = s.split(/[?#/]/)[0];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(s)) return null;
  return s;
}

async function fetchHoldings(wallet, apiKey) {
  try {
    const res = await fetchWithTimeout(HELIUS_RPC + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: wallet,
          page: 1,
          limit: 1000,
          displayOptions: {
            showFungible: true,
            showZeroBalance: false,
            showNativeBalance: false,
          },
        },
      }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const items = j?.result?.items || [];
    return items.filter(
      (i) => i.interface === "FungibleToken" || i.interface === "FungibleAsset"
    );
  } catch (err) {
    return [];
  }
}

// Convert raw Helius asset to a simplified holding record.
function simplifyHolding(asset) {
  const ti = asset.token_info || {};
  const decimals = ti.decimals != null ? ti.decimals : 0;
  const balRaw = ti.balance != null ? Number(ti.balance) : 0;
  const ui = decimals > 0 ? balRaw / Math.pow(10, decimals) : balRaw;
  const price = ti.price_info?.price_per_token || null;
  const valueUsd = price != null && ui > 0 ? ui * price : null;
  return {
    mint: asset.id,
    symbol: ti.symbol || asset.content?.metadata?.symbol || "—",
    name: asset.content?.metadata?.name || ti.symbol || "Unknown",
    image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
    uiAmount: ui,
    priceUsd: price,
    valueUsd,
  };
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

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Heatmap not configured." });

  // Cache first
  const now = Date.now();
  if (cache && now - cacheAt < RESULT_TTL_MS) {
    return res.status(200).json({ ...cache, cached: true });
  }

  try {
    // 1. Fetch top KOLs (use weekly — best signal-to-noise)
    const traders = await scrapeLeaderboard("weekly");
    const kols = (traders || [])
      .map((t) => {
        const handle = normalizeHandle(t.twitter);
        if (!t.wallet) return null;
        return {
          rank: t.rank,
          name: t.name,
          twitter: handle,
          wallet: t.wallet,
          pnlSol: t.pnl_sol ? Number(t.pnl_sol) : null,
          pnlUsd: t.pnl_usd ? Number(t.pnl_usd) : null,
        };
      })
      .filter(Boolean)
      .slice(0, TOP_N_KOLS);

    // 2. Fetch holdings for each KOL in parallel
    const holdingsArrays = await Promise.all(
      kols.map(async (k) => {
        const raw = await fetchHoldings(k.wallet, apiKey);
        return raw.map((a) => ({ kol: k, holding: simplifyHolding(a) }));
      })
    );
    const allHoldings = holdingsArrays.flat();

    // 3. Aggregate by mint
    const byMint = new Map(); // mint -> { meta, holders: [{kol, valueUsd}] }
    for (const { kol, holding } of allHoldings) {
      if (!holding.uiAmount || holding.uiAmount <= 0) continue;
      if (EXCLUDE_MINTS.has(holding.mint)) continue;
      // Skip dust positions worth less than $5 — they're likely airdrops
      // or fee-leftovers, not real conviction holdings.
      if (holding.valueUsd != null && holding.valueUsd < 5) continue;

      let entry = byMint.get(holding.mint);
      if (!entry) {
        entry = {
          mint: holding.mint,
          symbol: holding.symbol,
          name: holding.name,
          image: holding.image,
          priceUsd: holding.priceUsd,
          holders: [],
        };
        byMint.set(holding.mint, entry);
      }
      entry.holders.push({
        rank: kol.rank,
        twitter: kol.twitter,
        name: kol.name,
        wallet: kol.wallet,
        valueUsd: holding.valueUsd,
        uiAmount: holding.uiAmount,
      });
    }

    // 4. Filter to consensus tokens (3+ KOLs)
    const consensus = [];
    for (const entry of byMint.values()) {
      if (entry.holders.length < MIN_KOL_COUNT) continue;
      // Sort holders by rank (best first)
      entry.holders.sort((a, b) => (a.rank || 99) - (b.rank || 99));
      const totalValueUsd = entry.holders.reduce(
        (a, h) => a + (h.valueUsd || 0),
        0
      );
      const avgRank =
        entry.holders.reduce((a, h) => a + (h.rank || 99), 0) /
        entry.holders.length;
      consensus.push({
        ...entry,
        kolCount: entry.holders.length,
        totalValueUsd,
        avgRank,
      });
    }

    // 5. Sort by KOL count first, then total value
    consensus.sort((a, b) => {
      if (b.kolCount !== a.kolCount) return b.kolCount - a.kolCount;
      return (b.totalValueUsd || 0) - (a.totalValueUsd || 0);
    });

    const responseBody = {
      kolsAnalyzed: kols.length,
      kolsWithHoldings: holdingsArrays.filter((a) => a.length > 0).length,
      consensus: consensus.slice(0, 50),
      minKolCount: MIN_KOL_COUNT,
      generatedAt: new Date().toISOString(),
    };

    cache = responseBody;
    cacheAt = now;

    return res.status(200).json({ ...responseBody, cached: false });
  } catch (err) {
    console.error("Heatmap error:", err.message);
    return res.status(502).json({
      error: "Couldn't build the heatmap right now. Try again in a moment.",
    });
  }
};
