/**
 * Degen Desk - Copy-Trader Backtest frontend
 *
 * POSTs to /api/backtest with { address, days } and renders the simulated
 * theoretical PnL.
 */
(function () {
  "use strict";

  const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  const $ = (id) => document.getElementById(id);
  const input = $("bt-input");
  const pasteBtn = $("bt-paste");
  const goBtn = $("bt-go");
  const errorBox = $("bt-error");
  const loading = $("bt-loading");
  const summarySection = $("bt-summary-section");
  const summaryEl = $("bt-summary");
  const tradesSection = $("bt-trades-section");
  const tradesEl = $("bt-trades");
  const tfButtons = document.querySelectorAll(".bt-tf-btn");

  let currentDays = 30;

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtSol(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    const sign = v < 0 ? "-" : "+";
    const abs = Math.abs(v);
    if (abs >= 1000) return `${sign}${abs.toFixed(0)} SOL`;
    if (abs >= 1) return `${sign}${abs.toFixed(2)} SOL`;
    return `${sign}${abs.toFixed(4)} SOL`;
  }

  function fmtSolPlain(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (v >= 1000) return v.toFixed(0) + " SOL";
    if (v >= 1) return v.toFixed(2) + " SOL";
    return v.toFixed(4) + " SOL";
  }

  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "";
    const v = Number(n);
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (Math.abs(v) >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    return "$" + v.toFixed(0);
  }

  function fmtMultiple(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toFixed(2) + "×";
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    return (Number(n) * 100).toFixed(1) + "%";
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

  function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 4) + "…" + a.slice(-4);
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
  tfButtons.forEach((b) => {
    b.addEventListener("click", () => {
      tfButtons.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      currentDays = Number(b.dataset.days) || 30;
    });
  });

  function autoLoadFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("wallet") || params.get("addr");
    const d = Number(params.get("days"));
    if (Number.isFinite(d) && d > 0) {
      currentDays = Math.min(30, d);
      tfButtons.forEach((b) => b.classList.toggle("active", Number(b.dataset.days) === currentDays));
    }
    if (w && SOLANA_ADDR_RE.test(w)) {
      input.value = w;
      goBtn.disabled = false;
      run();
    }
  }

  async function run() {
    clearError();
    summarySection.hidden = true;
    tradesSection.hidden = true;
    const wallet = input.value.trim();
    if (!SOLANA_ADDR_RE.test(wallet)) {
      showError("That doesn't look like a valid Solana wallet address.");
      return;
    }
    goBtn.disabled = true;
    loading.hidden = false;

    const url = new URL(window.location.href);
    url.searchParams.set("wallet", wallet);
    url.searchParams.set("days", String(currentDays));
    window.history.replaceState({}, "", url.toString());

    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet, days: currentDays }),
      });
      const data = await res.json().catch(() => ({}));
      loading.hidden = true;
      if (!res.ok) {
        showError(data?.error || `Backtest failed (${res.status})`);
        goBtn.disabled = false;
        return;
      }
      renderSummary(data);
      renderTrades(data);
    } catch (err) {
      loading.hidden = true;
      console.error("Backtest error:", err);
      showError("Network error. Try again in a moment.");
    } finally {
      goBtn.disabled = false;
    }
  }

  function renderSummary(d) {
    const s = d.summary || {};
    const solPriceUsd = d.solPriceUsd || null;
    const netClass = (s.netPnlSol || 0) >= 0 ? "pos" : "neg";
    const netUsd = solPriceUsd ? (s.netPnlSol || 0) * solPriceUsd : null;
    const deployedUsd = solPriceUsd ? (s.deployedSol || 0) * solPriceUsd : null;
    summarySection.hidden = false;
    summaryEl.innerHTML = `
      <div class="bt-summary-grid">
        <div class="bt-stat">
          <div class="bt-stat-label">SOL Deployed</div>
          <div class="bt-stat-value">${fmtSolPlain(s.deployedSol)}</div>
          <div class="bt-stat-sub">${deployedUsd != null ? fmtUsd(deployedUsd) : ""} across ${d.tokenCount || 0} tokens</div>
        </div>
        <div class="bt-stat">
          <div class="bt-stat-label">Net PnL (theoretical)</div>
          <div class="bt-stat-value ${netClass}">${fmtSol(s.netPnlSol)}</div>
          <div class="bt-stat-sub">${netUsd != null ? (netUsd >= 0 ? "+" : "") + fmtUsd(netUsd) : ""}</div>
        </div>
        <div class="bt-stat">
          <div class="bt-stat-label">Multiple</div>
          <div class="bt-stat-value ${(s.overallMultiple || 0) >= 1 ? "pos" : "neg"}">${fmtMultiple(s.overallMultiple)}</div>
          <div class="bt-stat-sub">total return ÷ deployed</div>
        </div>
        <div class="bt-stat">
          <div class="bt-stat-label">Win Rate</div>
          <div class="bt-stat-value">${s.winRate == null ? "—" : fmtPct(s.winRate)}</div>
          <div class="bt-stat-sub">${s.winnersClosed ?? 0}W of ${s.closedTradeCount ?? 0} closed</div>
        </div>
        <div class="bt-stat">
          <div class="bt-stat-label">Realized</div>
          <div class="bt-stat-value">${fmtSol(s.realizedSol)}</div>
          <div class="bt-stat-sub">closed positions only</div>
        </div>
        <div class="bt-stat">
          <div class="bt-stat-label">Unrealized</div>
          <div class="bt-stat-value">${fmtSol(s.unrealizedSol)}</div>
          <div class="bt-stat-sub">mark-to-market on holdings</div>
        </div>
      </div>
      <div style="font-size:11.5px; color:rgba(240,240,248,0.5); margin-top:12px; line-height:1.55;">
        Window: ${d.lookbackDays} days · ${d.swapTxCount || 0} swap transactions analyzed · ${d.txCount || 0} total parsed.
        ${d.cached ? "Cached result." : ""}
      </div>
    `;
  }

  function renderTrades(d) {
    const trades = d.trades || [];
    if (trades.length === 0) {
      tradesSection.hidden = false;
      tradesEl.innerHTML = `<div class="bt-empty">No swap activity in this window for this wallet.</div>`;
      return;
    }
    tradesSection.hidden = false;
    const rows = trades
      .slice(0, 30)
      .map((t) => {
        const totalPnlSol = (t.realizedSol || 0) + (t.unrealizedSol || 0);
        const cls = totalPnlSol > 0 ? "pos" : totalPnlSol < 0 ? "neg" : "";
        const img = t.image
          ? `<img class="bt-token-img" src="${escapeHtml(t.image)}" alt="" onerror="this.style.display='none'"/>`
          : `<div class="bt-token-img"></div>`;
        const status = t.fullyClosed
          ? `<span class="bt-status-pill bt-status-closed">closed</span>`
          : `<span class="bt-status-pill bt-status-open">open</span>`;
        return `
          <tr>
            <td>
              <div class="bt-token-cell">
                ${img}
                <div>
                  <div class="bt-token-sym">${escapeHtml(t.symbol)}</div>
                  <div style="font-size:11px; color:rgba(240,240,248,0.5);">${escapeHtml(shortAddr(t.mint))}</div>
                </div>
              </div>
            </td>
            <td>${status}</td>
            <td class="num">${t.buyCount}/${t.sellCount}</td>
            <td class="num">${fmtSolPlain(t.buys)}</td>
            <td class="num">${fmtSolPlain(t.sells)}</td>
            <td class="num">${t.remainingValueSol != null ? fmtSolPlain(t.remainingValueSol) : "—"}</td>
            <td class="num ${cls}">${fmtSol(totalPnlSol)}</td>
            <td class="num">${fmtMultiple(t.multiple)}</td>
          </tr>
        `;
      })
      .join("");
    tradesEl.innerHTML = `
      <table class="bt-table">
        <thead>
          <tr>
            <th>Token</th>
            <th>Status</th>
            <th style="text-align:right;">Buy/Sell #</th>
            <th style="text-align:right;">Bought</th>
            <th style="text-align:right;">Sold</th>
            <th style="text-align:right;">Still Held</th>
            <th style="text-align:right;">Net PnL</th>
            <th style="text-align:right;">×</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="font-size:11px; color:rgba(240,240,248,0.45); margin-top:10px; line-height:1.55;">
        <strong>How to read this:</strong> "Bought" is the SOL the wallet spent on this token in the window. "Sold" is what they got back from sells. "Still Held" is the current SOL value of unsold tokens (mark-to-market). "Net PnL" = sold + still-held − bought. Closed = position fully exited. Open = still holding some — value moves with current price. ${trades.length > 30 ? `Showing top 30 of ${trades.length}.` : ""}
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", autoLoadFromQuery);
  if (document.readyState === "interactive" || document.readyState === "complete") autoLoadFromQuery();
})();
