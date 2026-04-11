/**
 * Degen Desk — Apple IAP integration via RevenueCat
 *
 * Exposes a small window.DegenDeskIAP API used by pricing.html:
 *   - init({ firebaseUid })  — configure RevenueCat and identify the user
 *   - purchase(plan)         — purchase "monthly" | "yearly"
 *   - restore()              — restore previous purchases, returns true if Pro
 *   - getEntitlement()       — returns current entitlement info
 *   - isPro()                — boolean, synchronous cached check
 *
 * Product IDs (App Store Connect):
 *   degendesk_pro_monthly  → $18.99/mo
 *   degendesk_pro_yearly   → $189.99/yr with 3-day free trial
 *
 * Entitlement ID (RevenueCat dashboard):
 *   "pro"  — granted by either subscription
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
  // Set this after creating the project at app.revenuecat.com.
  // Placeholder will be replaced once the RevenueCat project is ready.
  const REVENUECAT_APPLE_KEY = "appl_REPLACE_ME";

  // ---- Platform detection --------------------------------------------------
  function isNativePlatform() {
    return (
      typeof window.Capacitor !== "undefined" &&
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform()
    );
  }

  // ---- State ---------------------------------------------------------------
  let _initialized = false;
  let _initPromise = null;
  let _cachedPro = false;
  let _Purchases = null;
  let _LOG_LEVEL = null;

  // ---- Lazy loader for @revenuecat/purchases-capacitor --------------------
  async function loadPurchases() {
    if (_Purchases) return _Purchases;
    // When running inside the Capacitor WebView, the plugin registers itself
    // on window.Capacitor.Plugins. We access it there instead of ES import
    // (this codebase does not use a bundler).
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    if (!plugins || !plugins.Purchases) {
      throw new Error(
        "RevenueCat plugin not available. Make sure @revenuecat/purchases-capacitor is installed and npx cap sync ran."
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
      const Purchases = await loadPurchases();

      // Enable verbose logging during development — safe to leave on for now.
      try {
        if (_LOG_LEVEL && _LOG_LEVEL.DEBUG) {
          await Purchases.setLogLevel({ level: _LOG_LEVEL.DEBUG });
        } else {
          await Purchases.setLogLevel({ level: "DEBUG" });
        }
      } catch (_) {}

      if (REVENUECAT_APPLE_KEY.startsWith("appl_REPLACE")) {
        console.warn("[IAP] RevenueCat API key is a placeholder — purchases will fail until it is set in iap.js.");
      }

      await Purchases.configure({
        apiKey: REVENUECAT_APPLE_KEY,
        appUserID: firebaseUid || null,
      });

      // Prime the cached entitlement state
      try {
        const info = await Purchases.getCustomerInfo();
        _cachedPro = hasProEntitlement(info);
      } catch (_) {}

      _initialized = true;
    })();

    return _initPromise;
  }

  async function identify(firebaseUid) {
    if (!isNativePlatform() || !firebaseUid) return;
    if (!_initialized) await init({ firebaseUid });
    const Purchases = await loadPurchases();
    try {
      await Purchases.logIn({ appUserID: firebaseUid });
      const info = await Purchases.getCustomerInfo();
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
    if (!_initialized) await init({});

    const productId = PRODUCT_IDS[plan];
    if (!productId) throw new Error("Unknown plan: " + plan);

    const Purchases = await loadPurchases();

    // Load offerings from RevenueCat and find the matching package.
    let targetPackage = null;
    try {
      const offeringsResult = await Purchases.getOfferings();
      const current = offeringsResult && offeringsResult.current;
      if (current && Array.isArray(current.availablePackages)) {
        for (const pkg of current.availablePackages) {
          const pid =
            (pkg.product && pkg.product.identifier) ||
            pkg.identifier ||
            "";
          if (pid === productId) {
            targetPackage = pkg;
            break;
          }
        }
      }
    } catch (err) {
      console.error("[IAP] getOfferings error:", err);
      throw new Error("Could not load subscription products. Please try again.");
    }

    if (!targetPackage) {
      throw new Error(
        "Product not available: " + productId + ". Make sure the RevenueCat offering is configured."
      );
    }

    // Kick off the purchase. Apple's sheet will appear; user confirms with Face ID.
    let result;
    try {
      result = await Purchases.purchasePackage({ aPackage: targetPackage });
    } catch (err) {
      if (err && (err.userCancelled || err.code === "PURCHASE_CANCELLED")) {
        const e = new Error("Purchase cancelled");
        e.userCancelled = true;
        throw e;
      }
      throw new Error(err && err.message ? err.message : "Purchase failed.");
    }

    const customerInfo = result && result.customerInfo;
    _cachedPro = hasProEntitlement(customerInfo);

    if (!_cachedPro) {
      throw new Error("Purchase completed but Pro entitlement was not granted. Please try Restore Purchases.");
    }
    return true;
  }

  async function restore() {
    if (!isNativePlatform()) return false;
    if (!_initialized) await init({});
    const Purchases = await loadPurchases();
    try {
      const result = await Purchases.restorePurchases();
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
    if (!_initialized) await init({});
    const Purchases = await loadPurchases();
    try {
      const info = await Purchases.getCustomerInfo();
      _cachedPro = hasProEntitlement(info);
      return info;
    } catch (_) {
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
  };
})();
