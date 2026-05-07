/**
 * Pulls the top N KOL wallets to track for consensus signals.
 *
 * Source: our own /api/kol-feed endpoint (kolscan-driven leaderboard).
 * timeframe=weekly is the sweet spot — daily flips too fast, monthly misses
 * new hot KOLs.
 *
 * Returns: [{ wallet, label, twitter }] sorted by rank ascending.
 */

const KOL_FEED_URL = "https://degendesk.xyz/api/kol-feed?timeframe=weekly";
const TOP_N = 25;

export async function fetchTrackedKOLs() {
	const res = await fetch(KOL_FEED_URL, {
		signal: AbortSignal.timeout(10000),
	});
	if (!res.ok) {
		throw new Error(`KOL feed fetch failed: ${res.status}`);
	}
	const data = await res.json();
	const kols = (data.kols || [])
		.filter((k) => k.wallet)
		.slice(0, TOP_N)
		.map((k) => ({
			wallet: k.wallet,
			label: k.name || k.twitter || null,
			twitter: k.twitter || null,
			rank: k.rank,
		}));
	return kols;
}
