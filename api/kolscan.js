// KOLSCAN scraper — fetches top KOL trader data from kolscan.io
// Data is delivered via React Server Components (RSC) flight payload
// in self.__next_f.push() chunks. The key prop is "initLeaderboard"
// which contains all traders across daily/weekly/monthly timeframes.
// Caches results for 5 minutes.

let cache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Timeframe codes used by KOLSCAN: 1=daily, 7=weekly, 30=monthly
const TIMEFRAME_MAP = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

function extractRSCPayload(html) {
  // Collect all RSC chunks from self.__next_f.push([1, "..."]) calls
  const chunks = [];
  const chunkRegex = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let match;
  while ((match = chunkRegex.exec(html)) !== null) {
    // Unescape the string (it's JSON-escaped inside the push call)
    let decoded = match[1];
    // Handle common escapes
    decoded = decoded.replace(/\\n/g, "\n");
    decoded = decoded.replace(/\\t/g, "\t");
    decoded = decoded.replace(/\\"/g, '"');
    decoded = decoded.replace(/\\\\/g, "\\");
    chunks.push(decoded);
  }
  return chunks.join("");
}

function extractInitLeaderboard(rscPayload) {
  // Find the initLeaderboard array in the RSC payload
  // Format: "initLeaderboard":[{...},{...},...]
  const marker = '"initLeaderboard":';
  const idx = rscPayload.indexOf(marker);
  if (idx === -1) return null;

  const start = idx + marker.length;
  // Find the matching closing bracket for the array
  let depth = 0;
  let end = start;
  for (let i = start; i < rscPayload.length; i++) {
    if (rscPayload[i] === "[") depth++;
    else if (rscPayload[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  const jsonStr = rscPayload.substring(start, end);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse initLeaderboard JSON:", e.message);
    return null;
  }
}

function extractInitialData(rscPayload) {
  // Find the initialData array (full trader roster with names/pfps/socials)
  const marker = '"initialData":';
  const idx = rscPayload.indexOf(marker);
  if (idx === -1) return null;

  const start = idx + marker.length;
  let depth = 0;
  let end = start;
  for (let i = start; i < rscPayload.length; i++) {
    if (rscPayload[i] === "[") depth++;
    else if (rscPayload[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  try {
    return JSON.parse(rscPayload.substring(start, end));
  } catch (e) {
    return null;
  }
}

function extractSolPrice(rscPayload) {
  // Extract SOL price from priceData: {"SOL":xx.xx}
  const priceMatch = rscPayload.match(/"priceData":\s*\{\s*"SOL"\s*:\s*([\d.]+)\s*\}/);
  if (priceMatch) return parseFloat(priceMatch[1]);
  return null;
}

async function scrapeLeaderboard(timeframe = "weekly") {
  const url = "https://kolscan.io/leaderboard";
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`KOLSCAN returned ${res.status}`);
  }

  const html = await res.text();
  const rscPayload = extractRSCPayload(html);

  const timeframeCode = TIMEFRAME_MAP[timeframe] || 7;
  const solPrice = extractSolPrice(rscPayload) || 80;

  // Primary method: extract initLeaderboard from RSC payload
  const leaderboard = extractInitLeaderboard(rscPayload);

  if (leaderboard && Array.isArray(leaderboard) && leaderboard.length > 0) {
    // Filter by requested timeframe
    const filtered = leaderboard.filter((t) => t.timeframe === timeframeCode);

    // Sort by profit descending
    filtered.sort((a, b) => (b.profit || 0) - (a.profit || 0));

    return filtered.slice(0, 20).map((kol, i) => ({
      rank: i + 1,
      name: kol.name || "Unknown",
      wallet: kol.wallet_address || "",
      pnl_sol: kol.profit ? kol.profit.toFixed(2) : null,
      pnl_usd: kol.profit ? (kol.profit * solPrice).toFixed(2) : null,
      wins: kol.wins || null,
      losses: kol.losses || null,
      win_rate: kol.wins && kol.losses ? ((kol.wins / (kol.wins + kol.losses)) * 100).toFixed(1) + "%" : null,
      twitter: kol.twitter || null,
      telegram: kol.telegram || null,
      profile_url: `https://kolscan.io/account/${kol.wallet_address}`,
    }));
  }

  // Fallback: try initialData (full trader roster)
  const initialData = extractInitialData(rscPayload);
  if (initialData && Array.isArray(initialData) && initialData.length > 0) {
    return initialData.slice(0, 20).map((kol, i) => ({
      rank: i + 1,
      name: kol.name || "Unknown",
      wallet: kol.wallet_address || "",
      twitter: kol.twitter || null,
      telegram: kol.telegram || null,
      profile_url: `https://kolscan.io/account/${kol.wallet_address}`,
    }));
  }

  // Last resort fallback: parse HTML for wallet links and names
  const traders = [];
  // The rendered HTML has trader rows inside hidden div with names in <h1> tags
  const rowRegex = /href="\/account\/([1-9A-HJ-NP-Za-km-z]{32,44})[^"]*"[\s\S]*?<h1[^>]*>(.*?)<\/h1>/g;
  let htmlMatch;
  const seen = new Set();

  while ((htmlMatch = rowRegex.exec(html)) !== null && traders.length < 20) {
    const wallet = htmlMatch[1];
    if (seen.has(wallet)) continue;
    seen.add(wallet);

    const name = htmlMatch[2].replace(/<[^>]*>/g, "").trim();

    traders.push({
      rank: traders.length + 1,
      name: name || wallet.slice(0, 6) + "..." + wallet.slice(-4),
      wallet: wallet,
      profile_url: `https://kolscan.io/account/${wallet}`,
    });
  }

  return traders;
}

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://degendesk.xyz", "https://www.degendesk.xyz", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const timeframe = req.query?.timeframe || "weekly";

    // Check cache
    const now = Date.now();
    const cacheKey = `leaderboard_${timeframe}`;
    if (cache[cacheKey] && now - cache[cacheKey].time < CACHE_DURATION) {
      return res.status(200).json(cache[cacheKey].data);
    }

    const traders = await scrapeLeaderboard(timeframe);

    const result = {
      timeframe,
      traders,
      count: traders.length,
      source: "kolscan.io",
      updatedAt: new Date().toISOString(),
    };

    cache[cacheKey] = { data: result, time: now };

    return res.status(200).json(result);
  } catch (err) {
    console.error("KOLSCAN scrape error:", err.message);
    return res.status(500).json({ error: "Failed to fetch KOLSCAN data", details: err.message });
  }
};

// Export the scraper for direct in-process import from other Vercel functions.
// More reliable than self-fetching via fetch() inside the same deployment —
// avoids hostname resolution / cold-start / Vercel-internal HTTP issues.
module.exports.scrapeLeaderboard = scrapeLeaderboard;
