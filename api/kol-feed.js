/**
 * KOL Alpha Feed
 *
 * Cross-references the kolscan top-trader leaderboard with each KOL's recent
 * X posts (via Nitter RSS) to surface "alpha from ranked smart money."
 *
 * Differentiation vs. plain X trackers:
 *   - Posts are filtered to ONLY top-ranked KOLs by PnL (kolscan)
 *   - Posts are weighted by KOL rank + recency (top earners surface first)
 *   - Solana + EVM contract addresses are auto-extracted and tagged
 *   - "Consensus" signal: when 3+ ranked KOLs mention the same CA in 6h
 *   - Each KOL row links to the wallet analyzer
 *
 * Cost: $0. Uses kolscan scrape + free Nitter RSS. Fragile (Nitter
 * instances die regularly) — surface as Beta in the UI.
 */

const { scrapeLeaderboard } = require("./kolscan.js");

// =============================================
// CONFIG
// =============================================
const NITTER_HOSTS = [
  // Try multiple Nitter instances in order — if one is down, fall through.
  "https://nitter.net",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
];
const TOP_N_KOLS = 12; // cap to keep within Vercel 10s function timeout
const POST_LOOKBACK_HOURS = 24;
const CONSENSUS_WINDOW_HOURS = 6;
const CONSENSUS_MIN_KOLS = 3;
const RSS_TIMEOUT_MS = 5000;

// =============================================
// CACHE
// =============================================
let feedCache = null;
let feedCacheAt = 0;
const FEED_TTL_MS = 5 * 60 * 1000;

// =============================================
// REGEX
// =============================================
// Solana base58 32-44 chars — overmatches some text, but Token Analysis API
// will reject invalid addresses on click-through.
const SOLANA_CA_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const EVM_CA_RE = /\b0x[a-fA-F0-9]{40}\b/g;
// $TICKER: 2-10 uppercase chars, leading dollar sign
const TICKER_RE = /\$[A-Z][A-Z0-9]{1,9}\b/g;

function fetchWithTimeout(url, ms = RSS_TIMEOUT_MS) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, {
    signal: c.signal,
    headers: { "User-Agent": "Mozilla/5.0 DegenDeskFeed/1.0" },
  }).finally(() => clearTimeout(t));
}

// Kolscan stores Twitter as a full URL ("https://x.com/Cented7"), but
// we sometimes get plain handles or @-prefixed handles too. Normalize
// to bare username, return null if it doesn't look like a valid handle.
function normalizeHandle(twitter) {
  if (!twitter) return null;
  let s = String(twitter).trim();
  s = s.replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "");
  s = s.replace(/^@/, "");
  s = s.split(/[?#/]/)[0];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(s)) return null;
  return s;
}

// Try Nitter hosts in order until one returns RSS.
async function fetchKolPosts(handle) {
  const username = normalizeHandle(handle);
  if (!username) return [];
  for (const host of NITTER_HOSTS) {
    try {
      const res = await fetchWithTimeout(`${host}/${username}/rss`, RSS_TIMEOUT_MS);
      if (!res.ok) continue;
      const xml = await res.text();
      return parseRss(xml, username);
    } catch (err) {
      // try next host
    }
  }
  return [];
}

function parseRss(xml, username) {
  // Lightweight, dependency-free RSS parsing — extract <item> blocks and
  // pull title, link, pubDate, description.
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = pick(block, /<title>([\s\S]*?)<\/title>/);
    const link = pick(block, /<link>([\s\S]*?)<\/link>/);
    const pubDate = pick(block, /<pubDate>([\s\S]*?)<\/pubDate>/);
    const desc = pick(block, /<description>([\s\S]*?)<\/description>/);
    const ts = pubDate ? Date.parse(pubDate) : 0;
    if (!ts) continue;
    // Reject posts older than our lookback
    if (Date.now() - ts > POST_LOOKBACK_HOURS * 60 * 60 * 1000) continue;
    // Strip CDATA, decode entities, strip HTML
    const text = decodeAndStrip(`${title || ""}\n${desc || ""}`);
    items.push({
      handle: username,
      text,
      url: rewriteToX(link, username),
      ts,
    });
  }
  return items;
}

function pick(s, re) {
  const m = s.match(re);
  if (!m) return "";
  return stripCdata(m[1]).trim();
}

