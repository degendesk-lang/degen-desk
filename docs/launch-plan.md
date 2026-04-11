# Degen Desk — Launch Plan

Master reference for the launch strategy, timeline, and post-launch operations.
All dates assume the target launch window of late April 2026.

---

## Founder identity strategy

**Phase 1: Launch → September 17, 2026 (pre-18)**

- Apple Developer Program enrollment: **Individual** track, with parental consent
  (minor enrollment process handled via phone with Apple Developer Support at
  1-800-633-2152).
- App Store seller field: legal name (required by Apple, unavoidable).
- Everywhere else: **100% brand identity**, no personal name, no founder photo,
  no personal social media links.
- Public founder identity: **"a solo indie developer"** — nothing more specific.
- Support channel: `support@degendesk.xyz` only.
- Twitter: `@DegenDeskXYZ` only, no personal Twitter mentions.
- Do not announce age, location, school, or any personal details publicly.

**Phase 2: September 17, 2026 onward (post-18, post-LLC)**

- Form single-member LLC in home state (~$100–$300 depending on state).
- Get EIN from IRS at irs.gov (free, ~10 minutes).
- Open business bank account at Mercury or Relay (free, ~15 minutes, fully online).
- Enroll in Apple Developer Program as **Organization** under the LLC, OR convert
  existing Individual account to Organization (Apple has a documented process).
- Use App Store Connect "Transfer App" feature to move Degen Desk from Individual
  account to LLC Organization account. Subscribers stay active. RevenueCat keeps
  working.
- **Result:** legal name disappears from the App Store seller field, replaced by
  "Degen Desk LLC". Public identity is now fully brand-only.
- Re-apply for Apple Small Business Program under the LLC (transfers cleanly).

---

## Launch timeline

### Week 0 (this week) — Account setup

- [ ] **User:** Call Apple Developer Support at 1-800-633-2152 with a parent present.
      Script:
      > "Hi, I'm 17 years old and I'm trying to enroll in the Apple Developer
      > Program as an Individual. I have an iOS app ready to launch. I know Apple
      > has a process for parental consent and my parents are here with me. Can
      > you walk me through how to enroll with parental consent?"
- [ ] **User:** Submit Individual enrollment application with guardian consent form.
- [ ] **User:** Create RevenueCat account at app.revenuecat.com.
- [ ] **User:** Create "Degen Desk" project in RevenueCat with iOS app bundle ID
      `xyz.degendesk.app`.
- [ ] **User:** Generate RevenueCat Apple public API key (`appl_…`) and send to
      Claude to replace `REVENUECAT_APPLE_KEY` placeholder in `iap.js`.
- [ ] **User:** Generate a strong random string for `REVENUECAT_WEBHOOK_SECRET`
      and set it as a Vercel environment variable. Paste the same value into
      RevenueCat's webhook integration Authorization header with URL
      `https://degendesk.xyz/api/revenuecat-webhook`.
- [ ] **User:** Lock down `@DegenDeskXYZ` Twitter account per hardening checklist
      (no personal email, no personal phone, no birthday, 2FA via authenticator).
- [ ] **User:** Finish cleanup of other social platforms (Twitter, Reddit, gaming
      usernames) using free tools (Undiscord for Discord — already done;
      TweetDelete or Shreddit for the rest).

### Week 1 — Apple approval and IAP product setup

- [ ] **Apple:** Approves Individual enrollment (typically 3–7 days after call
      + guardian consent form).
