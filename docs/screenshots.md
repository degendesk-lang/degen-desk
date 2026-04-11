# App Store Screenshot Guide — Degen Desk

Everything you need to capture and upload App Store screenshots in one sitting.
Do this AFTER you have a working TestFlight build with Apple Sign-In + IAP functional.

---

## 1. Required sizes (as of Dec 2024)

Apple requires screenshots for at least **two device sizes**. You upload once,
and smaller screens typically scale automatically, but Apple still wants the
two primary sizes below:

| Device | Required resolution | Aspect | Notes |
|---|---|---|---|
| **6.9" iPhone** (16 Pro Max) | **1290 × 2796** portrait | 19.5:9 | REQUIRED — largest modern iPhone |
| **6.5" iPhone** (11 Pro Max / XS Max) | **1242 × 2688** portrait | 19.5:9 | REQUIRED — covers older models |
| 5.5" iPhone (8 Plus) | 1242 × 2208 portrait | 16:9 | Optional, only if you want to support older devices |
| iPad Pro 12.9" | 2048 × 2732 portrait | 4:3 | Only if you ship an iPad-optimized build |

You need **3–10 screenshots per size**. Apple recommends at least 3, and the
first 3 are the ones that show on the App Store product page before users tap
"see more". **The first 3 screenshots matter 10× more than the rest.**

---

## 2. How to capture (in priority order)

