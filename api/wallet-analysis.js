const admin = require("firebase-admin");
const { scrapeLeaderboard } = require("./kolscan.js");

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

// =============================================
// CONFIG & VALIDATION
// =============================================
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=";
const HELIUS_PARSED = "https://api.helius.xyz/v0/addresses/";

const FREE_DAILY_CAP = 10;
const PRO_DAILY_CAP = 100;

// =============================================
// RATE LIMITING (per-IP, in-memory)
// =============================================
const minuteMap = new Map();
const MINUTE_WINDOW = 60 * 1000;
const MINUTE_MAX = 6;

function isMinuteLimited(ip) {
  const now = Date.now();
  const e = minuteMap.get(ip);
  if (!e || now - e.start > MINUTE_WINDOW) {
    minuteMap.set(ip, { start: now, count: 1 });
    return false;
  }
  e.count++;
  return e.count > MINUTE_MAX;
}

const anonDailyMap = new Map();
function todayKey() {
  return new Date().toISOString().split("T")[0];
}
function getAnonDailyCount(ip) {
  const key = `${ip}:${todayKey()}`;
  return anonDailyMap.get(key) || 0;
}
function bumpAnonDaily(ip) {
  const key = `${ip}:${todayKey()}`;
  anonDailyMap.set(key, (anonDailyMap.get(key) || 0) + 1);
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of minuteMap) {
    if (now - e.start > MINUTE_WINDOW * 2) minuteMap.delete(ip);
  }
  // Anon daily map: prune entries whose date isn't today
  const t = todayKey();
  for (const k of anonDailyMap.keys()) {
    if (!k.endsWith(":" + t)) anonDailyMap.delete(k);
  }
}, 5 * 60 * 1000);

// =============================================
// KOL CACHE (5 min) — broadest set across timeframes
// =============================================
let kolCache = null;
let kolCacheAt = 0;
const KOL_TTL = 5 * 60 * 1000;

async function getKolMap() {
  const now = Date.now();
  if (kolCache && now - kolCacheAt < KOL_TTL) return kolCache;
  try {
    const [daily, weekly, monthly] = await Promise.all([
      scrapeLeaderboard("daily").catch(() => []),
      scrapeLeaderboard("weekly").catch(() => []),
      scrapeLeaderboard("monthly").catch(() => []),
    ]);
    const map = new Map();
    const merge = (arr, tf) => {
      for (const k of arr || []) {
        if (!k.wallet) continue;
        const existing = map.get(k.wallet) || {};
        existing.name = existing.name || k.name;
        existing.twitter = existing.twitter || k.twitter;
        existing.telegram = existing.telegram || k.telegram;
        existing.profile_url = existing.profile_url || k.profile_url;
        existing.ranks = existing.ranks || {};
        existing.ranks[tf] = k.rank;
        map.set(k.wallet, existing);
      }
    };
    merge(daily, "daily");
    merge(weekly, "weekly");
    merge(monthly, "monthly");
    kolCache = map;
    kolCacheAt = now;
    return map;
  } catch (err) {
    console.error("KOL fetch failed:", err.message);
    return kolCache || new Map();
  }
}

// =============================================
// FETCH HELPERS
// =============================================
async function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSolBalance(address, apiKey) {
  const res = await fetchWithTimeout(HELIUS_RPC + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      method: "getBalance",
      params: [address],
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  const lamports = j?.result?.value;
  if (typeof lamports !== "number") return null;
  return lamports / 1e9;
}

// Helius DAS — returns fungible holdings with metadata + Jupiter prices.
// Also returns nativeBalance (SOL) with current USD price when showNativeBalance is true.
async function fetchAssets(address, apiKey) {
  const res = await fetchWithTimeout(HELIUS_RPC + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: address,
        page: 1,
        limit: 1000,
        displayOptions: {
          showFungible: true,
          showZeroBalance: false,
          showNativeBalance: true,
        },
      },
    }),
  });
  if (!res.ok) return { items: [], nativeBalance: null };
  const j = await res.json();
  const result = j?.result || {};
  const items = result.items || [];
  // Keep only fungibles (FungibleToken / FungibleAsset interface)
  const fungibles = items.filter(
    (i) => i.interface === "FungibleToken" || i.interface === "FungibleAsset"
  );
  return { items: fungibles, nativeBalance: result.nativeBalance || null };
}

