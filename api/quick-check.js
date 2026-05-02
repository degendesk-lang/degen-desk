/**
 * Quick Check Endpoint
 *
 * Lightweight token preview powered by DexScreener only.
 * Returns: name, symbol, MC, price, liquidity, 24h change, chain, pair URL.
 *
 * Designed for the browser extension hover popover and any other UI that
 * needs sub-second token metrics without the heavy AI synthesis.
 *
 * - No auth required (free for everyone — extension users see this without signing in)
 * - No daily limit
 * - Per-IP rate limit only (180 req/min — generous, since extension may fire many on a page)
 * - Auto-detects chain from address shape, with optional `chain` override
 *
 * The extension uses this to populate the hover card. "Open full report" links
 * to degendesk.xyz/token-analysis.html?ca=... for the Pro-gated deep analysis.
 */

const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const DEX_CHAINS = {
  solana: { label: "Solana", explorer: "https://solscan.io/token/" },
  ethereum: { label: "Ethereum", explorer: "https://etherscan.io/token/" },
  base: { label: "Base", explorer: "https://basescan.org/token/" },
  bsc: { label: "BNB Chain", explorer: "https://bscscan.com/token/" },
};

// Per-IP rate limit (process-local — runs per Vercel lambda instance, which is fine).
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 180;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > MAX_PER_WINDOW;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > WINDOW_MS * 2) rateLimitMap.delete(ip);
  }
}, 5 * 60 * 1000);

function detectChain(addr) {
  if (EVM_ADDR_RE.test(addr)) return "evm";
  if (SOLANA_ADDR_RE.test(addr)) return "solana";
  return null;
}

async function fetchWithTimeout(url, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "DegenDesk/1.0" },
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  // CORS — allow the website + extension origins (chrome-extension://* doesn't echo Origin reliably)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Rate limit. Slow down." });
  }

  const { ca, chain: chainHint } = req.query || {};
  if (!ca || typeof ca !== "string") {
    return res.status(400).json({ error: "Missing ca query param." });
  }
  const addr = ca.trim();
  const detected = detectChain(addr);
  if (!detected) {
    return res.status(400).json({ error: "Address doesn't match Solana or EVM format." });
  }

  try {
    const r = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/tokens/${addr}`
    );
    if (!r.ok) {
      return res.status(502).json({ error: `DexScreener ${r.status}` });
    }
    const data = await r.json();
    if (!data?.pairs || data.pairs.length === 0) {
      return res.status(404).json({ error: "No trading pairs found for this address.", address: addr });
    }

    // Pick the best pair, optionally constrained to a hinted chain
    let pairs = data.pairs;
    if (chainHint && DEX_CHAINS[chainHint]) {
      const filtered = pairs.filter((p) => p.chainId === chainHint);
      if (filtered.length > 0) pairs = filtered;
    } else if (detected === "solana") {
      pairs = pairs.filter((p) => p.chainId === "solana") || pairs;
    }
    pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const top = pairs[0];
    const chainKey = top.chainId in DEX_CHAINS ? top.chainId : null;
    const chainMeta = chainKey ? DEX_CHAINS[chainKey] : null;

    return res.status(200).json({
      address: addr,
      chain: chainKey,
      chainLabel: chainMeta?.label || null,
      name: top.baseToken?.name || null,
      symbol: top.baseToken?.symbol || null,
      priceUsd: top.priceUsd ? parseFloat(top.priceUsd) : null,
      marketCap: top.marketCap || top.fdv || null,
      fdv: top.fdv || null,
      liquidityUsd: top.liquidity?.usd || null,
      volume24h: top.volume?.h24 || null,
      priceChange24h: top.priceChange?.h24 ?? null,
      priceChange1h: top.priceChange?.h1 ?? null,
      pairCreatedAt: top.pairCreatedAt || null,
      dexId: top.dexId || null,
      pairUrl: top.url || null,
      imageUrl: top.info?.imageUrl || null,
      explorerUrl: chainMeta ? `${chainMeta.explorer}${addr}` : null,
      reportUrl: `https://degendesk.xyz/token-analysis.html?ca=${encodeURIComponent(addr)}${chainKey ? `&chain=${chainKey}` : ""}`,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("quick-check error:", err.message);
    return res.status(500).json({ error: "Lookup failed." });
  }
};
