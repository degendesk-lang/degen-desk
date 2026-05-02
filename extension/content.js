/**
 * Content script — runs on every non-Degen-Desk page.
 *
 * Job:
 *  1. Walk the DOM for visible text nodes.
 *  2. Detect contract addresses (Solana base58 32-44 chars, EVM 0x + 40 hex).
 *  3. Wrap each match in a span that triggers a Degen Desk popover on hover.
 *  4. Fetch a quick metrics preview from /api/quick-check (cached server-side
 *     of the message bus in background.js).
 *  5. Provide an "Open full report →" button that opens degendesk.xyz with
 *     the address pre-filled.
 *
 * MutationObserver re-scans nodes added after the initial pass (X feed, Discord, etc.)
 *
 * Performance:
 *  - Skips <script>, <style>, <textarea>, <input>, <code>, <pre>, contenteditable.
 *  - Only walks text nodes whose textContent passes a cheap pre-check.
 *  - Hover-triggered fetch — no fetch happens until the user actually points
 *    at an address. Multiple fetches for the same address are deduped via an
 *    in-flight map plus the 60s background cache.
 *  - Skips re-wrapping nodes already marked.
 */

(() => {
  if (window.__DEGEN_DESK_INJECTED__) return;
  window.__DEGEN_DESK_INJECTED__ = true;

  const SOL_ADDR = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  const EVM_ADDR = /\b0x[a-fA-F0-9]{40}\b/g;
  const COMBINED = new RegExp(`${SOL_ADDR.source}|${EVM_ADDR.source}`, "g");

  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "INPUT",
    "CODE", "PRE", "KBD", "SAMP", "DD-CA",
  ]);

  // Simple base58 sanity gate — Solana mints are always exactly 32 bytes,
  // which is 43-44 base58 chars. The regex is loose (32-44) to accept any
  // address Solana clients accept, but we exclude obvious false positives:
  // ALL CAPS strings (like JWT tokens or Discord IDs are usually base64-ish).
  function looksLikeRealCa(s) {
    if (s.length < 32) return false;
    // Filter Solana false positives (addresses must contain at least one of each
    // character class is heuristic, but base58 token mints virtually always do)
    if (s.startsWith("0x")) return /^0x[a-fA-F0-9]{40}$/.test(s);
    // Has at least 2 lowercase + 2 uppercase letters (filters JWT-ish strings)
    const hasLower = (s.match(/[a-z]/g) || []).length >= 2;
    const hasUpper = (s.match(/[A-Z]/g) || []).length >= 2;
    return hasLower && hasUpper;
  }

  const inflight = new Map(); // address → Promise<payload>
  function quickCheck(address) {
    if (inflight.has(address)) return inflight.get(address);
    const p = new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "QUICK_CHECK", address },
          (resp) => resolve(resp || { ok: false, error: "no response" })
        );
      } catch (e) {
        resolve({ ok: false, error: e?.message || "send failed" });
      }
    });
    inflight.set(address, p);
    // Don't keep stale promises for resolved fetches forever — re-enable retry after 30s
    setTimeout(() => inflight.delete(address), 30_000);
    return p;
  }

  // ---------------- Popover ----------------
  let popoverEl = null;
  let popoverHideTimer = null;
  let activeChip = null;

  function ensurePopover() {
    if (popoverEl) return popoverEl;
    popoverEl = document.createElement("div");
    popoverEl.className = "dd-popover";
    popoverEl.setAttribute("role", "tooltip");
    popoverEl.addEventListener("mouseenter", cancelHide);
    popoverEl.addEventListener("mouseleave", scheduleHide);
    document.documentElement.appendChild(popoverEl);
    return popoverEl;
  }

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

  function chainBadgeHtml(chain, label) {
    if (!chain) return "";
    return `<span class="dd-chain-badge dd-chain-${chain}">${label || chain}</span>`;
  }

  function popoverHtml(state, addr, data) {
    const short = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
    if (state === "loading") {
      return `
        <div class="dd-pop-header">
          <img class="dd-pop-logo" src="${chrome.runtime.getURL("icons/icon-32.png")}" alt="Degen Desk" />
          <div class="dd-pop-title">Degen Desk</div>
        </div>
        <div class="dd-pop-body dd-pop-loading">
          <div class="dd-spinner"></div>
          <div class="dd-pop-addr">${short}</div>
        </div>
      `;
    }
    if (state === "error") {
      return `
        <div class="dd-pop-header">
          <img class="dd-pop-logo" src="${chrome.runtime.getURL("icons/icon-32.png")}" alt="Degen Desk" />
          <div class="dd-pop-title">Degen Desk</div>
        </div>
        <div class="dd-pop-body">
          <div class="dd-pop-err">${data || "No data found for this address."}</div>
          <div class="dd-pop-addr">${short}</div>
          <button class="dd-pop-cta" data-action="open" data-addr="${addr}">Try full analysis →</button>
        </div>
      `;
    }
    const d = data;
    const chg = d.priceChange24h;
    const chgCls = chg >= 0 ? "dd-up" : "dd-down";
    return `
      <div class="dd-pop-header">
        ${d.imageUrl ? `<img class="dd-pop-logo" src="${d.imageUrl}" alt="" onerror="this.style.display='none'" />` : `<img class="dd-pop-logo" src="${chrome.runtime.getURL("icons/icon-32.png")}" alt="" />`}
        <div class="dd-pop-titlewrap">
          <div class="dd-pop-name">${escapeHtml(d.name || "Token")}</div>
          <div class="dd-pop-sym">$${escapeHtml(d.symbol || "")} ${chainBadgeHtml(d.chain, d.chainLabel)}</div>
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
          <div class="dd-pop-cell-val ${chgCls}">${fmtPct(chg)}</div>
        </div>
      </div>
      <div class="dd-pop-foot">
        <button class="dd-pop-cta" data-action="open" data-addr="${addr}" data-chain="${d.chain || ""}">Open full report →</button>
        <div class="dd-pop-addr">${short}</div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showPopover(chip, addr) {
    activeChip = chip;
    cancelHide();
    const pop = ensurePopover();
    pop.innerHTML = popoverHtml("loading", addr);
    pop.classList.add("dd-pop-visible");
    positionPopover(chip);

    quickCheck(addr).then((resp) => {
      if (activeChip !== chip) return;
      if (resp?.ok && resp.data) {
        pop.innerHTML = popoverHtml("ok", addr, resp.data);
      } else {
        pop.innerHTML = popoverHtml("error", addr, resp?.error || null);
      }
      // re-bind the CTA
      const cta = pop.querySelector(".dd-pop-cta");
      if (cta) {
        cta.addEventListener("click", () => {
          chrome.runtime.sendMessage({
            type: "OPEN_REPORT",
            address: cta.getAttribute("data-addr"),
            chain: cta.getAttribute("data-chain") || null,
          });
        });
      }
      positionPopover(chip);
    });
  }

  function positionPopover(chip) {
    if (!popoverEl || !chip) return;
    const r = chip.getBoundingClientRect();
    const popH = popoverEl.offsetHeight || 180;
    const popW = popoverEl.offsetWidth || 320;
    const margin = 8;

    let top = r.bottom + margin + window.scrollY;
    let left = r.left + window.scrollX;

    // Flip up if no room below
    if (r.bottom + popH + margin > window.innerHeight) {
      top = r.top - popH - margin + window.scrollY;
    }
    // Clamp horizontally
    if (left + popW + margin > window.scrollX + window.innerWidth) {
      left = window.scrollX + window.innerWidth - popW - margin;
    }
    if (left < window.scrollX + margin) left = window.scrollX + margin;

    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;
  }

  function scheduleHide() {
    cancelHide();
    popoverHideTimer = setTimeout(() => {
      if (popoverEl) popoverEl.classList.remove("dd-pop-visible");
      activeChip = null;
    }, 220);
  }

  function cancelHide() {
    if (popoverHideTimer) {
      clearTimeout(popoverHideTimer);
      popoverHideTimer = null;
    }
  }

  // ---------------- DOM scan + wrap ----------------
  function wrapTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || text.length < 32) return;
    if (!COMBINED.test(text)) return;
    COMBINED.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let m;
    let added = false;
    while ((m = COMBINED.exec(text)) !== null) {
      const matchText = m[0];
      if (!looksLikeRealCa(matchText)) continue;

      // text before
      if (m.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
      }
      const chip = document.createElement("dd-ca");
      chip.className = "dd-ca";
      chip.textContent = matchText;
      chip.setAttribute("data-addr", matchText);
      chip.addEventListener("mouseenter", () => showPopover(chip, matchText));
      chip.addEventListener("mouseleave", scheduleHide);
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        chrome.runtime.sendMessage({ type: "OPEN_REPORT", address: matchText });
      });
      frag.appendChild(chip);
      lastIdx = m.index + matchText.length;
      added = true;
    }
    if (!added) return;
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }

  function shouldSkip(node) {
    if (!node || !node.parentNode) return true;
    let el = node.parentElement;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.isContentEditable) return true;
      if (el.classList && (el.classList.contains("dd-ca") || el.classList.contains("dd-popover"))) return true;
      el = el.parentElement;
    }
    return false;
  }

  function scan(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkip(node)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || node.nodeValue.length < 32) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);
    targets.forEach(wrapTextNode);
  }

  // Initial pass
  scan(document.body);

  // Watch for new content (X timeline, Discord chat, etc.)
  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      mut.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.classList && node.classList.contains("dd-ca")) return;
          scan(node);
        } else if (node.nodeType === Node.TEXT_NODE) {
          if (!shouldSkip(node)) wrapTextNode(node);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Hide popover on scroll/click outside
  document.addEventListener("scroll", scheduleHide, { passive: true, capture: true });
})();
