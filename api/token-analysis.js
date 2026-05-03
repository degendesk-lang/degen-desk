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

// Result cache — when a memecoin pumps, dozens of users analyze the same CA
// in the same few minutes. Cache the synthesized report so we only pay OpenAI
// once per CA per 5 minutes. Keyed by `${chain}:${address}:${tier}` so free
// vs Pro cached responses don't cross-contaminate (different model output).
const resultCache = new Map();
const RESULT_TTL = 5 * 60 * 1000;
function getCachedResult(key) {
  const e = resultCache.get(key);
  if (!e) return null;
  if (Date.now() - e.at > RESULT_TTL) {
    resultCache.delete(key);
    return null;
  }
  return e.value;
}
function setCachedResult(key, value) {
  resultCache.set(key, { at: Date.now(), value });
  // simple LRU-ish prune
  if (resultCache.size > 200) {
    const oldest = [...resultCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) resultCache.delete(oldest[0]);
  }
}

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

// =============================================
// MULTI-CHAIN CONFIG
// =============================================
const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

// chainKey → DexScreener chainId, GoPlus chain id, explorer base, label
const CHAINS = {
  solana: {
    label: "Solana",
    dexId: "solana",
    addrType: "solana",
    explorer: "https://solscan.io/token/",
    goPlusId: null, // GoPlus has Solana but with a different endpoint shape
  },
  ethereum: {
    label: "Ethereum",
    dexId: "ethereum",
    addrType: "evm",
    explorer: "https://etherscan.io/token/",
    goPlusId: "1",
    explorerApi: "https://api.etherscan.io/v2/api",
    explorerChainId: 1,
  },
  base: {
    label: "Base",
    dexId: "base",
    addrType: "evm",
    explorer: "https://basescan.org/token/",
    goPlusId: "8453",
    explorerApi: "https://api.etherscan.io/v2/api",
    explorerChainId: 8453,
  },
  bsc: {
    label: "BNB Chain",
    dexId: "bsc",
    addrType: "evm",
    explorer: "https://bscscan.com/token/",
    goPlusId: "56",
    explorerApi: "https://api.etherscan.io/v2/api",
    explorerChainId: 56,
  },
};

// Detect chain from address shape, with explicit override.
function resolveChain(address, override) {
  if (override && CHAINS[override]) return override;
  if (EVM_ADDR_RE.test(address)) return "ethereum"; // default EVM to mainnet; client can override to base
  if (SOLANA_ADDR_RE.test(address)) return "solana";
  return null;
}

