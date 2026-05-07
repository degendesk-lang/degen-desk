/**
 * consensus-cron — Cloudflare Worker
 *
 * Every 2 minutes:
 *   1. Pull top 25 KOLs from /api/kol-feed (kolscan-driven leaderboard)
 *   2. For each KOL wallet, fetch recent Helius swaps (last hour worth)
 *   3. Filter to BUY-side swaps only, group by tokenMint
 *   4. If a token has 5+ unique KOL buyers in the last hour AND we haven't
 *      fired an alert for that token in the last 24h → fire
 *   5. Email all Pro users via Resend's batch endpoint
 *   6. Persist consensusEvents/{tokenMint} for dedup
 *
 * The "1-hour window" is enforced by filtering Helius swap timestamps
 * client-side, not by polling state. Each tick re-evaluates from scratch,
 * which means: if the cron misses a tick, the next one still catches the
 * consensus as long as the buys are within the rolling window.
 */

import {
	getAccessToken,
	queryProUsers,
	getEmailsForUids,
	getConsensusEvent,
	saveConsensusEvent,
} from "./firebase.js";
import { fetchRecentSwaps, summarizeSwap } from "./helius.js";
import { fetchTrackedKOLs } from "./kols.js";
import { sendConsensusBatch } from "./email.js";

const CONSENSUS_THRESHOLD = 5; // unique KOL wallets required to fire
const WINDOW_SECONDS = 60 * 60; // 1 hour rolling window
const DEDUP_HOURS = 24; // don't re-fire same token within this many hours
const SWAPS_PER_KOL = 50; // Helius page size — covers a hyperactive KOL's hour

const SOL_MINT = "So11111111111111111111111111111111111111112";
const STABLECOINS = new Set([
	"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
	"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);

export default {
	async scheduled(event, env, ctx) {
		ctx.waitUntil(runTick(env, "cron"));
	},

	async fetch(request, env, ctx) {
		return new Response("consensus-cron is alive\n", { status: 200 });
	},
};

async function runTick(env, source) {
	const start = Date.now();
	console.log(`[${source}] consensus tick start`);

	let token;
	try {
		token = await getAccessToken(env);
	} catch (err) {
		console.error("Access token mint failed:", err.message);
		return;
	}

	let kols;
	try {
		kols = await fetchTrackedKOLs();
	} catch (err) {
		console.error("KOL list fetch failed:", err.message);
		return;
	}
	console.log(`Tracking ${kols.length} KOLs`);

	const cutoffTs = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;

	// Fetch all KOL swap activity in parallel.
	const allBuys = [];
	await Promise.all(
		kols.map(async (kol) => {
			try {
				const swaps = await fetchRecentSwaps(kol.wallet, env.HELIUS_API_KEY, SWAPS_PER_KOL);
				for (const tx of swaps) {
					if ((tx.timestamp || 0) < cutoffTs) continue;
					const summary = summarizeSwap(tx, kol.wallet);
					if (!summary || summary.kind !== "buy") continue;
					if (summary.tokenMint === SOL_MINT || STABLECOINS.has(summary.tokenMint)) continue;
					allBuys.push({
						wallet: kol.wallet,
						label: kol.label,
						twitter: kol.twitter,
						rank: kol.rank,
						...summary,
					});
				}
			} catch (err) {
				console.error(`Helius fetch failed for ${kol.wallet}: ${err.message}`);
			}
		}),
	);

	// Group by tokenMint, count unique KOL wallets.
	const byToken = new Map();
	for (const buy of allBuys) {
		if (!byToken.has(buy.tokenMint)) byToken.set(buy.tokenMint, new Map());
		const wallets = byToken.get(buy.tokenMint);
		// Keep the largest buy per wallet for that token (or earliest — either fine)
		const existing = wallets.get(buy.wallet);
		if (!existing || buy.solAmount > existing.solAmount) {
			wallets.set(buy.wallet, buy);
		}
	}

	// Find consensus tokens.
	const consensusCandidates = [];
	for (const [tokenMint, walletMap] of byToken) {
		if (walletMap.size >= CONSENSUS_THRESHOLD) {
			consensusCandidates.push({
				tokenMint,
				buys: Array.from(walletMap.values()),
			});
		}
	}
	console.log(
		`Total buys in window: ${allBuys.length} | Tokens with ${CONSENSUS_THRESHOLD}+ KOL buyers: ${consensusCandidates.length}`,
	);

	if (consensusCandidates.length === 0) {
		console.log(`[${source}] tick done in ${Date.now() - start}ms — no consensus`);
		return;
	}

	// Filter via dedup state.
	const dedupCutoffMs = Date.now() - DEDUP_HOURS * 60 * 60 * 1000;
	const toFire = [];
	for (const candidate of consensusCandidates) {
		const prev = await getConsensusEvent(env, token, candidate.tokenMint);
		if (prev?.lastFiredAt) {
			const lastMs = Date.parse(prev.lastFiredAt);
			if (lastMs && lastMs > dedupCutoffMs) {
				console.log(
					`Skipping ${candidate.tokenMint} — fired ${Math.floor((Date.now() - lastMs) / 60000)}m ago`,
				);
				continue;
			}
		}
		toFire.push(candidate);
	}
	console.log(`Firing ${toFire.length} consensus alert(s)`);

	if (toFire.length === 0) {
		console.log(`[${source}] tick done in ${Date.now() - start}ms — all candidates deduped`);
		return;
	}

	// Look up Pro user emails once for the whole tick.
	let proUsers;
	try {
		proUsers = await queryProUsers(env, token);
	} catch (err) {
		console.error("Pro user query failed:", err.message);
		return;
	}
	const uids = proUsers.map((u) => u.uid);
	const emailMap = await getEmailsForUids(env, token, uids);
	const recipients = Object.values(emailMap).filter(Boolean);
	console.log(`Pro users: ${proUsers.length} | with email: ${recipients.length}`);

	if (recipients.length === 0) {
		console.warn("No Pro user emails to send to — skipping firings");
		// Still persist event records so we don't bombard once recipients exist.
		for (const c of toFire) {
			await saveConsensusEvent(env, token, c.tokenMint, {
				walletCount: c.buys.length,
				wallets: c.buys,
			});
		}
		return;
	}

	// Send + persist.
	for (const c of toFire) {
		try {
			await sendConsensusBatch({
				apiKey: env.RESEND_API_KEY,
				recipients,
				tokenMint: c.tokenMint,
				buys: c.buys,
			});
			console.log(`Emailed consensus for ${c.tokenMint} to ${recipients.length} users`);
		} catch (err) {
			console.error(`Send failed for ${c.tokenMint}: ${err.message}`);
			continue; // don't persist if send failed — retry next tick
		}
		await saveConsensusEvent(env, token, c.tokenMint, {
			walletCount: c.buys.length,
			wallets: c.buys,
		});
	}

	console.log(`[${source}] tick done in ${Date.now() - start}ms`);
}
