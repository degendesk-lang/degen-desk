// Builds the Degen Desk pitch video deck.
// Dark background, brand-teal accent, large readable type for full-screen video.

const pptxgen = require("pptxgenjs");

const BG = "06060B";          // near-black
const FG = "FFFFFF";          // white
const FG_MUTED = "B8BCC8";    // light gray for body
const ACCENT = "00D4AA";      // brand teal
const SUBTLE = "1A1C24";      // panel background for cards

const HEADER_FONT = "Helvetica Neue";
const BODY_FONT = "Helvetica Neue";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" × 5.625"
pres.author = "Degen Desk";
pres.title = "Degen Desk — Pitch";

// Helper: add the wordmark + accent dot in the top-right of content slides
function addWordmark(slide) {
  slide.addText("DEGEN DESK", {
    x: 7.4, y: 0.25, w: 2.4, h: 0.35,
    fontSize: 12, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "right", charSpacing: 3, margin: 0,
  });
  slide.addShape(pres.shapes.OVAL, {
    x: 9.55, y: 0.36, w: 0.12, h: 0.12,
    fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
  });
}

// ============================================================
// Slide 1 — Title
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: BG };

  // Accent dot above title
  s.addShape(pres.shapes.OVAL, {
    x: 4.85, y: 1.55, w: 0.3, h: 0.3,
    fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
  });

  s.addText("DEGEN DESK", {
    x: 0.5, y: 2.05, w: 9, h: 1.4,
    fontSize: 84, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "center", charSpacing: 8, margin: 0,
  });

  s.addText("Solana memecoin risk & analytics", {
    x: 0.5, y: 3.5, w: 9, h: 0.6,
    fontSize: 28, fontFace: BODY_FONT,
    color: ACCENT, align: "center", margin: 0,
  });

  s.addText("degendesk.xyz", {
    x: 0.5, y: 5.05, w: 9, h: 0.3,
    fontSize: 14, fontFace: BODY_FONT,
    color: FG_MUTED, align: "center", charSpacing: 2, margin: 0,
  });
}

// ============================================================
// Slide 2 — Problem
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: BG };
  addWordmark(s);

  // Big accent stat-style bar on the left side of headline
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.6, y: 1.7, w: 0.08, h: 2.0,
    fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
  });

  s.addText("Solana retail is the most rugged group in crypto.", {
    x: 0.95, y: 1.7, w: 8.5, h: 2.0,
    fontSize: 44, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "left", valign: "middle", margin: 0,
  });

  s.addText("Most never check on-chain before they buy.", {
    x: 0.95, y: 3.9, w: 8.5, h: 0.6,
    fontSize: 24, fontFace: BODY_FONT,
    color: FG_MUTED, align: "left", margin: 0,
  });
}

// ============================================================
// Slide 3 — Why Current Tools Fail
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: BG };
  addWordmark(s);

  s.addText("Current tools fail the users who need them most.", {
    x: 0.6, y: 0.95, w: 8.8, h: 1.0,
    fontSize: 36, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "left", margin: 0,
  });

  const items = [
    { label: "Pro trading terminals", body: "built for speed, not education" },
    { label: "Smart-money trackers", body: "paywalled, Telegram-gated" },
    { label: "Single-purpose tools", body: "retail has to stitch a stack" },
  ];

  let y = 2.4;
  for (const item of items) {
    // Accent square bullet
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: y + 0.18, w: 0.18, h: 0.18,
      fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
    });
    s.addText(
      [
        { text: item.label, options: { bold: true, color: FG } },
        { text: " — " + item.body, options: { color: FG_MUTED } },
      ],
      {
        x: 1.0, y: y, w: 8.5, h: 0.6,
        fontSize: 22, fontFace: BODY_FONT, align: "left", margin: 0,
      }
    );
    y += 0.85;
  }
}

// ============================================================
// Slide 4 — Solution (three surfaces)
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: BG };
  addWordmark(s);

  s.addText("Degen Desk. Three surfaces, one platform.", {
    x: 0.6, y: 0.95, w: 8.8, h: 1.0,
    fontSize: 36, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "left", margin: 0,
  });

  // Three cards
  const cardLabels = ["WEB CHAT AGENT", "CHROME EXTENSION", "iOS APP"];
  const cardWidth = 2.7;
  const gap = 0.35;
  const totalWidth = cardLabels.length * cardWidth + (cardLabels.length - 1) * gap;
  const startX = (10 - totalWidth) / 2;
  const cardY = 2.4;
  const cardH = 1.7;

  cardLabels.forEach((label, idx) => {
    const x = startX + idx * (cardWidth + gap);

    // Card panel
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardWidth, h: cardH,
      fill: { color: SUBTLE }, line: { color: ACCENT, width: 1 },
    });

    // Top accent bar
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardWidth, h: 0.08,
      fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
    });

    s.addText(label, {
      x, y: cardY + 0.4, w: cardWidth, h: cardH - 0.4,
      fontSize: 18, fontFace: HEADER_FONT, bold: true,
      color: FG, align: "center", valign: "middle", charSpacing: 2, margin: 0,
    });
  });

  s.addText("Solana   |   Ethereum   |   Base   |   BNB", {
    x: 0.5, y: 4.5, w: 9, h: 0.5,
    fontSize: 18, fontFace: BODY_FONT,
    color: FG_MUTED, align: "center", charSpacing: 4, margin: 0,
  });
}

