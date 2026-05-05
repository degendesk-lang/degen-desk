/**
 * Degen Desk - Insider Tracker frontend
 *
 * GETs /api/insiders?ca=<mint> and renders summary + first-50 buyers.
 * No auth required.
 */
(function () {
  "use strict";

  const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  const $ = (id) => document.getElementById(id);
  const input = $("ins-input");
  const pasteBtn = $("ins-paste");
  const goBtn = $("ins-go");
  const errorBox = $("ins-error");
  const loading = $("ins-loading");
  const summarySection = $("ins-summary-section");
  const summaryEl = $("ins-summary");
  const listSection = $("ins-list-section");
  const listEl = $("ins-list");
  const listTitle = $("ins-list-title");

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 4) + "…" + a.slice(-4);
  }

  function fmtSol(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (v >= 1000) return v.toFixed(0) + " SOL";
    if (v >= 1) return v.toFixed(2) + " SOL";
    return v.toFixed(4) + " SOL";
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    return (Number(n) * 100).toFixed(0) + "%";
  }

  function fmtTime(ts) {
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  }

  function fmtUnits(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
    if (v >= 1) return v.toFixed(2);
    return v.toPrecision(3);
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }

  input.addEventListener("input", () => {
    clearError();
    goBtn.disabled = !SOLANA_ADDR_RE.test(input.value.trim());
  });
  pasteBtn.addEventListener("click", async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        input.value = t.trim();
        input.dispatchEvent(new Event("input"));
      }
    } catch {}
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !goBtn.disabled) run();
  });
  goBtn.addEventListener("click", run);

  function autoLoadFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const ca = params.get("ca") || params.get("addr");
    if (ca && SOLANA_ADDR_RE.test(ca)) {
      input.value = ca;
      goBtn.disabled = false;
      run();
    }
  }

  async function run() {
    clearError();
    summarySection.hidden = true;
    listSection.hidden = true;
    const ca = input.value.trim();
    if (!SOLANA_ADDR_RE.test(ca)) {
      showError("Enter a valid Solana token contract address.");
      return;
    }
    goBtn.disabled = true;
    loading.hidden = false;

    const url = new URL(window.location.href);
    url.searchParams.set("ca", ca);
    window.history.replaceState({}, "", url.toString());

    try {
      const res = await fetch(`/api/insiders?ca=${encodeURIComponent(ca)}`);
      const data = await res.json().catch(() => ({}));
      loading.hidden = true;

      if (!res.ok) {
        showError(data?.error || `Lookup failed (${res.status})`);
        goBtn.disabled = false;
        return;
      }

      renderSummary(data);
      renderList(data);
    } catch (err) {
      loading.hidden = true;
      console.error("Insider fetch error:", err);
      showError("Network error. Try again in a moment.");
    } finally {
      goBtn.disabled = false;
    }
  }

  function severityForKolPct(pct) {
    if (pct >= 0.30) return "pos";   // 30%+ smart money = strongly sniped
    if (pct >= 0.15) return "warn";  // 15-30% = some smart money
    return "danger";                 // <15% = retail-led
  }

  function verdictText(pct, count, total) {
    if (total === 0) return "No buyers found in the walked window.";
    if (pct >= 0.30) return `${count} of ${total} early buyers are ranked smart money — that's a strong snipe pattern.`;
    if (pct >= 0.15) return `${count} of ${total} early buyers are ranked smart money — moderate KOL interest at launch.`;
    if (pct > 0) return `Only ${count} of ${total} early buyers match a kolscan KOL — mostly retail-led entry.`;
    return `None of the first ${total} buyers are ranked KOLs we recognize. Could be retail FOMO, sniper bots, or fresh wallets we haven't indexed.`;
  }

  function renderSummary(data) {
    const s = data.summary || {};
    const sev = severityForKolPct(s.kolMatchPct || 0);
    const verdict = verdictText(s.kolMatchPct || 0, s.kolMatchCount || 0, s.firstNCount || 0);
    summarySection.hidden = false;
    summaryEl.innerHTML = `
      <div class="ins-summary">
        <div class="ins-stat">
          <div class="ins-stat-label">Buyers analyzed</div>
          <div class="ins-stat-value">${s.firstNCount || 0}</div>
          <div class="ins-stat-sub">earliest in our window</div>
        </div>
        <div class="ins-stat">
          <div class="ins-stat-label">Ranked KOL matches</div>
          <div class="ins-stat-value ${sev}">${s.kolMatchCount || 0}</div>
          <div class="ins-stat-sub">of ${s.firstNCount || 0} early buyers</div>
        </div>
        <div class="ins-stat">
          <div class="ins-stat-label">Smart money %</div>
          <div class="ins-stat-value ${sev}">${fmtPct(s.kolMatchPct)}</div>
          <div class="ins-stat-sub">of early buyers ranked on kolscan</div>
        </div>
        <div class="ins-stat">
          <div class="ins-stat-label">Pages walked</div>
          <div class="ins-stat-value">${data.pagesWalked || 0}</div>
          <div class="ins-stat-sub">${data.reachedLaunch ? "reached launch" : "didn't reach launch (high-volume token)"}</div>
        </div>
      </div>
      <div style="margin-top:14px; padding:12px 16px; border-radius:10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); font-size:13.5px; line-height:1.5;">
        <strong style="color:#f0f0f8;">Verdict:</strong>
        <span style="color:rgba(240,240,248,0.85); margin-left:6px;">${escapeHtml(verdict)}</span>
      </div>
    `;
  }

  function renderList(data) {
    const buyers = data.firstBuyers || [];
    listSection.hidden = false;
    listTitle.textContent = `First ${buyers.length} buyers (oldest → newest)`;
    if (buyers.length === 0) {
      listEl.innerHTML = `<div class="ins-empty">No buyer transactions found in the walked window.</div>`;
      return;
    }
    listEl.innerHTML = buyers
      .map((b) => {
        const isKol = !!b.kol;
        const walletUrl = `/wallet-analysis.html?wallet=${encodeURIComponent(b.wallet)}`;
        const txUrl = `https://solscan.io/tx/${encodeURIComponent(b.signature)}`;
        const ranks = b.kol?.ranks || {};
        const rankParts = [];
        if (ranks.daily) rankParts.push(`D #${ranks.daily}`);
        if (ranks.weekly) rankParts.push(`W #${ranks.weekly}`);
        if (ranks.monthly) rankParts.push(`M #${ranks.monthly}`);
        const handleStr =
          isKol && b.kol.twitter
            ? `<a href="https://x.com/${escapeHtml(b.kol.twitter)}" target="_blank" rel="noopener" style="color:#d6c8ff; text-decoration:none; font-weight:600;">@${escapeHtml(b.kol.twitter)}</a>`
            : "";
        const kolTag = isKol
          ? `<span class="ins-kol-tag">KOL${b.kol.name ? " · " + escapeHtml(b.kol.name) : ""}</span>`
          : "";
        return `
          <div class="ins-row ${isKol ? "kol" : ""}">
            <span class="ins-rank-num">#${b.rank}</span>
            <span class="ins-wallet">${escapeHtml(shortAddr(b.wallet))}</span>
            ${kolTag}
            ${handleStr}
            ${rankParts.length ? `<span style="font-size:11px; color:rgba(240,240,248,0.55);">${rankParts.join(" · ")}</span>` : ""}
            <span class="ins-meta">${fmtSol(b.solSpent)} · ${fmtUnits(b.tokensReceived)} units · ${fmtTime(b.ts)}</span>
            <span class="ins-actions">
              <a href="${walletUrl}">analyze →</a>
              <a href="${txUrl}" target="_blank" rel="noopener">tx ↗</a>
            </span>
          </div>
        `;
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", autoLoadFromQuery);
  if (document.readyState === "interactive" || document.readyState === "complete") autoLoadFromQuery();
})();
