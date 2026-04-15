/**
 * Degen Desk - Token Analysis Center
 * Frontend logic: Pro gate, CA validation, fetch, render report
 */

(function () {
  "use strict";

  // =============================================
  // DOM
  // =============================================
  const authLoadingEl = document.getElementById("ta-auth-loading");
  const gateEl = document.getElementById("ta-gate");
  const gateTitleEl = document.getElementById("ta-gate-title");
  const gateMessageEl = document.getElementById("ta-gate-message");
  const gateCtaEl = document.getElementById("ta-gate-cta");
  const gateSigninEl = document.getElementById("ta-gate-signin");
  const analyzerEl = document.getElementById("ta-analyzer");
  const caInputEl = document.getElementById("ta-ca-input");
  const pasteBtnEl = document.getElementById("ta-paste-btn");
  const analyzeBtnEl = document.getElementById("ta-analyze-btn");
  const btnCountEl = document.getElementById("ta-btn-count");
  const inputErrorEl = document.getElementById("ta-input-error");
  const loadingEl = document.getElementById("ta-loading");
  const reportEl = document.getElementById("ta-report");

  // =============================================
  // STATE
  // =============================================
  let isAnalyzing = false;
  const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  // =============================================
  // HELPERS
  // =============================================
  function showGate(opts) {
    if (authLoadingEl) authLoadingEl.hidden = true;
    gateEl.hidden = false;
    analyzerEl.hidden = true;
    if (opts?.title) gateTitleEl.textContent = opts.title;
    if (opts?.message) gateMessageEl.textContent = opts.message;
    if (opts?.ctaText) gateCtaEl.textContent = opts.ctaText;
    if (opts?.ctaHref) gateCtaEl.setAttribute("href", opts.ctaHref);
    if (opts?.showSignin) {
      gateSigninEl.hidden = false;
    } else {
      gateSigninEl.hidden = true;
    }
  }

  function showAnalyzer() {
    if (authLoadingEl) authLoadingEl.hidden = true;
    gateEl.hidden = true;
    analyzerEl.hidden = false;
  }

  function setAnalyzeButtonEnabled() {
    const ca = caInputEl.value.trim();
    analyzeBtnEl.disabled = isAnalyzing || !SOLANA_ADDR_RE.test(ca);
  }

  function setInputError(msg) {
    if (!msg) {
      inputErrorEl.hidden = true;
      inputErrorEl.textContent = "";
    } else {
      inputErrorEl.hidden = false;
      inputErrorEl.textContent = msg;
    }
  }

  function formatUsd(n) {
    if (n == null || isNaN(n)) return "—";
    const num = Number(n);
    if (num >= 1e9) return "$" + (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return "$" + (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return "$" + (num / 1e3).toFixed(2) + "K";
    if (num >= 1) return "$" + num.toFixed(2);
    if (num >= 0.01) return "$" + num.toFixed(4);
    return "$" + num.toPrecision(3);
  }

  function formatPercent(n) {
    if (n == null || isNaN(n)) return "—";
    const num = Number(n);
    const sign = num >= 0 ? "+" : "";
    return sign + num.toFixed(2) + "%";
  }

  function formatAge(timestamp) {
    if (!timestamp) return "—";
    const ms = Date.now() - new Date(timestamp).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      return hours + "h";
    }
    if (days < 30) return days + "d";
    if (days < 365) return Math.floor(days / 30) + "mo";
    return (days / 365).toFixed(1) + "y";
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function riskBadgeHtml(level, label) {
    const cls = `ta-risk-${level || "unknown"}`;
    return `<span class="ta-risk-badge ${cls}">${escapeHtml(label || level || "Unknown")}</span>`;
  }

  // =============================================
  // PASTE BUTTON
  // =============================================
  pasteBtnEl.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        caInputEl.value = text.trim();
        caInputEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (err) {
      setInputError("Couldn't read from clipboard. Paste manually.");
    }
  });

  // =============================================
  // INPUT VALIDATION
  // =============================================
  caInputEl.addEventListener("input", () => {
    setInputError(null);
    setAnalyzeButtonEnabled();
  });

  caInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !analyzeBtnEl.disabled) {
      e.preventDefault();
      runAnalysis();
    }
  });

  // =============================================
  // ANALYZE
  // =============================================
  analyzeBtnEl.addEventListener("click", runAnalysis);

  async function runAnalysis() {
    if (isAnalyzing) return;
    const ca = caInputEl.value.trim();
    if (!SOLANA_ADDR_RE.test(ca)) {
      setInputError("That doesn't look like a valid Solana contract address.");
      return;
    }

    const user = window.DegenAuth?.currentUser;
    if (!user) {
      setInputError("Please sign in to run an analysis.");
      return;
    }

    isAnalyzing = true;
    setAnalyzeButtonEnabled();
    setInputError(null);
    reportEl.hidden = true;
    reportEl.innerHTML = "";
    loadingEl.hidden = false;

    // Rotating loading steps visual
    const steps = loadingEl.querySelectorAll(".ta-loading-step");
    steps.forEach((s) => s.classList.remove("active"));
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      steps.forEach((s, i) => {
        s.classList.toggle("active", i <= stepIdx);
      });
      stepIdx = (stepIdx + 1) % steps.length;
    }, 1200);

    try {
      const res = await fetch("/api/token-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress: ca, uid: user.uid }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Handle specific error cases
        if (res.status === 403 && data.proRequired) {
          showGate({
            title: "Pro Required",
            message: data.error || "Token Analysis is a Pro-only feature. Upgrade to unlock.",
            ctaText: "Upgrade to Pro",
            ctaHref: "/pricing.html",
          });
          return;
        }
        if (res.status === 429 && data.dailyLimit) {
          renderError("Daily limit reached", data.error || "You've used your daily token analyses. Try again tomorrow.");
          return;
        }
        if (res.status === 404) {
          renderError("Token not found", data.error || "No data found for that contract address.");
          return;
        }
        renderError("Analysis failed", data.error || `Server returned ${res.status}`);
        return;
      }

      renderReport(data);
    } catch (err) {
      console.error("Analysis error:", err);
      renderError("Network error", "Couldn't reach the analysis server. Please try again.");
    } finally {
      clearInterval(stepInterval);
      loadingEl.hidden = true;
      isAnalyzing = false;
      setAnalyzeButtonEnabled();
    }
  }

  function renderError(title, msg) {
    reportEl.hidden = false;
    reportEl.innerHTML = `
      <div class="ta-error-card">
        <div class="ta-error-icon">⚠️</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(msg)}</p>
      </div>
    `;
  }

  // =============================================
  // RENDER REPORT
  // =============================================
  function renderReport(data) {
    reportEl.hidden = false;
    const m = data.metrics || {};
    const r = data.report || {};
    const sources = data.sources || {};

    const tokenName = m.name || "Unknown";
    const tokenSymbol = m.symbol || "—";
    const imageUrl = m.imageUrl || null;
    const age = m.pairCreatedAt ? formatAge(m.pairCreatedAt) : "—";

    // Update the button count
    if (data.analysesUsedToday && data.analysesDailyCap) {
      btnCountEl.textContent = `${data.analysesUsedToday}/${data.analysesDailyCap} today`;
    }

    const socialsHtml =
      m.socials && m.socials.length
        ? m.socials
            .map(
              (s) =>
                `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="ta-social-link">${escapeHtml(
                  s.type || "link"
                )}</a>`
            )
            .join("")
        : "";

    const websitesHtml =
      m.websites && m.websites.length
        ? m.websites
            .map(
              (w) =>
                `<a href="${escapeHtml(w.url || w)}" target="_blank" rel="noopener noreferrer" class="ta-social-link">website</a>`
            )
            .join("")
        : "";

    reportEl.innerHTML = `
      <div class="ta-report-inner">

        <!-- Token Header Card -->
        <div class="ta-card ta-token-header">
          <div class="ta-token-header-left">
            ${
              imageUrl
                ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(tokenName)}" class="ta-token-logo" onerror="this.style.display='none'" />`
                : `<div class="ta-token-logo-placeholder">?</div>`
            }
            <div class="ta-token-info">
              <div class="ta-token-name">${escapeHtml(tokenName)}</div>
              <div class="ta-token-symbol">$${escapeHtml(tokenSymbol)}</div>
              <div class="ta-token-ca">
                <span>${escapeHtml(data.contractAddress.slice(0, 6))}...${escapeHtml(data.contractAddress.slice(-6))}</span>
                <button class="ta-copy-btn" data-copy="${escapeHtml(data.contractAddress)}" aria-label="Copy contract address">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div class="ta-token-header-right">
            ${riskBadgeHtml(r.riskLevel, r.riskLabel)}
          </div>
        </div>

        <!-- Metrics Grid -->
        <div class="ta-metrics-grid">
          <div class="ta-metric">
            <div class="ta-metric-label">Market Cap</div>
            <div class="ta-metric-value">${formatUsd(m.marketCap)}</div>
          </div>
          <div class="ta-metric">
            <div class="ta-metric-label">Price</div>
            <div class="ta-metric-value">${formatUsd(m.priceUsd)}</div>
          </div>
          <div class="ta-metric">
            <div class="ta-metric-label">Liquidity</div>
            <div class="ta-metric-value">${formatUsd(m.liquidityUsd)}</div>
          </div>
          <div class="ta-metric">
            <div class="ta-metric-label">24h Volume</div>
            <div class="ta-metric-value">${formatUsd(m.volume24h)}</div>
          </div>
          <div class="ta-metric">
            <div class="ta-metric-label">24h Change</div>
            <div class="ta-metric-value ${
              m.priceChange24h >= 0 ? "ta-green" : "ta-red"
            }">${formatPercent(m.priceChange24h)}</div>
          </div>
          <div class="ta-metric">
            <div class="ta-metric-label">Age</div>
            <div class="ta-metric-value">${escapeHtml(age)}</div>
          </div>
        </div>

        ${
          socialsHtml || websitesHtml
            ? `<div class="ta-social-row">${websitesHtml}${socialsHtml}</div>`
            : ""
        }

        <!-- AI Summary -->
        ${
          r.summary
            ? `<div class="ta-card">
                <h3 class="ta-section-title">📊 Summary</h3>
                <p>${escapeHtml(r.summary)}</p>
              </div>`
            : ""
        }

        <!-- Key Findings -->
        ${
          Array.isArray(r.keyFindings) && r.keyFindings.length
            ? `<div class="ta-card">
                <h3 class="ta-section-title">🔍 Key Findings</h3>
                <ul class="ta-findings">
                  ${r.keyFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
                </ul>
              </div>`
            : ""
        }

        <!-- Holder Analysis -->
        ${
          r.holderAnalysis
            ? `<div class="ta-card">
                <h3 class="ta-section-title">👥 Holder Distribution</h3>
                <p>${escapeHtml(r.holderAnalysis)}</p>
              </div>`
            : ""
        }

        <!-- Bundle Analysis -->
        ${
          r.bundleAnalysis
            ? `<div class="ta-card">
                <h3 class="ta-section-title">📦 Bundle Detection</h3>
                <p>${escapeHtml(r.bundleAnalysis)}</p>
              </div>`
            : ""
        }

        <!-- Dev Wallet -->
        ${
          r.devWalletAnalysis
            ? `<div class="ta-card">
                <h3 class="ta-section-title">🛠️ Dev Wallet Scan</h3>
                <p>${escapeHtml(r.devWalletAnalysis)}</p>
              </div>`
            : ""
        }

        <!-- Comparables / Projected -->
        ${
          r.comparables
            ? `<div class="ta-card ta-card-highlight">
                <h3 class="ta-section-title">📈 Market Context</h3>
                <p>${escapeHtml(r.comparables)}</p>
              </div>`
            : ""
        }

        <!-- Final Note -->
        ${
          r.finalNote
            ? `<div class="ta-final-note">
                <strong>📝 Final Note</strong>
                <p>${escapeHtml(r.finalNote)}</p>
              </div>`
            : ""
        }

        <!-- Data Sources -->
        <div class="ta-sources">
          <span class="ta-sources-label">Data sources:</span>
          ${sources.dexScreener ? '<span class="ta-source-pill">DexScreener</span>' : ""}
          ${sources.rugCheck ? '<span class="ta-source-pill">RugCheck</span>' : ""}
          ${sources.pumpFun ? '<span class="ta-source-pill">pump.fun</span>' : ""}
          ${sources.helius ? '<span class="ta-source-pill">Helius</span>' : ""}
        </div>

        <!-- NFA reminder inside the report -->
        <div class="ta-inline-disclaimer">
          <strong>⚠️ NFA &middot; DYOR</strong>
          <span>Nothing above is financial advice. All data is observational. Always do your own research before making any trading decisions.</span>
        </div>

      </div>
    `;

    // Wire copy button
    const copyBtn = reportEl.querySelector(".ta-copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const text = copyBtn.getAttribute("data-copy");
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.classList.add("copied");
          setTimeout(() => copyBtn.classList.remove("copied"), 1500);
        } catch (err) {
          console.error("Copy failed:", err);
        }
      });
    }

    // Scroll report into view
    reportEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // =============================================
  // AUTH STATE + PRO GATE
  // =============================================
  async function checkAccess() {
    const auth = firebase.auth();
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        showGate({
          title: "Sign in required",
          message: "Sign in to access Token Analysis. This is a Pro-only feature.",
          ctaText: "Upgrade to Pro",
          ctaHref: "/pricing.html",
          showSignin: true,
        });
        // Wire sign in link to trigger Google sign-in via DegenAuth if available
        gateSigninEl.onclick = async (e) => {
          e.preventDefault();
          try {
            if (window.DegenAuth && typeof window.DegenAuth.signIn === "function") {
              await window.DegenAuth.signIn();
            } else {
              const provider = new firebase.auth.GoogleAuthProvider();
              await auth.signInWithPopup(provider);
            }
          } catch (err) {
            console.error("Sign in failed:", err);
          }
        };
        return;
      }

      // Signed in — check tier
      let tier = "free";
      try {
        const db = firebase.firestore();
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
          const d = doc.data();
          if (d.tier === "pro" && d.subscriptionStatus === "active") tier = "pro";
        }
        // Also check native IAP entitlement on iOS
        if (tier !== "pro" && window.DegenDeskIAP && typeof window.DegenDeskIAP.isPro === "function") {
          if (window.DegenDeskIAP.isPro()) tier = "pro";
        }
      } catch (err) {
        console.error("Tier check failed:", err);
      }

      if (tier !== "pro") {
        showGate({
          title: "Pro Feature",
          message: "Token Analysis is a Pro-only feature. Upgrade to unlock deep on-chain intelligence on any Solana token.",
          ctaText: "Upgrade to Pro",
          ctaHref: "/pricing.html",
        });
        return;
      }

      // Pro user — show the analyzer
      showAnalyzer();

      // Load daily count from Firestore if available
      try {
        const db = firebase.firestore();
        const doc = await db.collection("users").doc(user.uid).get();
        if (doc.exists) {
          const d = doc.data();
          const today = new Date().toISOString().split("T")[0];
          const count =
            d.tokenAnalysesUsedDate === today ? d.tokenAnalysesUsedToday || 0 : 0;
          btnCountEl.textContent = `${count}/20 today`;
        }
      } catch (err) {
        // non-fatal
      }
    });
  }

  checkAccess();
})();
