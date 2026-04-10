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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!admin.apps.length) {
    return res.status(500).json({ error: "Firebase Admin not configured" });
  }

  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "Missing idToken" });
    }

    // Verify the Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Mint a custom token that the app can use with signInWithCustomToken()
    const customToken = await admin.auth().createCustomToken(decoded.uid, {
      email: decoded.email,
      name: decoded.name,
    });

    return res.status(200).json({ customToken });
  } catch (err) {
    console.error("custom-token error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
