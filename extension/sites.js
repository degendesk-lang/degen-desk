/**
 * Site-specific overlay panel.
 *
 * Detects when the user is on a token detail page on a known dex/explorer
 * and injects a floating Degen Desk panel that shows:
 *  - Token logo, name, symbol, chain badge
 *  - Live metrics from /api/quick-check (MC, price, liquidity, 24h)
 *  - Big "Run full analysis →" CTA → degendesk.xyz with the CA pre-filled
 *
 * The panel is bottom-right by default, collapsible (state persisted to
 * chrome.storage.local), and dismissible per-session.
 *
 * Detection strategies, in priority order:
 *  1. URL pattern match for known dex sites (more reliable than DOM scraping)
 *  2. CA extracted from window.location.href (fallback for any site that
 *     puts the address in the URL — most token-detail pages do)
 */
(() => {
  if (window.__DEGEN_DESK_SITES__) return;
  window.__DEGEN_DESK_SITES__ = true;

  const SOL_ADDR = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const EVM_ADDR = /0x[a-fA-F0-9]{40}/g;

  function looksLikeRealCa(s) {
    if (!s || s.length < 32) return false;
    if (s.startsWith("0x")) return /^0x[a-fA-F0-9]{40}$/.test(s);
    const hasLower = (s.match(/[a-z]/g) || []).length >= 2;
    const hasUpper = (s.match(/[A-Z]/g) || []).length >= 2;
    return hasLower && hasUpper;
  }

  function extractCa(s) {
    if (!s) return null;
    const re = new RegExp(`${SOL_ADDR.source}|${EVM_ADDR.source}`, "g");
    let m;
    while ((m = re.exec(s)) !== null) {
      if (looksLikeRealCa(m[0])) return m[0];
    }
    return null;
  }

  // ---- Site detection ----
  // Each entry returns the contract address if the current URL matches.
  // The first matching strategy wins.
  const SITE_RULES = [
    // pump.fun: /coin/<ca>
    { host: /(^|\.)pump\.fun$/, fromUrl: () => extractCa(window.location.pathname) },
    // Axiom: /meme/<ca> or query param
    { host: /(^|\.)axiom\.trade$/, fromUrl: () => extractCa(window.location.href) },
    // Bullx: ?address=<ca>
    { host: /(^|\.)bullx\.io$/, fromUrl: () => extractCa(window.location.search) || extractCa(window.location.href) },
    // Photon (Solana): pair address in URL — we still attempt to extract any address
    { host: /(^|\.)photon-sol\.tinyastro\.io$/, fromUrl: () => extractCa(window.location.href) },
    // Dexscreener token page: /<chain>/<token>; but also pair pages —
    // grab the address regardless. Quick-check tolerates both since
    // DexScreener resolves tokens from pair addresses too via the same
    // /tokens/<address> endpoint when given a pair, returning the base.
    { host: /(^|\.)dexscreener\.com$/, fromUrl: () => extractCa(window.location.href) },
    // Solscan / Etherscan / Basescan / Bscscan token pages
    { host: /(^|\.)solscan\.io$/, fromUrl: () => extractCa(window.location.href) },
    { host: /(^|\.)etherscan\.io$/, fromUrl: () => extractCa(window.location.href) },
    { host: /(^|\.)basescan\.org$/, fromUrl: () => extractCa(window.location.href) },
    { host: /(^|\.)bscscan\.com$/, fromUrl: () => extractCa(window.location.href) },
    // X / Twitter — show panel if a CA is in the visible URL (e.g. status pages
    // that include a quoted CA in the URL hash). Most CAs on X are in body
    // text, handled by the regular content script.
    // Generic fallback: any site whose URL contains a CA-shaped substring.
    { host: /.*/, fromUrl: () => extractCa(window.location.href) },
  ];

  function detectAddress() {
    const host = window.location.hostname;
    for (const rule of SITE_RULES) {
      if (rule.host.test(host)) {
        const addr = rule.fromUrl();
        if (addr) return addr;
      }
    }
    return null;
  }

  // Collect every plausible CA on the page (URL + DOM). Used as the candidate
  // set we try in order — first one with trading data wins. Solves the Axiom
  // problem where /meme/<id> uses an internal identifier and the real SPL
  // mint only appears in the sidebar.
  function collectCandidates() {
    const set = new Set();
    const urlCa = detectAddress();
    if (urlCa) set.add(urlCa);

    // Body text — use textContent (not innerText) so CSS truncation doesn't
    // hide the full address. Many dex sites visually truncate via
    // text-overflow: ellipsis but the underlying text still has the full CA.
    try {
      const re = new RegExp(`${SOL_ADDR.source}|${EVM_ADDR.source}`, "g");
      const text = document.body?.textContent || "";
      let m;
      while ((m = re.exec(text)) !== null) {
        if (looksLikeRealCa(m[0])) set.add(m[0]);
      }
    } catch (_) {}

    // Anchor hrefs (most dex sites link the CA to Solscan/Etherscan/etc.)
    try {
      const anchors = document.querySelectorAll("a[href]");
      for (const a of anchors) {
        const ca = extractCa(a.getAttribute("href") || "");
        if (ca) set.add(ca);
      }
    } catch (_) {}

    // ALL attributes on EVERY element — catches data-clipboard-text on copy
    // buttons, aria-label on icon links, custom data-* attrs we don't know
    // about, etc. This is the heaviest scan but only runs once per page load.
    try {
      const all = document.querySelectorAll("*");
      // Cap at 10000 elements to avoid pathological pages — real dex pages
      // usually have 1k-5k. Anything past that is unlikely to contain the CA.
      const max = Math.min(all.length, 10000);
      for (let i = 0; i < max; i++) {
        const el = all[i];
        if (!el.attributes) continue;
        for (const attr of el.attributes) {
          if (!attr.value || attr.value.length < 32) continue;
          const ca = extractCa(attr.value);
          if (ca) set.add(ca);
        }
      }
    } catch (_) {}

    // Heuristic ordering:
    //  1. Solana mints ending in "pump" (pump.fun tokens) — almost always
    //     the real mint when on a memecoin dex
    //  2. URL CA (still useful for explorers + EVM chains)
    //  3. Everything else
    const all = Array.from(set);
    all.sort((a, b) => {
      const aPump = /pump$/.test(a) ? 1 : 0;
      const bPump = /pump$/.test(b) ? 1 : 0;
      if (aPump !== bPump) return bPump - aPump;
      // URL CA second priority
      if (urlCa) {
        if (a === urlCa) return -1;
        if (b === urlCa) return 1;
      }
      return 0;
    });
    return all;
  }

  // ---- Panel ----
  let panelEl = null;
  let currentAddr = null;

  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    if (v >= 1) return `$${v.toFixed(2)}`;
    if (v > 0) return `$${v.toFixed(6)}`;
    return "$0";
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadCollapsed() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(["dd_panel_collapsed"], (v) => {
          resolve(!!v?.dd_panel_collapsed);
        });
      } catch (_) {
        resolve(false);
      }
    });
  }

  function saveCollapsed(value) {
    try { chrome.storage.local.set({ dd_panel_collapsed: !!value }); } catch (_) {}
  }

  function quickCheck(address) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "QUICK_CHECK", address }, (resp) => {
          resolve(resp || { ok: false, error: "no response" });
        });
      } catch (e) {
        resolve({ ok: false, error: e?.message || "send failed" });
      }
    });
  }

  function searchToken(query, chainHint) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "SEARCH_TOKEN", query, chainHint }, (resp) => {
          resolve(resp || { ok: false, error: "no response" });
        });
      } catch (e) {
        resolve({ ok: false, error: e?.message || "send failed" });
      }
    });
  }

  // Best-effort token-name extraction for the search fallback. Looks at
  // og:title meta, the document title, and the most prominent heading.
  function extractTokenName() {
    const candidates = [];
    const og = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
    if (og) candidates.push(og);
    if (document.title) candidates.push(document.title);
    const h1 = document.querySelector("h1")?.textContent;
    if (h1) candidates.push(h1);
    const h2 = document.querySelector("h2")?.textContent;
    if (h2) candidates.push(h2);

    // Clean each candidate: strip currency symbols, arrows, price strings,
    // site name suffixes ("| Axiom", "· Pump"), and excess whitespace.
    const cleaned = candidates
      .map((s) =>
        String(s || "")
          .replace(/[↑↓→]/g, "")
          .replace(/\$[\d.,]+[KMB]?/gi, "")
          .replace(/\|\s*[a-z0-9 .]+$/i, "")
          .replace(/·.*$/i, "")
          .replace(/—.*$/, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((s) => s && s.length >= 2 && s.length <= 60);
    return cleaned[0] || null;
  }

  function chainHintFromHost() {
    const h = window.location.hostname.toLowerCase();
    if (/(axiom\.trade|pump\.fun|photon-sol|solscan)/.test(h)) return "solana";
    if (/etherscan/.test(h)) return "ethereum";
    if (/basescan/.test(h)) return "base";
    if (/bscscan/.test(h)) return "bsc";
    // Bullx + Dexscreener can be any chain
    return null;
  }

  function renderPanel(addr, state, data) {
    const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    if (state === "loading") {
      return `
        <div class="dd-panel-head">
          <div class="dd-panel-brand">
            <img src="${chrome.runtime.getURL("icons/icon-32.png")}" alt="Degen Desk" />
            <span>Degen Desk</span>
          </div>
          <div class="dd-panel-actions">
            <button class="dd-panel-btn-ic" data-action="collapse" title="Collapse">−</button>
            <button class="dd-panel-btn-ic" data-action="dismiss" title="Hide on this page">×</button>
          </div>
        </div>
        <div class="dd-panel-body dd-panel-loading">
          <div class="dd-spinner"></div>
          <div class="dd-panel-addr">${escapeHtml(short)}</div>
        </div>
      `;
    }

    if (state === "error") {
      return `
        <div class="dd-panel-head">
          <div class="dd-panel-brand">
            <img src="${chrome.runtime.getURL("icons/icon-32.png")}" alt="Degen Desk" />
            <span>Degen Desk</span>
          </div>
          <div class="dd-panel-actions">
            <button class="dd-panel-btn-ic" data-action="collapse" title="Collapse">−</button>
            <button class="dd-panel-btn-ic" data-action="dismiss" title="Hide on this page">×</button>
          </div>
        </div>
        <div class="dd-panel-body">
          <div class="dd-pop-err">${escapeHtml(data || "No DexScreener data found.")}</div>
          <button class="dd-panel-cta" data-action="open" data-addr="${escapeHtml(addr)}">Try full analysis →</button>
          <div class="dd-panel-addr">${escapeHtml(short)}</div>
        </div>
      `;
    }

    const d = data;
    const chgCls = (d.priceChange24h ?? 0) >= 0 ? "dd-up" : "dd-down";
    return `
      <div class="dd-panel-head">
        <div class="dd-panel-brand">
          <img src="${chrome.runtime.getURL("icons/icon-32.png")}" alt="Degen Desk" />
          <span>Degen Desk</span>
        </div>
        <div class="dd-panel-actions">
          <button class="dd-panel-btn-ic" data-action="collapse" title="Collapse">−</button>
          <button class="dd-panel-btn-ic" data-action="dismiss" title="Hide on this page">×</button>
        </div>
      </div>
      <div class="dd-panel-body">
        <div class="dd-panel-tokenrow">
          ${d.imageUrl ? `<img class="dd-panel-tlogo" src="${escapeHtml(d.imageUrl)}" alt="" onerror="this.style.display='none'" />` : ""}
          <div class="dd-panel-tinfo">
            <div class="dd-panel-tname">${escapeHtml(d.name || "Token")}</div>
            <div class="dd-panel-tsym">$${escapeHtml(d.symbol || "")} ${d.chain ? `<span class="dd-chain-badge dd-chain-${escapeHtml(d.chain)}">${escapeHtml(d.chainLabel || d.chain)}</span>` : ""}</div>
          </div>
        </div>
        <div class="dd-pop-grid">
          <div class="dd-pop-cell">
            <div class="dd-pop-cell-label">Market Cap</div>
            <div class="dd-pop-cell-val">${fmtUsd(d.marketCap)}</div>
          </div>
          <div class="dd-pop-cell">
            <div class="dd-pop-cell-label">Price</div>
            <div class="dd-pop-cell-val">${fmtUsd(d.priceUsd)}</div>
          </div>
          <div class="dd-pop-cell">
            <div class="dd-pop-cell-label">Liquidity</div>
            <div class="dd-pop-cell-val">${fmtUsd(d.liquidityUsd)}</div>
          </div>
          <div class="dd-pop-cell">
            <div class="dd-pop-cell-label">24h</div>
            <div class="dd-pop-cell-val ${chgCls}">${fmtPct(d.priceChange24h)}</div>
          </div>
        </div>
        <div class="dd-panel-pitch">
          <strong>Run the full Pro analysis</strong>
          <span>Holder concentration · honeypot · dev wallet · domain age · GitHub</span>
        </div>
        <button class="dd-panel-cta" data-action="open" data-addr="${escapeHtml(addr)}" data-chain="${escapeHtml(d.chain || "")}">Open full report on Degen Desk →</button>
        <div class="dd-panel-addr">${escapeHtml(short)}</div>
      </div>
    `;
  }

  function renderCollapsedTab() {
    return `
      <button class="dd-panel-tab-btn" data-action="expand" title="Open Degen Desk">
        <img src="${chrome.runtime.getURL("icons/icon-32.png")}" alt="Degen Desk" />
      </button>
    `;
  }

  function bindActions() {
    if (!panelEl) return;
    panelEl.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = el.getAttribute("data-action");
        if (action === "dismiss") {
          panelEl.remove();
          panelEl = null;
          window.__ddPanelDismissed = true;
        } else if (action === "collapse") {
          panelEl.classList.add("dd-panel-collapsed");
          panelEl.innerHTML = renderCollapsedTab();
          bindActions();
          saveCollapsed(true);
        } else if (action === "expand") {
          panelEl.classList.remove("dd-panel-collapsed");
          saveCollapsed(false);
          render(currentAddr);
        } else if (action === "open") {
          chrome.runtime.sendMessage({
            type: "OPEN_REPORT",
            address: el.getAttribute("data-addr"),
            chain: el.getAttribute("data-chain") || null,
          });
        }
      });
    });
  }

  async function tryCandidates(candidates) {
    // Iterate the candidate list and pick the first CA that returns data.
    for (const addr of candidates) {
      const resp = await quickCheck(addr);
      if (resp?.ok && resp.data) {
        return { addr, data: resp.data };
      }
    }
    return null;
  }

  async function render(initialAddr) {
    if (!panelEl) {
      panelEl = document.createElement("div");
      panelEl.className = "dd-panel";
      document.documentElement.appendChild(panelEl);
    }
    panelEl.innerHTML = renderPanel(initialAddr, "loading");
    bindActions();

    // Build the full candidate list and try them in priority order
    const candidates = collectCandidates();
    console.log("[Degen Desk] CA candidates collected:", candidates);

    let result = candidates.length > 0 ? await tryCandidates(candidates) : null;

    // Fallback: when no on-page CA resolves (Axiom uses an internal page id),
    // search DexScreener by the visible token name and pick the highest-
    // liquidity match on the chain hint.
    if (!result) {
      const name = extractTokenName();
      const chainHint = chainHintFromHost();
      console.log("[Degen Desk] CA fallback search:", { name, chainHint });
      if (name) {
        const resp = await searchToken(name, chainHint);
        if (resp?.ok && resp.data?.address) {
          result = { addr: resp.data.address, data: resp.data };
        }
      }
    }

    if (panelEl.classList.contains("dd-panel-collapsed")) return;

    if (result) {
      currentAddr = result.addr;
      panelEl.innerHTML = renderPanel(result.addr, "ok", result.data);
    } else {
      panelEl.innerHTML = renderPanel(
        initialAddr || "—",
        "error",
        "Couldn't resolve a token on this page. Try the toolbar popup or refresh."
      );
    }
    bindActions();
  }

  async function init() {
    if (window.__ddPanelDismissed) return;

    // Wait briefly for SPA-rendered DOM to settle so the candidate sweep
    // has something to work with on Axiom/Bullx/etc.
    await new Promise((r) => setTimeout(r, 600));

    const candidates = collectCandidates();
    const tokenName = extractTokenName();
    // Show the panel if we have either a CA candidate or a token name we
    // can search by — covers Axiom's internal-id case where no CA is in DOM.
    if (candidates.length === 0 && !tokenName) return;

    const initialAddr = candidates[0] || null;
    if (initialAddr && currentAddr === initialAddr) return;
    currentAddr = initialAddr;

    const collapsed = await loadCollapsed();
    if (collapsed) {
      if (!panelEl) {
        panelEl = document.createElement("div");
        panelEl.className = "dd-panel dd-panel-collapsed";
        document.documentElement.appendChild(panelEl);
      }
      panelEl.innerHTML = renderCollapsedTab();
      bindActions();
      return;
    }
    render(initialAddr);
  }

  init();

  // SPA navigation: re-init when URL changes (Axiom, Bullx, etc. push state)
  let lastHref = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      if (!window.__ddPanelDismissed) {
        currentAddr = null;
        init();
      }
    }
  }, 800);
})();
