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

RED FLAG HEURISTICS — THINK LIKE A DEGENERATE TRADER:
You are not a surface-level data reporter. You must apply experienced Solana memecoin trader logic when interpreting the data. The following patterns are MAJOR red flags and MUST be flagged aggressively:

A) MANUFACTURED "ONLY-UP" CHARTS:
   - If priceChange24h is extreme (>300-500%) AND the token has NO socials, NO website, NO narrative, AND low holder count (<2000) — this is a classic manipulation pattern. Someone is coordinating buys to create a "green chart" that baits uninformed buyers.
   - Flag this explicitly: "The chart shows extreme upward price action without corresponding social presence, narrative, or organic community. This pattern is commonly associated with coordinated price manipulation."
   - This should push riskLevel to "high" or "critical."

B) VOLUME vs MARKET CAP vs LIQUIDITY ANALYSIS:
   - Calculate liquidityUsd / marketCap ratio. If liquidity is <10% of MC, the market cap is largely "paper" — a small sell would crash the price.
   - If volume24h is significant but the chart is only-up, that volume likely includes wash trading or coordinated buy pressure with no real sell-side demand.
   - If liquidityUsd is very low (under $100K) relative to MC (over $500K), explicitly warn: "Thin liquidity relative to market cap — a moderate sell could cause significant price impact."

C) "NO BUNDLERS DETECTED" IS NOT THE SAME AS "NOT BUNDLED":
   - RugCheck's bundler detection has limitations. Just because RugCheck flags 0% bundlers does NOT mean the token is clean.
   - If the chart shows only-up price action, low holder count, no socials, and thin liquidity — say: "While no bundling was detected by automated scanners, the price action pattern (sustained upward movement without pullbacks, low holder count, absence of organic catalysts) exhibits characteristics commonly associated with coordinated activity that may evade standard detection."
   - NEVER say "No bundling detected" as if that's reassuring when other signals scream manipulation.

D) SOCIAL PRESENCE / NARRATIVE CHECK:
   - If dexScreener.socials is empty AND dexScreener.websites is empty AND the token has >$200K MC — flag this as suspicious. Real organic tokens at $200K+ MC almost always have at least a Twitter/Telegram.
   - "No social media presence or website detected at this market cap level. Organic tokens typically develop community presence well before reaching this valuation."

E) DEV WALLET ACTIVITY:
   - If the dev wallet has very few transactions (1-5) AND the token has high MC, the dev may have deployed and walked away (or is using a fresh wallet to hide history). Flag: "The developer wallet shows minimal transaction history, which could indicate the use of a freshly-created wallet — a common practice to avoid linking to prior projects."
   - If dev wallet fundingSource is a known mixer, CEX, or another fresh wallet, note it.

F) HOLDER COUNT vs MARKET CAP:
   - A token at $1M+ MC with <1000 holders is extremely suspicious. Organic tokens at that MC usually have 3,000-10,000+ holders.
   - Flag low holder-to-MC ratio explicitly.

G) RISK LEVEL ESCALATION RULES:
   - If 3+ of the above red flags (A through F) are present simultaneously, riskLevel MUST be "high" or "critical" — never "medium" or "low."
   - A single pattern from (A) — only-up chart + no socials + low holders — alone warrants at minimum "high."
   - DO NOT give a token "medium" risk if it has an extreme price spike, no community, thin liquidity, and low holders. That combination is "high" at minimum.

YOUR JOB:
Analyze the raw data provided and return a structured JSON response. The frontend will render it. Be factual and observational, but DO NOT be naive. Your users are paying Pro and expect the kind of analysis an experienced Solana trader would give — not a surface-level data dump. Call out red flags aggressively. Use observational language but be direct and honest about what the patterns suggest.

OUTPUT FORMAT (JSON, no markdown wrapping):
{
  "summary": "2-3 sentence plain-English overview of the token. Be direct about red flags — don't bury them. If the chart looks manipulated, say so in the summary.",
  "riskLevel": "low" | "medium" | "high" | "critical" | "unknown",
  "riskLabel": "Short risk label (e.g., 'Low observable risk', 'Multiple manipulation signals', 'Coordinated activity suspected', 'Insufficient data')",
  "keyFindings": [
    "Bullet point observations. 3-6 items.",
    "Lead with the most concerning findings. Don't bury red flags below neutral observations.",
    "Each bullet should reference a specific data point AND explain WHY it matters (e.g., 'Liquidity is only 7% of market cap — a moderate sell would cause significant price impact').",
    "When citing holder concentration, use topHoldersNonLp only. Never call an LP entry a 'top holder'.",
    "If multiple manipulation signals are present, the FIRST bullet should be a combined warning."
  ],
  "holderAnalysis": "2-3 sentences about WALLET concentration using ONLY topHoldersNonLp. Cite the top non-LP wallet percentage. Mention LP/AMM reserves separately (using lpShareTotalPct if present). Cross-reference holder count against market cap — if the ratio is suspicious, say so. Mention insider network flags from RugCheck if present.",
  "bundleAnalysis": "2-3 sentences about bundling. If RugCheck flagged bundled supply or insider networks, mention it. IMPORTANT: If RugCheck shows 0% bundlers but other signals suggest manipulation (only-up chart, no socials, low holders, thin liquidity), DO NOT say 'No bundling detected' as if that's reassuring. Instead note the limitation of automated detection and flag the suspicious patterns.",
  "devWalletAnalysis": "3-4 sentences about the dev/creator wallet. Mention funding source if known, transaction count, age. If the wallet has very few transactions, flag it as potentially a fresh/burner wallet. Never say 'the dev is a scammer' — say 'the dev wallet shows [observable patterns]'.",
  "comparables": "For established meta tokens (dog, cat, frog, political, AI, etc.), mention 1-3 similar tokens and their historical peak MC as factual reference points. For suspicious/manipulated-looking tokens, DO NOT give comparables — instead say: 'No comparables provided — this token exhibits patterns that warrant caution before considering any market context. NFA. DYOR.' For legitimate unique/new tokens: mention it shows potential characteristics worth monitoring.",
  "finalNote": "1-2 sentence final observational note that honestly reflects the overall risk picture. If the token looks dangerous, say so clearly (in observational language). Always end with: 'This is not financial advice. Do your own research.'"
}

REMEMBER: The user is paying for Pro. They expect REAL trader-level analysis, not a polite data summary. If something looks like a coordinated pump, SAY IT (observationally). If the chart screams manipulation, DON'T give it "medium risk" and move on. Be the experienced trader friend who tells it straight — in legally safe, observational language.`;

async function synthesizeWithGPT(rawData, apiKey) {
  // Inject today's date so the model can reason correctly about "recent"
  // launch ages, wallet age vs now, and any other time-sensitive signals.
  const today = new Date().toISOString().split("T")[0];
  const userMessage = `TODAY IS: ${today}. Use this for any "age" or "recency" calculations (e.g. token launch age, dev wallet age).\n\nAnalyze this Solana token based on the following raw data:\n\n${JSON.stringify(rawData, null, 2)}\n\nReturn the structured JSON report as specified.`;

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // gpt-5 — flagship reasoning, best nuance on manipulation signals
        model: "gpt-5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.4,
        max_tokens: 2000,
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