// Helius parsed transactions — last N, with categorized swap info.
async function fetchTransactions(address, apiKey, limit = 100) {
  const url = `${HELIUS_PARSED}${address}/transactions?api-key=${apiKey}&limit=${limit}`;
  const res = await fetchWithTimeout(url, {}, 15000);
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

// =============================================
// SYNTHESIS
// =============================================
function buildHoldings(assets) {
  const out = [];
  for (const a of assets) {
    const ti = a.token_info || {};
    const bal = ti.balance != null ? Number(ti.balance) : 0;
    const decimals = ti.decimals != null ? ti.decimals : 0;
    const ui = decimals > 0 ? bal / Math.pow(10, decimals) : bal;
    if (!ui || ui <= 0) continue;
    const price = ti.price_info?.price_per_token || null;
    const value = price != null ? ui * price : null;
    // Market cap = circulating supply (in UI units) * price per token.
    // Helius DAS returns total supply in raw units; convert with decimals.
    const supplyRaw = ti.supply != null ? Number(ti.supply) : null;
    const supplyUi =
      supplyRaw != null && decimals > 0
        ? supplyRaw / Math.pow(10, decimals)
        : supplyRaw;
    const marketCapUsd =
      price != null && supplyUi != null && supplyUi > 0 ? supplyUi * price : null;
    out.push({
      mint: a.id,
      symbol: ti.symbol || a.content?.metadata?.symbol || "—",
      name: a.content?.metadata?.name || ti.symbol || "Unknown",
      image: a.content?.links?.image || a.content?.files?.[0]?.uri || null,
      uiAmount: ui,
      decimals,
      priceUsd: price,
      valueUsd: value,
      supplyUi,
      marketCapUsd,
    });
  }
  out.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0));
  return out;
}

// Parse the various tokenAmount shapes Helius returns.
function parseTokenAmount(t) {
  if (t == null) return 0;
  if (typeof t.tokenAmount === "number") return t.tokenAmount;
  if (typeof t.tokenAmount === "string") return Number(t.tokenAmount);
  if (t.tokenAmount && typeof t.tokenAmount === "object") {
    if (t.tokenAmount.tokenAmount != null) return Number(t.tokenAmount.tokenAmount);
    if (t.tokenAmount.uiAmount != null) return Number(t.tokenAmount.uiAmount);
  }
  if (t.rawTokenAmount) {
    const dec = t.rawTokenAmount.decimals || 0;
    return Number(t.rawTokenAmount.tokenAmount) / Math.pow(10, dec);
  }
  return 0;
}

