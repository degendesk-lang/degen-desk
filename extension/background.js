/**
 * Service worker — proxies API calls so we don't ship CORS headaches
 * to every site the content script runs on, and centralizes the
 * config (API base URL, cache).
 *
 * Content script sends:  { type: "QUICK_CHECK", address }
 * Background returns:    { ok, data?, error? }
 *
 * In-memory cache keyed by address (60s TTL) to avoid hammering
 * DexScreener when a page has many references to the same token.
 */

const API_BASE = "https://degendesk.xyz";
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // addr → { expires, payload }

async function fetchQuickCheck(address) {
  const now = Date.now();
  const hit = cache.get(address);
  if (hit && hit.expires > now) return hit.payload;

  const url = `${API_BASE}/api/quick-check?ca=${encodeURIComponent(address)}`;
  const res = await fetch(url, { method: "GET" });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: data?.error || `HTTP ${res.status}` };
  }
  const payload = { ok: true, data };
  cache.set(address, { expires: now + CACHE_TTL_MS, payload });
  return payload;
}

// DexScreener search-by-text fallback. Used when the page identifier
// isn't a real mint (Axiom's /meme/<id> uses an internal ID) and we need
// to resolve via the visible token name/symbol instead.
const searchCache = new Map();
async function fetchSearch(query, chainHint) {
  const key = `${query}|${chainHint || ""}`;
  const now = Date.now();
  const hit = searchCache.get(key);
  if (hit && hit.expires > now) return hit.payload;

  try {
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `Search HTTP ${res.status}` };
    const json = await res.json();
    let pairs = Array.isArray(json?.pairs) ? json.pairs : [];
    if (chainHint) pairs = pairs.filter((p) => p.chainId === chainHint);
    pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const top = pairs[0];
    if (!top?.baseToken?.address) {
      const payload = { ok: false, error: "No matching token found." };
      searchCache.set(key, { expires: now + CACHE_TTL_MS, payload });
      return payload;
    }
    // Pipe through the regular quick-check so the response shape matches.
    const qc = await fetchQuickCheck(top.baseToken.address);
    searchCache.set(key, { expires: now + CACHE_TTL_MS, payload: qc });
    return qc;
  } catch (err) {
    return { ok: false, error: err?.message || "search failed" };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "QUICK_CHECK" && typeof msg.address === "string") {
    fetchQuickCheck(msg.address)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err?.message || "fetch failed" }));
    return true; // keep the message channel open for async
  }
  if (msg?.type === "SEARCH_TOKEN" && typeof msg.query === "string") {
    fetchSearch(msg.query, msg.chainHint || null)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err?.message || "search failed" }));
    return true;
  }
  if (msg?.type === "OPEN_REPORT" && typeof msg.address === "string") {
    const chainParam = msg.chain ? `&chain=${encodeURIComponent(msg.chain)}` : "";
    const url = `${API_BASE}/token-analysis.html?ca=${encodeURIComponent(msg.address)}${chainParam}`;
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
