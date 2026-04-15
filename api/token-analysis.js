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

// Per-IP rate limit to protect against abuse even among Pro users
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10; // max 10 analyses per minute per IP

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Solana address validation (base58, 32-44 chars)
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// =============================================
// DATA SOURCES
// =============================================

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// DexScreener — primary source for price, MC, liquidity, pair data.
// Covers 100% of Solana tokens including pump.fun launches.
async function fetchDexScreener(mint) {
  try {
    const res = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { headers: { "User-Agent": "DegenDesk/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.pairs || data.pairs.length === 0) return null;

    // Pick the Solana pair with the highest liquidity
    const solPairs = data.pairs.filter((p) => p.chainId === "solana");
    if (solPairs.length === 0) return null;
    solPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const top = solPairs[0];

    return {
      name: top.baseToken?.name || null,
      symbol: top.baseToken?.symbol || null,
      priceUsd: top.priceUsd ? parseFloat(top.priceUsd) : null,
      marketCap: top.marketCap || top.fdv || null,
      fdv: top.fdv || null,
      liquidityUsd: top.liquidity?.usd || null,
      volume24h: top.volume?.h24 || null,
      priceChange24h: top.priceChange?.h24 || null,
      priceChange1h: top.priceChange?.h1 || null,
      pairCreatedAt: top.pairCreatedAt || null,
      dexId: top.dexId || null,
      pairAddress: top.pairAddress || null,
      imageUrl: top.info?.imageUrl || null,
      websites: top.info?.websites || [],
      socials: top.info?.socials || [],
    };
  } catch (err) {
    console.error("DexScreener fetch failed:", err.message);
    return null;
  }
}

// RugCheck — risk flags, bundled supply %, dev history.
// Free API, no key needed.
async function fetchRugCheck(mint) {
  try {
    const res = await fetchWithTimeout(
      `https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      score: data.score ?? null,
      scoreNormalised: data.score_normalised ?? null,
      risks: Array.isArray(data.risks) ? data.risks.slice(0, 10) : [],
      // tokenMeta, topHolders, markets may come from the full report; summary is lighter
      rawSummary: data,
    };
  } catch (err) {
    console.error("RugCheck fetch failed:", err.message);
    return null;
  }
}

// RugCheck full report (gives us top holders + insider analysis + markets)
async function fetchRugCheckFull(mint) {
  try {
    const res = await fetchWithTimeout(
      `https://api.rugcheck.xyz/v1/tokens/${mint}/report`,
      { headers: { "Accept": "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Build a set of addresses that are known AMM liquidity pools so we
    // can tag those entries inside topHolders. RugCheck's `markets` array
    // lists each trading pair with the token-account addresses the LP
    // holds — those are the same addresses that show up in topHolders.
    const lpAddresses = new Set();
    const markets = Array.isArray(data.markets) ? data.markets : [];
    for (const m of markets) {
      // Different RugCheck versions expose these under different names
      const candidates = [
        m.mintAAccount, m.mintBAccount,
        m.lp?.mintAAccount, m.lp?.mintBAccount,
        m.pubkey, m.liquidityA, m.liquidityB,
        m.lpMint, m.lp?.lpMint,
      ].filter(Boolean);
      for (const addr of candidates) lpAddresses.add(addr);
    }

    // Tag each top holder with isLiquidityPool based on the LP address set.
    const rawTopHolders = Array.isArray(data.topHolders) ? data.topHolders.slice(0, 10) : [];
    const tagged = rawTopHolders.map((h) => ({
      address: h.address || null,
      owner: h.owner || null,
      pct: typeof h.pct === "number" ? h.pct : null,
      uiAmount: h.uiAmount ?? null,
      insider: !!h.insider,
      isLiquidityPool:
        lpAddresses.has(h.address) ||
        lpAddresses.has(h.owner) ||
        // Heuristic fallback: RugCheck sometimes labels these inline
        (typeof h.address === "string" && h.address.toLowerCase().includes("pool")),
    }));

    // Non-LP view — the one we care about for "top wallet concentration"
    const nonLpTopHolders = tagged.filter((h) => !h.isLiquidityPool);

    // Aggregate LP share so GPT can report it separately
    const lpShareTotalPct = tagged
      .filter((h) => h.isLiquidityPool)
      .reduce((sum, h) => sum + (h.pct || 0), 0);

    return {
      topHolders: tagged,               // full list with LP tagging
      topHoldersNonLp: nonLpTopHolders, // wallets only (the list users care about)
      lpShareTotalPct: lpShareTotalPct || null,
      creator: data.creator || null,
      mintAuthority: data.mintAuthority || null,
      freezeAuthority: data.freezeAuthority || null,
      totalMarketLiquidity: data.totalMarketLiquidity || null,
      totalHolders: data.totalHolders || null,
      insiderNetworks: Array.isArray(data.insiderNetworks) ? data.insiderNetworks.slice(0, 5) : [],
      markets: markets.slice(0, 5).map((m) => ({
        pubkey: m.pubkey || null,
        marketType: m.marketType || null,
      })),
    };
  } catch (err) {
    console.error("RugCheck full report fetch failed:", err.message);
    return null;
  }
}

// pump.fun frontend API — bonding curve %, dev %, pump-native metadata.
// Only for addresses that look like pump.fun mints (end in "pump").
async function fetchPumpFun(mint) {
  if (!mint.toLowerCase().endsWith("pump")) return null;
  try {
    const res = await fetchWithTimeout(
      `https://frontend-api.pump.fun/coins/${mint}`,
      { headers: { "Accept": "application/json", "User-Agent": "DegenDesk/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.name || null,
      symbol: data.symbol || null,
      description: data.description || null,
      creator: data.creator || null,
      marketCap: data.usd_market_cap || null,
      bondingCurveComplete: data.complete ?? null,
      bondingCurveProgress: data.complete ? 100 : null,
      virtualSolReserves: data.virtual_sol_reserves || null,
      virtualTokenReserves: data.virtual_token_reserves || null,
      king: data.king_of_the_hill_timestamp ? true : false,
      raydiumPool: data.raydium_pool || null,
      nsfw: data.nsfw || false,
    };
  } catch (err) {
    // pump.fun API is undocumented and can break — fail gracefully
    console.error("pump.fun fetch failed:", err.message);
    return null;
  }
}

// Helius — funding source trace for the dev wallet.
// Uses the user's existing HELIUS_API_KEY env var.
async function fetchHeliusDevTrace(creatorAddress) {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey || !creatorAddress) return null;

  try {
    // Get the most recent transactions for the creator wallet
    const url = `https://api.helius.xyz/v0/addresses/${creatorAddress}/transactions?api-key=${apiKey}&limit=25`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const txs = await res.json();
    if (!Array.isArray(txs)) return null;

    // Walk backwards looking for the earliest incoming SOL transfer — the funding source
    let fundingSource = null;
    let fundingTx = null;
    for (let i = txs.length - 1; i >= 0; i--) {
      const tx = txs[i];
      const nativeTransfers = tx.nativeTransfers || [];
      for (const t of nativeTransfers) {
        if (t.toUserAccount === creatorAddress && t.amount > 0) {
          fundingSource = t.fromUserAccount;
          fundingTx = tx.signature;
          break;
        }
      }
      if (fundingSource) break;
    }

    // Count total outgoing transfers (rough proxy for activity)
    let totalTx = txs.length;
    let oldestTs = txs.length > 0 ? txs[txs.length - 1].timestamp : null;

    return {
      address: creatorAddress,
      fundingSource,
      fundingTx,
      recentTxCount: totalTx,
      oldestSeenTimestamp: oldestTs,
    };
  } catch (err) {
    console.error("Helius fetch failed:", err.message);
    return null;
  }
}

// =============================================
// GPT-4o SYNTHESIS
// =============================================

const SYSTEM_PROMPT = `You are the Token Analysis engine for Degen Desk — a Pro-tier tool that analyzes Solana tokens using on-chain data.

CRITICAL LEGAL RULES (NEVER BREAK THESE):
1. NEVER predict prices. Never say "this will go to $X" or "this will pump" or "buy this."
2. NEVER give direct financial advice. Never say "invest" or "sell now" or "this is a good buy."
3. NEVER promise safety. Never say "this is safe" or "this is a rug." Use language like "shows characteristics consistent with..." or "observed patterns suggest caution."
4. ALWAYS frame comparisons as historical observations: "similar tokens in this category have historically reached $X MC" — never as predictions.
5. For unique/new tokens with no clear comparables, use cautious language: "shows potential characteristics worth monitoring" — never "will moon" or any variation.
6. Every section must implicitly or explicitly remind the user this is NFA/DYOR.
7. If data is missing or incomplete, say so clearly — don't speculate to fill gaps.

CRITICAL HOLDER RULES (NEVER BREAK THESE):
8. The rugCheckFull.topHolders array may include liquidity pool (LP / AMM) accounts. Each entry has an isLiquidityPool boolean.
9. When stating "the top holder owns X%" or discussing wallet concentration, YOU MUST USE rugCheckFull.topHoldersNonLp — the LP-filtered list. NEVER cite an LP entry as "a top holder." LPs are trading reserves, not individual wallets.
10. If ALL top holders are LPs (topHoldersNonLp is empty), say "Top wallet holders are below the reporting threshold — supply appears distributed across many small wallets."
11. Report LP share SEPARATELY from wallet concentration. Phrase LP as "liquidity pool reserves" or "AMM-held supply." Example: "The top non-LP wallet holds 2.2% of supply. Liquidity pool reserves account for ~22% of supply, which is normal for tradeable tokens."
12. Always use the pct value directly from the data. It is already a percentage (e.g. 2.2 means 2.2%). NEVER multiply, divide, or transform it.

YOUR JOB:
Analyze the raw data provided and return a structured JSON response. The frontend will render it. Keep it factual, observational, and cautious.

OUTPUT FORMAT (JSON, no markdown wrapping):
{
  "summary": "2-3 sentence plain-English overview of the token. Factual. No predictions.",
  "riskLevel": "low" | "medium" | "high" | "critical" | "unknown",
  "riskLabel": "Short risk label (e.g., 'Low observable risk', 'Multiple red flags detected', 'Insufficient data')",
  "keyFindings": [
    "Bullet point observations. 3-6 items. Mix of positive and concerning signals.",
    "Each bullet should reference a specific data point (liquidity, holders, dev wallet, etc.)",
    "When citing holder concentration, use topHoldersNonLp only. Never call an LP entry a 'top holder'."
  ],
  "holderAnalysis": "2-3 sentences about WALLET concentration using ONLY topHoldersNonLp. Cite the top non-LP wallet percentage. Mention LP/AMM reserves separately (using lpShareTotalPct if present) and note that LP reserves are normal for tradeable tokens. Mention insider network flags from RugCheck if present.",
  "bundleAnalysis": "2-3 sentences about bundling. If RugCheck flagged bundled supply or insider networks, mention it. If not, say 'No obvious bundling patterns detected in available data.'",
  "devWalletAnalysis": "3-4 sentences about the dev/creator wallet. Mention funding source if known, transaction activity, any rug history flags from RugCheck. Never say 'the dev is a scammer' — say 'the dev wallet shows [observable patterns]'.",
  "comparables": "For established meta tokens (dog, cat, frog, political, AI, etc.), mention 1-3 similar tokens and their historical peak MC as factual reference points. For unique/new tokens: 'This token is unique and has no direct comparables. It shows potential characteristics worth monitoring. NFA. DYOR.'",
  "finalNote": "1-2 sentence final observational note. Always end with: 'This is not financial advice. Do your own research.'"
}

REMEMBER: The user is paying for Pro. Give them real analysis, but stay legally bulletproof. Observational language only. Never directive.`;

async function synthesizeWithGPT(rawData, apiKey) {
  const userMessage = `Analyze this Solana token based on the following raw data:\n\n${JSON.stringify(rawData, null, 2)}\n\nReturn the structured JSON report as specified.`;

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    },
    30000
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error("Failed to parse AI JSON response");
  }
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

  const clientIP =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (isRateLimited(clientIP)) {
    return res
      .status(429)
      .json({ error: "Too many requests. Please slow down and try again in a minute." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const { contractAddress, uid } = req.body || {};

  // Basic validation
  if (!contractAddress || typeof contractAddress !== "string") {
    return res.status(400).json({ error: "Contract address is required." });
  }
  const mint = contractAddress.trim();
  if (!SOLANA_ADDR_RE.test(mint)) {
    return res
      .status(400)
      .json({ error: "That doesn't look like a valid Solana contract address." });
  }
  if (!uid) {
    return res.status(401).json({
      error: "Please sign in to use Token Analysis.",
      requireAuth: true,
    });
  }
  if (admin.apps.length === 0) {
    return res.status(500).json({ error: "Authentication backend not configured." });
  }

  // =========================================
  // PRO HARD GATE
  // =========================================
  let userRef = null;
  let userData = null;
  let tier = "free";
  try {
    userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      userData = userDoc.data();
      if (userData.tier === "pro" && userData.subscriptionStatus === "active") {
        tier = "pro";
      }
    }
  } catch (err) {
    console.error("Tier check failed:", err.message);
    return res.status(500).json({ error: "Failed to verify subscription." });
  }

  if (tier !== "pro") {
    return res.status(403).json({
      error: "Token Analysis is a Pro feature. Upgrade to unlock.",
      upgrade: true,
      proRequired: true,
    });
  }

  // =========================================
  // DAILY RATE LIMIT (20/day per Pro user, Firestore-tracked)
  // =========================================
  const DAILY_CAP = 20;
  const today = new Date().toISOString().split("T")[0];
  const storedDate = userData?.tokenAnalysesUsedDate;
  const currentCount = storedDate === today ? userData?.tokenAnalysesUsedToday || 0 : 0;

  if (currentCount >= DAILY_CAP) {
    return res.status(429).json({
      error: `You've used your ${DAILY_CAP} daily token analyses. Please try again tomorrow.`,
      dailyLimit: true,
    });
  }

  // =========================================
  // FETCH ALL DATA SOURCES IN PARALLEL
  // =========================================
  const [dex, rugSummary, rugFull, pumpfun] = await Promise.all([
    fetchDexScreener(mint),
    fetchRugCheck(mint),
    fetchRugCheckFull(mint),
    fetchPumpFun(mint),
  ]);

  // Derive the creator/dev wallet from whichever source has it
  const creatorAddress =
    rugFull?.creator || pumpfun?.creator || null;

  // Helius funding trace (only if we have a creator address + key)
  const devTrace = creatorAddress ? await fetchHeliusDevTrace(creatorAddress) : null;

  // If DexScreener returned nothing AND RugCheck returned nothing AND pump.fun returned nothing,
  // we probably have a bad address or an unknown token — bail early.
  if (!dex && !rugSummary && !rugFull && !pumpfun) {
    return res.status(404).json({
      error:
        "Couldn't find any data for that token. Double-check the contract address is correct and the token has at least one trading pair.",
    });
  }

  // =========================================
  // BUILD RAW DATA PACKAGE FOR GPT
  // =========================================
  const rawData = {
    contractAddress: mint,
    dexScreener: dex,
    rugCheckSummary: rugSummary
      ? {
          score: rugSummary.score,
          scoreNormalised: rugSummary.scoreNormalised,
          risks: rugSummary.risks,
        }
      : null,
    rugCheckFull: rugFull,
    pumpFun: pumpfun,
    devWalletTrace: devTrace,
  };

  // =========================================
  // GPT-4o SYNTHESIS
  // =========================================
  let report;
  try {
    report = await synthesizeWithGPT(rawData, apiKey);
  } catch (err) {
    console.error("GPT synthesis failed:", err.message);
    return res
      .status(502)
      .json({ error: "Failed to generate analysis. Please try again in a moment." });
  }

  // Increment daily counter (best-effort)
  try {
    await userRef.set(
      {
        tokenAnalysesUsedDate: today,
        tokenAnalysesUsedToday: currentCount + 1,
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Failed to increment analysis counter:", err.message);
  }

  // =========================================
  // RESPOND WITH STRUCTURED REPORT
  // =========================================
  const metrics = dex
    ? {
        name: dex.name,
        symbol: dex.symbol,
        priceUsd: dex.priceUsd,
        marketCap: dex.marketCap,
        fdv: dex.fdv,
        liquidityUsd: dex.liquidityUsd,
        volume24h: dex.volume24h,
        priceChange24h: dex.priceChange24h,
        priceChange1h: dex.priceChange1h,
        pairCreatedAt: dex.pairCreatedAt,
        dexId: dex.dexId,
        pairAddress: dex.pairAddress,
        imageUrl: dex.imageUrl,
        websites: dex.websites,
        socials: dex.socials,
      }
    : pumpfun
    ? {
        name: pumpfun.name,
        symbol: pumpfun.symbol,
        marketCap: pumpfun.marketCap,
        bondingCurveComplete: pumpfun.bondingCurveComplete,
      }
    : { name: null, symbol: null };

  return res.status(200).json({
    contractAddress: mint,
    metrics,
    report,
    sources: {
      dexScreener: !!dex,
      rugCheck: !!(rugSummary || rugFull),
      pumpFun: !!pumpfun,
      helius: !!devTrace,
    },
    analysesUsedToday: currentCount + 1,
    analysesDailyCap: DAILY_CAP,
    generatedAt: new Date().toISOString(),
  });
};
