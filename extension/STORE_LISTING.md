# Chrome Web Store Listing — Degen Desk

Everything you need to paste into the developer console at:
https://chrome.google.com/webstore/devconsole

---

## Item details

### Title
```
Degen Desk — Token Risk On Every Page
```
(Max 75 chars. Current: 39.)

### Summary (short description, max 132 chars)
```
On-chain risk verdicts on every page. Hover any Solana, Ethereum, Base, or BNB Chain CA — Pro analysis one click away.
```

### Detailed description
```
Degen Desk turns every page on the internet into a token research tool.

Hover any Solana, Ethereum, Base, or BNB Chain contract address — on Twitter, Discord, Telegram, Photon, Axiom, Bullx, Pump.fun, Dexscreener, anywhere — and instantly see live market cap, price, liquidity, and 24-hour change. One click takes you to the full Pro analysis on Degen Desk.

🟢 SUPPORTED CHAINS
• Solana
• Ethereum
• Base
• BNB Chain

🟢 WHAT YOU GET ON EVERY PAGE
• Auto-detected contract addresses underlined in green
• Hover popover with live metrics (DexScreener powered)
• Floating overlay panel on every major dex / explorer:
  Axiom, Photon, Bullx, Pump.fun, Dexscreener, Solscan,
  Etherscan, Basescan, Bscscan
• One-click deep link to the full Degen Desk analysis with
  the address pre-filled

🟢 FULL PRO ANALYSIS (on degendesk.xyz)
The "Open full report" button takes you to Degen Desk's Pro
Token Analysis Center, which adds:
• Holder concentration (LP-filtered)
• Bundled supply detection
• Honeypot + buy/sell tax (EVM)
• Ownership controls (mintable, hidden owner, proxy)
• Dev wallet history & funding source
• Domain age via RDAP / WHOIS
• GitHub repo health
• AI-synthesized risk verdict
• Shareable PNG cards

🟢 PRIVACY
• Zero analytics. Zero tracking.
• No data leaves your browser except the contract address
  you actually hover (sent to Degen Desk's quick-check
  endpoint to fetch market data).
• No browsing history collected.
• No accounts read.

Free to use. Pro analysis available with a Degen Desk Pro
subscription at degendesk.xyz/pricing.html.

Built by traders, for traders. Research smarter. Trade safer.
```

### Category
```
Productivity
```
(Alternates: "Tools" if Productivity feels off — Productivity converts better.)

### Language
```
English (United States)
```

---

## Privacy practices disclosure

Chrome will ask which user data you collect. Answer:

| Question | Answer |
|---|---|
| Personally identifiable information | **No** |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | **No** (we only read the contract address strings the user hovers — we don't collect, store, or transmit page content) |

Then the certification checklist:
- ✅ "I do not sell or transfer user data to third parties, outside of the approved use cases"
- ✅ "I do not use or transfer user data for purposes that are unrelated to my item's single purpose"
- ✅ "I do not use or transfer user data to determine creditworthiness or for lending purposes"

---

## Permission justifications

Chrome requires a one-line justification for each permission. Use these:

### `storage`
```
Persists the user's preference for collapsing the on-dex floating panel.
```

### `activeTab`
```
Reserved for the toolbar popup so the user can manually look up a contract address from the active tab.
```

### Host permissions (`https://degendesk.xyz/*`, `https://api.dexscreener.com/*`)
```
Required to fetch live token market data. The background service worker calls https://degendesk.xyz/api/quick-check (the extension's primary metrics endpoint) and falls back to DexScreener's public search API when the on-page contract address cannot be resolved.
```

### Content script `<all_urls>`
```
The extension's single purpose is to surface contract-address risk metrics on any page where a user might encounter one — primarily X (Twitter), Discord, Telegram, dex sites, and explorers. The content script detects 32–44 character base58 strings (Solana mints) and 0x + 40 hex strings (EVM addresses) in visible text and element attributes, underlines them, and renders a hover popover. It does not read, store, or transmit any other page content.
```

---

## Single purpose statement
```
The single purpose of Degen Desk is to help users research tokens by surfacing live on-chain market data and risk signals for any contract address they encounter while browsing.
```

---

## Required URLs

| Field | URL |
|---|---|
| Homepage | https://degendesk.xyz |
| Support email | support@degendesk.xyz |
| Privacy policy | https://degendesk.xyz/privacy.html |

---

## Screenshots required (minimum 1, max 5)

Specs: 1280×800 PNG/JPG (preferred) or 640×400.

Capture these five — each shows a different value prop:

1. **Hover popover on X / Twitter**
   Find a tweet with a Solana CA in it (search "$BONK address" or any meme), hover over the underlined CA, screenshot the green underline + live metrics popover.

2. **Floating panel on Axiom**
   Open any token on axiom.trade/meme/..., screenshot the bottom-right Degen Desk panel showing the live metrics + "Open full report" CTA.

3. **Floating panel on Dexscreener**
   Open any token on dexscreener.com/solana/..., screenshot the panel showing chain badge + metrics.

4. **Hover popover on Discord**
   In any Discord server with CAs being shared, hover one and screenshot the green underline + popover.

5. **Full Token Analysis page** (degendesk.xyz/token-analysis.html)
   Show what the user gets after clicking "Open full report" — the animated risk gauge, holder analysis, etc. This sells the upgrade path.

Frame each screenshot at exactly 1280×800. macOS shortcut: Cmd+Shift+4 → Space (window mode) → click window → resize after if needed. Or use Apple's Screenshot app preset.

---

## Promotional tile (optional, recommended)

Specs: 440×280 PNG.

Suggested layout: Degen Desk wordmark left, "Token risk on every page" tagline, glowing green underline graphic showing detected CAs. We can generate this from the brand kit if you want — just say the word.

---

## Pricing & distribution

| Setting | Value |
|---|---|
| Pricing | Free |
| Visibility | Public |
| Distribution regions | All regions |
| Maturity rating | Everyone |
| Mature content | No |

---

## Submission checklist

Before clicking submit:

- [ ] Privacy policy at https://degendesk.xyz/privacy.html mentions the extension
- [ ] All five screenshots uploaded
- [ ] Description pasted exactly as above
- [ ] Permission justifications pasted
- [ ] Single purpose statement pasted
- [ ] Privacy practices form completed and certified
- [ ] Pricing set to Free
- [ ] Visibility set to Public
- [ ] Item zip uploaded (run `npm run build:ext` from repo root, or zip `extension/` manually)

---

## Review timeline

- Initial submission review: typically 1–3 business days
- If rejected: usually a clear reason in the email; common issues are permission scope (we're tight) or missing privacy disclosures (we have them)
- Updates after first approval are usually reviewed within 24h

## After approval

The store listing URL will be `https://chrome.google.com/webstore/detail/<your-id>`. Drop it on:
- The website's nav bar (add a "Get the extension" link)
- An X post announcing it
- The footer of every page
- The blog post about the launch
