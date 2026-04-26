/**
 * Degen Desk — Apple IAP integration via RevenueCat
 *
 * Exposes a small window.DegenDeskIAP API used by pricing.html:
 *   - init({ firebaseUid })       — configure RevenueCat and identify the user
 *   - identify(firebaseUid)       — swap the RevenueCat user to a Firebase UID
 *   - logOut()                    — sign out of RevenueCat (call on Firebase sign-out)
 *   - purchase(plan)              — purchase "monthly" | "yearly"
 *   - restore()                   — restore previous purchases, returns true if Pro
 *   - getEntitlement()            — returns current entitlement info
 *   - isPro()                     — boolean, synchronous cached check
 *   - isNative()                  — true inside the Capacitor WebView
 *   - getConfigurationStatus()    — { ready: boolean, reason?: string }
 *
 * =========================================================================
 * REVENUECAT DASHBOARD SETUP (do these before the placeholder key is swapped)
 * =========================================================================
 * 1. Create project at https://app.revenuecat.com (bundle ID xyz.degendesk.app).
 * 2. Apps → + New → Apple App Store. Upload the in-app purchase key (.p8)
 *    from App Store Connect → Users and Access → Keys → In-App Purchase.
 * 3. Copy the PUBLIC Apple API key (starts with "appl_") and paste it into
 *    REVENUECAT_APPLE_KEY below. This key is safe to ship in client code.
 * 4. Products → + New Product → add BOTH of these (identifiers must match
 *    the App Store Connect product IDs exactly):
 *      - degendesk_pro_monthly   (type: Auto-renewable subscription)
 *      - degendesk_pro_yearly    (type: Auto-renewable subscription)
 * 5. Entitlements → + New → id "pro". Attach BOTH products above.
 * 6. Offerings → create a "default" offering, mark it "Current".
 *    Add two packages:
 *      - $rc_monthly  →  degendesk_pro_monthly
 *      - $rc_annual   →  degendesk_pro_yearly
 * 7. Integrations → Webhooks → add https://degendesk.xyz/api/revenuecat-webhook
 *    and copy the signing secret into Vercel env var REVENUECAT_WEBHOOK_SECRET.
 * 8. In App Store Connect, make sure both subscriptions are in "Ready to
 *    Submit" state and attached to your first app version, otherwise
 *    getOfferings() will return an empty list in TestFlight.
 * =========================================================================
 *
 * Product IDs (App Store Connect):
 *   degendesk_pro_monthly  → $17.99/mo
 *   degendesk_pro_yearly   → $179.99/yr with 3-day free trial
 *
 * Platform behavior:
 *   - On web or non-native: all methods are no-ops that throw/return false.
 *   - On iOS (Capacitor): uses @revenuecat/purchases-capacitor.
 */

