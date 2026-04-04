/**
 * Degen Desk - Firebase Auth + Firestore Chat Persistence
 */

window.DegenAuth = (function () {
  // =============================================
  // FIREBASE CONFIG — Replace with your project's config
  // =============================================
  const firebaseConfig = {
    apiKey: "AIzaSyAJ0MogernylRUNde0ni0obpSVjQgiOPms",
    authDomain: "degen-desk-7cbe6.firebaseapp.com",
    projectId: "degen-desk-7cbe6",
    storageBucket: "degen-desk-7cbe6.firebasestorage.app",
    messagingSenderId: "382072874801",
    appId: "1:382072874801:web:7a5c9575aab35aa0263210",
    measurementId: "G-YKPPMB9SSH",
  };

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUser = null;
  let authChangeCallbacks = [];

  // =============================================
  // AUTH METHODS
  // =============================================

  async function signIn() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (err) {
      // If popup blocked, try redirect
      if (err.code === "auth/popup-blocked") {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithRedirect(provider);
      } else {
        console.error("Sign in error:", err);
      }
    }
  }

  async function signOut() {
    try {
      await auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  function onAuthChange(callback) {
    authChangeCallbacks.push(callback);
  }

  // Listen for auth state changes
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    authChangeCallbacks.forEach((cb) => cb(user));
  });

  // =============================================
  // FIRESTORE CHAT PERSISTENCE
  // =============================================

  function getConversationRef(uid) {
    return db.collection("users").doc(uid).collection("conversations").doc("default");
  }

  async function loadHistory() {
    if (!currentUser) return [];
    try {
      const doc = await getConversationRef(currentUser.uid).get();
      if (doc.exists && doc.data().messages) {
        return doc.data().messages;
      }
      return [];
    } catch (err) {
      console.error("Failed to load chat history:", err);
      return [];
    }
  }

  async function saveMessage(role, content) {
    if (!currentUser) return;
    try {
      const ref = getConversationRef(currentUser.uid);
      const doc = await ref.get();
      let messages = [];

      if (doc.exists && doc.data().messages) {
        messages = doc.data().messages;
      }

      messages.push({
        role,
        content: content.substring(0, 2000), // Limit content size
        timestamp: Date.now(),
      });

      // Keep last 100 messages to stay under Firestore doc limit
      if (messages.length > 100) {
        messages = messages.slice(-100);
      }

      await ref.set(
        {
          messages,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          displayName: currentUser.displayName || "",
          photoURL: currentUser.photoURL || "",
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to save message:", err);
    }
  }

  async function clearHistory() {
    if (!currentUser) return;
    try {
      await getConversationRef(currentUser.uid).delete();
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  }

  // =============================================
  // PUBLIC API
  // =============================================

  return {
    get currentUser() {
      return currentUser;
    },
    signIn,
    signOut,
    onAuthChange,
    loadHistory,
    saveMessage,
    clearHistory,
  };
})();
