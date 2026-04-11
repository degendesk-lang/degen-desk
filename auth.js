/**
 * Degen Desk - Firebase Auth + Multi-Conversation Firestore Persistence
 */

window.DegenAuth = (function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAJ0MogernylRUNde0ni0obpSVjOgiOPms",
    authDomain: "degen-desk-7cbe6.firebaseapp.com",
    projectId: "degen-desk-7cbe6",
    storageBucket: "degen-desk-7cbe6.firebasestorage.app",
    messagingSenderId: "382072874801",
    appId: "1:382072874801:web:7a5c9575aab35aa0263210",
    measurementId: "G-YKPPMB9SSH",
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUser = null;
  let currentConversationId = null;
  let authChangeCallbacks = [];

  // =============================================
  // REFERRAL CODE CAPTURE
  // =============================================
  // Capture ?ref=CODE from URL and store in localStorage
  (function captureReferral() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("degen_referral_code", ref.toUpperCase());
      // Clean the URL without reload
      const url = new URL(window.location);
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  })();

  function getReferralCode() {
    return localStorage.getItem("degen_referral_code") || null;
  }

  function clearReferralCode() {
    localStorage.removeItem("degen_referral_code");
  }

  // =============================================
  // AUTH
  // =============================================

  // Detect Capacitor native platform
  function isNativePlatform() {
    return (
      typeof window.Capacitor !== "undefined" &&
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform()
    );
  }

  async function signIn() {
    try {
      if (isNativePlatform()) {
        // iOS/Android: open auth-callback page in SFSafariViewController.
        // The callback page talks to Google OAuth directly (implicit flow)
        // and hands the id_token back to the app via a degendesk:// URL scheme.
        // Cache-busting query param forces SFSafariViewController to fetch
        // the latest HTML every time (it caches aggressively).
        const Browser = window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
        if (Browser) {
          const cb = "https://degendesk.xyz/auth-callback.html?t=" + Date.now();
          await Browser.open({
            url: cb,
            presentationStyle: "popover",
          });
        } else {
          console.error("Capacitor Browser plugin not available");
        }
        return;
      }

      // Web: standard popup flow
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (err) {
      console.error("Sign in error:", err.code, err.message);
    }
  }

  // Handle deep-link callback from auth-callback.html (Capacitor native only)
  async function handleAuthDeepLink(urlStr) {
    try {
      const url = new URL(urlStr);
      // Accept both degendesk://auth?... and degendesk:///auth?...
      const isAuthLink =
        url.protocol === "degendesk:" &&
        (url.hostname === "auth" || url.pathname === "/auth" || url.pathname === "//auth");
      if (!isAuthLink) return false;

      // Close the in-app browser if it's still open
      try {
        const Browser = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
        if (Browser) await Browser.close();
      } catch (_) {}

      const idToken = url.searchParams.get("idToken");
      const method = url.searchParams.get("method");
      if (!idToken) return false;

      if (method === "google") {
        // We have the raw Google ID token — sign in directly with credential
        const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
        await auth.signInWithCredential(credential);
      } else if (method === "firebase") {
        // We have a Firebase ID token — exchange it for a custom token via our API
        const res = await fetch("https://degendesk.xyz/api/custom-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error("Token exchange failed");
        const { customToken } = await res.json();
        await auth.signInWithCustomToken(customToken);
      }
      return true;
    } catch (err) {
      console.error("Deep link sign-in error:", err);
      return false;
    }
  }

  // Register the deep-link listener on native platforms
  if (isNativePlatform()) {
    const tryRegister = () => {
      const AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (AppPlugin && typeof AppPlugin.addListener === "function") {
        AppPlugin.addListener("appUrlOpen", (data) => {
          if (data && data.url) handleAuthDeepLink(data.url);
        });
        return true;
      }
      return false;
    };
    // The Capacitor bridge may not be ready immediately — retry briefly
    if (!tryRegister()) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (tryRegister() || attempts > 20) clearInterval(interval);
      }, 150);
    }
  }

  async function signOut() {
    try {
      currentConversationId = null;
      await auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  function onAuthChange(callback) {
    authChangeCallbacks.push(callback);
  }

  // Initialize RevenueCat once on native platforms so offerings are warm by
  // the time the user visits pricing.html.
  if (isNativePlatform()) {
    try {
      if (window.DegenDeskIAP && typeof window.DegenDeskIAP.init === "function") {
        window.DegenDeskIAP.init({}).catch((err) => {
          console.warn("[IAP] init error:", err);
        });
      }
    } catch (_) {}
  }

  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    authChangeCallbacks.forEach((cb) => cb(user));

    // Sync RevenueCat with the signed-in Firebase user (native only).
    // This associates purchases with the correct Firebase uid so entitlements
    // follow the user across devices.
    try {
      const IAP = window.DegenDeskIAP;
      if (IAP && typeof IAP.isNative === "function" && IAP.isNative()) {
        if (user && user.uid) {
          await IAP.identify(user.uid);
        } else {
          await IAP.logOut();
        }
      }
    } catch (err) {
      console.warn("[IAP] auth sync error:", err);
    }
  });

  // =============================================
  // CONVERSATIONS
  // =============================================

  function conversationsRef(uid) {
    return db.collection("users").doc(uid).collection("conversations");
  }

  // Create a new conversation, return its ID
  async function createConversation(title) {
    if (!currentUser) return null;
    try {
      const ref = await conversationsRef(currentUser.uid).add({
        title: title || "New chat",
        messages: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      currentConversationId = ref.id;
      return ref.id;
    } catch (err) {
      console.error("Failed to create conversation:", err);
      return null;
    }
  }

  // List all conversations for current user (newest first)
  async function listConversations() {
    if (!currentUser) return [];
    try {
      const snapshot = await conversationsRef(currentUser.uid)
        .orderBy("updatedAt", "desc")
        .limit(50)
        .get();
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (err) {
      console.error("Failed to list conversations:", err);
      return [];
    }
  }

  // Load messages from a specific conversation
  async function loadConversation(convId) {
    if (!currentUser) return [];
    try {
      currentConversationId = convId;
      const doc = await conversationsRef(currentUser.uid).doc(convId).get();
      if (doc.exists && doc.data().messages) {
        return doc.data().messages;
      }
      return [];
    } catch (err) {
      console.error("Failed to load conversation:", err);
      return [];
    }
  }

  // Save a message to the current conversation
  async function saveMessage(role, content) {
    if (!currentUser || !currentConversationId) return;
    try {
      const ref = conversationsRef(currentUser.uid).doc(currentConversationId);
      const doc = await ref.get();
      let messages = [];
      let isFirstUserMessage = false;

      if (doc.exists && doc.data().messages) {
        messages = doc.data().messages;
      }

      // Check if this is the first user message (for auto-titling)
      if (role === "user" && messages.filter((m) => m.role === "user").length === 0) {
        isFirstUserMessage = true;
      }

      messages.push({
        role,
        content: content.substring(0, 2000),
        timestamp: Date.now(),
      });

      if (messages.length > 100) {
        messages = messages.slice(-100);
      }

      const updateData = {
        messages,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      // Auto-title from first user message
      if (isFirstUserMessage) {
        updateData.title = content.substring(0, 50) + (content.length > 50 ? "..." : "");
      }

      await ref.update(updateData);

      // Return whether title was updated so UI can refresh
      return isFirstUserMessage;
    } catch (err) {
      console.error("Failed to save message:", err);
      return false;
    }
  }

  // Delete a conversation
  async function deleteConversation(convId) {
    if (!currentUser) return;
    try {
      await conversationsRef(currentUser.uid).doc(convId).delete();
      if (currentConversationId === convId) {
        currentConversationId = null;
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }

  // =============================================
  // SUBSCRIPTION / TIER
  // =============================================

  let userTier = "free";

  async function loadUserTier() {
    if (!currentUser) {
      userTier = "free";
      return "free";
    }
    try {
      const doc = await db.collection("users").doc(currentUser.uid).get();
      if (doc.exists && doc.data().tier === "pro" && doc.data().subscriptionStatus === "active") {
        userTier = "pro";
      } else {
        userTier = "free";
      }
    } catch (err) {
      console.error("Failed to load tier:", err);
      userTier = "free";
    }

    // On iOS, also check the local RevenueCat entitlement. This covers the
    // short gap between a successful purchase and the RC webhook writing to
    // Firestore, and lets the app work offline after an initial sync.
    try {
      const IAP = window.DegenDeskIAP;
      if (userTier !== "pro" && IAP && typeof IAP.isNative === "function" && IAP.isNative()) {
        // Refresh the cached entitlement from StoreKit via RevenueCat
        if (typeof IAP.getEntitlement === "function") {
          await IAP.getEntitlement();
        }
        if (typeof IAP.isPro === "function" && IAP.isPro()) {
          userTier = "pro";
        }
      }
    } catch (_) {}

    return userTier;
  }

  // =============================================
  // PUBLIC API
  // =============================================

  return {
    get currentUser() {
      return currentUser;
    },
    get currentConversationId() {
      return currentConversationId;
    },
    set currentConversationId(val) {
      currentConversationId = val;
    },
    get tier() {
      return userTier;
    },
    signIn,
    signOut,
    onAuthChange,
    createConversation,
    listConversations,
    loadConversation,
    saveMessage,
    deleteConversation,
    loadUserTier,
    getReferralCode,
    clearReferralCode,
  };
})();