(function () {
  "use strict";

  // ---- Config --------------------------------------------------------------
  const ENTITLEMENT_ID = "pro";
  const PRODUCT_IDS = {
    monthly: "degendesk_pro_monthly",
    yearly: "degendesk_pro_yearly",
  };

  // RevenueCat public (Apple) API key — safe to ship in client code.
  // Swap this once the RevenueCat project is created. See setup steps above.
  const REVENUECAT_APPLE_KEY = "appl_REPLACE_ME";

  // Timeout (ms) for network calls to RevenueCat. Keeps the UI from hanging
  // forever if the user is offline or the RC backend is down.
  const NETWORK_TIMEOUT_MS = 15000;

  // ---- Platform detection --------------------------------------------------
  function isNativePlatform() {
    return (
      typeof window.Capacitor !== "undefined" &&
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform()
    );
  }

  function isPlaceholderKey() {
    return (
      !REVENUECAT_APPLE_KEY ||
      REVENUECAT_APPLE_KEY.startsWith("appl_REPLACE") ||
      REVENUECAT_APPLE_KEY === "appl_"
    );
  }

  function getConfigurationStatus() {
    if (!isNativePlatform()) {
      return { ready: false, reason: "not-native" };
    }
    if (isPlaceholderKey()) {
      return { ready: false, reason: "placeholder-key" };
    }
    return { ready: true };
  }

  // ---- State ---------------------------------------------------------------
  let _initialized = false;
  let _initPromise = null;
  let _cachedPro = false;
  let _Purchases = null;
  let _LOG_LEVEL = null;
  let _warnedPlaceholder = false;

  // ---- Utilities -----------------------------------------------------------
  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error((label || "Operation") + " timed out after " + ms + "ms"));
      }, ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }

  function warnPlaceholderOnce() {
    if (_warnedPlaceholder) return;
    _warnedPlaceholder = true;
    // Loud, obvious banner in the console so we cannot miss it in dev.
    const style = "background:#ff3355;color:#fff;font-weight:700;padding:4px 8px;border-radius:4px;";
    console.warn(
      "%c[DegenDeskIAP]%c RevenueCat API key is a placeholder (" +
        REVENUECAT_APPLE_KEY +
        "). Purchases will fail until you set REVENUECAT_APPLE_KEY in iap.js. " +
        "See the setup block at the top of iap.js.",
      style,
      ""
    );
  }

  // ---- Lazy loader for @revenuecat/purchases-capacitor --------------------
  async function loadPurchases() {
    if (_Purchases) return _Purchases;
    // When running inside the Capacitor WebView, the plugin registers itself
    // on window.Capacitor.Plugins. We access it there instead of ES import
    // (this codebase does not use a bundler).
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    if (!plugins || !plugins.Purchases) {
      throw new Error(
        "RevenueCat plugin not available. Make sure @revenuecat/purchases-capacitor is installed and `npx cap sync ios` has been run since install."
      );
    }
    _Purchases = plugins.Purchases;
    // Try to grab the LOG_LEVEL enum if the plugin exposes it.
    _LOG_LEVEL = plugins.Purchases.LOG_LEVEL || null;
    return _Purchases;
  }

  // ---- Public API ----------------------------------------------------------
  async function init({ firebaseUid } = {}) {
    if (!isNativePlatform()) return;
    if (_initialized) return;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
      try {
        const Purchases = await loadPurchases();

        // Enable verbose logging during development — safe to leave on for now.
        try {
          if (_LOG_LEVEL && _LOG_LEVEL.DEBUG) {
            await Purchases.setLogLevel({ level: _LOG_LEVEL.DEBUG });
          } else {
            await Purchases.setLogLevel({ level: "DEBUG" });
          }
        } catch (_) {}

        if (isPlaceholderKey()) {
          warnPlaceholderOnce();
          // Intentionally still configure so we surface a real error on
          // purchase() instead of silently succeeding.
        }

        await Purchases.configure({
          apiKey: REVENUECAT_APPLE_KEY,
          appUserID: firebaseUid || null,
        });

        // Prime the cached entitlement state (best-effort; offline is OK).
        try {
          const info = await withTimeout(
            Purchases.getCustomerInfo(),
            NETWORK_TIMEOUT_MS,
            "getCustomerInfo"
          );
          _cachedPro = hasProEntitlement(info);
        } catch (err) {
          console.warn("[IAP] Could not load initial customer info:", err && err.message);
        }

        _initialized = true;
      } catch (err) {
        // Reset promise so the next call can retry.
        _initPromise = null;
        throw err;
      }
    })();

    return _initPromise;
  }

  async function identify(firebaseUid) {
    if (!isNativePlatform() || !firebaseUid) return;
    if (!_initialized) {
      try {
        await init({ firebaseUid });
      } catch (err) {
        console.error("[IAP] init during identify failed:", err);
        return;
      }
    }
    const Purchases = await loadPurchases();
    try {
      await Purchases.logIn({ appUserID: firebaseUid });
      const info = await withTimeout(
        Purchases.getCustomerInfo(),
        NETWORK_TIMEOUT_MS,
        "getCustomerInfo"
      );
      _cachedPro = hasProEntitlement(info);
    } catch (err) {
      console.error("[IAP] identify error:", err);
    }
  }

  async function logOut() {
    if (!isNativePlatform()) return;
    try {
      const Purchases = await loadPurchases();
      await Purchases.logOut();
      _cachedPro = false;
    } catch (_) {}
  }

  async function purchase(plan) {
    if (!isNativePlatform()) {
      throw new Error("Apple In-App Purchase is only available in the iOS app.");
    }
    if (isPlaceholderKey()) {
      warnPlaceholderOnce();
      throw new Error(
        "Purchases are not configured yet. The RevenueCat API key is still a placeholder — see iap.js setup instructions."
      );
    }
    if (!_initialized) await init({});

    const productId = PRODUCT_IDS[plan];
    if (!productId) throw new Error("Unknown plan: " + plan);

    const Purchases = await loadPurchases();

    // Load offerings from RevenueCat and find the matching package.
    let targetPackage = null;
    let offeringDiagnostics = "";
    try {
      const offeringsResult = await withTimeout(
        Purchases.getOfferings(),
        NETWORK_TIMEOUT_MS,
        "getOfferings"
      );
      const current = offeringsResult && offeringsResult.current;
      if (!current) {
        offeringDiagnostics =
          " No current offering is marked in the RevenueCat dashboard. Set one offering as 'Current' under Offerings.";
      } else if (!Array.isArray(current.availablePackages) || current.availablePackages.length === 0) {
        offeringDiagnostics =
          " The current offering has no packages attached. Add $rc_monthly and $rc_annual packages and re-save.";
      } else {
        for (const pkg of current.availablePackages) {
          const pid =
            (pkg.product && pkg.product.identifier) ||
            pkg.identifier ||
            "";
          if (pid === productId || pid.indexOf(productId) !== -1) {
            targetPackage = pkg;
            break;
          }
        }
        if (!targetPackage) {
          offeringDiagnostics =
            " Packages exist but none match product id '" +
            productId +
            "'. Check that the App Store Connect product IDs line up with the RevenueCat dashboard.";
        }
      }
    } catch (err) {
      console.error("[IAP] getOfferings error:", err);
      throw new Error(
        "Could not load subscription products. Please check your connection and try again."
      );
    }

    if (!targetPackage) {
      throw new Error("Product not available." + offeringDiagnostics);
    }

    // Kick off the purchase. Apple's sheet will appear; user confirms with Face ID.
    let result;
    try {
      result = await Purchases.purchasePackage({ aPackage: targetPackage });
    } catch (err) {
      if (err && (err.userCancelled || err.code === "PURCHASE_CANCELLED" || err.code === "1")) {
        const e = new Error("Purchase cancelled");
        e.userCancelled = true;
        throw e;
      }
      const msg = err && err.message ? err.message : "Purchase failed.";
      console.error("[IAP] purchasePackage error:", err);
      throw new Error(msg);
    }

    const customerInfo = result && result.customerInfo;
    _cachedPro = hasProEntitlement(customerInfo);

    if (!_cachedPro) {
      throw new Error(
        "Purchase completed but Pro entitlement was not granted. Please tap Restore Purchases, or contact support@degendesk.xyz."
      );
    }
    return true;
  }

  async function restore() {
    if (!isNativePlatform()) return false;
    if (isPlaceholderKey()) {
      warnPlaceholderOnce();
      throw new Error(
        "Purchases are not configured yet. The RevenueCat API key is still a placeholder."
      );
    }
    if (!_initialized) await init({});
    const Purchases = await loadPurchases();
    try {
      const result = await withTimeout(
        Purchases.restorePurchases(),
        NETWORK_TIMEOUT_MS,
        "restorePurchases"
      );
      const info = result && result.customerInfo ? result.customerInfo : result;
      _cachedPro = hasProEntitlement(info);
      return _cachedPro;
    } catch (err) {
      console.error("[IAP] restore error:", err);
      throw new Error(err && err.message ? err.message : "Could not restore purchases.");
    }
  }

  async function getEntitlement() {
    if (!isNativePlatform()) return null;
    if (!_initialized) {
      try {
        await init({});
      } catch (_) {
        return null;
      }
    }
    const Purchases = await loadPurchases();
    try {
      const info = await withTimeout(
        Purchases.getCustomerInfo(),
        NETWORK_TIMEOUT_MS,
        "getCustomerInfo"
      );
      _cachedPro = hasProEntitlement(info);
      return info;
    } catch (err) {
      console.warn("[IAP] getEntitlement error:", err && err.message);
      return null;
    }
  }

  function isPro() {
    return _cachedPro === true;
  }

  // ---- Helpers -------------------------------------------------------------
  function hasProEntitlement(customerInfo) {
    if (!customerInfo) return false;
    // The shape can be either { customerInfo: { entitlements: ... } } or
    // directly { entitlements: ... } depending on the plugin call.
    const ci = customerInfo.customerInfo || customerInfo;
    const ents = ci && ci.entitlements;
    if (!ents) return false;
    const active = ents.active || {};
    return !!active[ENTITLEMENT_ID];
  }

  // ---- Expose --------------------------------------------------------------
  window.DegenDeskIAP = {
    init,
    identify,
    logOut,
    purchase,
    restore,
    getEntitlement,
    isPro,
    isNative: isNativePlatform,
    getConfigurationStatus,
  };
})();
