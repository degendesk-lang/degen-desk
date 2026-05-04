/**
 * Degen Desk - KOL Alpha Feed frontend
 *
 * Renders /api/kol-feed: ranked-KOL X posts + consensus CA signal.
 * No auth required (read-only public data).
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const refreshBtn = $("kf-refresh-btn");
  const statEl = $("kf-stat");
  const loadingEl = $("kf-loading");
  const consensusSection = $("kf-consensus-section");
  const consensusList = $("kf-consensus-list");
  const feedSection = $("kf-feed-section");
  const feedEl = $("kf-feed");

  const SOLANA_CA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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

  function timeAgo(ts) {
    const sec = Math.max(0, (Date.now() - ts) / 1000);
    if (sec < 60) return `${Math.floor(sec)}s`;
    const min = sec / 60;
    if (min < 60) return `${Math.floor(min)}m`;
    const hr = min / 60;
    if (hr < 24) return `${hr.toFixed(1)}h`;
    return `${(hr / 24).toFixed(1)}d`;
  }

  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    return "$" + v.toFixed(0);
  }

  // Highlight URLs and @mentions in post text. Be defensive — text may be
  // malformed since RSS extraction is regex-based.
  function linkifyText(text) {
    if (!text) return "";
    let out = escapeHtml(text);
    // URLs (already plain after RSS strip; just linkify)
    out = out.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener" style="color:#a78bfa;">$1</a>'
    );
    // @handles → x.com profile links
    out = out.replace(
      /@([A-Za-z0-9_]{2,15})\b/g,
      '<a href="https://x.com/$1" target="_blank" rel="noopener" style="color:#a78bfa;">@$1</a>'
    );
    return out;
  }

  function renderConsensus(consensus) {
    if (!consensus || consensus.length === 0) {
      consensusSection.hidden = true;
      return;
    }
    consensusSection.hidden = false;
    consensusList.innerHTML = consensus
      .slice(0, 8)
      .map((c) => {
        const reportUrl =
          c.chain === "evm"
            ? `/token-analysis.html?ca=${encodeURIComponent(c.address)}&chain=ethereum`
            : `/token-analysis.html?ca=${encodeURIComponent(c.address)}&chain=solana`;
        return `
          <div class="kf-consensus-row">
            <div class="num">${c.kolCount}×</div>
            <div class="ca">${escapeHtml(c.address)}</div>
            <div class="kols-count">${c.kols.map((k) => "@" + escapeHtml(k)).join(", ")}</div>
            <a href="${reportUrl}">Analyze →</a>
          </div>
        `;
      })
      .join("");
  }

  function renderPost(p) {
    const xPost = escapeHtml(p.url || `https://x.com/${p.handle}`);
    const walletUrl = p.wallet ? `/wallet-analysis.html?wallet=${encodeURIComponent(p.wallet)}` : null;

    const chips = [];
    for (const ca of p.mentions?.solana || []) {
      // Skip if it doesn't actually look like a CA on a strict check
      if (!SOLANA_CA_RE.test(ca)) continue;
      chips.push(
        `<a class="kf-chip" href="/token-analysis.html?ca=${encodeURIComponent(ca)}&chain=solana" title="Open Token Analysis">${shortAddr(ca)}</a>`
      );
    }
    for (const ca of p.mentions?.evm || []) {
      chips.push(
        `<a class="kf-chip evm" href="/token-analysis.html?ca=${encodeURIComponent(ca)}&chain=ethereum" title="Open Token Analysis">${shortAddr(ca)}</a>`
      );
    }
    for (const tk of p.mentions?.tickers || []) {
      chips.push(`<span class="kf-chip ticker">${escapeHtml(tk)}</span>`);
    }

    const pnl =
      p.pnlUsd != null
        ? `<span class="kf-pnl">${p.pnlUsd >= 0 ? "+" : ""}${fmtUsd(p.pnlUsd)}</span>`
        : "";

    return `
      <div class="kf-post">
        <div class="kf-post-head">
          <span class="kf-rank-badge">#${p.rank ?? "—"}</span>
          <a class="kf-handle" href="https://x.com/${escapeHtml(p.handle)}" target="_blank" rel="noopener">@${escapeHtml(p.handle)}</a>
          ${p.name ? `<span class="kf-name">${escapeHtml(p.name)}</span>` : ""}
          ${pnl}
          <span class="kf-time">${timeAgo(p.ts)} ago</span>
        </div>
        <div class="kf-text">${linkifyText(p.text)}</div>
        ${chips.length ? `<div class="kf-mentions">${chips.join("")}</div>` : ""}
        <div class="kf-post-actions">
          <a class="kf-action" href="${xPost}" target="_blank" rel="noopener">Open on X ↗</a>
          ${walletUrl ? `<a class="kf-action" href="${walletUrl}">Wallet →</a>` : ""}
        </div>
      </div>
    `;
  }

  function renderFeed(posts) {
    if (!posts || posts.length === 0) {
      feedSection.hidden = false;
      feedEl.innerHTML = `<div class="kf-empty">No posts in the lookback window. Try Refresh in a minute or two — Nitter instances can be flaky.</div>`;
      return;
    }
    feedSection.hidden = false;
    feedEl.innerHTML = posts.map(renderPost).join("");
  }

  async function load() {
    loadingEl.hidden = false;
    consensusSection.hidden = true;
    feedSection.hidden = true;
    statEl.textContent = "";

    try {
      const res = await fetch("/api/kol-feed", { method: "GET" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        feedEl.innerHTML = `<div class="kf-empty">${escapeHtml(data?.error || "Couldn't load the feed.")}</div>`;
        feedSection.hidden = false;
        return;
      }

      renderConsensus(data.consensus);
      renderFeed(data.posts);

      const updated = data.generatedAt ? new Date(data.generatedAt) : new Date();
      statEl.textContent = `${data.kolsWithPosts || 0}/${data.kolsFollowed || 0} KOLs · ${data.posts?.length || 0} posts · updated ${updated.toLocaleTimeString()}${data.cached ? " (cached)" : ""}`;
    } catch (err) {
      console.error("KOL feed load error:", err);
      feedEl.innerHTML = `<div class="kf-empty">Network error. Try Refresh.</div>`;
      feedSection.hidden = false;
    } finally {
      loadingEl.hidden = true;
    }
  }

  refreshBtn.addEventListener("click", load);
  document.addEventListener("DOMContentLoaded", load);
  if (document.readyState === "interactive" || document.readyState === "complete") load();
})();
