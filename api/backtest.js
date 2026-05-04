/**
 * Copy-Trader Backtest
 *
 * Simulates: "If I had copied every buy this wallet made over the last N days,
 * spending the same amount of SOL each time, what would my outcome be by now?"
 *
 * Output is THEORETICAL — real-world copy trading underperforms theoretical
 * results due to slippage, MEV, gas, missed fills, and emotional decisions.
 * The UI surfaces these caveats prominently.
 *
 * Architecture:
 *   1. Paginate Helius parsed transactions backwards (newest → oldest) until
 *      we cross the lookback boundary or hit a tx-page cap (5 pages = 500 txs).
 *   2. Reuse swap-aggregation logic from wallet-analysis.js.
 *   3. For each non-SOL token traded: track buys (SOL spent), sells (SOL received).
 *   4. For tokens still being held (bought > sold), fetch current price via DAS.
 *   5. Aggregate: total deployed, realized return, unrealized value, net PnL.
 */

const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=";
const HELIUS_PARSED = "https://api.helius.xyz/v0/addresses/";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 30;
const TX_PAGE_LIMIT = 100;
const MAX_TX_PAGES = 5; // up to 500 txs total

// Per-IP rate limit
const minuteMap = new Map();
const MINUTE_WINDOW = 60 * 1000;
const MINUTE_MAX = 4;
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
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of minuteMap) {
    if (now - v.start > MINUTE_WINDOW * 2) minuteMap.delete(k);
  }
}, 5 * 60 * 1000);

// Cache results per wallet+window for 5 min
const resultCache = new Map();
const RESULT_TTL = 5 * 60 * 1000;

function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

// Same handler as wallet-analysis.js — keeps swap detection consistent.
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

