/**
 * Degen Desk — Sentry error monitoring (optional).
 *
 * To activate:
 *   1. Go to https://sentry.io and sign up (free tier: 5k errors/mo, plenty for launch).
 *   2. Create a new project → choose "Browser JavaScript".
 *   3. Sentry gives you a DSN (looks like: https://abc123@o456.ingest.sentry.io/7890).
 *   4. Replace the SENTRY_DSN value below with your real DSN.
 *   5. That's it. Errors will start reporting to your Sentry dashboard.
 *
 * If SENTRY_DSN is left as "" (empty), this script no-ops silently — the app
 * runs normally without error monitoring. Safe to deploy unconfigured.
 */

(function () {
  const SENTRY_DSN = ""; // ← paste your Sentry DSN here to activate

  if (!SENTRY_DSN) return;

  // Load Sentry SDK lazily only if a DSN is configured
  const script = document.createElement("script");
  script.src = "https://browser.sentry-cdn.com/7.114.0/bundle.min.js";
  script.crossOrigin = "anonymous";
  script.async = true;
  script.onload = function () {
    try {
      if (typeof Sentry === "undefined") return;
      Sentry.init({
        dsn: SENTRY_DSN,
        environment: location.hostname === "localhost" ? "development" : "production",
        release: "degen-desk@1.0.0",
        tracesSampleRate: 0.1, // sample 10% of performance traces to stay under free tier
        ignoreErrors: [
          // Browser extension noise
          "ResizeObserver loop limit exceeded",
          "Non-Error promise rejection captured",
          // Firebase / network noise that isn't actionable
          "Network request failed",
          // Script load failures from user's blocked extensions / ad blockers
          "Script error.",
        ],
        beforeSend: function (event) {
          // Strip sensitive data from error reports
          if (event.request && event.request.url) {
            event.request.url = event.request.url.replace(/[?&]ref=[^&]*/g, "");
          }
          return event;
        },
      });

      // Hook into Firebase Auth if available to attach user context
      if (window.DegenAuth) {
        const origCallbacks = window.DegenAuth;
        if (typeof origCallbacks.onAuthChange === "function") {
          origCallbacks.onAuthChange(function (user) {
            if (user) {
              Sentry.setUser({ id: user.uid, email: user.email || undefined });
            } else {
              Sentry.setUser(null);
            }
          });
        }
      }
    } catch (err) {
      console.warn("[Sentry] init failed:", err && err.message);
    }
  };
  document.head.appendChild(script);
})();
