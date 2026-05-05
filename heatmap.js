/**
 * Degen Desk - Smart Money Heatmap frontend
 *
 * GETs /api/heatmap and renders the consensus list.
 * No auth required (read-only public data).
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const loading = $("hm-loading");
  const section = $("hm-section");
  const listEl = $("hm-list");
  const sectionTitle = $("hm-section-title");
  const statBar = $("hm-stat-bar");

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 4) + "…" + a.slice(-4);
  }

  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    if (Math.abs(v) >= 1) return "$" + v.toFixed(0);
    return "$" + v.toFixed(2);
  }

  function heatTier(kolCount) {
    if (kolCount >= 7) return "scorching";
    if (kolCount >= 5) return "hot";
    return "";
  }

  function rankStr(rank) {
    if (rank == null) return "?";
    return "#" + rank;
  }

  // Symbols that masquerade as major tokens. If a token uses any of these
  // symbols but ISN'T the canonical mint, that's a scam-impersonation signal.
  const MAJOR_IMPERSONATION_SYMBOLS = new Set([
    "USDC", "USDT", "SOL", "WSOL", "BTC", "WBTC", "ETH", "WETH", "BONK", "JUP", "PYTH",
  ]);
  const CANONICAL_MAJORS = new Set([
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    "So11111111111111111111111111111111111111112",  // wSOL
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JUP
    "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", // PYTH
  ]);

  function isImpersonator(token) {
    const sym = (token.symbol || "").trim().toUpperCase();
    if (!MAJOR_IMPERSONATION_SYMBOLS.has(sym)) return false;
    return !CANONICAL_MAJORS.has(token.mint);
  }

  function renderRow(token) {
    const reportUrl = `/token-analysis.html?ca=${encodeURIComponent(token.mint)}&chain=solana`;
    const dexUrl = `https://dexscreener.com/solana/${encodeURIComponent(token.mint)}`;
    const heat = heatTier(token.kolCount);
    const fake = isImpersonator(token);
    const img = token.image
      ? `<img class="hm-token-img" src="${escapeHtml(token.image)}" alt="" onerror="this.style.display='none'"/>`
      : `<div class="hm-token-img"></div>`;
    const valueLabel =
      token.totalValueUsd && token.totalValueUsd > 0
        ? `${fmtUsd(token.totalValueUsd)} held`
        : `<span style="color:rgba(255,204,51,0.85);">price not indexed yet</span>`;

    const holderChips = token.holders
      .slice(0, 12)
      .map((h) => {
        const handle = h.twitter
          ? `@${escapeHtml(h.twitter)}`
          : escapeHtml(h.name || shortAddr(h.wallet));
        const walletUrl = `/wallet-analysis.html?wallet=${encodeURIComponent(h.wallet)}`;
        return `
          <a class="hm-holder-chip" href="${walletUrl}" title="See ${handle}'s full holdings">
            <span class="rank">${rankStr(h.rank)}</span>
            <span>${handle}</span>
            <span class="val">${h.valueUsd != null ? fmtUsd(h.valueUsd) : "—"}</span>
          </a>
        `;
      })
      .join("");

    const moreHolders =
      token.holders.length > 12
        ? `<span style="font-size:11px; color:rgba(240,240,248,0.45); align-self:center;">+${token.holders.length - 12} more</span>`
        : "";

    const fakeBadge = fake
      ? `<span style="background: rgba(255,85,85,0.15); border: 1px solid rgba(255,85,85,0.40); color:#ffb8b8; font-size:10.5px; font-weight:700; padding:3px 8px; border-radius:999px; margin-left:6px;" title="This token uses the symbol of a major token but is not the canonical mint. Likely an impersonation memecoin.">⚠️ FAKE ${escapeHtml(token.symbol)}</span>`
      : "";

    return `
      <div class="hm-row">
        <div class="hm-row-head">
          ${img}
          <div class="hm-token-meta">
            <div class="hm-symbol">${escapeHtml(token.symbol)}${fakeBadge}</div>
            <div class="hm-name">${escapeHtml(token.name || "")}</div>
          </div>
          <span class="hm-kol-count ${heat}">${token.kolCount} KOLs</span>
          <span class="hm-value">${valueLabel}</span>
        </div>
        <div class="hm-holders">${holderChips}${moreHolders}</div>
        <div class="hm-row-actions">
          <a class="primary" href="${reportUrl}">Run Token Analysis →</a>
          <a href="${dexUrl}" target="_blank" rel="noopener">DexScreener ↗</a>
          <span style="margin-left:auto; font-size:11px; font-family:'JetBrains Mono', monospace; color:rgba(240,240,248,0.45);">${escapeHtml(shortAddr(token.mint))}</span>
        </div>
      </div>
    `;
  }

  async function load() {
    loading.hidden = false;
    section.hidden = true;
    statBar.innerHTML = "";

    try {
      const res = await fetch("/api/heatmap");
      const data = await res.json().catch(() => ({}));
      loading.hidden = true;

      if (!res.ok) {
        section.hidden = false;
        listEl.innerHTML = `<div class="hm-empty">${escapeHtml(data?.error || "Couldn't load heatmap.")}</div>`;
        return;
      }

      const consensus = data.consensus || [];
      const updated = data.generatedAt ? new Date(data.generatedAt) : new Date();
      statBar.innerHTML = `
        <span><strong>${data.kolsAnalyzed || 0}</strong> KOLs analyzed</span>
        <span>·</span>
        <span><strong>${data.kolsWithHoldings || 0}</strong> with on-chain holdings</span>
        <span>·</span>
        <span><strong>${consensus.length}</strong> consensus tokens (${data.minKolCount || 3}+ KOLs holding)</span>
        <span>·</span>
        <span>updated ${updated.toLocaleTimeString()}${data.cached ? " (cached)" : ""}</span>
      `;

      section.hidden = false;
      sectionTitle.textContent = `Tokens held by ${data.minKolCount || 3}+ ranked KOLs simultaneously`;

      if (consensus.length === 0) {
        listEl.innerHTML = `<div class="hm-empty">No consensus tokens right now. Either the smart money isn't lined up on anything fresh, or holdings just refreshed. Check back in 10 minutes.</div>`;
        return;
      }

      listEl.innerHTML = consensus.map(renderRow).join("");
    } catch (err) {
      console.error("Heatmap load error:", err);
      loading.hidden = true;
      section.hidden = false;
      listEl.innerHTML = `<div class="hm-empty">Network error. Refresh to try again.</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", load);
  if (document.readyState === "interactive" || document.readyState === "complete") load();
})();