- [ ] **User:** Log into App Store Connect for the first time. Sign the Paid
      Apps Agreement and submit banking/tax info (parent will need to be
      involved here because banking is the adult's name until the LLC at 18).
- [ ] **User:** Create the app record in App Store Connect:
      - App name: `Degen Desk: Meme Coin AI`
      - Bundle ID: `xyz.degendesk.app`
      - SKU: `degendesk-ios`
      - Primary language: English
- [ ] **User:** Create the subscription group `Degen Desk Pro`.
- [ ] **User:** Create the two IAP products using the exact IDs in
      `docs/app-store-listing.md`:
      - `degendesk_pro_monthly` at $18.99/month
      - `degendesk_pro_yearly` at $189.99/year with 3-day free trial
- [ ] **User:** Link Apple IAP products to RevenueCat in the RevenueCat dashboard.
- [ ] **User:** Apply to Apple Small Business Program at
      developer.apple.com/app-store/small-business-program/

### Week 2 — First TestFlight build

- [ ] **Claude:** Replace `REVENUECAT_APPLE_KEY` placeholder with real key in
      `iap.js`. Rebuild `www/`, run `npx cap sync ios`. Commit and push.
- [ ] **User:** Open Xcode, archive the iOS build, upload to App Store Connect.
- [ ] **User:** Wait for processing (~30 minutes), then add to TestFlight
      Internal Testing.
- [ ] **User:** Install TestFlight on your phone, pull down the build, run it,
      and verify:
      - Google Sign-In works end-to-end
      - Chat with the agent works
      - Pricing page loads with iOS prices ($18.99 / $189.99, 3-day trial label)
      - "Upgrade to Pro" button opens the Apple sandbox purchase sheet
      - Complete a sandbox purchase with a sandbox tester account
      - Firestore user doc updates to `tier: "pro"` after purchase
      - Pro features unlock in the app immediately
      - "Restore Purchases" button on pricing page works
- [ ] **User:** Fix anything broken; re-archive and re-upload as needed.

### Week 3 — Screenshots, listing, and submission

- [ ] **User:** Generate App Store screenshots from the iOS simulator.
      - 6.9" (iPhone 16 Pro Max) — 1320 × 2868 — at least 3 shots
      - 6.5" (iPhone 11 Pro Max) — 1284 × 2778 — at least 3 shots
      - Shot list in `docs/app-store-listing.md`
- [ ] **User:** Fill in all App Store Connect listing fields using the copy in
      `docs/app-store-listing.md` (name, subtitle, description, keywords,
      categories, age rating, support URL, privacy URL, copyright).
- [ ] **User:** Upload the 1024×1024 app icon.
- [ ] **User:** Attach screenshots to each device size slot.
- [ ] **User:** Create the reviewer demo Google account
      (`appreview@degendesk.xyz`) and note the credentials in the App Review
      information field.
- [ ] **User:** Submit for review.

### Week 4–5 — Review and launch

- [ ] **Apple:** Review (typically 24–48 hours, sometimes up to a week for first
      submissions).
- [ ] **Possible:** Apple rejection — most common reasons:
      - Missing privacy manifest → Claude will help debug
      - Unclear IAP description → revise in App Store Connect
      - Crash on launch → fix and resubmit
- [ ] **Apple:** Approval.
- [ ] **User:** Release to App Store (choose "Release this version immediately
      after approval" OR hold for a specific launch date).
- [ ] **User:** Post the launch tweet from `@DegenDeskXYZ`.

### Weeks 5–8 — Post-launch

- [ ] **Apple:** Approves Small Business Program application (retroactive rate
      change to 15% takes effect the month after approval).
- [ ] **User:** Monitor RevenueCat dashboard daily for subscriptions, trials,
      conversions.
- [ ] **User:** Respond to App Store reviews promptly.
- [ ] **User:** Ship small updates every 1–2 weeks to show active development.
- [ ] **Claude:** Help iterate on features based on user feedback.

### September 17, 2026 — LLC transition

- [ ] **User:** Form single-member LLC in home state. Recommended services:
      - Northwest Registered Agent ($39 + state fee) — cheapest, good reputation
      - LegalZoom ($79 + state fee) — more hand-holding but more expensive
- [ ] **User:** Get EIN from irs.gov — free, 10 minutes, filed online
- [ ] **User:** Open business checking at Mercury (mercury.com) — free, 15
      minutes, fully online, approved in 1–3 days
- [ ] **User:** Enroll the LLC in Apple Developer Program as Organization
      ($99/year). This creates a separate Organization account.
- [ ] **User:** Use App Store Connect → "Transfer App" to move Degen Desk from
      Individual account to LLC Organization account.
- [ ] **User:** Update RevenueCat billing to the new Mercury business account.
- [ ] **User:** Update Stripe (if web Stripe is live) to the LLC name and
      Mercury business account.
- [ ] **User:** Re-apply for Apple Small Business Program under the LLC.
- [ ] **User:** File DBA if needed for "Degen Desk" as a trade name under the LLC.
- [ ] **Result:** Legal name is now invisible in all public surfaces.
      Degen Desk is a real company.

---

## Twitter strategy for @DegenDeskXYZ

### Hardening checklist (do this before launch)

- [ ] Display name: `Degen Desk` (nothing personal)
- [ ] Bio: brand-focused, no personal references
- [ ] Website: `https://degendesk.xyz`
- [ ] Location: leave blank (or a joke like "Solana" — never a real city)
- [ ] Profile photo: Degen Desk logo, not a photo of you
- [ ] Birthday: leave blank
- [ ] Email on account: `support@degendesk.xyz` or similar, never personal Gmail
- [ ] Phone on account: Google Voice or prepaid SIM, not personal phone
- [ ] 2FA: authenticator app (not SMS — SMS is vulnerable to SIM swap)
- [ ] Discoverability: turn OFF "find by email" and "find by phone"
- [ ] Location in tweets: OFF
- [ ] Photo tagging: OFF
- [ ] Following list: only crypto projects, traders, and tools. Unfollow
      anything personal. This list is public.
- [ ] Liked tweets: make private if possible, or be careful what you like
- [ ] Delete any existing tweets from the account that reference anything
      personal or that predate the launch strategy

### What to post (first 30 days)

1. **Build-in-public tweets** — progress updates, feature previews, screenshots
   from the iOS simulator. "Here's what I'm shipping this week." These do well
   on Crypto Twitter and indie dev Twitter.
2. **Meme coin takes** — short, sharp observations about the market. Degen Desk
   is positioned as an expert, so tweet like one. No financial advice; educational
   framing.
3. **Feature launches** — every shipped feature gets a tweet with a screenshot
   or screen recording.
4. **Trending token commentary** — use the Degen Desk agent to generate
   commentary, post it as "Degen Desk says..." — this showcases the product.
5. **Replies to other crypto accounts** — jump into conversations, add value,
   be known. Don't be a reply guy; be a reply expert.

### What NOT to post, ever

- Your real name, age, location, school, or anything personal
- Financial advice (always caveat with "not financial advice, DYOR")
- Price predictions with specific targets and dates
- Promises of returns
- Anything political beyond crypto policy
- Anything about the Discord cleanup (never acknowledge the cleanup existed)
- Anything that could be interpreted as manipulating a token's price
- Responses to trolls asking "who are you really?" — either ignore or respond
  with "a solo indie dev shipping Degen Desk, that's all that matters"
- Age reveals. Do not tweet "as a 17 year old" or similar. Your age is not a
  marketing angle; it's a privacy liability until after the LLC transfer.

### Handling "who is the founder?" questions

**Default response (pre-LLC):**
> "Just a solo indie dev building what I wish existed. Let the product speak."

**If pressed:**
> "Focused on shipping, not on being a personality. Talk to the product."

**Do NOT:**
- Lie and say you're a team when you're not
- Give a fake name
- Give your real name
- Engage with people trying to dox you

**If someone doxes you anyway** (unlikely pre-traction but plan for it):
- Don't panic-delete anything — that draws attention
- Don't respond to the doxxer directly
- Tweet one calm statement from @DegenDeskXYZ: "Degen Desk is built by one
  person. Personal details aren't the product. Building continues."
- Tell your parents immediately
- Keep shipping — the best response to doxing is the app continuing to improve

### Launch day tweet (draft)

```
🖥️ Degen Desk is live on the App Store.

An AI agent trained on Solana meme coin intelligence. Ask anything about
wallets, trading, launchpads, or on-chain strategy and get a direct answer.

Free to start. Pro unlocks unlimited chat + deep research.

👉 [App Store link]

Built for degens, by a degen.
```

### First-week content calendar

- **Day 1 (launch):** Launch tweet (above) + pinned thread with 5-6 screenshots
  showing key features
- **Day 2:** "Here's a question Degen Desk answered this morning" — screenshot
  of a good chat answer
- **Day 3:** Reply to 10 crypto accounts, add value, mention Degen Desk when
  genuinely relevant
- **Day 4:** Share a "what's coming next" mini-roadmap tweet
- **Day 5:** Engage with any early reviews or feedback publicly
- **Day 6:** Post a "24 hours of Degen Desk in numbers" tweet if metrics are
  worth sharing (don't post if they're embarrassing)
- **Day 7:** Thank early users, tease a feature coming next week

---

## Risk register

### Technical risks

- **Apple rejection on first submission** — likely. Have `docs/app-store-listing.md`
  ready and be prepared to iterate. Most rejections are cosmetic or demo-account
  related.
- **RevenueCat misconfiguration** — test thoroughly in sandbox before submission.
- **Firebase Auth failing in WKWebView** — already solved via auth-callback.html
  and deep-link handoff. Keep an eye on it.

### Business risks

- **Low early downloads** — normal. Budget for 0 downloads on day 1 and grow
  from there. Don't judge the app on week 1 metrics.
- **Chargebacks or refund requests** — Apple handles these. Watch RevenueCat for
  unusual patterns.
- **Copycat apps** — likely if Degen Desk gets traction. Stay ahead on features.

### Personal risks

- **Old content surfaces** — mitigated by Discord cleanup (done) and brand-first
  identity. Have the response plan in `docs/launch-plan.md` ready.
- **Doxing attempt** — mitigated by brand-first identity and Twitter hardening.
  Response plan above.
- **Parental conflict** — your parents are supportive, which is a huge
  advantage. Keep them in the loop on milestones, not just problems.

### Regulatory risks

- **"Financial advice" claims** — mitigated by clear disclaimers in the app,
  the website, the ToS, and the App Store description.
- **Crypto regulatory changes** — possible but unlikely to affect an
  educational/informational app. Monitor the SEC and Apple's crypto policies.

---

## Contact and account inventory

Keep this updated as accounts are created.

- **Apple Developer Program:** _(to be enrolled)_
- **Apple ID for Developer Account:** _(create dedicated one)_
- **App Store Connect:** _(same as Apple ID above)_
- **RevenueCat:** _(to be created)_
- **Firebase project:** `degen-desk-7cbe6` ✅
- **Vercel project:** `degendesk.xyz` ✅
- **Domain registrar:** _(note which one: Namecheap, Cloudflare, etc.)_
- **Twitter:** `@DegenDeskXYZ` ✅
- **Stripe (web):** _(already live for web subscriptions)_
- **Support email:** `support@degendesk.xyz` _(set up email forwarding via
  ImprovMX or similar if not already)_
- **Reviewer demo Google account:** `appreview@degendesk.xyz` _(to be created)_
- **Business bank account:** _(Mercury or Relay, Sept 17, 2026)_
- **LLC:** _(to be formed Sept 17, 2026)_
- **EIN:** _(to be issued Sept 17, 2026)_
