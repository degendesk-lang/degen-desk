const COIN_MAP = {
  // Common aliases
  btc: "bitcoin", bitcoin: "bitcoin",
  eth: "ethereum", ethereum: "ethereum",
  sol: "solana", solana: "solana",
  xrp: "ripple", ripple: "ripple",
  doge: "dogecoin", dogecoin: "dogecoin",
  shib: "shiba-inu", "shiba inu": "shiba-inu",
  pepe: "pepe", bonk: "bonk",
  wif: "dogwifhat", dogwifhat: "dogwifhat",
  floki: "floki", popcat: "popcat",
  bnb: "binancecoin", ada: "cardano",
  dot: "polkadot", avax: "avalanche-2",
  matic: "matic-network", polygon: "matic-network",
  link: "chainlink", uni: "uniswap",
  apt: "aptos", sui: "sui", sei: "sei-network",
  arb: "arbitrum", op: "optimism",
  jup: "jupiter-exchange-solana", ray: "raydium",
  render: "render-token", fet: "artificial-superintelligence-alliance",
  wen: "wen-4", bome: "book-of-meme",
  trump: "official-trump", melania: "melania-meme",
};

// Cache prices for 30 seconds
let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 30000;

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://degendesk.xyz", "https://www.degendesk.xyz", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // GET = ticker prices (BTC, ETH, SOL, XRP)
  if (req.method === "GET") {
    try {
      if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
        return res.status(200).json(cache.data);
      }

      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,binancecoin&vs_currencies=usd&include_24hr_change=true"
      );
      const data = await response.json();

      const prices = {
        BTC: { price: data.bitcoin?.usd, change: data.bitcoin?.usd_24h_change },
        ETH: { price: data.ethereum?.usd, change: data.ethereum?.usd_24h_change },
        SOL: { price: data.solana?.usd, change: data.solana?.usd_24h_change },
        BNB: { price: data.binancecoin?.usd, change: data.binancecoin?.usd_24h_change },
        XRP: { price: data.ripple?.usd, change: data.ripple?.usd_24h_change },
      };

      cache = { data: prices, timestamp: Date.now() };
      return res.status(200).json(prices);
    } catch (err) {
      console.error("Price fetch error:", err.message);
      return res.status(500).json({ error: "Failed to fetch prices" });
    }
  }

  // POST = lookup any coin price
  if (req.method === "POST") {
    const { coin } = req.body;
    if (!coin) return res.status(400).json({ error: "Missing coin parameter" });

    const query = coin.toLowerCase().trim();
    let coinId = COIN_MAP[query];

    try {
      // If not in our map, search CoinGecko
      if (!coinId) {
        const searchRes = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
        );
        const searchData = await searchRes.json();
        if (searchData.coins && searchData.coins.length > 0) {
          coinId = searchData.coins[0].id;
        } else {
          return res.status(404).json({ error: `Coin "${coin}" not found` });
        }
      }

      const priceRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
      );
      const priceData = await priceRes.json();

      if (!priceData[coinId]) {
        return res.status(404).json({ error: `Price data not available for "${coin}"` });
      }

      return res.status(200).json({
        coin: coinId,
        symbol: coin.toUpperCase(),
        price: priceData[coinId].usd,
        change_24h: priceData[coinId].usd_24h_change,
        market_cap: priceData[coinId].usd_market_cap,
      });
    } catch (err) {
      console.error("Coin lookup error:", err.message);
      return res.status(500).json({ error: "Failed to look up coin price" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
