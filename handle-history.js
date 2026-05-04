/**
 * Degen Desk - X Handle History frontend
 *
 * Talks to /api/handle-history. No auth required (public archive lookup).
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const input = $("hh-input");
  const pasteBtn = $("hh-paste");
  const goBtn = $("hh-go");
  const errorBox = $("hh-error");
  const loading = $("hh-loading");
  const flagsSection = $("hh-flags-section");
  const flagsList = $("hh-flags-list");
  const flagsTitle = $("hh-flags-title");
  const resultsSection = $("hh-results-section");
  const results = $("hh-results");

  const VALID_RE = /^(?:@?[A-Za-z0-9_]{1,15}|\d{1,20})$/;

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
  function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = "";
  }
  function hideAll() {
    flagsSection.hidden = true;
    resultsSection.hidden = true;
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function fmtDuration(firstSeen, lastSeen) {
    if (!firstSeen || !lastSeen) return "";
    const a = Date.parse(firstSeen);
    const b = Date.parse(lastSeen);
    if (isNaN(a) || isNaN(b)) return "";
    const days = Math.max(0, Math.round((b - a) / (24 * 60 * 60 * 1000)));
    if (days < 30) return `${days}d`;
    if (days < 365) return `${(days / 30).toFixed(1)}mo`;
    return `${(days / 365).toFixed(1)}yr`;
  }

  function normalizeForUrl(raw) {
    let s = (raw || "").trim();
    s = s.replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "");
    s = s.replace(/^@/, "");
    return s.split(/[?#/]/)[0];
  }

  input.addEventListener("input", () => {
    clearError();
    const raw = normalizeForUrl(input.value);
    goBtn.disabled = !VALID_RE.test(raw);
  });

  pasteBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        input.value = text.trim();
        input.dispatchEvent(new Event("input"));
      }
    } catch (err) {
      // ignore — clipboard permission denied
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !goBtn.disabled) lookup();
  });
  goBtn.addEventListener("click", lookup);

  function autoLoadFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || params.get("handle");
    if (q) {
      input.value = q;
      input.dispatchEvent(new Event("input"));
      if (!goBtn.disabled) lookup();
    }
  }

  async function lookup() {
    clearError();
    hideAll();
    const raw = normalizeForUrl(input.value);
    if (!VALID_RE.test(raw)) {
      showError("Enter an X handle (e.g. @elonmusk) or a numeric account ID.");
      return;
    }
    goBtn.disabled = true;
    loading.hidden = false;

    // Reflect in URL so results are shareable
    const url = new URL(window.location.href);
    url.searchParams.set("q", raw);
    window.history.replaceState({}, "", url.toString());

    try {
      const res = await fetch(`/api/handle-history?q=${encodeURIComponent(raw)}`);
      const data = await res.json().catch(() => ({}));
      loading.hidden = true;

      if (!res.ok) {
        showError(data?.error || `Lookup failed (${res.status})`);
        goBtn.disabled = false;
        return;
      }

      if (!data.found) {
        resultsSection.hidden = false;
        const xUrl = `https://x.com/${encodeURIComponent(raw)}`;
        results.innerHTML = `
          <div class="hh-empty" style="text-align:left;">
            <div style="margin-bottom:10px;"><strong>No archived history for @${escapeHtml(raw)}.</strong></div>
            <div style="margin-bottom:10px; line-height:1.6;">
              memory.lol archives X handle changes by scraping public Twitter data. Smaller accounts often aren't captured — especially if the rename happened recently or the account didn't get heavy scraping coverage during the change window. Even Twitter's own API doesn't expose historical handle changes publicly, so this is a real gap with no perfect fix.
            </div>
            <div style="margin-bottom:10px; line-height:1.6;">
              <strong>Recommended manual checks:</strong>
              <ul style="margin: 6px 0 0 20px; padding: 0; line-height: 1.7;">
                <li>Open the profile and check the account creation date (X shows "Joined [Month Year]" on every profile).</li>
                <li>Look at the followers / following ratio and account age — fresh accounts with high follower counts can be a red flag.</li>
                <li>Check the earliest tweets — does the content match the project's claimed history?</li>
              </ul>
            </div>
            <a href="${escapeHtml(xUrl)}" target="_blank" rel="noopener" style="display:inline-block; background:#a78bfa; color:#021015; text-decoration:none; padding:8px 16px; border-radius:8px; font-weight:600; font-size:13px;">Open @${escapeHtml(raw)} on X ↗</a>
          </div>
        `;
        flagsSection.hidden = true;
        goBtn.disabled = false;
        return;
      }

      renderFlags(data.signals);
      renderResults(data.accounts);
    } catch (err) {
      loading.hidden = true;
      console.error("Handle history fetch error:", err);
      showError("Network error. Try again in a moment.");
    } finally {
      goBtn.disabled = false;
    }
  }

  function renderFlags(signals) {
    if (!signals || !signals.flags || signals.flags.length === 0) {
      flagsSection.hidden = false;
      flagsTitle.textContent = "Signals";
      flagsList.innerHTML = `
        <div class="hh-flag low">
          <span class="icon">✓</span>
          <span>No reuse or rebrand patterns detected. Account looks consistent across the archive — but always cross-check independently.</span>
        </div>
      `;
      return;
    }
    flagsSection.hidden = false;
    flagsTitle.textContent =
      signals.severity === "high"
        ? "⚠️ High-severity signals"
        : signals.severity === "medium"
        ? "Medium-severity signals"
        : "Signals";
    const sevClass = signals.severity || "low";
    flagsList.innerHTML = signals.flags
      .map(
        (f) => `
          <div class="hh-flag ${escapeHtml(sevClass)}">
            <span class="icon">${sevClass === "high" ? "🚩" : sevClass === "medium" ? "⚠️" : "ℹ️"}</span>
            <span>${escapeHtml(f.message)}</span>
          </div>
        `
      )
      .join("");
  }

  function renderResults(accounts) {
    if (!accounts || accounts.length === 0) {
      resultsSection.hidden = false;
      results.innerHTML = `<div class="hh-empty">No account records.</div>`;
      return;
    }
    resultsSection.hidden = false;
    results.innerHTML = accounts.map(renderAccount).join("");
  }

  function renderAccount(acct) {
    const handles = (acct.handles || []).slice();
    // Mark the most recent (current) handle
    const currentIdx = handles.length - 1;
    const handleRows = handles
      .map((h, i) => {
        const isCurrent = i === currentIdx;
        const dur = fmtDuration(h.firstSeen, h.lastSeen);
        return `
          <li class="hh-handle-item ${isCurrent ? "current" : ""}">
            <span class="h">@${escapeHtml(h.handle)}${isCurrent ? " · current" : ""}</span>
            <span class="range">${fmtDate(h.firstSeen)} → ${fmtDate(h.lastSeen)}</span>
            ${dur ? `<span class="duration">${dur}</span>` : ""}
          </li>
        `;
      })
      .join("");

    const ageStr =
      acct.accountAgeDays != null
        ? acct.accountAgeDays < 365
          ? `${acct.accountAgeDays}d old`
          : `${(acct.accountAgeDays / 365).toFixed(1)}yr old`
        : "";

    return `
      <div class="hh-account">
        <div class="hh-account-head">
          ${
            acct.profileUrl
              ? `<a class="hh-current" href="${escapeHtml(acct.profileUrl)}" target="_blank" rel="noopener">@${escapeHtml(acct.currentHandle || "—")}</a>`
              : `<span class="hh-current">@${escapeHtml(acct.currentHandle || "—")}</span>`
          }
          <span class="hh-id">ID ${escapeHtml(acct.accountId)}</span>
          <span class="hh-meta">${acct.renameCount} rename${acct.renameCount === 1 ? "" : "s"} ${ageStr ? "· " + ageStr : ""}</span>
        </div>
        <ul class="hh-handle-list">${handleRows}</ul>
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", autoLoadFromQuery);
  if (document.readyState === "interactive" || document.readyState === "complete") {
    autoLoadFromQuery();
  }
})();