// Walk parsed Helius txs and aggregate per-token SOL flow.
// Robust to Jupiter / aggregator routes:
//  - Compute the user's NET SOL delta for the tx (native + WSOL collapsed).
//  - Compute the user's NET delta per non-SOL mint.
//  - Match opposite-signed deltas → buy or sell of that mint.
// Doesn't assume strict zero on either native leg (rent/refunds are common).
function aggregateSwaps(txs, ownerAddress) {
  const perToken = new Map();
  const SOL_MINT = "So11111111111111111111111111111111111111112";

  for (const tx of txs) {
    if (tx.type !== "SWAP") continue;
    const ts = tx.timestamp || 0;
    const sw = tx.events?.swap;
    if (!sw) continue;

    let solDeltaLamports = 0; // + = user received SOL, - = user spent SOL
    const tokenDelta = new Map(); // mint -> ui units (signed)

    // Native legs — credit only if account matches owner (when present)
    if (sw.nativeInput) {
      const acct = sw.nativeInput.account;
      const amt = Number(sw.nativeInput.amount || 0);
      if (!acct || acct === ownerAddress) solDeltaLamports -= amt;
    }
    if (sw.nativeOutput) {
      const acct = sw.nativeOutput.account;
      const amt = Number(sw.nativeOutput.amount || 0);
      if (!acct || acct === ownerAddress) solDeltaLamports += amt;
    }

    // tokenInputs = tokens the user provided (negative for the user)
    for (const t of sw.tokenInputs || []) {
      const owner = t.userAccount || t.fromUserAccount;
      if (owner && owner !== ownerAddress) continue;
      const ui = parseTokenAmount(t);
      if (!ui) continue;
      if (t.mint === SOL_MINT) {
        solDeltaLamports -= Math.round(ui * 1e9);
      } else {
        tokenDelta.set(t.mint, (tokenDelta.get(t.mint) || 0) - ui);
      }
    }
    // tokenOutputs = tokens the user received (positive for the user)
    for (const t of sw.tokenOutputs || []) {
      const owner = t.userAccount || t.toUserAccount;
      if (owner && owner !== ownerAddress) continue;
      const ui = parseTokenAmount(t);
      if (!ui) continue;
      if (t.mint === SOL_MINT) {
        solDeltaLamports += Math.round(ui * 1e9);
      } else {
        tokenDelta.set(t.mint, (tokenDelta.get(t.mint) || 0) + ui);
      }
    }

    // Fallback: if events.swap had nothing for the user (some aggregators only
    // populate tokenTransfers), walk the top-level tokenTransfers array.
    if (tokenDelta.size === 0) {
      for (const tt of tx.tokenTransfers || []) {
        if (tt.toUserAccount === ownerAddress) {
          const ui = parseTokenAmount(tt);
          if (!ui) continue;
          if (tt.mint === SOL_MINT) {
            solDeltaLamports += Math.round(ui * 1e9);
          } else {
            tokenDelta.set(tt.mint, (tokenDelta.get(tt.mint) || 0) + ui);
          }
        } else if (tt.fromUserAccount === ownerAddress) {
          const ui = parseTokenAmount(tt);
          if (!ui) continue;
          if (tt.mint === SOL_MINT) {
            solDeltaLamports -= Math.round(ui * 1e9);
          } else {
            tokenDelta.set(tt.mint, (tokenDelta.get(tt.mint) || 0) - ui);
          }
        }
      }
      // Also walk nativeTransfers for SOL legs we haven't captured
      for (const nt of tx.nativeTransfers || []) {
        const amt = Number(nt.amount || 0);
        if (!amt) continue;
        if (nt.toUserAccount === ownerAddress) solDeltaLamports += amt;
        else if (nt.fromUserAccount === ownerAddress) solDeltaLamports -= amt;
      }
    }

    if (tokenDelta.size === 0) continue;
    const sol = solDeltaLamports / 1e9;

    for (const [mint, units] of tokenDelta) {
      if (units > 0 && sol < 0) {
        // BUY — user received tokens, paid SOL
        const e = perToken.get(mint) || emptyAgg();
        e.buys += -sol;
        e.boughtUnits += units;
        e.buyCount++;
        e.firstTs = e.firstTs ? Math.min(e.firstTs, ts) : ts;
        e.lastTs = Math.max(e.lastTs || 0, ts);
        e.trades.push({ ts, kind: "buy", sol: -sol, units, signature: tx.signature });
        perToken.set(mint, e);
      } else if (units < 0 && sol > 0) {
        // SELL — user sent tokens, received SOL
        const e = perToken.get(mint) || emptyAgg();
        e.sells += sol;
        e.soldUnits += -units;
        e.sellCount++;
        e.firstTs = e.firstTs ? Math.min(e.firstTs, ts) : ts;
        e.lastTs = Math.max(e.lastTs || 0, ts);
        e.trades.push({ ts, kind: "sell", sol, units: -units, signature: tx.signature });
        perToken.set(mint, e);
      }
      // Same-sign deltas (e.g. token-for-token swap with no SOL leg) are skipped
      // for v1 — pricing those needs a price oracle we don't have.
    }
  }
  return perToken;
}

function emptyAgg() {
  return {
    buys: 0,
    sells: 0,
    boughtUnits: 0,
    soldUnits: 0,
    buyCount: 0,
    sellCount: 0,
    firstTs: 0,
    lastTs: 0,
    trades: [],
  };
}