async function fetchTxPage(address, apiKey, before) {
  const params = new URLSearchParams({ "api-key": apiKey, limit: String(TX_PAGE_LIMIT) });
  if (before) params.set("before", before);
  const url = `${HELIUS_PARSED}${address}/transactions?${params.toString()}`;
  const res = await fetchWithTimeout(url, {}, 12000);
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

async function fetchAllTxs(address, apiKey, lookbackMs) {
  const cutoffSec = Math.floor((Date.now() - lookbackMs) / 1000);
  const all = [];
  let before = null;
  for (let page = 0; page < MAX_TX_PAGES; page++) {
    const batch = await fetchTxPage(address, apiKey, before);
    if (batch.length === 0) break;
    all.push(...batch);
    const last = batch[batch.length - 1];
    // If the oldest tx in this batch is past our cutoff, we're done.
    if ((last.timestamp || 0) < cutoffSec) break;
    before = last.signature;
    if (batch.length < TX_PAGE_LIMIT) break;
  }
  // Filter to lookback window
  return all.filter((tx) => (tx.timestamp || 0) >= cutoffSec);
}

// Returns Map<mint, {buys, sells, boughtUnits, soldUnits, buyCount, sellCount,
//   firstTs, lastTs, trades: [{ts, kind, sol, units}]}>
// Same logic as wallet-analysis.js aggregateSwaps but extracted for clarity.
function aggregateSwaps(txs, owner) {
  const perToken = new Map();
  const empty = () => ({
    buys: 0,
    sells: 0,
    boughtUnits: 0,
    soldUnits: 0,
    buyCount: 0,
    sellCount: 0,
    firstTs: 0,
    lastTs: 0,
    trades: [],
  });

  for (const tx of txs) {
    if (tx.type !== "SWAP") continue;
    const ts = tx.timestamp || 0;
    const sw = tx.events?.swap || null;

    let solDeltaLamports = 0;
    const tokenDelta = new Map();

    if (sw) {
      if (sw.nativeInput) {
        const acct = sw.nativeInput.account;
        const amt = Number(sw.nativeInput.amount || 0);
        if (!acct || acct === owner) solDeltaLamports -= amt;
      }
      if (sw.nativeOutput) {
        const acct = sw.nativeOutput.account;
        const amt = Number(sw.nativeOutput.amount || 0);
        if (!acct || acct === owner) solDeltaLamports += amt;
      }
      for (const t of sw.tokenInputs || []) {
        const o = t.userAccount || t.fromUserAccount;
        if (o && o !== owner) continue;
        const ui = parseTokenAmount(t);
        if (!ui) continue;
        if (t.mint === SOL_MINT) solDeltaLamports -= Math.round(ui * 1e9);
        else tokenDelta.set(t.mint, (tokenDelta.get(t.mint) || 0) - ui);
      }
      for (const t of sw.tokenOutputs || []) {
        const o = t.userAccount || t.toUserAccount;
        if (o && o !== owner) continue;
        const ui = parseTokenAmount(t);
        if (!ui) continue;
        if (t.mint === SOL_MINT) solDeltaLamports += Math.round(ui * 1e9);
        else tokenDelta.set(t.mint, (tokenDelta.get(t.mint) || 0) + ui);
      }
    }

    // Fallback for PUMP_AMM and other DEXes that leave events.swap empty.
    if (tokenDelta.size === 0) {
      for (const tt of tx.tokenTransfers || []) {
        if (tt.toUserAccount === owner) {
          const ui = parseTokenAmount(tt);
          if (!ui) continue;
          if (tt.mint === SOL_MINT) solDeltaLamports += Math.round(ui * 1e9);
          else tokenDelta.set(tt.mint, (tokenDelta.get(tt.mint) || 0) + ui);
        } else if (tt.fromUserAccount === owner) {
          const ui = parseTokenAmount(tt);
          if (!ui) continue;
          if (tt.mint === SOL_MINT) solDeltaLamports -= Math.round(ui * 1e9);
          else tokenDelta.set(tt.mint, (tokenDelta.get(tt.mint) || 0) - ui);
        }
      }
      for (const nt of tx.nativeTransfers || []) {
        const amt = Number(nt.amount || 0);
        if (!amt) continue;
        if (nt.toUserAccount === owner) solDeltaLamports += amt;
        else if (nt.fromUserAccount === owner) solDeltaLamports -= amt;
      }
    }

    if (tokenDelta.size === 0) continue;
    const sol = solDeltaLamports / 1e9;

    for (const [mint, units] of tokenDelta) {
      if (units > 0 && sol < 0) {
        const e = perToken.get(mint) || empty();
        e.buys += -sol;
        e.boughtUnits += units;
        e.buyCount++;
        e.firstTs = e.firstTs ? Math.min(e.firstTs, ts) : ts;
        e.lastTs = Math.max(e.lastTs || 0, ts);
        e.trades.push({ ts, kind: "buy", sol: -sol, units });
        perToken.set(mint, e);
      } else if (units < 0 && sol > 0) {
        const e = perToken.get(mint) || empty();
        e.sells += sol;
        e.soldUnits += -units;
        e.sellCount++;
        e.firstTs = e.firstTs ? Math.min(e.firstTs, ts) : ts;
        e.lastTs = Math.max(e.lastTs || 0, ts);
        e.trades.push({ ts, kind: "sell", sol, units: -units });
        perToken.set(mint, e);
      }
    }
  }
  return perToken;
}

// Fetch metadata + price for a list of mints via Helius DAS getAssetBatch.
async function fetchAssetBatch(mints, apiKey) {
  if (!mints.length) return new Map();
  const out = new Map();
  // Helius DAS allows up to 1000 mints per batch
  const chunks = [];
  for (let i = 0; i < mints.length; i += 100) chunks.push(mints.slice(i, i + 100));

  for (const chunk of chunks) {
    try {
      const res = await fetchWithTimeout(
        HELIUS_RPC + apiKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            method: "getAssetBatch",
            params: { ids: chunk },
          }),
        },
        12000
      );
      if (!res.ok) continue;
      const j = await res.json();
      const items = j?.result || [];
      for (const a of items) {
        if (!a) continue;
        const ti = a.token_info || {};
        const decimals = ti.decimals != null ? ti.decimals : 0;
        const price = ti.price_info?.price_per_token || null;
        out.set(a.id, {
          symbol: ti.symbol || a.content?.metadata?.symbol || "—",
          name: a.content?.metadata?.name || ti.symbol || "Unknown",
          image: a.content?.links?.image || null,
          decimals,
          priceUsd: price,
        });
      }
    } catch (err) {
      // continue with what we have
    }
  }
  return out;
}

