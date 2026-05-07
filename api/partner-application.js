/**
 * Partner application intake — POST /api/partner-application
 *
 * Public endpoint. Anyone can submit; we validate server-side and write
 * via Admin SDK so Firestore rules can lock down /partner_applications
 * to admin-only reads/writes.
 *
 * On success, also emails partners@degendesk.xyz so new applications
 * surface immediately. Email is best-effort — a Resend failure does not
 * fail the submission.
 */

const admin = require("firebase-admin");

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

const db = admin.apps.length > 0 ? admin.firestore() : null;

const PLATFORMS = new Set(["x", "tiktok", "instagram", "youtube", "podcast", "newsletter", "discord", "other"]);
const AUDIENCE_SIZES = new Set(["under_1k", "1k_5k", "5k_25k", "25k_100k", "100k_500k", "500k_plus"]);
const AUDIENCE_FOCUS = new Set(["crypto", "finance", "tech", "lifestyle", "college", "trading", "other"]);

function bad(res, msg) {
  return res.status(400).json({ error: msg });
}

module.exports = async function handler(req, res) {
  const allowedOrigins = ["https://degendesk.xyz", "https://www.degendesk.xyz", "http://localhost:3000"];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!db) return res.status(500).json({ error: "Database not configured" });

  const body = req.body || {};
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const platform = String(body.platform || "").trim();
  const handle = String(body.handle || "").trim();
  const audienceSize = String(body.audienceSize || "").trim();
  const audienceFocus = String(body.audienceFocus || "").trim();
  const pitch = String(body.pitch || "").trim();
  const agreed = body.agreed === true;

  if (!name || name.length > 200) return bad(res, "Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return bad(res, "Please enter a valid email address.");
  if (!PLATFORMS.has(platform)) return bad(res, "Please pick a platform.");
  if (!handle || handle.length > 200) return bad(res, "Please enter your handle or channel link.");
  if (!AUDIENCE_SIZES.has(audienceSize)) return bad(res, "Please pick an audience size.");
  if (!AUDIENCE_FOCUS.has(audienceFocus)) return bad(res, "Please pick an audience focus.");
  if (pitch.length > 4000) return bad(res, "Pitch is too long (4000 char max).");
  if (!agreed) return bad(res, "You must agree to the disclosure terms.");

  try {
    await db.collection("partner_applications").doc(email).set(
      {
        name,
        email,
        platform,
        handle,
        audienceSize,
        audienceFocus,
        pitch,
        agreed,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
        referrer: String(req.headers.referer || "").slice(0, 500),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("[partner-application] firestore save failed:", err);
    return res.status(500).json({ error: "Could not save application. Please email partners@degendesk.xyz." });
  }

  // Best-effort notification email. Never fails the request.
  if (process.env.RESEND_API_KEY) {
    try {
      const html = `
<h2>New Degen Desk partner application</h2>
<p><strong>Name:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email)}</p>
<p><strong>Platform:</strong> ${escapeHtml(platform)}</p>
<p><strong>Handle:</strong> ${escapeHtml(handle)}</p>
<p><strong>Audience size:</strong> ${escapeHtml(audienceSize)}</p>
<p><strong>Audience focus:</strong> ${escapeHtml(audienceFocus)}</p>
<p><strong>Pitch:</strong></p>
<p>${escapeHtml(pitch).replace(/\n/g, "<br>")}</p>
<hr>
<p><a href="https://degendesk.xyz/admin-partners.html">Review in admin dashboard →</a></p>`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Degen Desk <partners@degendesk.xyz>",
          to: ["partners@degendesk.xyz"],
          subject: `New partner application — ${name} (${platform})`,
          html,
          reply_to: email,
        }),
      });
      if (!r.ok) console.error("[partner-application] resend non-2xx:", r.status, await r.text());
    } catch (err) {
      console.error("[partner-application] resend failed:", err.message);
    }
  }

  return res.status(200).json({ ok: true });
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
