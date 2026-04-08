// Cache trending data for 2 minutes
let trendingCache = { data: null, timestamp: 0 };
const CACHE_TTL = 120000;

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://degendesk.xyz", "https://www.degendesk.xyz", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (trendingCache.data && Date.now() - trendingCache.timestamp < CACHE_TTL) {
      return res.status(200).json(trendingCache.data);
    }

    // Fetch trending from CoinGecko
    const trendingRes = await fetch("https://api.coingecko.com/api/v3/search/trending");
    const trendingData = await trendingRes.json();

    // Fetch top meme coins by category
    const memeRes = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=meme-token&order=market_cap_desc&per_page=15&page=1&sparkline=false&price_change_percentage=24h"
    );
    const memeData = await memeRes.json();

    // Fetch pump.fun top tokens by market cap
    let pumpFunTokens = [];
    try {
      const pumpRes = await fetch("https://frontend-api-v2.pump.fun/coins/currently-live?limit=15&offset=0&sort=market_cap&order=DESC&includeNsfw=false");
      const pumpData = await pumpRes.json();
      if (Array.isArray(pumpData)) {
        pumpFunTokens = pumpData.map((token) => ({
          name: token.name,
          symbol: token.symbol,
          mint: token.mint,
          market_cap: token.market_cap,
          price: token.price,
          description: token.description?.substring(0, 100),
        }));
      }
    } catch (pumpErr) {
      console.error("pump.fun fetch error:", pumpErr.message);
      // Continue without pump.fun data
    }

    const trending = (trendingData.coins || []).slice(0, 10).map((item) => ({
      name: item.item.name,
      symbol: item.item.symbol,
      id: item.item.id,
      market_cap_rank: item.item.market_cap_rank,
      price_btc: item.item.price_btc,
      score: item.item.score,
    }));

    const topMemeCoins = Array.isArray(memeData)
      ? memeData.map((coin) => ({
          name: coin.name,
          symbol: coin.symbol?.toUpperCase(),
          id: coin.id,
          price: coin.current_price,
          market_cap: coin.market_cap,
          market_cap_rank: coin.market_cap_rank,
          change_24h: coin.price_change_percentage_24h,
          volume_24h: coin.total_volume,
        }))
      : [];

    const result = { trending, topMemeCoins, pumpFunTokens, updatedAt: new Date().toISOString() };
    trendingCache = { data: result, timestamp: Date.now() };

    return res.status(200).json(result);
  } catch (err) {
    console.error("Trending fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch trending data" });
  }
};
