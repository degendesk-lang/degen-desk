/**
 * Wallet Watch — frontend
 *
 * Auth-gated (Pro). Talks to /api/wallet-watch.
 *
 * Auth pattern mirrors token-analysis.html: showGate() for unauthed/free,
 * showApp() for Pro.
 */
(function () {
  "use strict";

  const SOLANA_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  const $ = (id) => document.getElementById(id);
  const authLoading = $("ww-auth-loading");
  const gate = $("ww-gate");
  const gateTitle = $("ww-gate-title");
  const gateMessage = $("ww-gate-message");
  const gateCta = $("ww-gate-cta");
  const gateSignin = $("ww-gate-signin");
  const appSection = $("ww-app-section");
  const walletInput = $("ww-wallet");
  const labelInput = $("ww-label");
  const addBtn = $("ww-add");
  const addStatus = $("ww-add-status");
  const listEl = $("ww-list");
  const countEl = $("ww-count");
  const alertsEl = $("ww-alerts");
  const checkBtn = $("ww-check");

  let currentUid = null;
  let watches = [];

  // ----- helpers -----
  const escapeHtml = (s) =>
    s == null
      ? ""
      : String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

  const shortAddr = (a) => (!a || a.length < 10 ? a || "" : a.slice(0, 4) + "…" + a.slice(-4));

  function timeAgo(ts) {
    if (!ts) return "—";
    const ms = typeof ts === "number" ? Date.now() - ts : Date.now() - Date.parse(ts);
    const s = Math.max(0, ms / 1000);
    if (s < 60) return `${Math.floor(s)}s ago`;
    const m = s / 60;
    if (m < 60) return `${Math.floor(m)}m ago`;
    const h = m / 60;
    if (h < 24) return `${h.toFixed(1)}h ago`;
    return `${(h / 24).toFixed(1)}d ago`;
  }

  function fmtSol(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (v >= 100) return v.toFixed(0) + " SOL";
    if (v >= 1) return v.toFixed(2) + " SOL";
    return v.toFixed(4) + " SOL";
  }

  // ----- auth flow -----
  async function triggerSignIn(e) {
    if (e) e.preventDefault();
    try {
      if (window.DegenAuth?.signIn) await window.DegenAuth.signIn();
      else {
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithPopup(provider);
      }
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  }

  function showGate(opts) {
    authLoading.hidden = true;
    appSection.hidden = true;
    gate.hidden = false;
    if (opts?.title) gateTitle.textContent = opts.title;
    if (opts?.message) gateMessage.textContent = opts.message;
    if (opts?.ctaText) gateCta.textContent = opts.ctaText;
    if (opts?.ctaTriggersSignin) {
      gateCta.removeAttribute("href");
      gateCta.style.cursor = "pointer";
      gateCta.onclick = triggerSignIn;
    } else if (opts?.ctaHref) {
      gateCta.href = opts.ctaHref;
      gateCta.onclick = null;
    }
    gateSignin.hidden = true;
  }

  function showApp() {
    authLoading.hidden = true;
    gate.hidden = true;
    appSection.hidden = false;
  }

  async function bootstrap() {
    if (typeof firebase === "undefined" || !firebase.auth) {
      showGate({ title: "Sign-in unavailable", message: "Firebase SDK didn't load. Try reloading." });
      return;
    }
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        showGate({
          title: "Sign in to use Wallet Watch",
          message: "Track up to 10 Solana wallets free. Pro gets 25.",
          ctaText: "Sign in with Google",
          ctaTriggersSignin: true,
        });
        return;
      }
      currentUid = user.uid;
      // Free users get 10 watches, Pro gets 25. Tier-aware cap is enforced
      // server-side; the API tells the frontend which cap applies.
      showApp();
      await loadWatches();
    });
  }

  // ----- API calls -----
  async function loadWatches() {
    try {
      const res = await fetch(`/api/wallet-watch?uid=${encodeURIComponent(currentUid)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        listEl.innerHTML = `<div class="ww-error">${escapeHtml(data?.error || "Couldn't load watches.")}</div>`;
        return;
      }
      watches = data.items || [];
      renderList(watches, data.cap || 10);
    } catch (err) {
      console.error("Load watches error:", err);
      listEl.innerHTML = `<div class="ww-error">Network error loading watches.</div>`;
    }
  }

  async function addWatch() {
    addStatus.innerHTML = "";
    const wallet = walletInput.value.trim();
    const label = labelInput.value.trim();
    if (!SOLANA_ADDR_RE.test(wallet)) {
      addStatus.innerHTML = `<div class="ww-error">Enter a valid Solana wallet address.</div>`;
      return;
    }
    addBtn.disabled = true;
    try {
      const res = await fetch("/api/wallet-watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: currentUid, wallet, label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addStatus.innerHTML = `<div class="ww-error">${escapeHtml(data?.error || "Couldn't add.")}</div>`;
        return;
      }
      walletInput.value = "";
      labelInput.value = "";
      addBtn.disabled = true;
      addStatus.innerHTML = `<div class="ww-success">Added @${escapeHtml(label || shortAddr(wallet))}. New trades after this point will surface on the next Check.</div>`;
      await loadWatches();
    } catch (err) {
      addStatus.innerHTML = `<div class="ww-error">Network error.</div>`;
    } finally {
      addBtn.disabled = !SOLANA_ADDR_RE.test(walletInput.value.trim());
    }
  }

  async function removeWatch(wallet) {
    if (!confirm(`Stop watching ${shortAddr(wallet)}?`)) return;
    try {
      const res = await fetch("/api/wallet-watch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: currentUid, wallet }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Couldn't remove.");
        return;
      }
      await loadWatches();
    } catch (err) {
      console.error("Remove watch error:", err);
    }
  }

  async function checkNow() {
    if (watches.length === 0) {
      alertsEl.innerHTML = `<div class="ww-empty">Add a wallet first.</div>`;
      return;
    }
    checkBtn.disabled = true;
    checkBtn.textContent = "⟳ Checking...";
    try {
      const res = await fetch("/api/wallet-watch?action=check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: currentUid, action: "check" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alertsEl.innerHTML = `<div class="ww-error">${escapeHtml(data?.error || "Check failed.")}</div>`;
        return;
      }
      renderAlerts(data.alerts || []);
      // Refresh the list to show updated lastCheckedAt
      await loadWatches();
    } catch (err) {
      console.error("Check error:", err);
      alertsEl.innerHTML = `<div class="ww-error">Network error during check.</div>`;
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = "⟳ Check for new trades";
    }
  }

  // ----- rendering -----
  function renderList(items, cap) {
    countEl.textContent = `${items.length} / ${cap}`;
    if (items.length === 0) {
      listEl.innerHTML = `<div class="ww-empty">No watched wallets yet. Add one above.</div>`;
      return;
    }
    listEl.innerHTML = items
      .map((w) => {
        const labelText = w.label || shortAddr(w.wallet);
        const checked = w.lastCheckedAt ? timeAgo(w.lastCheckedAt) : "never";
        return `
          <div class="ww-watch-row">
            <span class="label">${escapeHtml(labelText)}</span>
            <span class="addr">${escapeHtml(shortAddr(w.wallet))}</span>
            <span class="meta">last checked ${checked}</span>
            <a href="/wallet-analysis.html?wallet=${encodeURIComponent(w.wallet)}" style="font-size:11.5px; color:#a78bfa; text-decoration:none;">analyze →</a>
            <button class="remove" type="button" data-wallet="${escapeHtml(w.wallet)}">Remove</button>
          </div>
        `;
      })
      .join("");
    // Wire up remove buttons
    listEl.querySelectorAll("button.remove").forEach((b) => {
      b.addEventListener("click", () => removeWatch(b.dataset.wallet));
    });
  }

  function renderAlerts(alerts) {
    if (alerts.length === 0) {
      alertsEl.innerHTML = `<div class="ww-empty">No new trades since your last check. Check back later.</div>`;
      return;
    }
    alertsEl.innerHTML = alerts
      .map((a) => {
        const who = a.label || shortAddr(a.wallet);
        const tokenLink = `/token-analysis.html?ca=${encodeURIComponent(a.tokenMint)}&chain=solana`;
        const txLink = `https://solscan.io/tx/${encodeURIComponent(a.signature)}`;
        return `
          <div class="ww-alert ${escapeHtml(a.kind)}">
            <span class="kind">${a.kind === "buy" ? "BUY" : "SELL"}</span>
            <span class="who">${escapeHtml(who)}</span>
            <span class="amount">${fmtSol(a.solAmount)}</span>
            <a href="${tokenLink}">analyze ${shortAddr(a.tokenMint)} →</a>
            <a href="${txLink}" target="_blank" rel="noopener">tx ↗</a>
            <span class="ago">${timeAgo((a.ts || 0) * 1000)}</span>
          </div>
        `;
      })
      .join("");
  }

  // ----- input wiring -----
  walletInput.addEventListener("input", () => {
    addBtn.disabled = !SOLANA_ADDR_RE.test(walletInput.value.trim());
  });
  walletInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !addBtn.disabled) addWatch();
  });
  labelInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !addBtn.disabled) addWatch();
  });
  addBtn.addEventListener("click", addWatch);
  checkBtn.addEventListener("click", checkNow);

  bootstrap();
})();
