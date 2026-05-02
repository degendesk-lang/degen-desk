# Degen Desk — Browser Extension

On-chain risk verdicts on every page. Hover any contract address (Solana, Ethereum, Base, BNB Chain) on any website to see live metrics. One click → full Pro analysis on degendesk.xyz.

## Features (v0.1.0)

- **Address detection on any page.** Solana base58 (32–44 chars) and EVM (`0x` + 40 hex) addresses are detected in body text and underlined in green.
- **Hover popover.** Live market cap, price, liquidity, 24h change, plus the chain badge — all from a single low-latency `/api/quick-check` call (DexScreener-backed, server-cached).
- **One-click full analysis.** "Open full report →" deep-links to `degendesk.xyz/token-analysis.html?ca=...&chain=...` with the input pre-filled and analysis auto-running.
- **Manual lookup popup.** Click the toolbar icon to paste any CA. The clipboard is read on open as a friendly auto-fill.
- **Smart skipping.** Doesn't touch `<script>`, `<input>`, `<textarea>`, `<code>`, `<pre>`, contenteditable regions, or already-wrapped chips. Uses a MutationObserver so dynamically loaded content (X feed, Discord chat, etc.) is also wrapped.
- **No tracking.** Zero analytics, zero local storage of addresses you've viewed. The only network calls are `https://degendesk.xyz/api/quick-check` (preview) and tab-create to the report URL (full analysis).

## Local install (developer mode)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Select this `extension/` folder.
5. Pin the Degen Desk icon to the toolbar for fast access.

## File map

```
extension/
├── manifest.json    Manifest V3 config — content scripts, host perms, action popup.
├── background.js    Service worker. Proxies the quick-check fetch (one place to cache + handle errors).
├── content.js       Runs on every non-Degen-Desk page. DOM walker + popover.
├── content.css      Popover and chip styles. !important to survive host CSS.
├── popup.html       Toolbar popup UI.
├── popup.css        Popup styles.
├── popup.js         Manual CA entry, clipboard auto-paste, validation.
└── icons/           16/32/48/128 PNGs generated from the brand kit logo master.
```

## Roadmap

**v0.2 (next)**
- Auth bridge with degendesk.xyz (read Firebase token via `cookies` permission so signed-in Pro users get richer popovers).
- Site-specific overlays for Photon, Bullx, Axiom, Dexscreener — inject a Degen Desk panel on token pages.

**v0.3**
- Watchlist + risk-change push notifications.
- "Recent CAs" history in the popup.

**Submission**
- After v0.2 stabilises, submit to Chrome Web Store. Review takes 1–3 weeks.

## Dev notes

- Manifest V3 service workers are short-lived. The background cache is intentionally in-memory only — re-fetches are cheap (<1s).
- Content script uses a `dd-` CSS prefix and `!important` everywhere because we run on every site, including ones with aggressive CSS resets.
- `quickCheck()` dedupes in-flight requests for the same address per page so a doc with 50 mentions of the same CA fires one fetch.
- The `dd-ca` element is a custom tag (`<dd-ca>`) so host CSS that targets `span.something` doesn't accidentally style our chips.