// ============================================================
// Slide 5 — Free Tier IS the Product
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: BG };
  addWordmark(s);

  s.addText("The free tier IS the product.", {
    x: 0.6, y: 0.95, w: 8.8, h: 1.0,
    fontSize: 40, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "left", margin: 0,
  });

  // Four features in 2x2 grid
  const features = [
    "Chat Agent",
    "Smart Money Tracker",
    "Heatmap & Handle History",
    "Chrome Extension",
  ];
  const colW = 4.2;
  const colGap = 0.4;
  const rowH = 0.9;
  const rowGap = 0.25;
  const gridStartX = (10 - (2 * colW + colGap)) / 2;
  const gridStartY = 2.4;

  features.forEach((feat, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const x = gridStartX + col * (colW + colGap);
    const y = gridStartY + row * (rowH + rowGap);

    // Background panel
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: colW, h: rowH,
      fill: { color: SUBTLE }, line: { color: SUBTLE, width: 0 },
    });

    // FREE tag
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.2, y: y + 0.27, w: 0.7, h: 0.35,
      fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
    });
    s.addText("FREE", {
      x: x + 0.2, y: y + 0.27, w: 0.7, h: 0.35,
      fontSize: 12, fontFace: HEADER_FONT, bold: true,
      color: BG, align: "center", valign: "middle", charSpacing: 2, margin: 0,
    });

    // Feature label
    s.addText(feat, {
      x: x + 1.05, y, w: colW - 1.15, h: rowH,
      fontSize: 20, fontFace: HEADER_FONT, bold: true,
      color: FG, align: "left", valign: "middle", margin: 0,
    });
  });
}

// ============================================================
// Slide 6 — Traction
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: BG };
  addWordmark(s);

  s.addText("Real traction. Six weeks. Solo.", {
    x: 0.6, y: 0.95, w: 8.8, h: 1.0,
    fontSize: 38, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "left", margin: 0,
  });

  const items = [
    { lead: "1UP Esports", rest: " — flagship partner (top-20 Fortnite org)" },
    { lead: "Shipping weekly", rest: " since late March" },
    { lead: "Seventeen", rest: ", in online high school full-time on this" },
    { lead: "Quit fast-food job", rest: " months ago to bet on it" },
  ];

  let y = 2.3;
  for (const item of items) {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: y + 0.16, w: 0.18, h: 0.18,
      fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
    });
    s.addText(
      [
        { text: item.lead, options: { bold: true, color: FG } },
        { text: item.rest, options: { color: FG_MUTED } },
      ],
      {
        x: 1.0, y: y, w: 8.5, h: 0.55,
        fontSize: 20, fontFace: BODY_FONT, align: "left", margin: 0,
      }
    );
    y += 0.7;
  }
}

// ============================================================
// Slide 7 — Why Now
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: BG };
  addWordmark(s);

  s.addText("Why now.", {
    x: 0.6, y: 0.95, w: 8.8, h: 1.0,
    fontSize: 48, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "left", margin: 0,
  });

  const items = [
    "Solana memecoin wave at peak — harm scaling with it",
    "AI lets one person ship a chat agent worth using",
    "Free public-goods infrastructure needs to exist first",
  ];

  let y = 2.5;
  for (const item of items) {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: y + 0.2, w: 0.18, h: 0.18,
      fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
    });
    s.addText(item, {
      x: 1.0, y: y, w: 8.5, h: 0.6,
      fontSize: 22, fontFace: BODY_FONT,
      color: FG, align: "left", margin: 0,
    });
    y += 0.8;
  }
}

// ============================================================
// Slide 8 — Ask & Close
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: BG };

  // Accent dot above title
  s.addShape(pres.shapes.OVAL, {
    x: 4.85, y: 1.55, w: 0.3, h: 0.3,
    fill: { color: ACCENT }, line: { color: ACCENT, width: 0 },
  });

  s.addText("DEGEN DESK", {
    x: 0.5, y: 2.05, w: 9, h: 1.2,
    fontSize: 76, fontFace: HEADER_FONT, bold: true,
    color: FG, align: "center", charSpacing: 8, margin: 0,
  });

  s.addText("Accelerator + funding to scale free-tier infrastructure", {
    x: 0.5, y: 3.45, w: 9, h: 0.6,
    fontSize: 22, fontFace: BODY_FONT, bold: true,
    color: ACCENT, align: "center", margin: 0,
  });

  s.addText("degendesk.xyz", {
    x: 0.5, y: 5.05, w: 9, h: 0.3,
    fontSize: 14, fontFace: BODY_FONT,
    color: FG_MUTED, align: "center", charSpacing: 2, margin: 0,
  });
}

pres.writeFile({ fileName: "/Users/annieb/Claude Code/memecoin-agent/marketing/degen-desk-pitch.pptx" })
  .then((fn) => console.log("Wrote", fn));
