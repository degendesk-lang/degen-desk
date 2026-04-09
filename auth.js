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

  // Detect Capacitor native app
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      if (isNative) {
        // Native app: redirect is the only approach that works in WKWebView
        // Popup opens SFSafariViewController which can't communicate back
        await auth.signInWithRedirect(provider);
      } else {
        // Web: popup works normally in browsers
        await auth.signInWithPopup(provider);
      }
    } catch (err) {
      if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user") {
        await auth.signInWithRedirect(provider);
      } else {
        console.error("Sign in error:", err);
      }
    }
  }

  // Handle redirect result on page load (needed for native app sign-in)
  auth.getRedirectResult().then((result) => {
    if (result && result.user) {
      console.log("Sign-in redirect complete:", result.user.email);
    }
  }).catch((err) => {
    if (err.code && err.code !== "auth/no-auth-event") {
      console.error("Redirect result error:", err);
    }
  });

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

  auth.onAuthStateChanged((user) => {
    currentUser = user;
    authChangeCallbacks.forEach((cb) => cb(user));
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