async function fetchSolPriceUsd(apiKey) {
  try {
    const res = await fetchWithTimeout(
      HELIUS_RPC + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "getAsset",
          params: { id: SOL_MINT },
        }),
      },
      8000
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j?.result?.token_info?.price_info?.price_per_token || null;
  } catch {
    return null;
  }
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (isMinuteLimited(ip)) {
    return res.status(429).json({ error: "Slow down — too many backtests in the last minute." });
  }

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Backtest not configured." });

  const { address, days } = req.body || {};
  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "Wallet address is required." });
  }
  const wallet = address.trim();
  if (!SOLANA_ADDR_RE.test(wallet)) {
    return res.status(400).json({ error: "That doesn't look like a valid Solana wallet address." });
  }
  let lookbackDays = Number(days);
  if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) lookbackDays = DEFAULT_LOOKBACK_DAYS;
  lookbackDays = Math.min(lookbackDays, MAX_LOOKBACK_DAYS);

  const cacheKey = `${wallet}:${lookbackDays}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RESULT_TTL) {
    return res.status(200).json({ ...cached.value, cached: true });
  }

  try {
    const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
    const txs = await fetchAllTxs(wallet, apiKey, lookbackMs);
    const swapTxCount = txs.filter((t) => t.type === "SWAP").length;

    const perToken = aggregateSwaps(txs, wallet);

    // Tokens that still have an open position (bought > sold units)
    const stillHoldingMints = [...perToken.entries()]
      .filter(([_, agg]) => agg.boughtUnits > agg.soldUnits + 1e-9)
      .map(([mint]) => mint);

    const [assetMeta, solPriceUsd] = await Promise.all([
      fetchAssetBatch(stillHoldingMints, apiKey),
      fetchSolPriceUsd(apiKey),
    ]);

    // Build per-token simulated trade records
    const trades = [];
    let totalDeployedSol = 0;
    let totalRealizedSol = 0;
    let totalUnrealizedSol = 0;

    for (const [mint, agg] of perToken) {
      const remainingUnits = Math.max(0, agg.boughtUnits - agg.soldUnits);
      const avgBuyPriceSol = agg.boughtUnits > 0 ? agg.buys / agg.boughtUnits : 0;
      const meta = assetMeta.get(mint) || {};
      const priceUsd = meta.priceUsd || null;
      const remainingValueUsd = priceUsd != null ? remainingUnits * priceUsd : null;
      const remainingValueSol =
        remainingValueUsd != null && solPriceUsd ? remainingValueUsd / solPriceUsd : null;

      const costOfSold = avgBuyPriceSol * Math.min(agg.soldUnits, agg.boughtUnits);
      const realizedSol = agg.sells - costOfSold;
      const unrealizedSol = remainingValueSol != null ? remainingValueSol - avgBuyPriceSol * remainingUnits : null;

      totalDeployedSol += agg.buys;
      totalRealizedSol += realizedSol;
      if (unrealizedSol != null) totalUnrealizedSol += unrealizedSol;

      const fullyClosed = remainingUnits < 1e-9;
      const totalReturnSol = (agg.sells || 0) + (remainingValueSol || 0);
      const multiple = agg.buys > 0 ? totalReturnSol / agg.buys : null;

      trades.push({
        mint,
        symbol: meta.symbol || mint.slice(0, 4) + "…" + mint.slice(-4),
        name: meta.name || null,
        image: meta.image || null,
        buyCount: agg.buyCount,
        sellCount: agg.sellCount,
        firstTs: agg.firstTs,
        lastTs: agg.lastTs,
        buys: agg.buys,
        sells: agg.sells,
        avgBuyPriceSol,
        boughtUnits: agg.boughtUnits,
        soldUnits: agg.soldUnits,
        remainingUnits,
        remainingValueSol,
        realizedSol,
        unrealizedSol,
        totalReturnSol,
        multiple,
        fullyClosed,
      });
    }

    trades.sort((a, b) => {
      const aPnl = (a.realizedSol || 0) + (a.unrealizedSol || 0);
      const bPnl = (b.realizedSol || 0) + (b.unrealizedSol || 0);
      return bPnl - aPnl;
    });

    const totalNetSol = totalRealizedSol + totalUnrealizedSol;
    const overallMultiple =
      totalDeployedSol > 0
        ? (totalRealizedSol + totalUnrealizedSol + (totalDeployedSol - totalRealizedSol /* avoid double-count */)) / totalDeployedSol
        : null;
    // Cleaner overall multiple formula:
    // multiple = (sum of sells + sum of remaining value) / sum of buys
    const sumSells = trades.reduce((a, t) => a + (t.sells || 0), 0);
    const sumRemainingValue = trades.reduce((a, t) => a + (t.remainingValueSol || 0), 0);
    const overallMultipleClean =
      totalDeployedSol > 0 ? (sumSells + sumRemainingValue) / totalDeployedSol : null;

    const closedCount = trades.filter((t) => t.fullyClosed).length;
    const winnersClosed = trades.filter((t) => t.fullyClosed && t.realizedSol > 0).length;
    const winRate = closedCount > 0 ? winnersClosed / closedCount : null;

    const responseBody = {
      address: wallet,
      lookbackDays,
      txCount: txs.length,
      swapTxCount,
      tokenCount: perToken.size,
      summary: {
        deployedSol: totalDeployedSol,
        realizedSol: totalRealizedSol,
        unrealizedSol: totalUnrealizedSol,
        netPnlSol: totalNetSol,
        overallMultiple: overallMultipleClean,
        closedTradeCount: closedCount,
        winnersClosed,
        winRate,
      },
      solPriceUsd,
      trades: trades.slice(0, 100),
      generatedAt: new Date().toISOString(),
    };

    resultCache.set(cacheKey, { at: Date.now(), value: responseBody });
    if (resultCache.size > 200) {
      const oldest = [...resultCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) resultCache.delete(oldest[0]);
    }

    return res.status(200).json({ ...responseBody, cached: false });
  } catch (err) {
    console.error("Backtest error:", err.message);
    return res.status(502).json({ error: "Backtest failed. Try again in a moment." });
  }
};