function buildTrades(perToken, holdings, solPriceUsd) {
  const byMint = new Map(holdings.map((h) => [h.mint, h]));
  const out = [];

  for (const [mint, agg] of perToken) {
    const h = byMint.get(mint);
    const currentUnits = h?.uiAmount || 0;
    const currentValueSol = h?.valueUsd && solPriceUsd ? h.valueUsd / solPriceUsd : 0;

    // Realized PnL: (SOL received from sells) - (SOL spent buying the units that were sold)
    // Approximation: if avg buy price = buys/boughtUnits, cost basis of sold = soldUnits * avgBuy.
    const avgBuy = agg.boughtUnits > 0 ? agg.buys / agg.boughtUnits : 0;
    const costOfSold = avgBuy * Math.min(agg.soldUnits, agg.boughtUnits);
    const realizedSol = agg.sells - costOfSold;

    // Unrealized: current value - cost basis of remaining units
    const remainingUnits = Math.max(0, agg.boughtUnits - agg.soldUnits);
    const costRemaining = avgBuy * remainingUnits;
    const unrealizedSol = currentValueSol - costRemaining;

    // Win flag for closed positions: only call it a "win" if fully closed and realized > 0
    const fullyClosed = currentUnits === 0 || remainingUnits === 0;
    const isWin = fullyClosed && realizedSol > 0;
    const isLoss = fullyClosed && realizedSol < 0;

    const holdSeconds = agg.lastTs && agg.firstTs ? agg.lastTs - agg.firstTs : 0;

    out.push({
      mint,
      symbol: h?.symbol || mint.slice(0, 4) + "…" + mint.slice(-4),
      name: h?.name || null,
      image: h?.image || null,
      buys: agg.buys,
      sells: agg.sells,
      buyCount: agg.buyCount,
      sellCount: agg.sellCount,
      firstTs: agg.firstTs,
      lastTs: agg.lastTs,
      holdSeconds,
      avgBuyPriceSol: avgBuy,
      currentUnits,
      currentValueSol,
      realizedSol,
      unrealizedSol,
      totalPnlSol: realizedSol + unrealizedSol,
      fullyClosed,
      isWin,
      isLoss,
      multiple:
        agg.buys > 0 ? (agg.sells + currentValueSol) / agg.buys : null,
    });
  }
  out.sort((a, b) => (b.totalPnlSol || 0) - (a.totalPnlSol || 0));
  return out;
}

