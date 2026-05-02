/**
 * Degen Desk - Wallet Analyzer frontend
 *
 * Talks to /api/wallet-analysis. Free with daily limits, unlimited for Pro.
 * Anonymous users can analyze too — uid is sent only if signed in.
 */
(function () {
  "use strict";

  const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  const $ = (id) => document.getElementById(id);
  const input = $("wa-addr-input");
  const pasteBtn = $("wa-paste-btn");
  const analyzeBtn = $("wa-analyze-btn");
  const errorBox = $("wa-input-error");
  const loading = $("wa-loading");
  const report = $("wa-report");
  const btnCount = $("wa-btn-count");

  // ---------- helpers ----------
  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }
  function setLoading(on) {
    loading.hidden = !on;
    if (on) report.hidden = true;
  }
  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    if (Math.abs(v) >= 1) return "$" + v.toFixed(2);
    if (v === 0) return "$0";
    return "$" + v.toFixed(6);
  }
  function fmtSol(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    const sign = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    if (abs >= 1000) return sign + abs.toFixed(0) + " SOL";
    if (abs >= 1) return sign + abs.toFixed(2) + " SOL";
    return sign + abs.toFixed(4) + " SOL";
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
  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    return (Number(n) * 100).toFixed(1) + "%";
  }
  function fmtHold(seconds) {
    if (!seconds || seconds <= 0) return "—";
    const m = seconds / 60;
    if (m < 60) return m.toFixed(0) + "m";
    const h = m / 60;
    if (h < 24) return h.toFixed(1) + "h";
    const d = h / 24;
    if (d < 30) return d.toFixed(1) + "d";
    return (d / 30).toFixed(1) + "mo";
  }
  function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 4) + "…" + a.slice(-4);
  }
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function convictionLabel(c) {
    return (
      {
        scalper: "Scalper (avg hold &lt; 1h)",
        day_trader: "Day trader (avg hold &lt; 1d)",
        swing: "Swing trader (avg hold &lt; 1w)",
        diamond_hands: "Diamond hands (avg hold &gt; 1w)",
        balanced: "Balanced",
      }[c] || "Unknown"
    );
  }

  // ---------- input handling ----------
  input.addEventListener("input", () => {
    clearError();
    const v = input.value.trim();
    analyzeBtn.disabled = !SOLANA_ADDR_RE.test(v);
  });

  pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        input.value = text.trim();
        input.dispatchEvent(new Event("input"));
      }
    } catch (err) {
      // Clipboard read denied — fall back silently
    }
  });

  // Auto-analyze if ?wallet=... is in the URL
  function autoLoadFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("wallet") || params.get("addr");
    if (w && SOLANA_ADDR_RE.test(w)) {
      input.value = w;
      analyzeBtn.disabled = false;
      runAnalysis();
    }
  }

  analyzeBtn.addEventListener("click", runAnalysis);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !analyzeBtn.disabled) runAnalysis();
  });

  // ---------- main flow ----------
  async function runAnalysis() {
    clearError();
    const addr = input.value.trim();
    if (!SOLANA_ADDR_RE.test(addr)) {
      showError("That doesn't look like a valid Solana wallet address.");
      return;
    }

    analyzeBtn.disabled = true;
    setLoading(true);

    // Sequence loading-step highlights for visual feedback
    const stepEls = document.querySelectorAll(".ta-loading-step");
    stepEls.forEach((el) => el.classList.remove("active", "done"));
    const stepOrder = ["balance", "txs", "kol", "synth"];
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      if (stepIdx > 0) {
        const prev = document.querySelector(`.ta-loading-step[data-step="${stepOrder[stepIdx - 1]}"]`);
        if (prev) prev.classList.add("done");
      }
      const cur = document.querySelector(`.ta-loading-step[data-step="${stepOrder[stepIdx]}"]`);
      if (cur) cur.classList.add("active");
      stepIdx++;
      if (stepIdx >= stepOrder.length) clearInterval(stepInterval);
    }, 1100);

    try {
      // uid is optional — only sent if user is signed in
      const uid = window.firebase?.auth?.()?.currentUser?.uid || null;

      const res = await fetch("/api/wallet-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, uid }),
      });

      clearInterval(stepInterval);
      stepEls.forEach((el) => el.classList.add("done"));

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || `Request failed (${res.status})`;
        showError(msg);
        setLoading(false);
        analyzeBtn.disabled = false;
        return;
      }

      renderReport(data);
      updateBtnCount(data);
      // Reflect the analyzed wallet in the URL so it's shareable
      const url = new URL(window.location.href);
      url.searchParams.set("wallet", addr);
      window.history.replaceState({}, "", url.toString());
    } catch (err) {
      clearInterval(stepInterval);
      console.error("Wallet analysis failed:", err);
      showError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      analyzeBtn.disabled = false;
    }
  }

  function updateBtnCount(data) {
    if (data?.dailyCap && data?.analysesUsedToday != null) {
      btnCount.textContent = `${data.analysesUsedToday}/${data.dailyCap} today`;
    } else {
      btnCount.textContent = "";
    }
  }

  // ---------- rendering ----------
  function renderReport(data) {
    const parts = [];

    // Header card
    parts.push(`
      <div class="wa-section">
        <div style="display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-size:11px; color:rgba(240,240,248,0.55); text-transform:uppercase; letter-spacing:0.06em;">Wallet</div>
            <div class="wa-mono wa-addr" style="font-size:13px; margin-top:4px;">${escapeHtml(data.address)}</div>
            <div style="margin-top:8px;">
              <a href="${escapeHtml(data.explorerUrl)}" target="_blank" rel="noopener" style="font-size:12px; color:#a78bfa; text-decoration:none;">Open in Solscan ↗</a>
            </div>
          </div>
          <div>
            ${renderKolBadge(data.kol)}
          </div>
        </div>
        ${renderStatGrid(data)}
      </div>
    `);

    // Smart money signals
    parts.push(renderSignals(data.signals));

    // Holdings
    parts.push(renderHoldings(data.holdings, data.sol));

    // Trades / per-token PnL
    parts.push(renderTrades(data.trades));

    report.innerHTML = parts.join("");
    report.hidden = false;
    report.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderKolBadge(kol) {
    if (!kol) return "";
    const ranks = kol.ranks || {};
    const rankParts = [];
    if (ranks.daily) rankParts.push(`D #${ranks.daily}`);
    if (ranks.weekly) rankParts.push(`W #${ranks.weekly}`);
    if (ranks.monthly) rankParts.push(`M #${ranks.monthly}`);
    const rankStr = rankParts.length ? rankParts.join(" · ") : "";
    const social = kol.twitter
      ? `<a href="https://x.com/${escapeHtml(kol.twitter.replace(/^@/, ""))}" target="_blank" rel="noopener" style="color:#d6c8ff; margin-left:8px; text-decoration:none;">@${escapeHtml(kol.twitter.replace(/^@/, ""))}</a>`
      : "";
    return `
      <div class="wa-kol-badge" title="Matched against the kolscan top-traders leaderboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/>
        </svg>
        Known KOL${kol.name ? `: ${escapeHtml(kol.name)}` : ""}${social}
        ${rankStr ? `<span style="opacity:0.75; margin-left:8px;">${rankStr}</span>` : ""}
      </div>
    `;
  }

  function renderStatGrid(data) {
    const sol = data.sol || {};
    const portfolio = data.portfolio || {};
    const signals = data.signals || {};
    const winRate = signals.winRate;
    const winClass = winRate == null ? "" : winRate >= 0.5 ? "pos" : "neg";
    return `
      <div class="wa-stat-grid">
        <div class="wa-stat">
          <div class="wa-stat-label">SOL Balance</div>
          <div class="wa-stat-value">${fmtSol(sol.balance)}</div>
          <div class="wa-stat-sub">${sol.valueUsd != null ? fmtUsd(sol.valueUsd) : ""}</div>
        </div>
        <div class="wa-stat">
          <div class="wa-stat-label">Token Holdings</div>
          <div class="wa-stat-value">${portfolio.tokenCount ?? 0}</div>
          <div class="wa-stat-sub">${fmtUsd(portfolio.holdingsValueUsd)}</div>
        </div>
        <div class="wa-stat">
          <div class="wa-stat-label">Closed Trades</div>
          <div class="wa-stat-value">${signals.closedCount ?? 0}</div>
          <div class="wa-stat-sub">${signals.wins ?? 0}W · ${signals.losses ?? 0}L</div>
        </div>
        <div class="wa-stat">
          <div class="wa-stat-label">Win Rate</div>
          <div class="wa-stat-value ${winClass}">${winRate == null ? "—" : fmtPct(winRate)}</div>
          <div class="wa-stat-sub">on closed positions</div>
        </div>
      </div>
    `;
  }

  function renderSignals(signals) {
    if (!signals) return "";
    return `
      <div class="wa-section">
        <h3>Smart-Money Signals</h3>
        <div class="wa-signal-grid">
          <div class="wa-signal">
            <div class="wa-signal-label">10× Winners</div>
            <div class="wa-signal-value">${signals.tenXers ?? 0}</div>
          </div>
          <div class="wa-signal">
            <div class="wa-signal-label">5× Winners</div>
            <div class="wa-signal-value">${signals.fiveXers ?? 0}</div>
          </div>
          <div class="wa-signal">
            <div class="wa-signal-label">2× Winners</div>
            <div class="wa-signal-value">${signals.twoXers ?? 0}</div>
          </div>
          <div class="wa-signal">
            <div class="wa-signal-label">Avg Hold</div>
            <div class="wa-signal-value">${fmtHold(signals.avgHoldSeconds)}</div>
          </div>
          <div class="wa-signal" style="grid-column: span 2;">
            <div class="wa-signal-label">Trader Style</div>
            <div class="wa-signal-value" style="font-size:14px;">${convictionLabel(signals.conviction)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderHoldings(holdings, sol) {
    if (!holdings || holdings.length === 0) {
      return `<div class="wa-section"><h3>Current Holdings</h3><div class="wa-empty">No fungible token holdings detected.</div></div>`;
    }
    const rows = holdings
      .slice(0, 25)
      .map((h) => {
        const img = h.image
          ? `<img class="wa-token-img" src="${escapeHtml(h.image)}" alt="" onerror="this.style.display='none'"/>`
          : `<div class="wa-token-img"></div>`;
        return `
          <tr>
            <td>
              <div class="wa-token-cell">
                ${img}
                <div>
                  <div class="wa-token-sym">${escapeHtml(h.symbol)}</div>
                  <div class="wa-token-name">${escapeHtml(h.name || "")}</div>
                </div>
              </div>
            </td>
            <td class="num">${fmtUnits(h.uiAmount)}</td>
            <td class="num">${h.priceUsd != null ? fmtUsd(h.priceUsd) : "—"}</td>
            <td class="num">${h.valueUsd != null ? fmtUsd(h.valueUsd) : "—"}</td>
          </tr>
        `;
      })
      .join("");
    return `
      <div class="wa-section">
        <h3>Current Holdings ${holdings.length > 25 ? `<span style="font-size:11px; color:rgba(240,240,248,0.5); font-weight:500;">(top 25 of ${holdings.length})</span>` : ""}</h3>
        <table class="wa-table">
          <thead>
            <tr>
              <th>Token</th>
              <th style="text-align:right;">Balance</th>
              <th style="text-align:right;">Price</th>
              <th style="text-align:right;">Value</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderTrades(trades) {
    if (!trades || trades.length === 0) {
      return `<div class="wa-section"><h3>Trades (last 100 transactions)</h3><div class="wa-empty">No swap activity detected in the recent transaction window.</div></div>`;
    }
    const rows = trades
      .slice(0, 25)
      .map((t) => {
        const pnl = t.totalPnlSol;
        const cls = pnl > 0 ? "pos" : pnl < 0 ? "neg" : "";
        const mult = t.multiple != null ? t.multiple.toFixed(2) + "×" : "—";
        return `
          <tr>
            <td>
              <div class="wa-token-cell">
                ${t.image ? `<img class="wa-token-img" src="${escapeHtml(t.image)}" alt="" onerror="this.style.display='none'"/>` : `<div class="wa-token-img"></div>`}
                <div>
                  <div class="wa-token-sym">${escapeHtml(t.symbol)}</div>
                  <div class="wa-token-name">${escapeHtml(shortAddr(t.mint))}</div>
                </div>
              </div>
            </td>
            <td class="num">${t.buyCount}/${t.sellCount}</td>
            <td class="num">${fmtSol(t.buys)}</td>
            <td class="num">${fmtSol(t.sells)}</td>
            <td class="num ${cls}">${fmtSol(pnl)}</td>
            <td class="num">${mult}</td>
          </tr>
        `;
      })
      .join("");
    return `
      <div class="wa-section">
        <h3>Per-Token PnL ${trades.length > 25 ? `<span style="font-size:11px; color:rgba(240,240,248,0.5); font-weight:500;">(top 25 of ${trades.length})</span>` : ""}</h3>
        <table class="wa-table">
          <thead>
            <tr>
              <th>Token</th>
              <th style="text-align:right;">Buy/Sell #</th>
              <th style="text-align:right;">Bought</th>
              <th style="text-align:right;">Sold</th>
              <th style="text-align:right;">Net PnL</th>
              <th style="text-align:right;">Multiple</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="font-size:11px; color:rgba(240,240,248,0.45); margin-top:10px;">
          PnL is approximated using average cost basis on the last ~100 transactions. Older trades may not be included. Multiple = (sells + remaining value) / buys.
        </div>
      </div>
    `;
  }

  // ---------- boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    autoLoadFromQuery();
  });
  // In case DOMContentLoaded already fired
  if (document.readyState === "interactive" || document.readyState === "complete") {
    autoLoadFromQuery();
  }
})();
