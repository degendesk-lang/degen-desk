/**
 * Share Card Generator
 *
 * Renders a 1200×630 PNG of any Token Analysis report using the Canvas 2D API.
 * No external libs, no server round-trip — everything happens in the browser.
 *
 * The output is a Twitter-card-sized image branded with Degen Desk styling
 * so users can paste their analysis into X / Discord / Telegram and the
 * Degen Desk wordmark + URL go along for the ride.
 *
 * Public API:
 *   await DegenDeskShareCard.generate(data) → Blob (PNG)
 *   DegenDeskShareCard.attachToReport(reportData) — wires up the share button
 */
(function () {
  "use strict";

  const W = 1200;
  const H = 630;
  const PAD = 56;

  // Colors mirror the live report
  const COLORS = {
    bg: "#060610",
    bgPanel: "#0f0f1a",
    bgPanel2: "#16162a",
    border: "rgba(255, 255, 255, 0.08)",
    text: "#f0f0f8",
    textDim: "rgba(240, 240, 248, 0.6)",
    textMuted: "rgba(240, 240, 248, 0.4)",
    accent: "#a78bfa",
    green: "#00ff88",
    red: "#ff5555",
    risk: {
      low: "#00ff88",
      medium: "#ffcc33",
      high: "#ff9933",
      critical: "#ff5555",
      unknown: "rgba(150, 150, 170, 0.6)",
    },
  };

  const FILL_PCT = { low: 25, medium: 55, high: 80, critical: 96, unknown: 0 };

  // ----------- helpers -----------

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    if (v >= 1) return "$" + v.toFixed(2);
    if (v > 0) return "$" + v.toFixed(6);
    return "$0";
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  }

  function truncate(text, max) {
    if (!text) return "";
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trimEnd() + "…";
  }

  // Wrap text into multiple lines that fit within maxWidth.
  function wrapText(ctx, text, maxWidth, maxLines) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
        if (lines.length === maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines) {
      // Add ellipsis if truncated
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + "…").width > maxWidth && last.length > 0) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last + "…";
    }
    return lines;
  }

  // Draw the animated-ring gauge as a static snapshot.
  function drawGauge(ctx, cx, cy, radius, level) {
    const lvl = level || "unknown";
    const pct = FILL_PCT[lvl] ?? 0;
    const color = COLORS.risk[lvl] || COLORS.risk.unknown;
    const lineW = 12;

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.stroke();

    // Fill arc — start at top (-pi/2), go clockwise by pct
    const sweep = (pct / 100) * Math.PI * 2;
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + sweep);
      ctx.lineWidth = lineW;
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Center text
    ctx.fillStyle = color;
    ctx.font = "900 28px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelText = lvl === "unknown" ? "?" : lvl.charAt(0).toUpperCase() + lvl.slice(1);
    ctx.fillText(labelText, cx, cy - 6);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = "700 11px Inter, system-ui, sans-serif";
    ctx.fillText("RISK", cx, cy + 18);
  }

  // ----------- main render -----------

  async function render(data) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const m = data.metrics || {};
    const r = data.report || {};
    const ca = data.contractAddress || "";
    const tokenName = m.name || "Unknown Token";
    const tokenSymbol = m.symbol ? `$${m.symbol}` : "";

    // ---- Background ----
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#060610");
    bgGrad.addColorStop(1, "#0a0a18");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle accent glow top-right
    const glow = ctx.createRadialGradient(W - 100, 100, 0, W - 100, 100, 500);
    glow.addColorStop(0, "rgba(167, 139, 250, 0.18)");
    glow.addColorStop(1, "rgba(167, 139, 250, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Outer card border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 0);
    ctx.stroke();

    // ---- Header: logo + name + symbol + CA ----
    const tokenLogo = m.imageUrl ? await loadImage(m.imageUrl) : null;
    let cursorX = PAD;

    if (tokenLogo) {
      // Circle-clipped token logo
      const logoSize = 88;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cursorX + logoSize / 2, PAD + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(tokenLogo, cursorX, PAD, logoSize, logoSize);
      ctx.restore();
      // Ring around it
      ctx.beginPath();
      ctx.arc(cursorX + logoSize / 2, PAD + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      cursorX += logoSize + 22;
    }

    // Token name
    ctx.fillStyle = COLORS.text;
    ctx.font = "900 38px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const nameMaxW = W - cursorX - 200; // leave room for gauge on the right
    const nameTrunc = truncate(tokenName, 28);
    ctx.fillText(nameTrunc, cursorX, PAD + 4);

    // Symbol
    ctx.fillStyle = COLORS.accent;
    ctx.font = "700 22px Inter, system-ui, sans-serif";
    ctx.fillText(tokenSymbol, cursorX, PAD + 50);

    // CA preview
    if (ca) {
      const caShort = ca.slice(0, 6) + "..." + ca.slice(-6);
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = "500 14px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillText(caShort, cursorX, PAD + 82);
    }

    // ---- Risk gauge (right side of header) ----
    drawGauge(ctx, W - PAD - 60, PAD + 60, 54, r.riskLevel);

    // Risk label below gauge
    if (r.riskLabel) {
      const lvl = r.riskLevel || "unknown";
      const color = COLORS.risk[lvl] || COLORS.risk.unknown;
      ctx.fillStyle = color;
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      const labelLines = wrapText(ctx, r.riskLabel.toUpperCase(), 200, 2);
      labelLines.forEach((line, i) => {
        ctx.fillText(line, W - PAD - 60, PAD + 134 + i * 16);
      });
    }

    // ---- Metrics row ----
    const metricsY = 240;
    const metricH = 92;
    const metricW = (W - PAD * 2 - 30) / 4; // 4 tiles, 10px gap
    const metrics = [
      { label: "MARKET CAP", value: fmtUsd(m.marketCap) },
      { label: "PRICE", value: fmtUsd(m.priceUsd) },
      { label: "LIQUIDITY", value: fmtUsd(m.liquidityUsd) },
      {
        label: "24H CHANGE",
        value: fmtPct(m.priceChange24h),
        color: m.priceChange24h >= 0 ? COLORS.green : COLORS.red,
      },
    ];

    metrics.forEach((mt, i) => {
      const x = PAD + i * (metricW + 10);
      // Tile
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      roundRect(ctx, x, metricsY, metricW, metricH, 14);
      ctx.fill();
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      roundRect(ctx, x + 0.5, metricsY + 0.5, metricW - 1, metricH - 1, 14);
      ctx.stroke();

      // Label
      ctx.fillStyle = COLORS.textDim;
      ctx.font = "700 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(mt.label, x + 18, metricsY + 18);

      // Value
      ctx.fillStyle = mt.color || COLORS.text;
      ctx.font = "800 26px Inter, system-ui, sans-serif";
      ctx.fillText(mt.value, x + 18, metricsY + 44);
    });

    // ---- Verdict / summary ----
    const summaryY = 370;
    if (r.summary) {
      ctx.fillStyle = COLORS.textDim;
      ctx.font = "700 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("AI VERDICT", PAD, summaryY);

      ctx.fillStyle = COLORS.text;
      ctx.font = "500 19px Inter, system-ui, sans-serif";
      const lines = wrapText(ctx, r.summary, W - PAD * 2, 4);
      lines.forEach((line, i) => {
        ctx.fillText(line, PAD, summaryY + 24 + i * 28);
      });
    }

    // ---- Footer strip ----
    const footerY = H - 70;
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fillRect(0, footerY, W, 70);
    ctx.strokeStyle = COLORS.border;
    ctx.beginPath();
    ctx.moveTo(0, footerY);
    ctx.lineTo(W, footerY);
    ctx.stroke();

    // Brand mark (try to load logo)
    const brandLogo = await loadImage("/brand-kit/logo-master.png");
    let footerCursor = PAD;
    if (brandLogo) {
      const bSize = 36;
      ctx.drawImage(brandLogo, footerCursor, footerY + 17, bSize, bSize);
      footerCursor += bSize + 12;
    }

    ctx.fillStyle = COLORS.text;
    ctx.font = "800 18px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("Degen Desk", footerCursor, footerY + 28);

    ctx.fillStyle = COLORS.textDim;
    ctx.font = "500 13px Inter, system-ui, sans-serif";
    ctx.fillText("Pro Token Analysis", footerCursor, footerY + 48);

    // Right side: URL + NFA
    ctx.fillStyle = COLORS.accent;
    ctx.font = "700 16px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("degendesk.xyz", W - PAD, footerY + 28);

    ctx.fillStyle = COLORS.textMuted;
    ctx.font = "500 11px Inter, system-ui, sans-serif";
    ctx.fillText("Not financial advice · DYOR", W - PAD, footerY + 48);

    // Convert to PNG blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.98);
    });
  }

  // ----------- public API -----------

  async function generate(data) {
    return await render(data);
  }

  async function downloadCard(data) {
    const blob = await generate(data);
    if (!blob) throw new Error("Failed to render share card");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const sym = (data.metrics?.symbol || "token").replace(/[^a-z0-9]/gi, "");
    a.download = `degendesk-${sym}-analysis.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyCardToClipboard(data) {
    const blob = await generate(data);
    if (!blob) throw new Error("Failed to render share card");
    if (!navigator.clipboard || !window.ClipboardItem) {
      throw new Error("Clipboard API not available — try Download instead.");
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }

  window.DegenDeskShareCard = {
    generate,
    download: downloadCard,
    copy: copyCardToClipboard,
  };
})();
