/**
 * Smart Money Tracker (v1)
 *
 * Returns the top kolscan KOLs in a normalized shape, ready to render with:
 *   - Direct link to Degen Desk Wallet Analyzer (instant view of holdings/PnL)
 *   - Direct link to the KOL's X profile
 *
 * The original plan included a live X feed via Nitter RSS, but Nitter
 * instances either block Vercel egress IPs (TypeError) or 403 from
 * Cloudflare. The cleanest fix is a separate cron-based collector that
 * writes posts to Firestore — queued for v1.1 along with Fomo + GMGN
 * sources.
 *
 * For v1, the kolscan-driven leaderboard + cross-tool integration is the
 * shipping differentiator vs. plain X trackers (Axiom, Photon, Bullx) —
 * because they don't have the Wallet Analyzer or Token Analysis to send
 * traffic into.
 */

const { scrapeLeaderboard } = require("./kolscan.js");

// Strip URL/@-prefix from kolscan twitter values, return null if invalid.
function normalizeHandle(twitter) {
  if (!twitter) return null;
  let s = String(twitter).trim();
  s = s.replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "");
  s = s.replace(/^@/, "");
  s = s.split(/[?#/]/)[0];
  if (!/^[A-Za-z0-9_]{1,15}$/.test(s)) return null;
  return s;
}

let cache = null;
let cacheAt = 0;
const TTL_MS = 5 * 60 * 1000;

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

  const timeframe = ["daily", "weekly", "monthly"].includes(req.query?.timeframe)
    ? req.query.timeframe
    : "weekly";
  const cacheKey = timeframe;

  const now = Date.now();
  if (cache && cache.key === cacheKey && now - cacheAt < TTL_MS) {
    return res.status(200).json({ ...cache.value, cached: true });
  }

  try {
    const traders = await scrapeLeaderboard(timeframe);
    const kols = (traders || [])
      .map((t) => {
        const handle = normalizeHandle(t.twitter);
        return {
          rank: t.rank,
          name: t.name,
          wallet: t.wallet || null,
          twitter: handle,
          pnlSol: t.pnl_sol ? Number(t.pnl_sol) : null,
          pnlUsd: t.pnl_usd ? Number(t.pnl_usd) : null,
          wins: t.wins != null ? Number(t.wins) : null,
          losses: t.losses != null ? Number(t.losses) : null,
          winRate: t.win_rate || null,
        };
      })
      .filter((k) => k.wallet);

    const responseBody = {
      timeframe,
      kols,
      count: kols.length,
      source: "kolscan",
      generatedAt: new Date().toISOString(),
    };

    cache = { key: cacheKey, value: responseBody };
    cacheAt = now;

    return res.status(200).json({ ...responseBody, cached: false });
  } catch (err) {
    console.error("Smart Money Tracker error:", err.message);
    return res.status(502).json({ error: "Couldn't load smart money data right now." });
  }
};