function isValidForChain(address, chainKey) {
  const c = CHAINS[chainKey];
  if (!c) return false;
  if (c.addrType === "evm") return EVM_ADDR_RE.test(address);
  return SOLANA_ADDR_RE.test(address);
}

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
// Works across Solana, Ethereum, Base, and every other chain DexScreener indexes.
async function fetchDexScreener(mint, chainKey) {
  const targetDexId = CHAINS[chainKey]?.dexId;
  if (!targetDexId) return null;
  try {
    const res = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { headers: { "User-Agent": "DegenDesk/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.pairs || data.pairs.length === 0) return null;

    // Pick the pair on the requested chain with the highest liquidity
    const chainPairs = data.pairs.filter((p) => p.chainId === targetDexId);
    if (chainPairs.length === 0) return null;
    chainPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const top = chainPairs[0];

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

// Domain Age via RDAP (free, no auth, works for most TLDs).
// Pulls the registration date for the token's primary website.
function extractPrimaryDomain(websites) {
  if (!Array.isArray(websites) || websites.length === 0) return null;
  for (const w of websites) {
    const url = typeof w === "string" ? w : (w?.url || w?.label || "");
    if (!url) continue;
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      const host = u.hostname.toLowerCase().replace(/^www\./, "");
      // Skip github / x / twitter / t.me / discord / telegram URLs — those are socials, not project sites
      if (/(github\.com|twitter\.com|x\.com|t\.me|telegram\.org|discord\.gg|discord\.com|medium\.com|linktr\.ee)/.test(host)) {
        continue;
      }
      return host;
    } catch (_) {
      continue;
    }
  }
  return null;
}

async function fetchDomainAge(websites) {
  const domain = extractPrimaryDomain(websites);
  if (!domain) return null;
  try {
    const res = await fetchWithTimeout(
      `https://rdap.org/domain/${domain}`,
      { headers: { Accept: "application/rdap+json" } },
      6000
    );
    if (!res.ok) {
      // RDAP often returns 404 for niche TLDs — record gracefully
      return { domain, lookupSucceeded: false, reason: `RDAP ${res.status}` };
    }
    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    const reg = events.find((e) => e.eventAction === "registration");
    const exp = events.find((e) => e.eventAction === "expiration");
    const upd = events.find((e) => e.eventAction === "last changed" || e.eventAction === "last update of RDAP database");
    const registrationDate = reg?.eventDate || null;
    const ageDays = registrationDate
      ? Math.floor((Date.now() - new Date(registrationDate).getTime()) / 86400000)
      : null;
    return {
      domain,
      lookupSucceeded: true,
      registrationDate,
      expirationDate: exp?.eventDate || null,
      lastUpdated: upd?.eventDate || null,
      ageDays,
      registrar:
        Array.isArray(data?.entities)
          ? data.entities.find((e) => Array.isArray(e.roles) && e.roles.includes("registrar"))?.vcardArray?.[1]?.find?.((v) => v[0] === "fn")?.[3] || null
          : null,
    };
  } catch (err) {
    console.error("RDAP fetch failed:", err.message);
    return { domain, lookupSucceeded: false, reason: err.message };
  }
}

// GitHub repo analysis: real project or a hollow shell?
function extractGitHubRepo(websites, socials) {
  const candidates = [];
  for (const w of websites || []) {
    const url = typeof w === "string" ? w : (w?.url || "");
    if (url) candidates.push(url);
  }
  for (const s of socials || []) {
    const url = typeof s === "string" ? s : (s?.url || "");
    if (url) candidates.push(url);
  }
  for (const url of candidates) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      if (u.hostname.toLowerCase().replace(/^www\./, "") === "github.com") {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
        }
      }
    } catch (_) {
      continue;
    }
  }
  return null;
}

async function fetchGitHubAnalysis(websites, socials) {
  const ref = extractGitHubRepo(websites, socials);
  if (!ref) return null;
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "DegenDesk/1.0" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const [repoRes, contribRes, commitsRes] = await Promise.all([
      fetchWithTimeout(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, { headers }, 6000),
      fetchWithTimeout(`https://api.github.com/repos/${ref.owner}/${ref.repo}/contributors?per_page=10&anon=1`, { headers }, 6000),
      fetchWithTimeout(`https://api.github.com/repos/${ref.owner}/${ref.repo}/commits?per_page=20`, { headers }, 6000),
    ]);
    if (!repoRes.ok) {
      return {
        owner: ref.owner,
        repo: ref.repo,
        lookupSucceeded: false,
        reason: `GitHub ${repoRes.status}${repoRes.status === 404 ? " (repo missing or private)" : ""}`,
      };
    }
    const repo = await repoRes.json();
    const contributors = contribRes.ok ? await contribRes.json() : [];
    const commits = commitsRes.ok ? await commitsRes.json() : [];
    const created = repo.created_at;
    const pushed = repo.pushed_at;
    const ageDays = created ? Math.floor((Date.now() - new Date(created).getTime()) / 86400000) : null;
    const daysSinceLastPush = pushed ? Math.floor((Date.now() - new Date(pushed).getTime()) / 86400000) : null;
    return {
      owner: ref.owner,
      repo: ref.repo,
      url: repo.html_url,
      lookupSucceeded: true,
      description: repo.description || null,
      createdAt: created,
      lastPushedAt: pushed,
      ageDays,
      daysSinceLastPush,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      watchers: repo.subscribers_count ?? 0,
      openIssues: repo.open_issues_count ?? 0,
      archived: !!repo.archived,
      disabled: !!repo.disabled,
      isFork: !!repo.fork,
      language: repo.language || null,
      license: repo.license?.spdx_id || null,
      contributorCount: Array.isArray(contributors) ? contributors.length : 0,
      topContributors: Array.isArray(contributors)
        ? contributors.slice(0, 5).map((c) => ({ login: c.login || null, contributions: c.contributions || 0 }))
        : [],
      recentCommitCount: Array.isArray(commits) ? commits.length : 0,
      recentCommitMessages: Array.isArray(commits)
        ? commits.slice(0, 5).map((c) => c.commit?.message?.split("\n")[0]?.slice(0, 120) || null).filter(Boolean)
        : [],
    };
  } catch (err) {
    console.error("GitHub fetch failed:", err.message);
    return { owner: ref.owner, repo: ref.repo, lookupSucceeded: false, reason: err.message };
  }
}

