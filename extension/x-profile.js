/**
 * X / Twitter profile overlay
 *
 * Runs only on x.com and twitter.com. When the user lands on a profile page,
 * fetches handle history from /api/handle-history and injects a
 * "Previous: @oldhandle (Xd ago), ..." line under the user's bio.
 *
 * If the account has no archived rename history (memory.lol's coverage gap),
 * we inject nothing — better silent than noisy.
 *
 * Click the line → opens the full Degen Desk Handle History tool with the
 * handle pre-filled, so the user can see flagged signals + manual-check tips.
 *
 * Implementation notes:
 *  - X is an SPA; we use a URL-change watcher instead of relying on initial load.
 *  - We anchor to [data-testid="UserDescription"] (the bio block) which is the
 *    most stable identifier X exposes. Position the overlay as the next sibling.
 *  - Singleton flag prevents duplicate injection per profile view.
 */
(() => {
  if (window.__DEGEN_DESK_X_PROFILE__) return;
  window.__DEGEN_DESK_X_PROFILE__ = true;

  const OVERLAY_ID = "dd-x-profile-overlay";
  const VALID_HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
  // Reserved X path prefixes — these are not user profiles.
  const RESERVED = new Set([
    "home", "explore", "notifications", "messages", "bookmarks", "lists",
    "communities", "i", "search", "compose", "settings", "login", "logout",
    "signup", "tos", "privacy", "jobs", "ads", "intent", "share", "explore",
    "topics", "moments", "verified-choose", "manage", "follower_requests",
    "account", "personalization", "privacy_policy", "rules", "help", "about",
    "download", "premium", "verified-organizations",
  ]);

  let lastHandleSeen = null;
  let inFlightHandle = null;

  function extractHandleFromPath() {
    const seg = window.location.pathname.split("/").filter(Boolean)[0];
    if (!seg) return null;
    if (RESERVED.has(seg.toLowerCase())) return null;
    if (!VALID_HANDLE_RE.test(seg)) return null;
    return seg;
  }

  // The page is a profile if there's a UserDescription (bio) block, OR the
  // header is rendered. Bio doesn't always exist (some users have no bio),
  // so fall back to UserName which is always present on profiles.
  function findInjectionAnchor() {
    return (
      document.querySelector('[data-testid="UserDescription"]') ||
      document.querySelector('[data-testid="UserName"]')
    );
  }

  function daysAgo(iso) {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (isNaN(t)) return null;
    return Math.max(0, Math.round((Date.now() - t) / (24 * 60 * 60 * 1000)));
  }

  function fetchHandleHistory(handle) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "HANDLE_HISTORY", handle },
          (resp) => resolve(resp || { ok: false })
        );
      } catch {
        resolve({ ok: false });
      }
    });
  }

  function removeOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();
  }

  // Build the overlay element. Returns null if there's nothing useful to show.
  function buildOverlay(handle, history) {
    if (!history?.found) return null;
    const accounts = history.accounts || [];
    if (accounts.length === 0) return null;

    // For the current handle being viewed, find the matching account in the
    // returned set (memory.lol can return multiple accounts if a handle was reused).
    // Match by current handle when we can.
    const matchingAccount =
      accounts.find(
        (a) => (a.currentHandle || "").toLowerCase() === handle.toLowerCase()
      ) || accounts[0];

    const prior = (matchingAccount.handles || [])
      .filter((h) => h.handle.toLowerCase() !== handle.toLowerCase())
      .reverse() // newest prior first
      .slice(0, 4);

    // Cross-account reuse: this handle has appeared on >1 account
    const handleReuse = accounts.length > 1;

    if (prior.length === 0 && !handleReuse) return null;

    const sev = history.signals?.severity || "low";
    const bgColor =
      sev === "high"
        ? "rgba(255, 85, 85, 0.10)"
        : sev === "medium"
        ? "rgba(255, 204, 51, 0.10)"
        : "rgba(167, 139, 250, 0.10)";
    const borderColor =
      sev === "high"
        ? "rgba(255, 85, 85, 0.35)"
        : sev === "medium"
        ? "rgba(255, 204, 51, 0.35)"
        : "rgba(167, 139, 250, 0.30)";
    const textColor =
      sev === "high" ? "#ffb8b8" : sev === "medium" ? "#ffe7a3" : "#d6c8ff";

    const wrap = document.createElement("div");
    wrap.id = OVERLAY_ID;
    wrap.setAttribute("dir", "ltr");
    wrap.style.cssText = [
      "margin: 8px 0",
      "padding: 8px 12px",
      "border-radius: 10px",
      `background: ${bgColor}`,
      `border: 1px solid ${borderColor}`,
      `color: ${textColor}`,
      "font-size: 13.5px",
      "font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "line-height: 1.45",
      "cursor: pointer",
      "display: block",
      "max-width: 100%",
      "box-sizing: border-box",
    ].join(";");

    const icon = sev === "high" ? "🚩" : sev === "medium" ? "⚠️" : "🕒";
    const reuseNote = handleReuse
      ? ` &middot; ⚠️ this @handle has been used by ${accounts.length} different accounts`
      : "";

    if (prior.length > 0) {
      const priorStrs = prior
        .map((p) => {
          const d = daysAgo(p.firstSeen);
          return d != null
            ? `<strong>@${escapeHtml(p.handle)}</strong> (${d}d ago)`
            : `<strong>@${escapeHtml(p.handle)}</strong>`;
        })
        .join(", ");
      wrap.innerHTML = `
        <span style="opacity:0.85;">${icon} <strong style="color:${textColor};">Previous:</strong></span>
        ${priorStrs}${reuseNote}
        <span style="opacity:0.65; font-size:11.5px; margin-left:6px;">Degen Desk →</span>
      `;
    } else if (handleReuse) {
      wrap.innerHTML = `
        ${icon} <strong>This @handle has been used by ${accounts.length} different accounts.</strong>
        Verify the current account is the one you think it is.
        <span style="opacity:0.65; font-size:11.5px; margin-left:6px;">Degen Desk →</span>
      `;
    }

    wrap.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      window.open(
        `https://degendesk.xyz/handle-history.html?q=${encodeURIComponent(handle)}`,
        "_blank",
        "noopener"
      );
    });

    return wrap;
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

  async function tryRender(handle) {
    if (inFlightHandle === handle) return;
    inFlightHandle = handle;

    const resp = await fetchHandleHistory(handle);
    inFlightHandle = null;

    // The user may have navigated to a different profile while we waited.
    if (lastHandleSeen !== handle) return;

    removeOverlay();
    if (!resp?.ok) return;
    const overlay = buildOverlay(handle, resp.data);
    if (!overlay) return;

    const anchor = findInjectionAnchor();
    if (!anchor || !anchor.parentNode) {
      // DOM not ready — try again shortly
      setTimeout(() => {
        if (lastHandleSeen === handle && !document.getElementById(OVERLAY_ID)) {
          const a = findInjectionAnchor();
          if (a && a.parentNode) a.parentNode.insertBefore(overlay, a.nextSibling);
        }
      }, 800);
      return;
    }
    anchor.parentNode.insertBefore(overlay, anchor.nextSibling);
  }

  function onLocationChange() {
    const handle = extractHandleFromPath();
    if (!handle) {
      lastHandleSeen = null;
      removeOverlay();
      return;
    }
    if (handle === lastHandleSeen && document.getElementById(OVERLAY_ID)) return;
    lastHandleSeen = handle;
    removeOverlay();
    // Wait for the profile DOM to render, then attempt injection.
    // Profile renders quickly but bio appears slightly later than UserName.
    setTimeout(() => {
      if (lastHandleSeen === handle) tryRender(handle);
    }, 600);
  }

  // Initial check
  onLocationChange();

  // SPA navigation watcher — X swaps content without full reload.
  // We listen to history pushState/popState as the most reliable signal.
  const _push = history.pushState;
  const _replace = history.replaceState;
  history.pushState = function () {
    _push.apply(this, arguments);
    setTimeout(onLocationChange, 50);
  };
  history.replaceState = function () {
    _replace.apply(this, arguments);
    setTimeout(onLocationChange, 50);
  };
  window.addEventListener("popstate", () => setTimeout(onLocationChange, 50));

  // Belt-and-suspenders: re-check on visible mutations (e.g. when X re-renders
  // the profile area after a tab switch).
  const observer = new MutationObserver(() => {
    const handle = extractHandleFromPath();
    if (!handle) return;
    if (handle === lastHandleSeen && !document.getElementById(OVERLAY_ID)) {
      // We had a handle but the overlay disappeared (X re-rendered) — re-inject.
      tryRender(handle);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