function stripCdata(s) {
  return s.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeAndStrip(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rewriteToX(nitterUrl, fallbackUser) {
  if (!nitterUrl) return `https://x.com/${fallbackUser}`;
  return nitterUrl
    .replace(/^https?:\/\/[^/]+/, "https://x.com")
    .replace("#m", "");
}

function extractMentions(text) {
  if (!text) return { solana: [], evm: [], tickers: [] };
  const solana = [...new Set((text.match(SOLANA_CA_RE) || []))].filter(
    (a) => a.length >= 32 && a.length <= 44
  );
  const evm = [...new Set(text.match(EVM_CA_RE) || [])];
  const tickers = [...new Set(text.match(TICKER_RE) || [])];
  return { solana, evm, tickers };
}

// =============================================
// CONSENSUS
// =============================================
function buildConsensus(posts) {
  const cutoff = Date.now() - CONSENSUS_WINDOW_HOURS * 60 * 60 * 1000;
  const counts = new Map(); // ca -> Set of handles
  for (const p of posts) {
    if (p.ts < cutoff) continue;
    for (const ca of p.mentions.solana) {
      if (!counts.has(ca)) counts.set(ca, new Set());
      counts.get(ca).add(p.handle);
    }
    for (const ca of p.mentions.evm) {
      const key = `evm:${ca}`;
      if (!counts.has(key)) counts.set(key, new Set());
      counts.get(key).add(p.handle);
    }
  }
  const consensus = [];
  for (const [key, handles] of counts) {
    if (handles.size >= CONSENSUS_MIN_KOLS) {
      const isEvm = key.startsWith("evm:");
      consensus.push({
        chain: isEvm ? "evm" : "solana",
        address: isEvm ? key.slice(4) : key,
        kolCount: handles.size,
        kols: [...handles],
      });
    }
  }
  consensus.sort((a, b) => b.kolCount - a.kolCount);
  return consensus;
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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  // Cache first
  const now = Date.now();
  if (feedCache && now - feedCacheAt < FEED_TTL_MS) {
    return res.status(200).json({ ...feedCache, cached: true });
  }

  try {
    // 1. Fetch top KOLs from kolscan (weekly = broadest signal-to-noise)
    const traders = await scrapeLeaderboard("weekly");
    const kols = (traders || [])
      .map((t) => {
        const handle = normalizeHandle(t.twitter);
        if (!handle || !t.wallet) return null;
        return {
          rank: t.rank,
          name: t.name,
          wallet: t.wallet,
          twitter: handle,
          pnlSol: t.pnl_sol ? Number(t.pnl_sol) : null,
          pnlUsd: t.pnl_usd ? Number(t.pnl_usd) : null,
          winRate: t.win_rate || null,
        };
      })
      .filter(Boolean)
      .slice(0, TOP_N_KOLS);

    // 2. Fetch X posts for each KOL in parallel
    const postArrays = await Promise.all(
      kols.map(async (k) => {
        const posts = await fetchKolPosts(k.twitter);
        return posts.map((p) => ({
          ...p,
          rank: k.rank,
          name: k.name,
          wallet: k.wallet,
          pnlSol: k.pnlSol,
          pnlUsd: k.pnlUsd,
          winRate: k.winRate,
        }));
      })
    );
    const allPosts = postArrays.flat();

    // 3. Annotate posts with extracted CAs / tickers
    for (const p of allPosts) {
      p.mentions = extractMentions(p.text);
    }

    // 4. Sort by recency, but boost top-ranked KOLs:
    //    score = recency_factor + rank_bonus
    //    A post 1h old from rank 1 should beat a post 12h old from rank 10.
    const NOW = Date.now();
    for (const p of allPosts) {
      const ageHours = (NOW - p.ts) / (60 * 60 * 1000);
      const recencyFactor = Math.max(0, 24 - ageHours); // 0..24
      const rankBonus = Math.max(0, 25 - (p.rank || 25)); // 0..25
      p.score = recencyFactor + rankBonus * 0.5;
    }
    allPosts.sort((a, b) => b.score - a.score);

    // 5. Compute consensus
    const consensus = buildConsensus(allPosts);

    // 6. Build response
    const responseBody = {
      posts: allPosts.slice(0, 60).map((p) => ({
        handle: p.handle,
        name: p.name,
        rank: p.rank,
        wallet: p.wallet,
        pnlSol: p.pnlSol,
        pnlUsd: p.pnlUsd,
        winRate: p.winRate,
        text: p.text,
        url: p.url,
        ts: p.ts,
        mentions: p.mentions,
      })),
      consensus,
      kolsFollowed: kols.length,
      kolsWithPosts: new Set(allPosts.map((p) => p.handle)).size,
      lookbackHours: POST_LOOKBACK_HOURS,
      consensusWindowHours: CONSENSUS_WINDOW_HOURS,
      generatedAt: new Date().toISOString(),
    };

    feedCache = responseBody;
    feedCacheAt = now;

    return res.status(200).json({ ...responseBody, cached: false });
  } catch (err) {
    console.error("KOL feed error:", err.message);
    return res.status(502).json({
      error: "Couldn't build the KOL feed right now. Try again in a moment.",
    });
  }
};
