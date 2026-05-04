/**
 * Smart Money Tracker - frontend
 *
 * Renders /api/kol-feed as a ranked leaderboard with one-click drill-downs
 * into Wallet Analyzer (see what they're holding right now) and X profile.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const refreshBtn = $("kf-refresh-btn");
  const statEl = $("kf-stat");
  const loadingEl = $("kf-loading");
  const feedSection = $("kf-feed-section");
  const feedEl = $("kf-feed");
  const tabs = document.querySelectorAll("[data-tf]");

  let currentTimeframe = "weekly";

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    const sign = v < 0 ? "-" : "+";
    const abs = Math.abs(v);
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }

  function fmtSol(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    const sign = v < 0 ? "-" : "+";
    return `${sign}${Math.abs(v).toFixed(1)} SOL`;
  }

  function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 4) + "…" + a.slice(-4);
  }

  function rankMedal(rank) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  }

  function renderRow(k) {
    const xUrl = k.twitter ? `https://x.com/${escapeHtml(k.twitter)}` : null;
    const walletUrl = k.wallet ? `/wallet-analysis.html?wallet=${encodeURIComponent(k.wallet)}` : null;
    const pnlClass = (k.pnlUsd ?? 0) >= 0 ? "pos" : "neg";
    return `
      <div class="kf-post">
        <div class="kf-post-head">
          <span class="kf-rank-badge">${rankMedal(k.rank)}</span>
          ${k.twitter ? `<a class="kf-handle" href="${xUrl}" target="_blank" rel="noopener">@${escapeHtml(k.twitter)}</a>` : `<span class="kf-handle">${escapeHtml(k.name || "Unknown")}</span>`}
          ${k.name && k.twitter ? `<span class="kf-name">${escapeHtml(k.name)}</span>` : ""}
          <span class="kf-time" style="font-family: 'JetBrains Mono', monospace;">${escapeHtml(shortAddr(k.wallet))}</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin-top:6px;">
          <div>
            <div style="font-size:10.5px; color:rgba(240,240,248,0.5); text-transform:uppercase; letter-spacing:0.06em;">PnL</div>
            <div class="kf-pnl ${pnlClass}" style="font-size:15px; font-weight:700;">${fmtUsd(k.pnlUsd)}</div>
            <div style="font-size:11px; color:rgba(240,240,248,0.45);">${fmtSol(k.pnlSol)}</div>
          </div>
          ${
            k.wins != null && k.losses != null
              ? `<div>
                   <div style="font-size:10.5px; color:rgba(240,240,248,0.5); text-transform:uppercase; letter-spacing:0.06em;">Win Rate</div>
                   <div style="font-size:15px; font-weight:700;">${k.winRate || "—"}</div>
                   <div style="font-size:11px; color:rgba(240,240,248,0.45);">${k.wins}W · ${k.losses}L</div>
                 </div>`
              : ""
          }
        </div>
        <div class="kf-post-actions" style="margin-top:10px;">
          ${walletUrl ? `<a class="kf-action" href="${walletUrl}" style="background: rgba(0,255,136,0.10); border: 1px solid rgba(0,255,136,0.25); color: #6effae; padding: 5px 12px; border-radius: 999px; font-weight: 600;">See holdings →</a>` : ""}
          ${xUrl ? `<a class="kf-action" href="${xUrl}" target="_blank" rel="noopener">Open on X ↗</a>` : ""}
        </div>
      </div>
    `;
  }

  function renderFeed(kols) {
    if (!kols || kols.length === 0) {
      feedSection.hidden = false;
      feedEl.innerHTML = `<div class="kf-empty">No KOL data right now. Try Refresh in a moment.</div>`;
      return;
    }
    feedSection.hidden = false;
    feedEl.innerHTML = kols.map(renderRow).join("");
  }

  async function load() {
    loadingEl.hidden = false;
    feedSection.hidden = true;
    statEl.textContent = "";

    try {
      const res = await fetch(`/api/kol-feed?timeframe=${currentTimeframe}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        feedEl.innerHTML = `<div class="kf-empty">${escapeHtml(data?.error || "Couldn't load.")}</div>`;
        feedSection.hidden = false;
        return;
      }
      renderFeed(data.kols);
      const updated = data.generatedAt ? new Date(data.generatedAt) : new Date();
      statEl.textContent = `${data.count || 0} KOLs · ${currentTimeframe} · updated ${updated.toLocaleTimeString()}${data.cached ? " (cached)" : ""}`;
    } catch (err) {
      console.error("Smart Money load error:", err);
      feedEl.innerHTML = `<div class="kf-empty">Network error. Try Refresh.</div>`;
      feedSection.hidden = false;
    } finally {
      loadingEl.hidden = true;
    }
  }

  refreshBtn.addEventListener("click", load);
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      currentTimeframe = t.dataset.tf;
      load();
    });
  });
  document.addEventListener("DOMContentLoaded", load);
  if (document.readyState === "interactive" || document.readyState === "complete") load();
})();