// GoPlus Security — EVM equivalent of RugCheck.
// Free, no auth. Covers honeypot detection, buy/sell tax, ownership renouncement,
// LP locked %, hidden owner, blacklist functions, holder concentration.
async function fetchGoPlus(mint, chainKey) {
  const c = CHAINS[chainKey];
  if (!c?.goPlusId) return null;
  try {
    const res = await fetchWithTimeout(
      `https://api.gopluslabs.io/api/v1/token_security/${c.goPlusId}?contract_addresses=${mint}`,
      { headers: { Accept: "application/json", "User-Agent": "DegenDesk/1.0" } },
      8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.result?.[mint.toLowerCase()] || data?.result?.[mint] || null;
    if (!result) return null;

    // Normalize the dozens of "1" / "0" / null fields into something the AI can reason on.
    const flag = (v) => (v === "1" ? true : v === "0" ? false : null);
    const num = (v) => (v == null || v === "" ? null : parseFloat(v));

    const holders = Array.isArray(result.holders)
      ? result.holders.slice(0, 10).map((h) => ({
          address: h.address || null,
          tag: h.tag || null,
          balance: num(h.balance),
          percent: num(h.percent) != null ? parseFloat(h.percent) * 100 : null,
          isLocked: flag(h.is_locked),
          isContract: flag(h.is_contract),
        }))
      : [];

    const lpHolders = Array.isArray(result.lp_holders)
      ? result.lp_holders.slice(0, 5).map((h) => ({
          address: h.address || null,
          tag: h.tag || null,
          percent: num(h.percent) != null ? parseFloat(h.percent) * 100 : null,
          isLocked: flag(h.is_locked),
        }))
      : [];

    return {
      tokenName: result.token_name || null,
      tokenSymbol: result.token_symbol || null,
      totalSupply: num(result.total_supply),
      holderCount: result.holder_count ? parseInt(result.holder_count, 10) : null,

      // Honeypot signals (the most important EVM red flag)
      isHoneypot: flag(result.is_honeypot),
      cannotBuy: flag(result.cannot_buy),
      cannotSellAll: flag(result.cannot_sell_all),
      transferPausable: flag(result.transfer_pausable),
      tradingCooldown: flag(result.trading_cooldown),

      // Tax — anything over a few percent on either side hurts
      buyTax: num(result.buy_tax) != null ? parseFloat(result.buy_tax) * 100 : null,
      sellTax: num(result.sell_tax) != null ? parseFloat(result.sell_tax) * 100 : null,

      // Ownership / control
      ownerAddress: result.owner_address || null,
      ownerChangeBalance: flag(result.owner_change_balance),
      hiddenOwner: flag(result.hidden_owner),
      canTakeBackOwnership: flag(result.can_take_back_ownership),
      selfdestruct: flag(result.selfdestruct),

      // Liquidity
      lpTotalSupply: num(result.lp_total_supply),
      lpHolderCount: result.lp_holder_count ? parseInt(result.lp_holder_count, 10) : null,

      // Mint authority equivalent on EVM
      isMintable: flag(result.is_mintable),
      isProxy: flag(result.is_proxy),
      isOpenSource: flag(result.is_open_source),

      // Anti-whale / fee modifiability
      slippageModifiable: flag(result.slippage_modifiable),
      personalSlippageModifiable: flag(result.personal_slippage_modifiable),
      isAntiWhale: flag(result.is_anti_whale),
      antiWhaleModifiable: flag(result.anti_whale_modifiable),

      // Lists
      isInDex: flag(result.is_in_dex),
      isAirdropScam: flag(result.is_airdrop_scam),
      trustList: flag(result.trust_list),

      // Top wallet + LP holders
      topHolders: holders,
      lpHolders,

      // Creator / deployer (we'll use this as the "creator" for downstream code)
      creatorAddress: result.creator_address || null,
      creatorBalance: num(result.creator_balance),
      creatorPercent: num(result.creator_percent) != null ? parseFloat(result.creator_percent) * 100 : null,
    };
  } catch (err) {
    console.error("GoPlus fetch failed:", err.message);
    return null;
  }
}

// Etherscan v2 unified API — works across Ethereum, Base, BNB, and other EVM chains
// with a single API key. Used to trace the deployer/creator wallet's funding history.
async function fetchEvmDevTrace(creatorAddress, chainKey) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const c = CHAINS[chainKey];
  if (!apiKey || !c?.explorerChainId || !creatorAddress) return null;
  try {
    // Recent normal transactions for the creator address, oldest first.
    const url = `${c.explorerApi}?chainid=${c.explorerChainId}&module=account&action=txlist&address=${creatorAddress}&startblock=0&endblock=99999999&page=1&offset=25&sort=asc&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.result)) return null;
    const txs = data.result;

    // Find the first incoming transfer that funded the wallet
    let fundingSource = null;
    let fundingTx = null;
    for (const tx of txs) {
      if (tx.to && tx.to.toLowerCase() === creatorAddress.toLowerCase() && parseFloat(tx.value) > 0) {
        fundingSource = tx.from || null;
        fundingTx = tx.hash || null;
        break;
      }
    }

    const oldestTs = txs.length > 0 ? parseInt(txs[0].timeStamp, 10) * 1000 : null;
    return {
      address: creatorAddress,
      fundingSource,
      fundingTx,
      recentTxCount: txs.length,
      oldestSeenTimestamp: oldestTs,
    };
  } catch (err) {
    console.error("Etherscan v2 trace failed:", err.message);
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

const SYSTEM_PROMPT = `You are the Token Analysis engine for Degen Desk — a Pro-tier tool that analyzes tokens across Solana, Ethereum, Base, and BNB Chain (BSC) using on-chain data. The chain is provided in the data as the "chain" field. Adapt your analysis: Solana data comes from RugCheck/pump.fun/Helius; EVM data (ethereum, base, bsc) comes from GoPlus Security and Etherscan v2. Some signals only apply to one chain — never invent data that wasn't provided.

CRITICAL LEGAL RULES (NEVER BREAK THESE):
1. NEVER predict prices. Never say "this will go to $X" or "this will pump" or "buy this."
2. NEVER give direct financial advice. Never say "invest" or "sell now" or "this is a good buy."
3. NEVER promise safety. Never say "this is safe" or "this is a rug." Use language like "shows characteristics consistent with..." or "observed patterns suggest caution."
4. ALWAYS frame comparisons as historical observations: "similar tokens in this category have historically reached $X MC" — never as predictions.
5. For unique/new tokens with no clear comparables, use cautious language: "shows potential characteristics worth monitoring" — never "will moon" or any variation.
6. Every section must implicitly or explicitly remind the user this is NFA/DYOR.
7. If data is missing or incomplete, say so clearly — don't speculate to fill gaps.

CRITICAL HOLDER RULES (NEVER BREAK THESE):
8. SOLANA: rugCheckFull.topHolders array may include liquidity pool (LP / AMM) accounts. Each entry has an isLiquidityPool boolean. Use rugCheckFull.topHoldersNonLp — the LP-filtered list — when discussing wallet concentration. Never call an LP entry a "top holder."
9. EVM: goPlus.topHolders is the wallet list, goPlus.lpHolders is separate. Use goPlus.topHolders for wallet concentration. The "percent" field is already a percentage (e.g. 2.2 means 2.2%).
10. If ALL top holders look like LPs/contracts (isContract=true and tag suggests pool/router), say "Top wallet holders are below the reporting threshold — supply appears distributed across many small wallets."
11. Report LP share SEPARATELY from wallet concentration. Phrase LP as "liquidity pool reserves" or "AMM-held supply." Example: "The top non-LP wallet holds 2.2% of supply. Liquidity pool reserves account for ~22% of supply, which is normal for tradeable tokens."
12. Always use the percent value directly from the data — never multiply or transform it.

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

G) DOMAIN AGE SIGNALS (from domainAge):
   - If a project website was registered very recently (<14 days) but the token claims to be an "established" project or has high MC (>$500K), this is a major red flag — likely a fresh domain spun up to look legitimate.
   - If domain age is 1-3 days old, treat it as critical: "The project's domain was registered [N] days ago, suggesting the entire web presence was created immediately around the token launch."
   - If domain age is 30+ days, that's a mild positive signal (not a guarantee, but better than a 2-day-old site).
   - If domainAge is null, the project has no website — already covered by signal (D).
   - If lookupSucceeded is false, do not speculate — say "Domain registration history could not be retrieved for this TLD."

H) GITHUB SIGNALS (from githubAnalysis):
   - If the token links a GitHub repo, scrutinize it. A real project repo will have: multiple contributors (>1), more than ~20 recent commits, stars proportional to claimed user base, descriptive commit messages, age >30 days, recent activity (lastPushedAt within 30 days).
   - RED FLAGS to call out aggressively:
     * archived: true OR disabled: true → repo is dead, project abandoned
     * createdAt very recent (<14 days) when token claims established protocol → "shell repo" created to look legitimate
     * recentCommitCount very low (<5) with no description → empty or placeholder repo
     * isFork: true with no original commits → forked someone else's code, no original work
     * contributorCount === 1 AND stars === 0 AND commits are generic ("init", "first commit") → solo dev with no traction or signal of legitimacy
     * daysSinceLastPush > 90 → project inactive, dev abandoned
   - POSITIVE signals: 5+ contributors, 100+ stars, regular commits over 6+ months, descriptive commit messages, proper license.
   - If lookupSucceeded is false (e.g. 404), the GitHub link is broken/private — flag it: "The project's linked GitHub repository could not be accessed (private or removed). Public-facing projects typically maintain a publicly visible repo."

