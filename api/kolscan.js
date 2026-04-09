// KOLSCAN scraper — fetches top KOL trader data from kolscan.io
// Caches results for 5 minutes to avoid hammering the site

let cache = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function scrapeLeaderboard(timeframe = "weekly") {
  const url = "https://kolscan.io/leaderboard";
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`KOLSCAN returned ${res.status}`);
  }

  const html = await res.text();

  // Extract the Next.js server data which contains the pre-rendered trader data
  // KOLSCAN uses React Server Components — data is embedded in the HTML
  const traders = [];

  // Parse leaderboard rows from HTML
  // Look for wallet addresses (Solana base58 format) and associated data
  const walletRegex = /([1-9A-HJ-NP-Za-km-z]{32,44})/g;

  // Try to extract structured data from Next.js __NEXT_DATA__ script
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const props = nextData?.props?.pageProps;
      if (props?.kols || props?.leaderboard || props?.traders) {
        const data = props.kols || props.leaderboard || props.traders;
        if (Array.isArray(data)) {
          return data.slice(0, 20).map((kol, i) => ({
            rank: i + 1,
            name: kol.name || kol.displayName || kol.username || "Unknown",
            wallet: kol.wallet || kol.walletAddress || kol.address || "",
            pnl_sol: kol.pnl_sol || kol.realizedPnl || kol.pnlSol || null,
            pnl_usd: kol.pnl_usd || kol.realizedPnlUsd || kol.pnlUsd || null,
            win_rate: kol.winRate || kol.win_rate || null,
            wins: kol.wins || kol.win || null,
            losses: kol.losses || kol.loss || null,
            twitter: kol.twitter || kol.twitterUrl || kol.x || null,
            avatar: kol.avatar || kol.profilePicture || kol.image || null,
          }));
        }
      }
    } catch (e) {
      // JSON parse failed, fall through to HTML parsing
    }
  }

  // Try extracting from RSC payload (React Server Components flight data)
  const rscChunks = html.match(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g);
  if (rscChunks && rscChunks.length > 0) {
    let fullPayload = "";
    for (const chunk of rscChunks) {
      const match = chunk.match(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/);
      if (match) {
        fullPayload += match[1];
      }
    }

    // Look for arrays of trader objects in the RSC payload
    // They typically contain wallet addresses and PnL data
    const traderArrayMatch = fullPayload.match(/\[(?:\{[^}]*"(?:wallet|address|name)"[^}]*\}[,\s]*)+\]/g);
    if (traderArrayMatch) {
      for (const arrStr of traderArrayMatch) {
        try {
          const decoded = arrStr.replace(/\\"/g, '"').replace(/\\n/g, "\n");
          const arr = JSON.parse(decoded);
          if (Array.isArray(arr) && arr.length > 3) {
            return arr.slice(0, 20).map((kol, i) => ({
              rank: i + 1,
              name: kol.name || kol.displayName || "Unknown",
              wallet: kol.wallet || kol.walletAddress || kol.address || "",
              pnl_sol: kol.pnl_sol || kol.realizedPnl || null,
              pnl_usd: kol.pnl_usd || kol.realizedPnlUsd || null,
              win_rate: kol.winRate || kol.win_rate || null,
              wins: kol.wins || null,
              losses: kol.losses || null,
              twitter: kol.twitter || null,
            }));
          }
        } catch (e) {
          // continue trying other matches
        }
      }
    }
  }

  // Fallback: parse raw HTML table/list structure
  // Look for leaderboard entries with common patterns
  const entryRegex = /<a[^>]*href="\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  const seen = new Set();

  while ((match = entryRegex.exec(html)) !== null && traders.length < 20) {
    const wallet = match[1];
    if (seen.has(wallet)) continue;
    seen.add(wallet);

    const block = match[2];

    // Try to extract name
    const nameMatch = block.match(/<(?:span|p|div)[^>]*>([^<]{2,30})<\/(?:span|p|div)>/);
    const name = nameMatch ? nameMatch[1].trim() : wallet.slice(0, 6) + "..." + wallet.slice(-4);

    // Try to extract PnL
    const pnlMatch = block.match(/([\d,.]+)\s*SOL/);
    const pnlUsdMatch = block.match(/\$([\d,.]+)/);

    traders.push({
      rank: traders.length + 1,
      name: name,
      wallet: wallet,
      pnl_sol: pnlMatch ? pnlMatch[1] : null,
      pnl_usd: pnlUsdMatch ? pnlUsdMatch[1] : null,
    });
  }

  // If we still got nothing, try finding any wallet-like links
  if (traders.length === 0) {
    const linkRegex = /\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})/g;
    const wallets = new Set();
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null && wallets.size < 20) {
      wallets.add(linkMatch[1]);
    }
    for (const w of wallets) {
      traders.push({
        rank: traders.length + 1,
        name: w.slice(0, 6) + "..." + w.slice(-4),
        wallet: w,
      });
    }
  }

  return traders;
}

async function scrapeTraderProfile(wallet) {
  const url = `https://kolscan.io/account/${wallet}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    return null;
  }

  const html = await res.text();

  // Try __NEXT_DATA__
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const props = nextData?.props?.pageProps;
      if (props) {
        return {
          name: props.name || props.displayName || props.kol?.name || wallet.slice(0, 6) + "..." + wallet.slice(-4),
          wallet: wallet,
          pnl_sol: props.realizedPnl || props.pnl_sol || props.kol?.realizedPnl || null,
          pnl_usd: props.realizedPnlUsd || props.pnl_usd || props.kol?.realizedPnlUsd || null,
          win_rate: props.winRate || props.win_rate || props.kol?.winRate || null,
          total_trades: props.totalTrades || props.kol?.totalTrades || null,
          avg_hold_time: props.avgHoldTime || props.kol?.avgHoldTime || null,
          top_trade: props.topTrade || props.bestTrade || props.kol?.topTrade || null,
          twitter: props.twitter || props.twitterUrl || props.kol?.twitter || null,
          recent_trades: props.trades || props.recentTrades || props.kol?.trades || [],
        };
      }
    } catch (e) {
      // fall through
    }
  }

  // Basic HTML extraction
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const name = titleMatch ? titleMatch[1].replace(/ - KOLSCAN.*/, "").trim() : wallet.slice(0, 6) + "..." + wallet.slice(-4);

  return {
    name: name,
    wallet: wallet,
    profile_url: `https://kolscan.io/account/${wallet}`,
  };
}

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://degendesk.xyz", "https://www.degendesk.xyz", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "POST") {
      // Lookup specific trader by wallet
      const { wallet } = req.body || {};
      if (!wallet) {
        return res.status(400).json({ error: "wallet required" });
      }
      const profile = await scrapeTraderProfile(wallet);
      return res.status(200).json(profile || { error: "Trader not found" });
    }

    // GET — return leaderboard
    const timeframe = req.query?.timeframe || "weekly";

    // Check cache
    const now = Date.now();
    const cacheKey = `leaderboard_${timeframe}`;
    if (cache && cache.key === cacheKey && now - cacheTime < CACHE_DURATION) {
      return res.status(200).json(cache.data);
    }

    const traders = await scrapeLeaderboard(timeframe);

    const result = {
      timeframe,
      traders,
      count: traders.length,
      source: "kolscan.io",
      updatedAt: new Date().toISOString(),
    };

    cache = { key: cacheKey, data: result };
    cacheTime = now;

    return res.status(200).json(result);
  } catch (err) {
    console.error("KOLSCAN scrape error:", err.message);
    return res.status(500).json({ error: "Failed to fetch KOLSCAN data", details: err.message });
  }
};
