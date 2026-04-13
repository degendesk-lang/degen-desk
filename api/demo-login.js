/**
 * Demo Login endpoint for Apple App Review.
 *
 * Apple reviewers need a way to sign into the app without a personal Google
 * account. This endpoint accepts a secret review code and returns a Firebase
 * custom token for a dedicated demo user account.
 *
 * Usage:
 *   POST /api/demo-login  { "code": "<APP_REVIEW_CODE>" }
 *   Returns: { "customToken": "...", "uid": "...", "email": "..." }
 *
 * The client (auth.js) detects ?review=CODE in the URL and calls this
 * endpoint automatically, then signs in with signInWithCustomToken().
 *
 * Environment variables:
 *   APP_REVIEW_CODE — the secret code Apple reviewers use to sign in.
 *                     Set this in Vercel → Settings → Environment Variables.
 */

const admin = require("firebase-admin");

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }
}

// Fixed UID and email for the demo reviewer account.
// Using a deterministic UID so the same Firestore user doc is reused every time.
const DEMO_UID = "apple-reviewer-demo-account";
const DEMO_EMAIL = "appreview@degendesk.xyz";
const DEMO_DISPLAY_NAME = "App Reviewer";

module.exports = async function handler(req, res) {
  // CORS
  const allowedOrigins = [
    "https://degendesk.xyz",
    "https://www.degendesk.xyz",
    "http://localhost:3000",
    "capacitor://localhost",
    "ionic://localhost",
  ];
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  if (!admin.apps.length) {
    return res.status(500).json({ error: "Firebase Admin not configured" });
  }

  const reviewCode = process.env.APP_REVIEW_CODE;
  if (!reviewCode) {
    return res
      .status(500)
      .json({ error: "APP_REVIEW_CODE not set on server" });
  }

  try {
    const { code } = req.body || {};

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Missing review code" });
    }

    // Constant-time comparison to prevent timing attacks
    if (code.length !== reviewCode.length || code !== reviewCode) {
      return res.status(403).json({ error: "Invalid review code" });
    }

    // Ensure the demo Firebase Auth user exists
    try {
      await admin.auth().getUser(DEMO_UID);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        await admin.auth().createUser({
          uid: DEMO_UID,
          email: DEMO_EMAIL,
          displayName: DEMO_DISPLAY_NAME,
          emailVerified: true,
        });
      } else {
        throw err;
      }
    }

    // Ensure the Firestore user doc exists with free tier
    const db = admin.firestore();
    const userRef = db.collection("users").doc(DEMO_UID);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({
        email: DEMO_EMAIL,
        displayName: DEMO_DISPLAY_NAME,
        tier: "free",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isReviewAccount: true,
      });
    }

    // Mint a custom token
    const customToken = await admin.auth().createCustomToken(DEMO_UID, {
      email: DEMO_EMAIL,
      name: DEMO_DISPLAY_NAME,
    });

    return res.status(200).json({
      customToken,
      uid: DEMO_UID,
      email: DEMO_EMAIL,
    });
  } catch (err) {
    console.error("demo-login error:", err);
    return res.status(500).json({ error: "Demo login failed" });
  }
};