I) EVM-SPECIFIC SIGNALS (when chain is "ethereum", "base", or "bsc", from goPlus):
   - BSC NOTE: BNB Chain has historically had the highest concentration of honeypots and high-tax scam tokens of any EVM chain. Be especially aggressive about flagging BSC tokens with isHoneypot, high taxes, hidden owner, mintable, or unlocked LP. The base rate of scams is much higher than ETH/Base — calibrate your skepticism accordingly.
   - HONEYPOT: If isHoneypot is true, OR cannotSellAll is true, OR cannotBuy is true → riskLevel MUST be "critical." This is a hard rug — users cannot sell. State plainly: "This contract is flagged as a honeypot — buyers cannot sell. Avoid."
   - HIGH TAX: buyTax or sellTax > 10% is a major red flag. > 25% is effectively a rug (you lose a quarter of your trade to the team). Flag explicitly with the percentages.
   - OWNERSHIP: If hiddenOwner is true OR canTakeBackOwnership is true OR ownerChangeBalance is true → flag aggressively. The deployer can pause trading, blacklist your address, or modify your balance. Combine with low ownerAddress activity for severity.
   - MINTABLE: isMintable=true means the deployer can print new tokens at will, diluting holders. Flag.
   - PROXY / NOT OPEN SOURCE: isProxy=true OR isOpenSource=false means the contract logic can change or hasn't been verified. State: "This contract is [a proxy / not source-verified] — its logic [can be changed by the owner / cannot be independently audited]."
   - LP NOT LOCKED: lpHolders mostly with isLocked=false → liquidity can be pulled at any moment. "Liquidity is unlocked. The deployer can remove the pool and take buyers' funds."
   - SLIPPAGE MODIFIABLE: slippageModifiable=true means tax can be raised after launch — common bait-and-switch.
   - CREATOR HOLDS LARGE % (creatorPercent > 5) — flag clearly.
   - AIRDROP SCAM: isAirdropScam=true → state plainly that this contract has been flagged as an airdrop scam pattern.
   - When in doubt on EVM, defer to GoPlus over your own intuition — it has the deepest contract introspection.

