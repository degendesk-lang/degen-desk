/**
 * Helius swap fetching + summarizing.
 * Ported from /api/wallet-watch.js (handleCheck path) so the cron and the
 * manual "Check now" button behave identically.
 */

const HELIUS_PARSED = "https://api.helius.xyz/v0/addresses/";
const SOL_MINT = "So11111111111111111111111111111111111111112";

function fetchWithTimeout(url, opts = {}, ms = 10000) {
	const c = new AbortController();
	const t = setTimeout(() => c.abort(), ms);
	return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(t));
}

export async function fetchRecentSwaps(wallet, apiKey, limit = 25) {
	const params = new URLSearchParams({ "api-key": apiKey, limit: String(limit) });
	const url = `${HELIUS_PARSED}${wallet}/transactions?${params.toString()}`;
	const res = await fetchWithTimeout(url, {}, 10000);
	if (!res.ok) return [];
	const j = await res.json();
	if (!Array.isArray(j)) return [];
	return j.filter((t) => t.type === "SWAP");
}

export function summarizeSwap(tx, owner) {
	const sw = tx.events?.swap;
	const ts = tx.timestamp || 0;

	let solDelta = 0;
	let tokenMint = null;
	let kind = null;

	if (sw) {
		if (sw.nativeInput?.account === owner) solDelta -= Number(sw.nativeInput.amount || 0);
		if (sw.nativeOutput?.account === owner) solDelta += Number(sw.nativeOutput.amount || 0);

		for (const t of sw.tokenInputs || []) {
			if ((t.userAccount || t.fromUserAccount) !== owner) continue;
			if (t.mint === SOL_MINT) continue;
			tokenMint = tokenMint || t.mint;
		}
		for (const t of sw.tokenOutputs || []) {
			if ((t.userAccount || t.toUserAccount) !== owner) continue;
			if (t.mint === SOL_MINT) continue;
			tokenMint = tokenMint || t.mint;
		}
	}

	if (!tokenMint) {
		for (const tt of tx.tokenTransfers || []) {
			if (tt.mint === SOL_MINT) continue;
			if (tt.fromUserAccount === owner || tt.toUserAccount === owner) {
				tokenMint = tt.mint;
				break;
			}
		}
		for (const nt of tx.nativeTransfers || []) {
			const amt = Number(nt.amount || 0);
			if (nt.toUserAccount === owner) solDelta += amt;
			else if (nt.fromUserAccount === owner) solDelta -= amt;
		}
	}

	if (!tokenMint) return null;
	if (solDelta < 0) kind = "buy";
	else if (solDelta > 0) kind = "sell";
	else return null;

	return {
		signature: tx.signature,
		ts,
		kind,
		tokenMint,
		solAmount: Math.abs(solDelta) / 1e9,
		source: tx.source || null,
	};
}
