/**
 * Firebase access via REST (firebase-admin doesn't run in Workers).
 *
 * Auth: service-account JWT signed with RS256, exchanged at oauth2.googleapis.com
 * for an access token good for 1 hour. We mint one per cron tick — cheaper than
 * caching given the 5-min cadence.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1";
const IDENTITY_BASE = "https://identitytoolkit.googleapis.com/v1";

function b64url(input) {
	const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
	let str = "";
	for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
	return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signJwt(claim, privateKeyPem) {
	const header = { alg: "RS256", typ: "JWT" };
	const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

	const pemBody = privateKeyPem
		.replace(/-----BEGIN PRIVATE KEY-----/g, "")
		.replace(/-----END PRIVATE KEY-----/g, "")
		.replace(/\s/g, "");
	const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

	const key = await crypto.subtle.importKey(
		"pkcs8",
		der,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(unsigned),
	);
	return `${unsigned}.${b64url(sig)}`;
}

export async function getAccessToken(env) {
	const now = Math.floor(Date.now() / 1000);
	const claim = {
		iss: env.FIREBASE_CLIENT_EMAIL,
		scope:
			"https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit",
		aud: TOKEN_URL,
		exp: now + 3600,
		iat: now,
	};
	const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
	const jwt = await signJwt(claim, privateKey);

	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
	});
	if (!res.ok) {
		throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
	}
	const j = await res.json();
	return j.access_token;
}

// ----- Firestore -----

export async function queryProUsers(env, token) {
	const url = `${FIRESTORE_BASE}/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
	const body = {
		structuredQuery: {
			from: [{ collectionId: "users" }],
			where: {
				compositeFilter: {
					op: "AND",
					filters: [
						{
							fieldFilter: {
								field: { fieldPath: "tier" },
								op: "EQUAL",
								value: { stringValue: "pro" },
							},
						},
						{
							fieldFilter: {
								field: { fieldPath: "subscriptionStatus" },
								op: "EQUAL",
								value: { stringValue: "active" },
							},
						},
					],
				},
			},
		},
	};
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`Pro user query failed: ${res.status} ${await res.text()}`);
	}
	const data = await res.json();
	return data
		.filter((r) => r.document)
		.map((r) => {
			const uid = r.document.name.split("/").pop();
			return { uid };
		});
}

export async function listWatches(env, token, uid) {
	const url = `${FIRESTORE_BASE}/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/walletWatches/${uid}/items?pageSize=100`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
	if (!res.ok) {
		// 404 = user has no watches subcollection yet, treat as empty
		if (res.status === 404) return [];
		throw new Error(`List watches failed for ${uid}: ${res.status}`);
	}
	const data = await res.json();
	return (data.documents || []).map((doc) => {
		const wallet = doc.name.split("/").pop();
		const f = doc.fields || {};
		return {
			wallet,
			label: f.label?.stringValue || null,
			lastSeenSignature: f.lastSeenSignature?.stringValue || null,
		};
	});
}

export async function updateWatch(env, token, uid, wallet, { lastSeenSignature, lastAlerts }) {
	const params = new URLSearchParams();
	params.append("updateMask.fieldPaths", "lastSeenSignature");
	params.append("updateMask.fieldPaths", "lastCheckedAt");
	params.append("updateMask.fieldPaths", "lastAlerts");
	const url = `${FIRESTORE_BASE}/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/walletWatches/${uid}/items/${wallet}?${params.toString()}`;
	const body = {
		fields: {
			lastSeenSignature: { stringValue: lastSeenSignature || "" },
			lastCheckedAt: { timestampValue: new Date().toISOString() },
			lastAlerts: alertsToFirestoreArray(lastAlerts),
		},
	};
	const res = await fetch(url, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		console.error(`Update watch failed ${uid}/${wallet}: ${res.status} ${await res.text()}`);
	}
}

function alertsToFirestoreArray(alerts) {
	return {
		arrayValue: {
			values: (alerts || []).slice(0, 5).map((a) => ({
				mapValue: {
					fields: {
						signature: { stringValue: a.signature || "" },
						kind: { stringValue: a.kind || "" },
						tokenMint: { stringValue: a.tokenMint || "" },
						solAmount: { doubleValue: a.solAmount || 0 },
						ts: { integerValue: String(a.ts || 0) },
					},
				},
			})),
		},
	};
}

// ----- Identity Toolkit (Firebase Auth) -----

export async function getUserEmail(env, token, uid) {
	const url = `${IDENTITY_BASE}/projects/${env.FIREBASE_PROJECT_ID}/accounts:lookup`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ localId: [uid] }),
	});
	if (!res.ok) {
		console.error(`Email lookup failed for ${uid}: ${res.status}`);
		return null;
	}
	const data = await res.json();
	return data.users?.[0]?.email || null;
}
