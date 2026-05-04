/**
 * X Handle History
 *
 * Look up an X (Twitter) handle's full rename history via memory.lol's
 * public archive. Surfaces two scam-relevant red flags:
 *
 *   1. Handle reuse — same @handle has been used by N different accounts
 *      over time (classic scam: register an old handle abandoned by someone
 *      legit, impersonate the original).
 *   2. Recent rebrand — the same account changed handles within the last
 *      30 days (classic scam: rebrand a previously-flagged scam account
 *      to a fresh-looking memecoin project).
 *
 * Cost: $0. memory.lol is a public archive. No auth required.
 *
 * Data shape returned by memory.lol:
 *   { accounts: [{ id, id_str, screen_names: { "@handle": [firstSeen, lastSeen] } }] }
 */

const MEMORY_LOL = "https://api.memory.lol/v1/tw/";
const MAX_INPUT_LEN = 30;
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const ID_RE = /^\d{1,20}$/;

let cache = new Map(); // key -> { at, value }
const TTL = 10 * 60 * 1000;

function fetchWithTimeout(url, ms = 6000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, {
    signal: c.signal,
    headers: { "User-Agent": "Mozilla/5.0 DegenDesk/1.0" },
  }).finally(() => clearTimeout(t));
}

function normalizeInput(raw) {
  if (!raw) return null;
  let s = String(raw).trim().slice(0, MAX_INPUT_LEN);
  s = s.replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "");
  s = s.replace(/^@/, "");
  s = s.split(/[?#/]/)[0];
  if (!s) return null;
  if (HANDLE_RE.test(s)) return { kind: "handle", value: s };
  if (ID_RE.test(s)) return { kind: "id", value: s };
  return null;
}

async function fetchHistory(input) {
  const url = MEMORY_LOL + encodeURIComponent(input.value);
  const res = await fetchWithTimeout(url);
  if (res.status === 404) return { found: false, accounts: [] };
  if (!res.ok) {
    throw new Error(`memory.lol returned ${res.status}`);
  }
  const data = await res.json();
  return { found: true, accounts: data.accounts || [] };
}

// Convert memory.lol's `screen_names: { handle: [first, last] }` map into a
// chronologically-sorted array of { handle, firstSeen, lastSeen }.
function expandHandles(account) {
  const names = account.screen_names || {};
  const list = [];
  for (const [handle, range] of Object.entries(names)) {
    const [firstSeen, lastSeen] =
      Array.isArray(range) && range.length >= 2 ? range : [null, null];
    list.push({ handle, firstSeen, lastSeen });
  }
  list.sort((a, b) => {
    const fa = a.firstSeen || "";
    const fb = b.firstSeen || "";
    return fa.localeCompare(fb);
  });
  return list;
}

function daysBetween(isoA, isoB) {
  if (!isoA || !isoB) return null;
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function buildSignals(accounts) {
  const flags = [];
  let severity = "low";

  // Handle reuse: more than one account ID returned for a single handle query
  if (accounts.length > 1) {
    flags.push({
      kind: "handle_reuse",
      message: `This @handle has been used by ${accounts.length} different X accounts over time. Verify the current account is the one you think it is.`,
    });
    severity = "high";
  }

  // Per-account: rebrand frequency + recency
  const todayMs = Date.now();
  for (const acct of accounts) {
    const handles = expandHandles(acct);
    if (handles.length > 1) {
      flags.push({
        kind: "rebrands",
        accountId: acct.id_str || String(acct.id),
        message: `Account ID ${acct.id_str || acct.id} has used ${handles.length} different handles.`,
      });
      if (severity === "low") severity = "medium";
    }
    // Most recent rename = max lastSeen across handles, but we want changeover
    // dates. A handle whose firstSeen is within the last 30 days is suspicious.
    const recentRename = handles
      .slice(1) // ignore the first/oldest, we care about subsequent
      .find((h) => {
        if (!h.firstSeen) return false;
        const ageDays = (todayMs - Date.parse(h.firstSeen)) / (24 * 60 * 60 * 1000);
        return ageDays >= 0 && ageDays <= 30;
      });
    if (recentRename) {
      flags.push({
        kind: "recent_rename",
        accountId: acct.id_str || String(acct.id),
        message: `Account ID ${acct.id_str || acct.id} renamed to @${recentRename.handle} within the last 30 days. Recent rebrands are a common scam signal — verify the project's legitimacy independently.`,
      });
      severity = "high";
    }
  }

  return { flags, severity };
}

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

  const raw = (req.query?.q || req.query?.handle || "").toString();
  const input = normalizeInput(raw);
  if (!input) {
    return res.status(400).json({
      error: "Enter an X handle (e.g. @elonmusk or elonmusk) or numeric account ID.",
    });
  }

  const cacheKey = `${input.kind}:${input.value.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL) {
    return res.status(200).json({ ...cached.value, cached: true });
  }

  try {
    const { found, accounts } = await fetchHistory(input);
    if (!found || accounts.length === 0) {
      return res.status(200).json({
        query: input,
        found: false,
        message:
          "memory.lol has no history for this handle. The account may be too new, too obscure, or recently created. Always cross-check via the X account creation date.",
        cached: false,
      });
    }

    const enriched = accounts.map((acct) => {
      const handles = expandHandles(acct);
      const oldestFirstSeen = handles[0]?.firstSeen || null;
      const newestLastSeen = handles
        .map((h) => h.lastSeen)
        .filter(Boolean)
        .sort()
        .pop();
      const currentHandle = handles[handles.length - 1]?.handle || null;
      const accountAgeDays = daysBetween(oldestFirstSeen, new Date().toISOString());
      return {
        accountId: acct.id_str || String(acct.id),
        currentHandle,
        oldestKnownDate: oldestFirstSeen,
        newestKnownDate: newestLastSeen,
        accountAgeDays,
        renameCount: Math.max(0, handles.length - 1),
        handles,
        profileUrl: currentHandle ? `https://x.com/${currentHandle}` : null,
      };
    });

    const { flags, severity } = buildSignals(accounts);

    const result = {
      query: input,
      found: true,
      accountCount: accounts.length,
      accounts: enriched,
      signals: { severity, flags },
      generatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { at: Date.now(), value: result });
    if (cache.size > 500) {
      // simple LRU pruning
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) cache.delete(oldest[0]);
    }

    return res.status(200).json({ ...result, cached: false });
  } catch (err) {
    console.error("Handle history error:", err.message);
    return res.status(502).json({
      error: "Couldn't reach the handle archive right now. Try again in a moment.",
    });
  }
};