J) RISK LEVEL ESCALATION RULES:
   - If 3+ of the above red flags (A through I) are present simultaneously, riskLevel MUST be "high" or "critical" — never "medium" or "low."
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
  "holderAnalysis": "2-3 sentences about WALLET concentration. SOLANA: use rugCheckFull.topHoldersNonLp and report LP share separately via lpShareTotalPct. EVM: use goPlus.topHolders for wallets, goPlus.lpHolders for LP, mention goPlus.holderCount. Cross-reference holder count against market cap — if the ratio is suspicious, say so. Mention insider network flags or contract holders if present.",
  "bundleAnalysis": "2-3 sentences. SOLANA: about bundling — use rugCheckSummary.risks and insiderNetworks. EVM: bundle detection isn't applicable the same way; instead summarize creator percent + ownership controls (hiddenOwner, canTakeBackOwnership, mintable). IMPORTANT: If automated detection shows clean but other signals suggest manipulation, note the limitation and flag the patterns.",
  "devWalletAnalysis": "3-4 sentences about the dev/creator wallet. SOLANA: from devWalletTrace (funding source, recent tx count). EVM: from devWalletTrace (Etherscan v2) plus goPlus.creatorAddress / creatorPercent / ownerAddress. If the wallet has very few transactions, flag it as potentially a fresh/burner wallet. Never say 'the dev is a scammer' — say 'the dev wallet shows [observable patterns]'.",
  "contractAnalysis": "EVM ONLY. 3-4 sentences. ONLY include this field when chain is 'ethereum' or 'base' AND goPlus data is present. State honeypot status, buy/sell tax %, ownership controls (renounced / hidden / mintable / pausable / proxy), source verification, LP lock status. Lead with the most dangerous flag. If chain is solana OR no goPlus data, OMIT this field entirely.",
  "domainAnalysis": "1-2 sentences. ONLY include this field if domainAge data is present. State the domain, its age in days/months (translate ageDays — e.g. 4 days = 'registered 4 days ago', 540 days = 'registered ~1.5 years ago'), and what that age implies in context with the token's MC and apparent maturity. If lookupSucceeded is false, say 'Domain registration history could not be retrieved.' If no domainAge data, OMIT this field entirely.",
  "githubAnalysis": "2-3 sentences. ONLY include this field if githubAnalysis data is present. Cite the repo (owner/repo), age, contributor count, recent activity, stars. Be direct: if the repo looks like a shell (1 contributor, 0 stars, generic commits, archived, or freshly created) call it out. If the repo looks legitimate (multiple contributors, regular commits, real description), say so observationally. If lookupSucceeded is false, note that the linked repo is inaccessible. If no githubAnalysis data, OMIT this field entirely.",
  "comparables": "For established meta tokens (dog, cat, frog, political, AI, etc.), mention 1-3 similar tokens and their historical peak MC as factual reference points. For suspicious/manipulated-looking tokens, DO NOT give comparables — instead say: 'No comparables provided — this token exhibits patterns that warrant caution before considering any market context. NFA. DYOR.' For legitimate unique/new tokens: mention it shows potential characteristics worth monitoring.",
  "finalNote": "1-2 sentence final observational note that honestly reflects the overall risk picture. If the token looks dangerous, say so clearly (in observational language). Always end with: 'This is not financial advice. Do your own research.'"
}

