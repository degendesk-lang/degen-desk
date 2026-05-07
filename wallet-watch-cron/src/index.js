/**
 * wallet-watch-cron — Cloudflare Worker
 *
 * Every 5 minutes, for each Pro user with watched wallets:
 *   1. Fetch each wallet's recent swaps from Helius
 *   2. Diff against lastSeenSignature → new swaps only
 *   3. Email a digest via Resend
 *   4. Persist new lastSeenSignature back to Firestore
 *
 * Mirrors the diff in /api/wallet-watch.js (handleCheck) so manual + cron
 * paths stay consistent.
 */

import {
	getAccessToken,
	queryProUsers,
	listWatches,
	updateWatch,
	getUserEmail,
} from "./firebase.js";
import { fetchRecentSwaps, summarizeSwap } from "./helius.js";
import { sendDigest } from "./email.js";

// On a wallet's first-ever cron tick (no lastSeenSignature yet), only alert
// on the single most-recent swap so we don't blast the user with backlog.
// Manual handleCheck uses 3; cron is more conservative since it's automated.
const FIRST_TICK_LIMIT = 1;

export default {
	async scheduled(event, env, ctx) {
		ctx.waitUntil(runTick(env, "cron"));
	},

	async fetch(request, env, ctx) {
		return new Response("wallet-watch-cron is alive\n", { status: 200 });
	},
};

async function runTick(env, source) {
	const start = Date.now();
	console.log(`[${source}] tick start`);

	let token;
	try {
		token = await getAccessToken(env);
	} catch (err) {
		console.error("Access token mint failed:", err.message);
		return;
	}

	let users;
	try {
		users = await queryProUsers(env, token);
	} catch (err) {
		console.error("Pro user query failed:", err.message);
		return;
	}
	console.log(`Pro users found: ${users.length}`);

	const results = await Promise.allSettled(
		users.map((u) => processUser(env, token, u.uid)),
	);

	let totalAlerts = 0;
	let usersEmailed = 0;
	for (const r of results) {
		if (r.status === "fulfilled" && r.value > 0) {
			totalAlerts += r.value;
			usersEmailed++;
		}
	}
	console.log(
		`[${source}] tick done in ${Date.now() - start}ms — ${usersEmailed} users emailed, ${totalAlerts} alerts total`,
	);
}

async function processUser(env, token, uid) {
	const watches = await listWatches(env, token, uid);
	if (watches.length === 0) return 0;

	const userAlerts = [];

	await Promise.all(
		watches.map(async (w) => {
			try {
				const swaps = await fetchRecentSwaps(w.wallet, env.HELIUS_API_KEY);
				if (swaps.length === 0) return;

				const lastSeen = w.lastSeenSignature || null;
				let newSwaps;
				if (!lastSeen) {
					newSwaps = swaps.slice(0, FIRST_TICK_LIMIT);
				} else {
					const idx = swaps.findIndex((s) => s.signature === lastSeen);
					newSwaps = idx === -1 ? swaps : swaps.slice(0, idx);
				}

				const summarized = newSwaps
					.map((tx) => summarizeSwap(tx, w.wallet))
					.filter(Boolean);

				const newestSig = swaps[0]?.signature || lastSeen;
				await updateWatch(env, token, uid, w.wallet, {
					lastSeenSignature: newestSig,
					lastAlerts: summarized,
				});

				for (const s of summarized) {
					userAlerts.push({ wallet: w.wallet, label: w.label, ...s });
				}
			} catch (err) {
				console.error(`Watch failed ${uid}/${w.wallet}: ${err.message}`);
			}
		}),
	);

	if (userAlerts.length === 0) return 0;

	const email = await getUserEmail(env, token, uid);
	if (!email) {
		console.warn(`No email for ${uid}; ${userAlerts.length} alerts dropped`);
		return 0;
	}

	userAlerts.sort((a, b) => (b.ts || 0) - (a.ts || 0));

	try {
		await sendDigest({ apiKey: env.RESEND_API_KEY, to: email, alerts: userAlerts });
		console.log(`Emailed ${userAlerts.length} alerts to ${uid} (${email})`);
		return userAlerts.length;
	} catch (err) {
		console.error(`Email send failed for ${uid}: ${err.message}`);
		return 0;
	}
}
