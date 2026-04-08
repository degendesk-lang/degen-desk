const Stripe = require("stripe");

const PRICE_IDS = {
  monthly: "price_1TJjUJImLIzJxo34JDfJGF1w",
  quarterly: "price_1TJjazImLIzJxo34MAN8DHgj",
  yearly: "price_1TJjazImLIzJxo34PxLMdmNr",
};

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

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set in environment variables");
    return res.status(500).json({ error: "Server configuration error: missing Stripe key" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { plan, uid, email } = req.body;

  if (!plan || !uid || !email) {
    return res.status(400).json({ error: "Missing plan, uid, or email" });
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return res.status(400).json({ error: "Invalid plan. Use: monthly, quarterly, or yearly" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin || "https://degendesk.xyz"}/pricing.html?success=true`,
      cancel_url: `${req.headers.origin || "https://degendesk.xyz"}/pricing.html?canceled=true`,
      metadata: { firebaseUid: uid },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err.message, err.type);
    return res.status(500).json({ error: "Stripe error: " + err.message });
  }
};