function smartMoneySignals(trades) {
  const closed = trades.filter((t) => t.fullyClosed);
  const wins = closed.filter((t) => t.isWin).length;
  const losses = closed.filter((t) => t.isLoss).length;
  const winRate =
    closed.length > 0 ? wins / closed.length : null;

  const tenXers = trades.filter((t) => t.multiple != null && t.multiple >= 10).length;
  const fiveXers = trades.filter((t) => t.multiple != null && t.multiple >= 5).length;
  const twoXers = trades.filter((t) => t.multiple != null && t.multiple >= 2).length;

  // Average hold time across closed trades that have both first and last ts
  const holdSamples = closed
    .map((t) => t.holdSeconds)
    .filter((s) => s > 0);
  const avgHold = holdSamples.length
    ? holdSamples.reduce((a, b) => a + b, 0) / holdSamples.length
    : null;

  // Diamond / paper read
  let conviction = "balanced";
  if (avgHold != null) {
    if (avgHold < 60 * 60) conviction = "scalper"; // <1h avg
    else if (avgHold < 24 * 60 * 60) conviction = "day_trader"; // <1d
    else if (avgHold < 7 * 24 * 60 * 60) conviction = "swing"; // <1w
    else conviction = "diamond_hands";
  }

  return {
    closedCount: closed.length,
    wins,
    losses,
    winRate,
    tenXers,
    fiveXers,
    twoXers,
    avgHoldSeconds: avgHold,
    conviction,
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isMinuteLimited(ip)) {
    return res.status(429).json({ error: "Slow down — too many requests in the last minute." });
  }

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Wallet analyzer not configured." });
  }

  const { address, uid } = req.body || {};
  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "Wallet address is required." });
  }
  const wallet = address.trim();
  if (!SOLANA_ADDR_RE.test(wallet)) {
    return res.status(400).json({ error: "That doesn't look like a valid Solana wallet address." });
  }

  // =========================================
  // TIER + DAILY CAP
  // =========================================
  let tier = "anonymous";
  let userRef = null;
  let userData = null;
  let currentCount = 0;
  let cap = FREE_DAILY_CAP;

  if (uid && admin.apps.length > 0) {
    try {
      userRef = admin.firestore().collection("users").doc(uid);
      const snap = await userRef.get();
      if (snap.exists) {
        userData = snap.data();
        if (userData.tier === "pro" && userData.subscriptionStatus === "active") {
          tier = "pro";
          cap = PRO_DAILY_CAP;
        } else {
          tier = "free";
        }
      } else {
        tier = "free";
      }
      const t = todayKey();
      currentCount =
        userData?.walletAnalysesUsedDate === t
          ? userData?.walletAnalysesUsedToday || 0
          : 0;
    } catch (err) {
      console.error("Wallet analyzer tier check failed:", err.message);
      // fall back to anonymous behavior
      tier = "anonymous";
    }
  }

  if (tier === "anonymous") {
    currentCount = getAnonDailyCount(ip);
    cap = FREE_DAILY_CAP;
  }

  if (currentCount >= cap) {
    return res.status(429).json({
      error:
        tier === "pro"
          ? `You've hit your ${PRO_DAILY_CAP} daily wallet analyses. Try again tomorrow.`
          : `Daily limit reached (${cap}/day). Sign in for Pro to get ${PRO_DAILY_CAP}/day.`,
      dailyLimit: true,
      tier,
      cap,
      used: currentCount,
    });
  }

  // =========================================
  // FETCH (parallel)
  // =========================================
  let assetsResp, txs, kolMap;
  try {
    [assetsResp, txs, kolMap] = await Promise.all([
      fetchAssets(wallet, apiKey).catch(() => ({ items: [], nativeBalance: null })),
      fetchTransactions(wallet, apiKey, 100).catch(() => []),
      getKolMap().catch(() => new Map()),
    ]);
  } catch (err) {
    console.error("Wallet analyzer fetch error:", err.message);
    return res.status(502).json({ error: "Failed to fetch wallet data. Please try again in a moment." });
  }

  // =========================================
  // SYNTHESIZE
  // =========================================
  const holdings = buildHoldings(assetsResp.items || []);
  const native = assetsResp.nativeBalance || null;
  // Helius native_balance shape: { lamports, price_per_sol, total_price }
  const solBalance =
    native?.lamports != null
      ? Number(native.lamports) / 1e9
      : null;
  const solPriceUsd = native?.price_per_sol ? Number(native.price_per_sol) : null;
  const solValueUsd =
    native?.total_price != null
      ? Number(native.total_price)
      : solBalance != null && solPriceUsd
      ? solBalance * solPriceUsd
      : null;

  const perToken = aggregateSwaps(txs, wallet);
  const trades = buildTrades(perToken, holdings, solPriceUsd);
  const signals = smartMoneySignals(trades);

  const holdingsValueUsd = holdings.reduce((acc, h) => acc + (h.valueUsd || 0), 0);
  const portfolioUsd =
    (solValueUsd || 0) + holdingsValueUsd || (holdingsValueUsd > 0 ? holdingsValueUsd : null);

  // KOL match
  const kolMatch = kolMap.get(wallet) || null;

  // Bump counter (best effort)
  try {
    if (tier !== "anonymous" && userRef) {
      await userRef.set(
        {
          walletAnalysesUsedDate: todayKey(),
          walletAnalysesUsedToday: currentCount + 1,
        },
        { merge: true }
      );
    } else {
      bumpAnonDaily(ip);
    }
  } catch (err) {
    console.error("Failed to increment wallet counter:", err.message);
  }

  return res.status(200).json({
    address: wallet,
    chain: "solana",
    tier,
    analysesUsedToday: currentCount + 1,
    dailyCap: cap,
    sol: {
      balance: solBalance,
      valueUsd: solValueUsd,
    },
    portfolio: {
      tokenCount: holdings.length,
      holdingsValueUsd,
      totalUsd: portfolioUsd,
    },
    kol: kolMatch
      ? {
          name: kolMatch.name,
          twitter: kolMatch.twitter,
          telegram: kolMatch.telegram,
          profileUrl: kolMatch.profile_url,
          ranks: kolMatch.ranks,
        }
      : null,
    holdings: holdings.slice(0, 50), // cap response size
    trades: trades.slice(0, 50),
    signals,
    sources: {
      helius: true,
      kolscan: kolMap.size > 0,
    },
    explorerUrl: `https://solscan.io/account/${wallet}`,
    generatedAt: new Date().toISOString(),
  });
};
