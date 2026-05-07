/**
 * Resend "consensus alert" email.
 *
 * Triggered when 5+ tracked KOLs buy the same token within 1 hour. Sent to
 * all Pro users via Resend's batch endpoint (up to 100 emails per call).
 *
 * Domain degendesk.xyz verified in Resend 2026-05-05.
 */

const FROM_ADDRESS = "Degen Desk Alerts <alerts@degendesk.xyz>";
const RESEND_BATCH_URL = "https://api.resend.com/emails/batch";

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

function timeAgo(ts) {
	if (!ts) return "—";
	const ms = Date.now() - ts * 1000;
	const m = Math.floor(ms / 60000);
	if (m < 1) return "just now";
	if (m < 60) return `${m}m ago`;
	return `${Math.floor(m / 60)}h ago`;
}

function renderHtml(tokenMint, buys) {
	const sortedBuys = [...buys].sort((a, b) => (b.ts || 0) - (a.ts || 0));
	const tokenLink = `https://degendesk.xyz/token-analysis.html?ca=${encodeURIComponent(tokenMint)}&chain=solana`;

	const rows = sortedBuys
		.map((b) => {
			const who = escapeHtml(b.label || SHORT_ADDR(b.wallet));
			const txLink = `https://solscan.io/tx/${encodeURIComponent(b.signature)}`;
			const xLink = b.twitter ? `https://x.com/${encodeURIComponent(b.twitter)}` : null;
			return `
				<tr>
					<td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#e5e7eb;font-weight:600;">
						${xLink ? `<a href="${xLink}" style="color:#a78bfa;text-decoration:none;">@${who}</a>` : who}
					</td>
					<td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#10b981;font-weight:600;">
						${escapeHtml(fmtSol(b.solAmount))}
					</td>
					<td style="padding:10px 12px;border-bottom:1px solid #1f2937;color:#9ca3af;font-size:12px;">
						${escapeHtml(timeAgo(b.ts))}
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
		<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#10b981;color:#fff;font-weight:700;font-size:11px;letter-spacing:0.06em;">
			SMART MONEY CONSENSUS
		</div>
		<h1 style="font-size:22px;margin:12px 0 8px;color:#fff;">
			${buys.length} top KOLs bought ${escapeHtml(SHORT_ADDR(tokenMint))} in the last hour
		</h1>
		<p style="margin:0 0 16px;color:#9ca3af;font-size:14px;">
			Cross-wallet pattern detected on the kolscan top-25 leaderboard.
		</p>
		<div style="margin:0 0 18px;">
			<a href="${tokenLink}" style="display:inline-block;padding:10px 16px;background:#a78bfa;color:#0b0f17;text-decoration:none;border-radius:6px;font-weight:700;">
				Analyze ${escapeHtml(SHORT_ADDR(tokenMint))} →
			</a>
		</div>
		<table style="width:100%;border-collapse:collapse;background:#111827;border-radius:8px;overflow:hidden;">${rows}</table>
		<p style="margin:20px 0 0;font-size:12px;color:#6b7280;">
			You're getting this because you're a Degen Desk Pro subscriber.
			Consensus alerts fire at most once per token per 24 hours.
			<a href="https://degendesk.xyz/alerts.html" style="color:#a78bfa;">Manage alerts →</a>
		</p>
	</div>
</body></html>`;
}

export async function sendConsensusBatch({ apiKey, recipients, tokenMint, buys }) {
	if (!recipients || recipients.length === 0) return { sent: 0 };
	const html = renderHtml(tokenMint, buys);
	const subject = `${buys.length} top KOLs converging on ${SHORT_ADDR(tokenMint)}`;
	const payload = recipients.map((to) => ({
		from: FROM_ADDRESS,
		to: [to],
		subject,
		html,
	}));

	const res = await fetch(RESEND_BATCH_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		throw new Error(`Resend batch failed: ${res.status} ${await res.text()}`);
	}
	const data = await res.json();
	return { sent: recipients.length, response: data };
}
