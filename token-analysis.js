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
  const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

  // Multi-chain state — defaults to Solana to preserve current behavior.
  let selectedChain = "solana";
  const CHAIN_PLACEHOLDERS = {
    solana: "e.g. DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    ethereum: "e.g. 0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    base: "e.g. 0x1111111111166b7FE7bd91427724B487980aFc69",
    bsc: "e.g. 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  };
  const CHAIN_LABELS = { solana: "Solana", ethereum: "Ethereum", base: "Base", bsc: "BNB Chain" };
  function isValidForChain(addr, chain) {
    if (chain === "solana") return SOLANA_ADDR_RE.test(addr);
    return EVM_ADDR_RE.test(addr);
  }
  function detectChainFromAddress(addr) {
    if (EVM_ADDR_RE.test(addr)) return "evm"; // ambiguous between ethereum/base
    if (SOLANA_ADDR_RE.test(addr)) return "solana";
    return null;
  }

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
    analyzeBtnEl.disabled = isAnalyzing || !isValidForChain(ca, selectedChain);
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

  // Animated risk gauge — SVG circle that draws in on render.
  // Severity → fill percentage maps to perceived urgency.
  function riskGaugeHtml(level, label) {
    const lvl = level || "unknown";
    const fillMap = { low: 25, medium: 55, high: 80, critical: 96, unknown: 0 };
    const fillPct = fillMap[lvl] ?? 0;
    const C = 263.89; // 2 * pi * 42
    const offset = (C * (1 - fillPct / 100)).toFixed(2);
    const displayLevel = lvl === "unknown" ? "?" : lvl.charAt(0).toUpperCase() + lvl.slice(1);
    return `
      <div class="ta-risk-gauge-wrap">
        <div class="ta-risk-gauge ta-risk-${lvl}" style="--gauge-target: ${offset};">
          <svg viewBox="0 0 100 100" class="ta-gauge-svg" aria-hidden="true">
            <circle cx="50" cy="50" r="42" class="ta-gauge-track" />
            <circle cx="50" cy="50" r="42" class="ta-gauge-fill" />
          </svg>
          <div class="ta-gauge-content">
            <div class="ta-gauge-level">${escapeHtml(displayLevel)}</div>
            <div class="ta-gauge-eyebrow">RISK</div>
          </div>
        </div>
        ${label ? `<div class="ta-risk-badge ta-risk-${lvl}">${escapeHtml(label)}</div>` : ""}
      </div>
    `;
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
  // CHAIN PICKER TABS
  // =============================================
  const chainTabs = document.querySelectorAll(".ta-chain-tab");

  function setSelectedChain(chain, opts) {
    if (!chain) return;
    selectedChain = chain;
    chainTabs.forEach((t) => {
      const isActive = t.getAttribute("data-chain") === chain;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    if (caInputEl && CHAIN_PLACEHOLDERS[chain]) {
      caInputEl.placeholder = CHAIN_PLACEHOLDERS[chain];
    }
    setInputError(null);
    setAnalyzeButtonEnabled();
  }

  chainTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setSelectedChain(tab.getAttribute("data-chain"));
    });
  });

  // Auto-detect chain from address shape on input — flip tabs automatically
  // unless the user has manually selected a different EVM chain.
  function autoDetectChainFromInput(value) {
    const detected = detectChainFromAddress(value);
    if (!detected) return;
    if (detected === "solana" && selectedChain !== "solana") {
      setSelectedChain("solana");
    } else if (detected === "evm" && selectedChain === "solana") {
      // Default to Ethereum on first EVM detection; user can switch to Base
      setSelectedChain("ethereum");
    }
  }

  // =============================================
  // INPUT VALIDATION
  // =============================================
  caInputEl.addEventListener("input", () => {
    setInputError(null);
    autoDetectChainFromInput(caInputEl.value.trim());
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
    if (!isValidForChain(ca, selectedChain)) {
      setInputError(`That doesn't look like a valid ${CHAIN_LABELS[selectedChain] || "contract"} address.`);
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
        body: JSON.stringify({ contractAddress: ca, uid: user.uid, chain: selectedChain }),
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
          // Free users hitting their daily cap → upgrade prompt.
          // Pro users at their cap → straightforward error.
          if (data.upgrade) {
            renderError(
              "Daily limit reached",
              `${data.error || "You've used your daily token analyses."} <a href="/pricing.html" style="color:#a78bfa; text-decoration:underline;">Upgrade to Pro →</a>`,
              { allowHtml: true }
            );
          } else {
            renderError("Daily limit reached", data.error || "You've used your daily token analyses. Try again tomorrow.");
          }
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

  function renderError(title, msg, opts) {
    reportEl.hidden = false;
    const body = opts?.allowHtml ? msg : escapeHtml(msg);
    reportEl.innerHTML = `
      <div class="ta-error-card">
        <div class="ta-error-icon">⚠️</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${body}</p>
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
              <div class="ta-token-symbol">
                <span>$${escapeHtml(tokenSymbol)}</span>
                ${data.chainLabel ? `<span class="ta-chain-badge ta-chain-badge-${escapeHtml(data.chain || "solana")}"><span class="ta-chain-dot ta-chain-dot-${escapeHtml(data.chain || "solana")}"></span>${escapeHtml(data.chainLabel)}</span>` : ""}
              </div>
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
            ${riskGaugeHtml(r.riskLevel, r.riskLabel)}
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

        <!-- Contract Analysis (EVM only) -->
        ${
          r.contractAnalysis
            ? `<div class="ta-card">
                <h3 class="ta-section-title">📜 Contract Analysis</h3>
                <p>${escapeHtml(r.contractAnalysis)}</p>
              </div>`
            : ""
        }

        <!-- Domain Age -->
        ${
          r.domainAnalysis
            ? `<div class="ta-card">
                <h3 class="ta-section-title">🌐 Domain Age</h3>
                <p>${escapeHtml(r.domainAnalysis)}</p>
              </div>`
            : ""
        }

        <!-- GitHub Analyzer -->
        ${
          r.githubAnalysis
            ? `<div class="ta-card">
                <h3 class="ta-section-title">💻 GitHub Repo</h3>
                <p>${escapeHtml(r.githubAnalysis)}</p>
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

        <!-- Share actions -->
        <div class="ta-share-row">
          <div class="ta-share-label">📤 Share this analysis</div>
          <div class="ta-share-buttons">
            <button class="ta-share-btn" data-action="download" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Download PNG</span>
            </button>
            <button class="ta-share-btn ta-share-btn-secondary" data-action="copy" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>Copy image</span>
            </button>
            <button class="ta-share-btn ta-share-btn-secondary" data-action="tweet" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              <span>Tweet</span>
            </button>
          </div>
          <div class="ta-share-status" data-share-status hidden></div>
        </div>

        <!-- Data Sources -->
        <div class="ta-sources">
          <span class="ta-sources-label">Data sources:</span>
          ${sources.dexScreener ? '<span class="ta-source-pill">DexScreener</span>' : ""}
          ${sources.rugCheck ? '<span class="ta-source-pill">RugCheck</span>' : ""}
          ${sources.pumpFun ? '<span class="ta-source-pill">pump.fun</span>' : ""}
          ${sources.goPlus ? '<span class="ta-source-pill">GoPlus Security</span>' : ""}
          ${sources.helius ? '<span class="ta-source-pill">Helius</span>' : ""}
          ${sources.etherscan ? '<span class="ta-source-pill">Etherscan v2</span>' : ""}
          ${sources.domainAge ? '<span class="ta-source-pill">RDAP / WHOIS</span>' : ""}
          ${sources.github ? '<span class="ta-source-pill">GitHub</span>' : ""}
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

    // Wire share-card buttons
    const shareRow = reportEl.querySelector(".ta-share-row");
    if (shareRow && window.DegenDeskShareCard) {
      const statusEl = shareRow.querySelector("[data-share-status]");
      const setStatus = (msg, isError) => {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.hidden = !msg;
        statusEl.classList.toggle("ta-share-error", !!isError);
        if (msg) setTimeout(() => { statusEl.hidden = true; }, 2800);
      };
      shareRow.querySelectorAll(".ta-share-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const action = btn.getAttribute("data-action");
          btn.disabled = true;
          try {
            if (action === "download") {
              await window.DegenDeskShareCard.download(data);
              setStatus("Downloaded ✓");
            } else if (action === "copy") {
              await window.DegenDeskShareCard.copy(data);
              setStatus("Copied to clipboard ✓");
            } else if (action === "tweet") {
              const sym = data.metrics?.symbol || "this token";
              const lvl = data.report?.riskLevel
                ? data.report.riskLevel.charAt(0).toUpperCase() + data.report.riskLevel.slice(1)
                : "Unknown";
              const text = `Just ran a Token Analysis on $${sym} with @DegenDeskXYZ\n\nRisk verdict: ${lvl}\n\nFull report: degendesk.xyz/token-analysis.html`;
              const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
              window.open(url, "_blank", "noopener,noreferrer");
              setStatus("Opened X — attach the downloaded image to your tweet ✓");
              // Auto-trigger download so the user has the image ready to paste
              setTimeout(() => window.DegenDeskShareCard.download(data).catch(() => {}), 200);
            }
          } catch (err) {
            console.error("Share action failed:", err);
            setStatus(err.message || "Something went wrong", true);
          } finally {
            btn.disabled = false;
          }
        });
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

      // Signed in — show the analyzer for free + Pro alike. Daily caps
      // are enforced server-side: free=5/day, Pro=25/day. The 429 response
      // surfaces an upgrade CTA when free users hit the cap.
      showAnalyzer();

      // Deep-link from the browser extension: ?ca=<address>&chain=<chain>
      // Pre-fill the input, switch to the right chain tab, and auto-run.
      try {
        const params = new URLSearchParams(window.location.search);
        const linkedCa = params.get("ca");
        const linkedChain = params.get("chain");
        if (linkedCa) {
          if (linkedChain && CHAIN_LABELS[linkedChain]) {
            setSelectedChain(linkedChain);
          }
          caInputEl.value = linkedCa.trim();
          caInputEl.dispatchEvent(new Event("input", { bubbles: true }));
          if (!analyzeBtnEl.disabled) {
            setTimeout(() => runAnalysis(), 350);
          }
        }
      } catch (err) {
        // non-fatal — deep link parsing should never break the page
      }

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