REMEMBER: The user is paying for Pro. They expect REAL trader-level analysis, not a polite data summary. If something looks like a coordinated pump, SAY IT (observationally). If the chart screams manipulation, DON'T give it "medium risk" and move on. Be the experienced trader friend who tells it straight — in legally safe, observational language.`;

async function synthesizeWithGPT(rawData, apiKey, tier) {
  // Inject today's date so the model can reason correctly about "recent"
  // launch ages, wallet age vs now, and any other time-sensitive signals.
  const today = new Date().toISOString().split("T")[0];
  const userMessage = `TODAY IS: ${today}. Use this for any "age" or "recency" calculations (e.g. token launch age, dev wallet age).\n\nAnalyze this Solana token based on the following raw data:\n\n${JSON.stringify(rawData, null, 2)}\n\nReturn the structured JSON report as specified.`;

  // Pro: gpt-4.1 — flagship reasoning, sharper manipulation/synthesis nuance.
  // Free: gpt-4.1-mini — same prompt, ~6× cheaper. Still produces a useful
  //   structured report; the upgrade story is "Pro gets the trader-grade analysis."
  const model = tier === "pro" ? "gpt-4.1" : "gpt-4.1-mini";

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
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

  const { contractAddress, uid, chain: requestedChain } = req.body || {};

  // Basic validation
  if (!contractAddress || typeof contractAddress !== "string") {
    return res.status(400).json({ error: "Contract address is required." });
  }
  const mint = contractAddress.trim();
  const chainKey = resolveChain(mint, requestedChain);
  if (!chainKey) {
    return res
      .status(400)
      .json({ error: "That doesn't look like a valid Solana, Ethereum, or Base contract address." });
  }
  if (!isValidForChain(mint, chainKey)) {
    return res
      .status(400)
      .json({ error: `That address format doesn't match ${CHAINS[chainKey].label}.` });
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
  // TIER + DAILY CAP
  // Free signed-in users get 5/day, Pro gets 25/day.
  // Anonymous (no uid) is rejected earlier — OpenAI calls cost real money,
  // and an unauthenticated free path opens a trivial abuse vector.
  // =========================================
  const FREE_DAILY_CAP = 10;
  const PRO_DAILY_CAP = 50;
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

  const DAILY_CAP = tier === "pro" ? PRO_DAILY_CAP : FREE_DAILY_CAP;
  const today = new Date().toISOString().split("T")[0];
  const storedDate = userData?.tokenAnalysesUsedDate;
  const currentCount = storedDate === today ? userData?.tokenAnalysesUsedToday || 0 : 0;

  if (currentCount >= DAILY_CAP) {
    return res.status(429).json({
      error:
        tier === "pro"
          ? `You've used your ${PRO_DAILY_CAP} daily token analyses. Try again tomorrow.`
          : `Daily limit reached (${FREE_DAILY_CAP}/day). Upgrade to Pro for ${PRO_DAILY_CAP}/day.`,
      dailyLimit: true,
      tier,
      cap: DAILY_CAP,
      used: currentCount,
      upgrade: tier !== "pro",
    });
  }

  // =========================================
  // RESULT CACHE — when many users analyze the same CA in a short window
  // (very common during memecoin pumps), serve the same synthesized report
  // instead of paying OpenAI for each. Still counts against the user's
  // daily cap and updates the counter so the user-visible limit is honest.
  // =========================================
  const cacheKey = `${chainKey}:${mint}:${tier}`;
  const cached = getCachedResult(cacheKey);
  if (cached) {
    try {
      await userRef.set(
        {
          tokenAnalysesUsedDate: today,
          tokenAnalysesUsedToday: currentCount + 1,
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to increment analysis counter (cached):", err.message);
    }
    return res.status(200).json({
      ...cached,
      analysesUsedToday: currentCount + 1,
      analysesDailyCap: DAILY_CAP,
      cached: true,
      generatedAt: cached.generatedAt,
    });
  }

  // =========================================
  // FETCH DATA SOURCES (chain-aware, in parallel)
  // =========================================
  const isSolana = chainKey === "solana";

  const [dex, rugSummary, rugFull, pumpfun, goPlus] = await Promise.all([
    fetchDexScreener(mint, chainKey),
    isSolana ? fetchRugCheck(mint) : Promise.resolve(null),
    isSolana ? fetchRugCheckFull(mint) : Promise.resolve(null),
    isSolana ? fetchPumpFun(mint) : Promise.resolve(null),
    isSolana ? Promise.resolve(null) : fetchGoPlus(mint, chainKey),
  ]);

  // Derive the creator/dev wallet from whichever source has it
  const creatorAddress =
    rugFull?.creator || pumpfun?.creator || goPlus?.creatorAddress || null;

  // Dev wallet funding trace + domain age + GitHub analysis (parallel)
  const [devTrace, domain, github] = await Promise.all([
    creatorAddress
      ? isSolana
        ? fetchHeliusDevTrace(creatorAddress)
        : fetchEvmDevTrace(creatorAddress, chainKey)
      : Promise.resolve(null),
    fetchDomainAge(dex?.websites),
    fetchGitHubAnalysis(dex?.websites, dex?.socials),
  ]);

  // If everything came back empty, bail early.
  if (!dex && !rugSummary && !rugFull && !pumpfun && !goPlus) {
    return res.status(404).json({
      error: `Couldn't find any data for that ${CHAINS[chainKey].label} token. Double-check the contract address is correct and the token has at least one trading pair.`,
    });
  }

  // =========================================
  // BUILD RAW DATA PACKAGE FOR GPT
  // =========================================
  const rawData = {
    chain: chainKey,
    chainLabel: CHAINS[chainKey].label,
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
    goPlus,
    devWalletTrace: devTrace,
    domainAge: domain,
    githubAnalysis: github,
  };

  // =========================================
  // GPT-4o SYNTHESIS
  // =========================================
  let report;
  try {
    report = await synthesizeWithGPT(rawData, apiKey, tier);
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
    : goPlus
    ? {
        name: goPlus.tokenName,
        symbol: goPlus.tokenSymbol,
      }
    : { name: null, symbol: null };

  const responseBody = {
    chain: chainKey,
    chainLabel: CHAINS[chainKey].label,
    explorerUrl: `${CHAINS[chainKey].explorer}${mint}`,
    contractAddress: mint,
    metrics,
    report,
    sources: {
      dexScreener: !!dex,
      rugCheck: !!(rugSummary || rugFull),
      pumpFun: !!pumpfun,
      goPlus: !!goPlus,
      helius: isSolana && !!devTrace,
      etherscan: !isSolana && !!devTrace,
      domainAge: !!domain,
      github: !!github,
    },
    generatedAt: new Date().toISOString(),
  };
  setCachedResult(cacheKey, responseBody);

  return res.status(200).json({
    ...responseBody,
    analysesUsedToday: currentCount + 1,
    analysesDailyCap: DAILY_CAP,
    cached: false,
  });
};