### Option A — iOS Simulator (FASTEST, use this)
1. Open Xcode → `npx cap open ios` from the repo root
2. Run the app on **iPhone 16 Pro Max** simulator (for 6.9")
3. Navigate to the screen you want to capture
4. Press **Cmd+S** in the simulator (File → Save Screen) — saves a PNG at the
   exact correct resolution to your Desktop
5. Switch to **iPhone 11 Pro Max** simulator, repeat for 6.5"

This is the best workflow because:
- Screenshots come out at pixel-perfect App Store dimensions
- No status bar weirdness
- You can stage the UI however you want (pre-populated chats, specific state)

### Option B — Real device via TestFlight
1. Install the TestFlight build on your iPhone
2. Capture via **Volume Up + Side Button** (standard screenshot)
3. AirDrop screenshots to your Mac
4. Problem: status bar shows your real carrier, battery, time — Apple rejects
   screenshots with carrier names or personal info visible. Edit them out or
   use a clean status bar overlay

**Use Option A unless you have a specific reason to use Option B.**

---

## 3. Shot list — 6 screenshots in priority order

Capture all 6 on both 6.9" and 6.5" simulators. That's 12 total files.

### Shot 1 — Welcome screen (HERO — most important)
**What:** The fresh welcome screen with the gradient title, "Try asking" label,
and all 4 suggestion cards visible.
**Why:** First impression. Shows the premium UI, the brand identity, and the
core interaction model all at once.
**How to stage:** Fresh install or tap "New chat" in the sidebar. Make sure
you're signed in so the sidebar shows your profile instead of the sign-in
button — signed-in state looks more legitimate.
**Caption text (overlay, optional):** "Expert Solana meme coin intelligence"

### Shot 2 — Chat in progress with a rich AI response
**What:** A real chat exchange showing a user question and a formatted Pro-model
response with headings, bullet points, and a callout box (tip/warning/info).
**Why:** Proves the product actually does something valuable. Shows the output
quality and the formatted message bubbles.
**How to stage:** Ask "How do I detect rug pulls, scams, and bundled launches?"
or "Tell me about Axiom, Photon, BullX, and GMGN trading platforms". These
questions pull from the local knowledge base and render with all the rich
formatting — callout boxes, bullet lists, chain tags.
**Caption text:** "AI-powered trading intel"

### Shot 3 — Pricing page
**What:** The polished pricing page showing Monthly/Yearly toggle, Free + Pro
cards, Pro card featured with "Recommended" badge.
**Why:** Transparency about what's free and what's paid. Apple reviewers
specifically look for this.
**How to stage:** Tap "Upgrade to Pro" from the sidebar. Set the toggle to
**Yearly** so the 3-day free trial banner is visible. Make sure iOS pricing
shows ($18.99 / $189.99).
**Caption text:** "3-day free trial on yearly"

### Shot 4 — Sidebar with topic library open
**What:** The sidebar open, Topics section expanded to show the full list of
22 topic buttons (Meme Coin Basics, Buying on Solana, Wallets, Metrics, etc.).
**Why:** Shows the breadth of knowledge. Proves this isn't a thin wrapper
around a chatbot — it's a curated intelligence product.
**How to stage:** Tap the hamburger icon, then expand the Topics section.
Scroll so users can see ~8–10 topics at once.
**Caption text:** "22 meme coin topics covered"

### Shot 5 — Referrals page
**What:** The referrals page showing the user's personal referral code, the
"Apply a referral code" card, the earnings section, and the 15% commission copy.
**Why:** Viral/growth angle. Makes the app feel like a community, not just a
one-shot utility.
**How to stage:** Tap "Referrals" in the sidebar footer. Make sure a code is
generated (you may need to be signed in and pre-generate one).
**Caption text:** "Earn 15% on every referral"

### Shot 6 — Rich response with warning/risk callout (closer)
**What:** A second chat screen showing a response that includes the red warning
callout box ("Risk:" or "Warning:") — proves the app is responsible and
safety-conscious.
**Why:** Counters the "meme coin app = gambling app" reviewer concern. Shows
you proactively warn users about risk. Apple reviewers score this well.
**How to stage:** Ask "What risk management strategies should I use for meme
coins?" or "How do I manage emotions and psychology while trading meme coins?"
Both responses include warning callouts.
**Caption text:** "Risk-first trading education"

---

## 4. Caption / text overlay guidance

**You don't need to add text overlays** — many successful apps use raw
screenshots with no marketing copy overlaid. But if you want to, common
patterns that work:

- **Big caption at the top**, screenshot underneath
- **Caption integrated into a colored banner** above the device frame
- **NO text directly on top of the app UI** — it looks amateur

**Tools for text overlays (if you decide to):**
- **Screenshots.pro** (free tier, web-based) — fast
- **Figma** — free, overkill but total control
- **Rotato** (paid, $30/mo) — fanciest, 3D device mockups
- **Screely** — free, minimal

**My recommendation:** ship plain screenshots first. You can always add
text overlays in an update. Getting to launch > perfect marketing assets.

---

## 5. Common reviewer rejection reasons to avoid

1. **Showing competitor branding** — no Axiom/Photon/GMGN/pump.fun logos.
   Text mentions are fine, visible logos are not.
2. **Showing crypto prices that look like financial advice** — the price
   ticker at the bottom is OK because it's neutral market data. Don't
   screenshot with a specific coin chart that looks like a buy
   recommendation.
3. **Carrier name / personal info in status bar** — use simulator, not
   real device
4. **Placeholder content** — "Lorem ipsum" or fake chat messages. Every
   screenshot must show real, functional app state.
5. **Showing features that don't exist yet** — don't screenshot a feature
   you're planning to add in v1.1
6. **Wrong resolution** — Apple rejects screenshots that don't match the
   required pixel dimensions. Always use simulator Cmd+S, never resize
   screenshots manually.

---

## 6. Pre-capture checklist

Before you start capturing, make sure:

- [ ] You have a TestFlight build running in simulator
- [ ] You're signed in with a real Google account (shows avatar + name)
- [ ] The account has Pro tier enabled (for Shot 2's rich formatting + so
      the sidebar shows "Pro" instead of "Upgrade to Pro")
- [ ] Simulator status bar is clean (simulator default: 9:41 AM, full battery,
      full signal — Apple explicitly recommends this)
- [ ] Device is set to **portrait orientation**
- [ ] Keyboard is dismissed when capturing (tap outside the input field)
- [ ] No browser dev tools open, no Xcode overlays

---

## 7. Upload to App Store Connect

After capturing all 12 screenshots:

1. Go to **App Store Connect → My Apps → Degen Desk → App Store tab**
2. Under **iPhone 6.9" Display**, drag in the 6 screenshots in shot-list order
3. Under **iPhone 6.5" Display**, drag in the 6 screenshots in shot-list order
4. Click **Save** in the top right

The order you upload them in is the order they display on the App Store
product page. **Shot 1 (welcome screen) must be first** — it's what drives
the install decision.

---

## 8. File naming convention (for your own organization)

Save captures to `~/Desktop/degen-desk-screenshots/` using this pattern:

```
6.9/01-welcome.png
6.9/02-chat-response.png
6.9/03-pricing.png
6.9/04-sidebar-topics.png
6.9/05-referrals.png
6.9/06-risk-callout.png

6.5/01-welcome.png
6.5/02-chat-response.png
...
```

This makes uploading in the correct order trivial.

---

## 9. Time estimate

- **Simulator capture** (both sizes): 30–45 minutes, assuming the app is built
  and working
- **Review + retake**: 15 minutes
- **Upload to App Store Connect**: 10 minutes
- **Total**: ~1 hour

Do this the day before you submit for review, not the day of. Gives you buffer
to retake anything that looks off.

---

## 10. After launch — what to iterate on

Once you have real users and analytics (via App Store Connect):

- **If conversion is low**: try swapping shot 1 (welcome) for shot 2 (chat in
  progress) to lead with the "magic" of the product instead of the marketing
- **If retention is low**: shot 5 (referrals) probably isn't helping and you
  should replace it with something more engagement-focused
- **Never change all 6 at once** — one at a time, monitor for a week, see what
  moves the install rate

---

**TL;DR:** Capture 6 shots × 2 sizes = 12 PNGs from iOS Simulator (Cmd+S) in
portrait mode, signed in as a Pro user, following the shot list above. Upload
in order to App Store Connect. Budget ~1 hour.
