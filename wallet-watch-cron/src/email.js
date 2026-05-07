/**
 * Resend digest email. Domain degendesk.xyz verified in Resend 2026-05-05.
 */

const FROM_ADDRESS = "Degen Desk Alerts <alerts@degendesk.xyz>";

const SHORT_ADDR = (a) => (!a || a.length < 10 ? a || "" : `${a.slice(0, 4)}…${a.slice(-4)}`);

function fmtSol(n) {
	if (n == null || isNaN(n)) return "—";
	const v = Number(n);
	if (v >= 100) return `${v.toFixed(0)} SOL`;
	if (v >= 1) return `${v.toFixed(2)} SOL`;
	return `${v.toFixed(4)} SOL`;
}

function escapeHtml(s) {
	return String(s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function renderHtml(alerts) {
	const rows = alerts
		.map((a) => {
			const who = escapeHtml(a.label || SHORT_ADDR(a.wallet));
			const tokenLink = `https://degendesk.xyz/token-analysis.html?ca=${encodeURIComponent(a.tokenMint)}&chain=solana`;
			const txLink = `https://solscan.io/tx/${encodeURIComponent(a.signature)}`;
			const kindColor = a.kind === "buy" ? "#10b981" : "#ef4444";
			const kindLabel = a.kind === "buy" ? "BUY" : "SELL";
			return `
				<tr>
					<td style="padding:10px 12px;border-bottom:1px solid #1f2937;">
						<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${kindColor};color:#fff;font-weight:700;font-size:12px;">${kindLabel}</span>
					</td>
					<td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#e5e7eb;font-weight:600;">${who}</td>
					<td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#e5e7eb;">${escapeHtml(fmtSol(a.solAmount))}</td>
					<td style="padding:10px 12px;border-bottom:1px solid #1f2937;">
						<a href="${tokenLink}" style="color:#a78bfa;text-decoration:none;">${escapeHtml(SHORT_ADDR(a.tokenMint))} →</a>
					</td>
					<td style="padding:10px 12px;border-bottom:1px solid #1f2937;">
						<a href="${txLink}" style="color:#9ca3af;text-decoration:none;font-size:12px;">tx ↗</a>
					</td>
				</tr>
			`;
		})
		.join("");

	return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#0b0f17;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#e5e7eb;">
	<div style="max-width:640px;margin:0 auto;">
		<h1 style="font-size:20px;margin:0 0 16px;color:#fff;">
			${alerts.length} new ${alerts.length === 1 ? "trade" : "trades"} from your watched wallets
		</h1>
		<table style="width:100%;border-collapse:collapse;background:#111827;border-radius:8px;overflow:hidden;">${rows}</table>
		<p style="margin:20px 0 0;font-size:12px;color:#6b7280;">
			You're getting this because you're a Degen Desk Pro subscriber with active wallet watches.
			<a href="https://degendesk.xyz/alerts.html" style="color:#a78bfa;">Manage watches →</a>
		</p>
	</div>
</body></html>`;
}

export async function sendDigest({ apiKey, to, alerts }) {
	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: FROM_ADDRESS,
			to: [to],
			subject: `${alerts.length} new ${alerts.length === 1 ? "trade" : "trades"} from your watched wallets`,
			html: renderHtml(alerts),
		}),
	});
	if (!res.ok) {
		throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
	}
	return await res.json();
}
