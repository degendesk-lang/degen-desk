/**
 * Degen Desk - Expert-Level Meme Coin Knowledge Base
 * Deep Solana-first intelligence with ETH/BNB/Base coverage.
 * Written from the perspective of an experienced meme coin trader.
 */

const KNOWLEDGE_BASE = [

  // =============================================
  // 1. MEME COIN FUNDAMENTALS
  // =============================================
  {
    id: "basics",
    keywords: ["what are meme coins", "meme coin", "what is a meme coin", "basics", "explain meme coins", "how do meme coins work", "beginner", "new to meme coins", "getting started", "start", "newbie", "introduction", "tell me everything", "what should i know", "what can you do", "overview", "explain everything"],
    aliases: ["memecoin", "meme token"],
    response: `
      <h3>What Are Meme Coins?</h3>
      <p>Meme coins are speculative tokens built around internet culture, humor, narratives, or community momentum. Unlike utility tokens, their value is almost entirely driven by <strong>attention, community belief, and market psychology</strong>.</p>

      <h3>Why They Matter in Crypto</h3>
      <p>Meme coins are the <strong>highest-risk, highest-reward</strong> sector in crypto. They're where a $500 position can turn into $50,000 — or zero. They dominate on-chain trading volume on Solana and regularly produce the most dramatic returns (and losses) in the entire market.</p>

      <h3>How Meme Coins Actually Work</h3>
      <ul>
        <li><strong>Token creation:</strong> Anyone can create a meme coin in seconds on platforms like pump.fun (Solana) or via token deployer tools. There's no barrier to entry.</li>
        <li><strong>Liquidity pool:</strong> A trading pair is created (e.g., MEME/SOL) on a DEX. Buyers swap SOL for the token, sellers swap back. The pool's ratio determines the price.</li>
        <li><strong>Price mechanics:</strong> Price goes up when buy pressure exceeds sell pressure, and down when the opposite happens. With low liquidity, small buys/sells create massive price swings.</li>
        <li><strong>Value proposition:</strong> Community, meme virality, narrative timing, and occasionally celebrity or influencer endorsement. There is no revenue, no product, no utility in 99% of cases.</li>
      </ul>

      <h3>The Solana Meme Coin Ecosystem</h3>
      <p>Solana dominates meme coin trading because of:</p>
      <ul>
        <li><strong>Sub-second transaction finality</strong> (~400ms block times)</li>
        <li><strong>Near-zero fees</strong> (~$0.001-0.01 per transaction)</li>
        <li><strong>pump.fun</strong> — the dominant launchpad creating thousands of tokens daily</li>
        <li><strong>Mature tooling</strong> — Jupiter, Raydium, Photon, Axiom, GMGN, DEX Screener, RugCheck</li>
        <li><strong>Culture</strong> — Solana's community has embraced degen culture more than any other chain</li>
      </ul>

      <h3>Notable Meme Coins by Chain</h3>
      <ul>
        <li><span class="chain-tag sol">SOL</span> <strong>BONK, WIF (dogwifhat), POPCAT, MEW, BOME, SLERF, GOAT, FARTCOIN, AI16Z, PENGU</strong></li>
        <li><span class="chain-tag eth">ETH</span> <strong>DOGE, SHIB, PEPE, FLOKI, MOG, TURBO, WOJAK, SPX6900</strong></li>
        <li><span class="chain-tag bnb">BNB</span> <strong>BABYDOGE, FLOKI (multi-chain), SIMON'S CAT</strong></li>
      </ul>

      <div class="warning-box">
        <strong>Reality Check:</strong> Over 99% of meme coins go to zero. The winners you see on Twitter/X are survivorship bias. For every 1000x screenshot, there are thousands of traders who lost everything. Approach this space with money you can afford to lose completely.
      </div>
    `
  },

  // =============================================
  // 2. BUYING ON SOLANA (DETAILED)
  // =============================================
  {
    id: "buying-solana",
    keywords: ["buy solana", "buy meme coin solana", "how to buy", "purchase", "buying on solana", "buy on sol", "swap solana", "get meme coins", "first meme coin", "how do i buy"],
    aliases: ["buy sol", "swap sol"],
    response: `
      <h3>How to Buy Meme Coins on Solana</h3>
      <p>Solana is where the majority of meme coin action happens. Here's the complete process from zero to trading.</p>

      <h3>Step 1: Set Up a Wallet</h3>
      <ul>
        <li>Install <strong>Phantom</strong> (browser extension + mobile) — the standard for Solana</li>
        <li>Write down your <strong>seed phrase</strong> (12 words) on paper. Never store it digitally. Never share it.</li>
        <li><strong>Pro move:</strong> Create a separate "degen wallet" for risky plays. Keep your main holdings in a different wallet.</li>
      </ul>

      <h3>Step 2: Fund Your Wallet with SOL</h3>
      <ul>
        <li>Buy SOL on a centralized exchange (Coinbase, Binance, Kraken, Bybit)</li>
        <li>Withdraw to your Phantom wallet address (starts with a letter/number, ~32-44 characters)</li>
        <li>Keep at least <strong>0.05-0.1 SOL</strong> reserved for transaction fees and priority fees</li>
        <li><strong>Alternative:</strong> Use Moonpay or Coinbase Onramp directly inside Phantom to buy SOL with card</li>
      </ul>

      <h3>Step 3: Choose Your Trading Method</h3>
      <p>This is where it gets real. You have multiple options:</p>

      <h3>Option A: Jupiter (jup.ag) — Best for Standard Swaps</h3>
      <ul>
        <li>Aggregates all Solana DEXs for the best price</li>
        <li>Supports limit orders, DCA, and swap with MEV protection</li>
        <li>Connect your Phantom wallet, paste the token's <strong>contract address (CA)</strong>, set amount, swap</li>
        <li>Best for: Tokens that have already graduated to Raydium/Orca with established liquidity</li>
      </ul>

      <h3>Option B: Trading Terminals — Best for Active Trading</h3>
      <ul>
        <li><strong>Axiom, Photon, BullX, GMGN</strong> — web-based trading terminals with advanced features</li>
        <li>Faster execution, built-in charts, auto-buy on new pairs, wallet tracking, position management</li>
        <li>These are what experienced traders actually use day-to-day</li>
        <li>More details in the "Trading Terminals" topic</li>
      </ul>

      <h3>Option C: Telegram Bots — Best for Speed</h3>
      <ul>
        <li><strong>BONKbot, Trojan, Maestro, Bloom</strong> — trade directly from Telegram</li>
        <li>Paste a CA in the chat, hit buy. Fastest possible execution for sniping.</li>
        <li>More details in the "Telegram Bots" topic</li>
      </ul>

      <h3>Step 4: Finding the Contract Address (CA)</h3>
      <ul>
        <li><strong>NEVER search by token name</strong> — scammers create hundreds of clones with the same name</li>
        <li>Get the CA from: the project's official Twitter/X, their Telegram pinned message, or DEX Screener</li>
        <li>Verify on <strong>DEX Screener</strong> — check the pair age, volume, and liquidity match what you expect</li>
        <li>Cross-reference: Does the CA on their Twitter match the one on DEX Screener?</li>
      </ul>

      <div class="tip-box">
        <strong>Experienced Trader Workflow:</strong> See a token on Twitter → copy CA → paste into RugCheck (check safety) → paste into DEX Screener (check chart/liquidity) → if it passes, paste into Axiom/Photon/GMGN to buy. This whole process takes under 30 seconds with practice.
      </div>

      <div class="warning-box">
        <strong>Critical:</strong> Always triple-check the contract address. One wrong character = completely different token, likely a scam copycat. Bookmark verified CAs or use the "favorite" features in trading terminals.
      </div>
    `
  },

  // =============================================
  // 3. TRADING TERMINALS (AXIOM, PHOTON, BULLX, GMGN, PADRE)
  // =============================================
  {
    id: "terminals",
    keywords: ["trading terminal", "terminal", "axiom", "photon", "bullx", "gmgn", "padre", "trading platform", "trading interface", "where to trade", "best platform", "trading tool", "trading app", "platform comparison"],
    aliases: ["axiom", "photon", "bullx", "gmgn", "padre", "photon sol", "axiom trade", "bull x"],
    response: `
      <h3>Solana Trading Terminals — The Tools Pros Use</h3>
      <p>Trading terminals are web-based platforms purpose-built for meme coin trading. They combine charts, execution, wallet tracking, and token analysis into one interface. If you're serious about trading, you need to use one of these instead of just Jupiter.</p>

      <h3>Axiom</h3>
      <ul>
        <li><strong>What it is:</strong> A fast, feature-rich Solana trading terminal that's become one of the most popular platforms for active meme coin traders.</li>
        <li><strong>Key features:</strong>
          <ul>
            <li>Lightning-fast execution with customizable priority fees and Jito tipping</li>
            <li>Real-time charts integrated with trading (no switching between DEX Screener and your swap tool)</li>
            <li>Wallet tracking — follow smart money wallets and see their trades in real-time</li>
            <li>New pair alerts — get notified when new tokens launch or graduate from pump.fun to Raydium</li>
            <li>Built-in token scanner with safety checks (mint authority, freeze authority, LP status)</li>
            <li>Position management — see your P&L, set take-profit and stop-loss orders</li>
            <li>Memescope — customizable feeds to filter new launches by criteria you set (holder count, volume, etc.)</li>
          </ul>
        </li>
        <li><strong>Best for:</strong> Traders who want an all-in-one platform with strong execution speed and analytics</li>
        <li><strong>Fee:</strong> ~1% on transactions (varies)</li>
      </ul>

      <h3>Photon</h3>
      <ul>
        <li><strong>What it is:</strong> One of the original Solana trading terminals. Clean, fast, battle-tested.</li>
        <li><strong>Key features:</strong>
          <ul>
            <li>Extremely fast swap execution with priority fee customization</li>
            <li>Auto-buy feature — automatically buy tokens when they hit certain criteria</li>
            <li>New pair sniping — detect and buy new Raydium listings within seconds of migration</li>
            <li>Limit orders and take-profit/stop-loss functionality</li>
            <li>Copy trading — mirror trades from wallets you track</li>
            <li>Detailed token info panel with holder analysis, LP info, and social links</li>
            <li>Quick-buy buttons (e.g., 0.1 SOL, 0.5 SOL, 1 SOL) for rapid entries</li>
          </ul>
        </li>
        <li><strong>Best for:</strong> Speed-focused traders, snipers, and those who want reliable execution</li>
        <li><strong>Fee:</strong> ~1% on transactions</li>
      </ul>

      <h3>BullX</h3>
      <ul>
        <li><strong>What it is:</strong> Multi-chain trading terminal supporting Solana, Ethereum, Base, BNB, and more.</li>
        <li><strong>Key features:</strong>
          <ul>
            <li>Cross-chain support — trade meme coins on multiple chains from one interface</li>
            <li>pump.fun integration — buy tokens directly while still on the bonding curve (before graduation)</li>
            <li>Advanced order types including trailing stop-loss</li>
            <li>Wallet tracking and copy trading across chains</li>
            <li>Token scanner with customizable filters</li>
            <li>Portfolio dashboard showing all positions across chains</li>
          </ul>
        </li>
        <li><strong>Best for:</strong> Multi-chain traders or those who want pump.fun bonding curve trading integrated with their terminal</li>
        <li><strong>Fee:</strong> ~1% on transactions</li>
      </ul>

      <h3>GMGN</h3>
      <ul>
        <li><strong>What it is:</strong> A data-heavy trading terminal focused on smart money tracking and on-chain analytics.</li>
        <li><strong>Key features:</strong>
          <ul>
            <li><strong>Smart money dashboard</strong> — tracks known profitable wallets, KOLs (Key Opinion Leaders), and "fresh wallet" snipers in real-time</li>
            <li>Shows you exactly what tokens smart money is buying RIGHT NOW</li>
            <li>Wallet profiling — see any wallet's win rate, average return, and trading patterns</li>
            <li>Token safety scores and insider detection</li>
            <li>New token feed with filtering by smart money buys, volume, holder growth</li>
            <li>Built-in trading with fast execution</li>
            <li>Dev wallet tracking — see what the token deployer is doing</li>
          </ul>
        </li>
        <li><strong>Best for:</strong> Data-driven traders who want to follow smart money and analyze on-chain activity deeply</li>
        <li><strong>Fee:</strong> ~1% on transactions</li>
      </ul>

      <h3>Padre</h3>
      <ul>
        <li><strong>What it is:</strong> A newer Solana trading terminal that's rapidly gaining popularity for its speed, clean UI, and trader-centric design. Built to compete directly with Photon and Axiom.</li>
        <li><strong>Key features:</strong>
          <ul>
            <li>Extremely fast execution with optimized transaction routing and Jito tip integration</li>
            <li>Clean, modern interface designed for rapid decision-making — minimal clutter, maximum information</li>
            <li>Built-in token scanner with real-time new pair detection and pump.fun graduation tracking</li>
            <li>Wallet tracking and copy trading functionality</li>
            <li>Quick-buy presets and one-click trading for fast entries/exits</li>
            <li>Token safety analysis integrated directly into the trading view</li>
            <li>Position management with P&L tracking, take-profit, and stop-loss orders</li>
            <li>Growing feature set — actively developed with frequent updates based on trader feedback</li>
          </ul>
        </li>
        <li><strong>Best for:</strong> Traders looking for a fast, clean alternative to the established terminals. Worth trying if you find Photon or Axiom cluttered or want to compare execution speed.</li>
        <li><strong>Fee:</strong> ~1% on transactions (competitive with other terminals)</li>
      </ul>

      <h3>Head-to-Head Comparison</h3>
      <table style="width:100%; font-size:11px; border-collapse:collapse; margin:10px 0;">
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:5px;"><strong>Feature</strong></td>
          <td style="padding:5px;"><strong>Axiom</strong></td>
          <td style="padding:5px;"><strong>Photon</strong></td>
          <td style="padding:5px;"><strong>BullX</strong></td>
          <td style="padding:5px;"><strong>GMGN</strong></td>
          <td style="padding:5px;"><strong>Padre</strong></td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:5px;">Execution speed</td>
          <td style="padding:5px; color:#00ff88;">Excellent</td>
          <td style="padding:5px; color:#00ff88;">Excellent</td>
          <td style="padding:5px;">Good</td>
          <td style="padding:5px;">Good</td>
          <td style="padding:5px; color:#00ff88;">Excellent</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:5px;">Smart money data</td>
          <td style="padding:5px;">Good</td>
          <td style="padding:5px;">Basic</td>
          <td style="padding:5px;">Good</td>
          <td style="padding:5px; color:#00ff88;">Best</td>
          <td style="padding:5px;">Basic</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:5px;">Multi-chain</td>
          <td style="padding:5px; color:#ff4757;">Solana only</td>
          <td style="padding:5px; color:#ff4757;">Solana only</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#ff4757;">Solana only</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:5px;">pump.fun trading</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:5px;">Copy trading</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
          <td style="padding:5px; color:#00ff88;">Yes</td>
        </tr>
        <tr>
          <td style="padding:5px;">Best for</td>
          <td style="padding:5px;">All-around</td>
          <td style="padding:5px;">Speed/sniping</td>
          <td style="padding:5px;">Multi-chain</td>
          <td style="padding:5px;">Analytics</td>
          <td style="padding:5px;">Clean UI/speed</td>
        </tr>
      </table>

      <div class="tip-box">
        <strong>Experienced Trader Take:</strong> Most serious Solana traders have accounts on 2-3 of these platforms. Many use Axiom or Photon as their primary execution tool and GMGN as their research/smart-money dashboard. Padre is a strong newer option worth testing — especially if you value a clean interface. There's no single "best" — they each have strengths. Try them all and see what fits your workflow.
      </div>

      <div class="info-box">
        <strong>Setup Tip:</strong> When you first connect your wallet to a terminal, configure your default buy amounts (quick-buy buttons), set your default slippage (1-5% for established tokens, 10-15% for new/low-liq tokens), and set your default priority fee/Jito tip. This saves critical seconds when you need to move fast.
      </div>
    `
  },

  // =============================================
  // 4. TELEGRAM TRADING BOTS
  // =============================================
  {
    id: "tg-bots",
    keywords: ["telegram bot", "telegram bots", "trading bot", "bonkbot", "trojan", "maestro", "bloom", "sol trading bot", "tg bot", "bot trading", "telegram trading"],
    aliases: ["bonkbot", "trojan", "maestro", "bloom", "banana gun", "sol trading bot"],
    response: `
      <h3>Telegram Trading Bots for Solana</h3>
      <p>Telegram bots let you trade directly inside Telegram by pasting a contract address. They're the <strong>fastest way to execute a trade</strong> because there's no website to load — just paste and tap.</p>

      <h3>How They Work</h3>
      <ol>
        <li>Start the bot in Telegram — it generates a new Solana wallet for you (or lets you import one)</li>
        <li>Send SOL to the bot's wallet address</li>
        <li>Paste any token CA into the chat</li>
        <li>Hit "Buy" with your preset amount (e.g., 0.5 SOL, 1 SOL)</li>
        <li>The bot executes the swap with your configured slippage and priority fee</li>
        <li>To sell, open your positions and hit sell (25%, 50%, 100%, etc.)</li>
      </ol>

      <h3>Top Solana Telegram Bots</h3>

      <h3>BONKbot</h3>
      <ul>
        <li>One of the most popular and longest-running Solana trading bots</li>
        <li>Extremely fast execution. Customizable buy amounts, slippage, and Jito tips</li>
        <li>Supports limit orders, auto-sell at target prices</li>
        <li>Simple UI — great for beginners getting into bot trading</li>
        <li>Referral system that shares fees with referrers</li>
      </ul>

      <h3>Trojan Bot</h3>
      <ul>
        <li>Very popular, known for reliability and speed</li>
        <li>Supports sniping new launches — can automatically buy tokens the moment they hit Raydium</li>
        <li>Copy trading — follow specific wallets and auto-mirror their buys</li>
        <li>Position tracking with P&L display</li>
        <li>Multi-wallet support — run multiple wallets from one bot</li>
      </ul>

      <h3>Bloom</h3>
      <ul>
        <li>Newer bot gaining traction for its speed and features</li>
        <li>Fast execution with Jito bundle support</li>
        <li>Integrated token scanner and alerts</li>
        <li>Clean interface with detailed trade confirmations</li>
      </ul>

      <h3>Maestro</h3>
      <ul>
        <li>Multi-chain bot — supports Solana, Ethereum, BNB, Base, and more</li>
        <li>Good for traders active on multiple chains</li>
        <li>Sniping features, copy trading, and anti-MEV protection</li>
      </ul>

      <h3>Banana Gun</h3>
      <ul>
        <li>Started on Ethereum, expanded to Solana</li>
        <li>Known for strong sniping capabilities on new launches</li>
        <li>Auto-buy features with customizable triggers</li>
        <li>Has its own token (BANANA) which gives fee discounts</li>
      </ul>

      <div class="warning-box">
        <strong>Bot Security:</strong>
        <ul>
          <li>Telegram bots generate a wallet that THEY control the private key for. You are trusting the bot with your funds.</li>
          <li><strong>Never</strong> store large amounts in a bot wallet. Only deposit what you plan to actively trade.</li>
          <li>Use established, well-known bots only. Scam bots that steal funds are common.</li>
          <li>Verify you're using the real bot — check the official username carefully. Scammers create lookalike bots with slightly different usernames.</li>
          <li>Enable 2FA/withdrawal confirmations if the bot supports them.</li>
        </ul>
      </div>

      <div class="tip-box">
        <strong>When to Use a TG Bot vs Terminal:</strong> TG bots excel when you need absolute speed (sniping a launch, acting on a fast call) or when you're on mobile. Terminals like Axiom/Photon are better for research-heavy trading, chart analysis, and managing multiple positions. Many traders have both set up.
      </div>
    `
  },

  // =============================================
  // 5. WALLETS
  // =============================================
  {
    id: "wallets",
    keywords: ["wallet", "wallets", "phantom", "solflare", "metamask", "trust wallet", "backpack", "best wallet", "which wallet", "hot wallet", "cold wallet", "hardware wallet", "ledger", "burner wallet"],
    aliases: ["phantom", "solflare", "metamask", "backpack", "rabby"],
    response: `
      <h3>Wallet Setup for Meme Coin Trading</h3>

      <h3>The Multi-Wallet Strategy (What Experienced Traders Do)</h3>
      <p>Don't use one wallet for everything. Experienced traders segment their wallets:</p>
      <ul>
        <li><strong>Main/vault wallet</strong> — Holds your core SOL/ETH. Connected to a Ledger hardware wallet. You never connect this to random dApps.</li>
        <li><strong>Trading wallet</strong> — Where you actively trade meme coins. Connected to Axiom/Photon/Jupiter. Only keep what you're willing to risk.</li>
        <li><strong>Burner wallet(s)</strong> — Disposable wallets for high-risk plays, claiming airdrops, or testing unknown dApps. Easy to create new ones in Phantom.</li>
        <li><strong>Bot wallet</strong> — Your Telegram bot wallet (BONKbot, Trojan, etc.). Only fund with what you'll trade that session.</li>
      </ul>

      <h3><span class="chain-tag sol">SOL</span> Solana Wallets</h3>
      <ul>
        <li><strong>Phantom</strong> — The standard. Clean UI, fast, built-in swap, NFT gallery, mobile app. Supports Ledger. 95%+ of Solana meme coin traders use Phantom.</li>
        <li><strong>Solflare</strong> — Strong Ledger integration, transaction simulation (shows you what a transaction will do before you approve it), staking.</li>
        <li><strong>Backpack</strong> — By the Mad Lads team. xNFT support, modern design. Growing user base.</li>
      </ul>

      <h3><span class="chain-tag eth">ETH</span> / <span class="chain-tag bnb">BNB</span> EVM Wallets</h3>
      <ul>
        <li><strong>MetaMask</strong> — Industry standard for all EVM chains. Works with ETH, BNB, Base, Arbitrum, etc.</li>
        <li><strong>Rabby</strong> — Superior to MetaMask in many ways. Transaction simulation, multi-chain dashboard, security warnings. Highly recommended as a MetaMask replacement.</li>
        <li><strong>Coinbase Wallet</strong> — Best for Base chain. Easy fiat on-ramp. Good for beginners.</li>
      </ul>

      <h3>Hardware Wallets</h3>
      <ul>
        <li><strong>Ledger Nano S Plus / Nano X / Stax</strong> — Works with Phantom (Solana) and MetaMask (EVM). Your seed phrase never leaves the device.</li>
        <li>Use Ledger for your vault wallet. It adds an extra approval step (physically pressing a button) which protects against wallet drainers.</li>
      </ul>

      <div class="warning-box">
        <strong>Non-Negotiable Security Rules:</strong>
        <ul>
          <li>NEVER share your seed phrase with anyone. No legitimate service will ever ask for it.</li>
          <li>NEVER enter your seed phrase on any website.</li>
          <li>NEVER store your seed phrase in a screenshot, notes app, email, or cloud storage.</li>
          <li>Write it on paper (or metal plate) and store it somewhere physically secure.</li>
          <li>Revoke token approvals regularly — use revoke.cash (EVM) or the revoke feature in Phantom settings.</li>
          <li>If you think your wallet is compromised, transfer everything to a NEW wallet immediately. Don't "fix" the old one.</li>
        </ul>
      </div>
    `
  },

  // =============================================
  // 6. DEX PLATFORMS
  // =============================================
  {
    id: "dex",
    keywords: ["dex", "decentralized exchange", "jupiter", "raydium", "uniswap", "pancakeswap", "orca", "meteora", "amm", "biggest dex", "liquidity pool", "lp", "dca", "dollar cost average", "limit order", "swap"],
    aliases: ["jupiter", "raydium", "uniswap", "pancakeswap", "orca", "meteora", "aerodrome", "dca", "limit order"],
    response: `
      <h3>DEX Platforms — Where Meme Coins Trade</h3>

      <h3><span class="chain-tag sol">SOL</span> Solana DEXs</h3>

      <h3>Jupiter (jup.ag)</h3>
      <ul>
        <li><strong>What it is:</strong> The #1 swap aggregator on Solana. It routes your trade across all Solana DEXs (Raydium, Orca, Meteora, etc.) to find the best price.</li>
        <li><strong>Key features:</strong> Limit orders, DCA (dollar-cost averaging), perpetual futures, MEV protection toggle</li>
        <li><strong>When to use:</strong> Standard swaps for established tokens, limit orders, DCA strategies. Jupiter is the backbone — even many trading terminals route through Jupiter's backend.</li>
        <li><strong>Fee:</strong> No platform fee on most swaps (just DEX LP fees + network fees)</li>
      </ul>

      <h3>Raydium</h3>
      <ul>
        <li><strong>What it is:</strong> The largest AMM (Automated Market Maker) on Solana. When a token "graduates" from pump.fun, it migrates to a <strong>Raydium liquidity pool</strong>.</li>
        <li><strong>Why it matters:</strong> Raydium is where most meme coin liquidity lives post-pump.fun. It's also where most trading terminals execute your trades.</li>
        <li><strong>Key detail:</strong> Raydium pools use a constant product formula (x*y=k). Understanding this helps you understand why slippage increases with bigger trades relative to pool size.</li>
        <li><strong>Concentrated Liquidity (CLMM):</strong> Raydium also offers concentrated liquidity pools where LPs can target specific price ranges.</li>
      </ul>

      <h3>Orca</h3>
      <ul>
        <li>Concentrated liquidity DEX. Known for lower slippage on larger trades when there's active LP in the price range.</li>
        <li>Some meme coins have Orca pools in addition to Raydium. Jupiter aggregates both.</li>
      </ul>

      <h3>Meteora</h3>
      <ul>
        <li>Dynamic liquidity pools with innovative LP strategies. Growing in importance.</li>
        <li>Some newer tokens are launching with Meteora DLMM (Dynamic Liquidity Market Maker) pools instead of Raydium.</li>
        <li>pump.fun has at times used Meteora for token migrations instead of Raydium.</li>
      </ul>

      <h3><span class="chain-tag eth">ETH</span> Ethereum DEXs</h3>
      <ul>
        <li><strong>Uniswap</strong> — The original DEX. Most ETH meme coins trade here. Gas fees: $5-100+ per swap depending on congestion.</li>
        <li><strong>1inch</strong> — Aggregator for EVM chains (like Jupiter for Ethereum).</li>
        <li><strong>SushiSwap</strong> — Uniswap alternative with loyalty features.</li>
      </ul>

      <h3><span class="chain-tag bnb">BNB</span> BNB Chain DEXs</h3>
      <ul>
        <li><strong>PancakeSwap</strong> — Dominant BNB Chain DEX. Fees ~$0.10-0.50 per swap.</li>
      </ul>

      <h3>Base Chain DEXs</h3>
      <ul>
        <li><strong>Aerodrome</strong> — Leading Base DEX with deep liquidity.</li>
        <li><strong>Uniswap (Base deployment)</strong> — Uniswap with L2-level fees.</li>
      </ul>

      <div class="tip-box">
        <strong>Understanding the Flow:</strong> Token launches on pump.fun (bonding curve) → graduates to Raydium/Meteora (real LP) → now tradeable via Jupiter, Axiom, Photon, GMGN, and all Solana DEXs. The trading terminals route through these DEXs automatically — you don't need to go to Raydium directly.
      </div>
    `
  },

  // =============================================
  // 7. SCAM DETECTION (DEEP)
  // =============================================
  {
    id: "scams",
    keywords: ["scam", "rug pull", "rug", "rugpull", "honeypot", "honey pot", "safe", "safety", "how to spot", "red flag", "red flags", "audit", "scam detection", "is it safe", "fake", "fraud", "protect", "security", "bundled", "bundle"],
    aliases: ["rugcheck", "tokensniffer", "honeypot", "rug"],
    response: `
      <h3>Scam Detection — Deep Dive</h3>
      <p>Scam detection is a survival skill. If you can't spot rugs, you will lose money. Here's what experienced traders check.</p>

      <h3>Tier 1: Instant Disqualifiers</h3>
      <ul>
        <li><strong>Mint authority NOT revoked</strong> — The creator can mint unlimited new tokens, diluting your holdings to zero. Check on RugCheck or Solscan. If mint authority is enabled, DO NOT BUY.</li>
        <li><strong>Freeze authority NOT revoked</strong> — The creator can freeze your tokens so you literally cannot sell. Instant pass.</li>
        <li><strong>Liquidity not burned or locked</strong> — If the dev can pull LP, they can drain the trading pool, leaving your tokens worthless. LP should be burned (permanent) or locked for a meaningful duration (months/years).</li>
        <li><strong>Honeypot</strong> — You can buy but the contract prevents you from selling. Test with a tiny buy first, then try to sell immediately.</li>
      </ul>

      <h3>Tier 2: Major Red Flags</h3>
      <ul>
        <li><strong>Bundled launch</strong> — The deployer used a Jito bundle to create the token AND buy a large supply in the same transaction. This means the dev secretly holds a big bag that won't show as "dev wallet" in basic scanners. Check for this on GMGN or Birdeye's bundle detection features.</li>
        <li><strong>Concentrated holdings</strong> — If the top 10 wallets hold >40-50% of supply, the token is a ticking time bomb. One dump crashes everything. Use BubbleMaps to see if "separate" wallets are secretly connected.</li>
        <li><strong>Fake/copied socials</strong> — Scammers copy existing project websites and Twitter accounts. Verify the Twitter account has real engagement history, not just created today.</li>
        <li><strong>Dev selling but holding through multiple wallets</strong> — The dev might sell from their deployer wallet (making it look "safe") while holding through 20+ alt wallets they funded before launch.</li>
      </ul>

      <h3>Tier 3: Subtler Warning Signs</h3>
      <ul>
        <li><strong>Wash trading</strong> — Artificially inflated volume through the same wallets buying/selling to each other. If you see high volume but the holder count isn't growing, it's likely wash traded.</li>
        <li><strong>Paid KOL shilling</strong> — Influencers get paid (or given free tokens) to promote a token. When all of CT is suddenly talking about one token at the same time, it's often a coordinated campaign. The KOLs are the exit liquidity providers' marketing department.</li>
        <li><strong>Too-perfect chart</strong> — A chart that goes straight up with no dips often means a small group is carefully managing the price to attract FOMO buyers before dumping.</li>
        <li><strong>Copy-paste projects</strong> — Website is a template, tokenomics are generic, roadmap is vague. Zero effort = zero legitimacy.</li>
      </ul>

      <h3>Safety Checklist (In Order)</h3>
      <ol>
        <li><strong>RugCheck.xyz</strong> — Paste the CA. Check for "Good" rating. Look at mint/freeze authority, LP status, top holders.</li>
        <li><strong>BubbleMaps.io</strong> — Visual map of holder connections. Are "different" wallets secretly linked?</li>
        <li><strong>DEX Screener</strong> — Check pair age, liquidity depth, volume-to-mcap ratio.</li>
        <li><strong>GMGN/Birdeye</strong> — Check for bundled launch, dev wallet activity, smart money involvement.</li>
        <li><strong>Twitter/X</strong> — Is the community real or botted? Check reply quality, not just follower count.</li>
        <li><strong>Solscan</strong> — Look at the deployer wallet's history. Have they deployed other tokens that all went to zero?</li>
      </ol>

      <div class="warning-box">
        <strong>The 30-Second Rule:</strong> If you can't verify basic safety (LP burned, mint revoked, no bundle) within 30 seconds, skip the token. There will always be another play. Protecting your capital is more important than catching every pump.
      </div>
    `
  },

  // =============================================
  // 8. PUMP.FUN & LAUNCHPADS (DEEP)
  // =============================================
  {
    id: "launchpads",
    keywords: ["pump.fun", "pump fun", "pumpfun", "launchpad", "launch", "bonding curve", "fair launch", "create token", "make a token", "launch a token", "token creation", "new token", "migrate", "graduation", "king of the hill"],
    aliases: ["pump.fun", "pumpfun", "pump fun", "moonshot", "believe"],
    response: `
      <h3>pump.fun — The Meme Coin Factory</h3>
      <p>pump.fun is the dominant meme coin launchpad on Solana. Understanding its mechanics is essential for any Solana meme coin trader.</p>

      <h3>How pump.fun Works (Technical Detail)</h3>
      <ol>
        <li><strong>Creation:</strong> Anyone creates a token for ~0.02 SOL. They set the name, ticker, image, and description. Total supply is fixed at 1 billion tokens.</li>
        <li><strong>Bonding curve phase:</strong> The token launches on an internal bonding curve. The price starts near zero and increases mathematically as more SOL is deposited. Early buyers get the cheapest price.</li>
        <li><strong>Curve mechanics:</strong> ~800M tokens are available on the bonding curve. ~200M tokens + the deposited SOL are reserved for the Raydium LP at graduation.</li>
        <li><strong>King of the Hill:</strong> Tokens closest to graduating (filling the bonding curve) get featured on the pump.fun homepage. This visibility creates a positive feedback loop — more attention → more buys → faster graduation.</li>
        <li><strong>Graduation:</strong> When the bonding curve reaches ~$69K market cap (~85 SOL deposited), the token "graduates." pump.fun creates a Raydium liquidity pool with the reserved tokens and SOL, and the token becomes tradeable on all Solana DEXs.</li>
        <li><strong>Post-graduation:</strong> LP is burned automatically. The token is now a standard Raydium-listed SPL token tradeable via Jupiter, Axiom, Photon, etc.</li>
      </ol>

      <h3>pump.fun Trading Strategies</h3>
      <ul>
        <li><strong>Curve trading (highest risk, highest reward):</strong> Buy on the bonding curve when a token is very young. If it graduates, your entry was extremely early. If it doesn't graduate (most don't), you likely lose most of your investment.</li>
        <li><strong>Graduation snipe:</strong> Use Photon, Axiom, or a Telegram bot to automatically buy the instant a token graduates to Raydium. You avoid bonding curve risk but get in at the first moment of real DEX trading.</li>
        <li><strong>Post-graduation entry:</strong> Wait for the token to prove itself on Raydium — establish a chart pattern, build holders, develop community. Lower reward ceiling but much lower risk of buying a dead token.</li>
      </ul>

      <h3>What to Look for in pump.fun Tokens</h3>
      <ul>
        <li><strong>Narrative fit:</strong> Does the meme/concept have legs? Is it timely? Does it tap into something people care about?</li>
        <li><strong>Community forming:</strong> Is there a Telegram being created? Are people tweeting about it organically?</li>
        <li><strong>Dev behavior:</strong> Did the dev buy a large amount? (Check early transactions.) A dev holding a massive bag is planning to dump on graduation.</li>
        <li><strong>Bonding curve velocity:</strong> How fast is the curve filling? Slow = dying interest. Fast = momentum building.</li>
        <li><strong>Holder count on the curve:</strong> More unique holders = more distributed = healthier if it graduates.</li>
      </ul>

      <h3>Other Launchpads</h3>
      <ul>
        <li><span class="chain-tag sol">SOL</span> <strong>Moonshot</strong> — By the DEX Screener team. Similar bonding curve model. Lower volume than pump.fun.</li>
        <li><span class="chain-tag sol">SOL</span> <strong>Believe</strong> — Newer launchpad gaining traction.</li>
        <li><span class="chain-tag eth">ETH</span> Various pump.fun clones exist on Ethereum and Base.</li>
        <li><span class="chain-tag bnb">BNB</span> <strong>Four.Meme, PinkSale, Gempad</strong> — BNB Chain presale/launch platforms.</li>
      </ul>

      <div class="tip-box">
        <strong>The Math:</strong> Thousands of tokens launch on pump.fun daily. Fewer than ~1-2% ever graduate. Of those that graduate, most still lose value within hours/days. Of the survivors, a tiny fraction reach $1M+ market cap. Trading pump.fun is a numbers game — you're looking for the rare needle in a massive haystack.
      </div>
    `
  },

  // =============================================
  // 9. MEV, SLIPPAGE, JITO & EXECUTION
  // =============================================
  {
    id: "mev-execution",
    keywords: ["slippage", "mev", "front run", "frontrun", "front-run", "sandwich", "sandwich attack", "priority fee", "jito", "jito bundle", "jito tip", "gas", "gas fee", "transaction fee", "failed transaction", "transaction failed", "speed", "execution", "rpc", "rpc node"],
    aliases: ["jito", "slippage", "mev", "priority fee", "sandwich", "rpc"],
    response: `
      <h3>Execution Mechanics — MEV, Slippage, Jito &amp; RPC</h3>
      <p>Understanding execution is what separates profitable traders from those who bleed money to hidden costs.</p>

      <h3>Slippage — The Hidden Cost</h3>
      <ul>
        <li><strong>What it is:</strong> The difference between the price you expect and the price you actually get when your trade executes.</li>
        <li><strong>Why it happens:</strong> Price moves between when you submit your transaction and when it's confirmed. Also caused by your trade itself impacting the pool's price (price impact).</li>
        <li><strong>Slippage settings:</strong>
          <ul>
            <li><strong>Established tokens (BONK, WIF, PEPE):</strong> 0.5-1% slippage</li>
            <li><strong>Mid-liquidity meme coins:</strong> 1-5%</li>
            <li><strong>New/micro-cap tokens:</strong> 5-15%</li>
            <li><strong>Absolute emergency (trying to dump a rugging token):</strong> 20-50% — but understand you're accepting a terrible price</li>
          </ul>
        </li>
        <li><strong>Price impact vs slippage:</strong> Price impact is the guaranteed cost of your trade size relative to the pool. Slippage is the additional variation. Both matter. If price impact is >5%, your trade is too big for the pool — split it up.</li>
      </ul>

      <h3>MEV &amp; Sandwich Attacks</h3>
      <ul>
        <li><strong>Front-running:</strong> A MEV bot sees your pending buy, places their buy FIRST (paying higher priority fees), drives the price up, then your trade executes at the worse price. The bot profits from the difference.</li>
        <li><strong>Sandwich attack:</strong> The bot front-runs your buy AND back-runs your sell (or waits to sell after your buy pumps the price). You're literally the filling in their profit sandwich.</li>
        <li><strong>How big is the problem?</strong> On Ethereum, MEV extraction costs traders billions per year. On Solana, it's growing but less severe due to the different architecture.</li>
      </ul>

      <h3>Jito Bundles &amp; Priority Fees (Solana-Specific)</h3>
      <ul>
        <li><strong>Jito</strong> is the MEV infrastructure on Solana. Jito validators process "bundles" — groups of transactions that execute atomically (all-or-nothing, in a specific order).</li>
        <li><strong>Jito tips</strong> are bribes you pay to Jito validators to prioritize your transaction. Higher tip = higher chance of landing in the next block.</li>
        <li><strong>When to increase your Jito tip:</strong>
          <ul>
            <li>Sniping a new launch (everyone is competing for the same block)</li>
            <li>Network congestion (lots of activity, blocks are full)</li>
            <li>Time-sensitive exits (you need to sell NOW)</li>
          </ul>
        </li>
        <li><strong>Typical Jito tips:</strong>
          <ul>
            <li>Normal trading: 0.0001-0.001 SOL</li>
            <li>Competitive sniping: 0.001-0.01 SOL</li>
            <li>Highly contested launches: 0.01-0.1+ SOL</li>
          </ul>
        </li>
        <li><strong>Priority fees vs Jito tips:</strong> Priority fees are the base Solana compute fee. Jito tips are additional and go to Jito validators specifically. For meme coin trading, Jito tips are generally more effective at landing your transaction.</li>
      </ul>

      <h3>RPC Nodes — Your Connection to the Blockchain</h3>
      <ul>
        <li><strong>What it is:</strong> The RPC (Remote Procedure Call) node is the server your wallet/terminal connects to for reading blockchain data and submitting transactions.</li>
        <li><strong>Why it matters:</strong> A slow or overloaded RPC = transactions that fail or land late. During high-activity periods (big launches), the default free RPCs get hammered.</li>
        <li><strong>Free RPCs</strong> — What Phantom uses by default. Fine for casual use but unreliable during congestion.</li>
        <li><strong>Premium RPCs</strong> — Services like <strong>Helius, QuickNode, Triton, Shyft</strong> offer faster, more reliable connections. Serious traders pay $50-200/month for premium RPC access.</li>
        <li><strong>How to use:</strong> Most trading terminals and bots let you configure a custom RPC endpoint in their settings.</li>
      </ul>

      <div class="tip-box">
        <strong>Anti-MEV Checklist:</strong>
        <ul>
          <li>Use Jupiter's MEV Protection toggle when swapping on jup.ag</li>
          <li>Keep slippage as low as possible while still landing trades</li>
          <li>For large buys, split into multiple smaller transactions</li>
          <li>On trading terminals, enable any anti-MEV or private transaction features</li>
          <li>Avoid placing huge market orders on low-liquidity tokens — you're painting a target for bots</li>
        </ul>
      </div>
    `
  },

  // =============================================
  // 10. COPY TRADING & SMART MONEY TRACKING
  // =============================================
  {
    id: "copy-trading",
    keywords: ["copy trade", "copy trading", "smart money", "whale watching", "whale track", "follow wallet", "wallet tracking", "wallet tracker", "smart wallet", "profitable wallet", "top trader", "alpha wallet", "track whales", "find alpha"],
    aliases: ["copy trade", "smart money", "whale", "wallet track", "cielo"],
    response: `
      <h3>Copy Trading &amp; Smart Money Tracking</h3>
      <p>One of the most powerful edges in meme coin trading is watching what consistently profitable wallets are doing — and following their moves.</p>

      <h3>The Concept</h3>
      <p>Every transaction on Solana (and all blockchains) is public. You can see exactly what any wallet buys, sells, and when. If you can identify wallets that consistently make money on meme coins, you can watch their activity and follow their trades.</p>

      <h3>How to Find Smart Money Wallets</h3>
      <ul>
        <li><strong>GMGN.ai</strong> — Has a dedicated "Smart Money" dashboard showing wallets with high win rates and profits. You can filter by time period, chain, profit level, and more. This is the go-to tool for smart money tracking.</li>
        <li><strong>Birdeye</strong> — "Top Traders" tab on any token shows which wallets profited most. Work backwards from big winners to find consistently good wallets.</li>
        <li><strong>Axiom/Photon</strong> — Both have wallet tracking features where you can save wallets and see their activity.</li>
        <li><strong>Solscan</strong> — Manually look at any wallet's full transaction history. Time-consuming but thorough.</li>
        <li><strong>Arkham Intelligence</strong> — Entity labeling service. Can identify wallets belonging to known funds, KOLs, and traders.</li>
        <li><strong>Cielo Finance</strong> — Multi-chain wallet tracker with notifications.</li>
      </ul>

      <h3>How to Evaluate a Wallet</h3>
      <ul>
        <li><strong>Win rate</strong> — What % of their trades are profitable? Above 40% is strong for meme coins.</li>
        <li><strong>Average return</strong> — Do they hit small consistent wins or rare big wins? Both styles can work.</li>
        <li><strong>Trade frequency</strong> — How often do they trade? Very active wallets are harder to follow in real-time.</li>
        <li><strong>Holding period</strong> — Do they flip in minutes (harder to copy) or hold for hours/days (easier to follow)?</li>
        <li><strong>Recent performance</strong> — A wallet that was hot 3 months ago might be cold now. Check recent trades.</li>
        <li><strong>Sample size</strong> — 5 winning trades could be luck. 50+ winning trades is a pattern.</li>
      </ul>

      <h3>Copy Trading Methods</h3>
      <ul>
        <li><strong>Manual:</strong> Get alerts when a tracked wallet buys, then quickly buy the same token yourself. Delay of seconds to minutes.</li>
        <li><strong>Automated (built-in):</strong> Axiom, Photon, and some Telegram bots have "copy trade" features that automatically execute when your tracked wallet trades. Faster but requires careful configuration.</li>
        <li><strong>Risk:</strong> You'll always enter after the wallet you're copying, meaning they got a better price. If many people are copying the same wallet, you're all bidding up the price on entry.</li>
      </ul>

      <div class="warning-box">
        <strong>Copy Trading Pitfalls:</strong>
        <ul>
          <li><strong>Crowded trades:</strong> If a wallet is widely known and tracked by thousands, copy trading it becomes a self-defeating strategy — everyone rushes in, drives up the price, and the original wallet exits into all the copiers.</li>
          <li><strong>Deliberate traps:</strong> Some traders know they're being tracked and will make deceptive trades on their public wallet while trading differently on private wallets.</li>
          <li><strong>Multi-wallet strategies:</strong> A "smart money" wallet might be one of 10 wallets a trader uses. You only see part of their strategy.</li>
          <li><strong>No context:</strong> You don't know WHY they bought. It could be a hedge, a test, or a loss they're writing off.</li>
        </ul>
      </div>

      <div class="tip-box">
        <strong>Practical Approach:</strong> Don't blindly copy. Use smart money tracking as ONE input alongside your own research. If a top wallet buys a token AND you independently verify it looks good (RugCheck clean, good chart, growing community), that convergence of signals is powerful. Smart money buying something you'd never touch on your own merits is a weak signal.
      </div>
    `
  },

  // =============================================
  // 11. SNIPING
  // =============================================
  {
    id: "sniping",
    keywords: ["snipe", "sniping", "sniper", "first buy", "launch snipe", "new pair", "new listing", "auto buy", "graduation snipe", "raydium snipe", "fast buy"],
    aliases: ["snipe", "sniper", "auto buy"],
    response: `
      <h3>Sniping New Token Launches</h3>
      <p>Sniping means buying a token the instant it becomes tradeable — either when it launches on pump.fun's bonding curve, or when it graduates to Raydium. It's the highest-speed form of meme coin trading.</p>

      <h3>Types of Sniping</h3>

      <h3>1. pump.fun Curve Sniping</h3>
      <ul>
        <li>Buying a token within seconds of creation on pump.fun</li>
        <li>You're buying at the absolute lowest point of the bonding curve</li>
        <li>The catch: thousands of tokens launch daily, most die immediately. You're basically gambling on which ones will gain traction.</li>
        <li>Tools: pump.fun itself, BullX, Axiom, Photon all support bonding curve buys</li>
      </ul>

      <h3>2. Graduation/Raydium Migration Sniping</h3>
      <ul>
        <li>Buying the instant a token graduates from pump.fun and migrates to Raydium</li>
        <li>This is a validated signal — the token already proved it could fill the bonding curve ($69K MC)</li>
        <li>Competition is fierce — many bots and traders are watching for graduations</li>
        <li>Tools: Photon, Axiom, BONKbot, Trojan all have auto-buy-on-graduation features</li>
        <li>You need fast RPC, proper Jito tip settings, and pre-configured buy amounts</li>
      </ul>

      <h3>3. New Raydium Pair Sniping (Non-pump.fun)</h3>
      <ul>
        <li>Some tokens launch directly on Raydium without going through pump.fun</li>
        <li>Less common now but still happens for some projects</li>
        <li>Trading terminals can detect new Raydium pairs and alert you</li>
      </ul>

      <h3>Snipe Setup Checklist</h3>
      <ul>
        <li><strong>Pre-fund your wallet</strong> with enough SOL for multiple plays</li>
        <li><strong>Pre-set your buy amount</strong> in your terminal/bot (e.g., 0.5 SOL per snipe)</li>
        <li><strong>Set appropriate slippage</strong> — 15-25% for sniping (high but necessary due to rapid price movement)</li>
        <li><strong>Set Jito tip</strong> — 0.005-0.01+ SOL for competitive sniping</li>
        <li><strong>Have safety checks ready</strong> — Even when sniping, experienced traders have RugCheck open or use terminals with built-in safety scores</li>
      </ul>

      <div class="warning-box">
        <strong>Sniping Realities:</strong>
        <ul>
          <li>You're competing against automated bots with sub-millisecond execution. As a human, you'll almost never be the literal first buyer.</li>
          <li>Many sniped tokens are rugs or die within minutes. Your win rate will be low.</li>
          <li>The strategy works on volume — lots of small bets, a few big winners covering the many losses.</li>
          <li>Bundled launches are common sniper traps — the "dev" is actually sniping their own token with hidden wallets.</li>
          <li>If you're sniping and consistently losing, it's not bad luck — it's the expected outcome for most attempts.</li>
        </ul>
      </div>
    `
  },

  // =============================================
  // 12. ON-CHAIN ANALYSIS
  // =============================================
  {
    id: "onchain",
    keywords: ["on-chain", "onchain", "on chain", "holder distribution", "insider", "insider detection", "wallet analysis", "bubblemaps", "token analysis", "holder analysis", "distribution", "top holders", "dev wallet", "deployer"],
    aliases: ["bubblemaps", "onchain", "holder", "insider", "dev wallet", "deployer"],
    response: `
      <h3>On-Chain Analysis — Reading the Blockchain</h3>
      <p>Every transaction is public. If you know how to read the chain, you can see what's happening behind the scenes — who's accumulating, who's dumping, whether insiders are coordinating, and whether the token is genuinely distributed.</p>

      <h3>Holder Distribution Analysis</h3>
      <ul>
        <li><strong>Why it matters:</strong> A token where 5 wallets hold 60% of supply is a controlled dump waiting to happen. A token with 5,000+ holders and no single wallet over 3% is much healthier.</li>
        <li><strong>Where to check:</strong> Birdeye (holder tab), GMGN (token details), Solscan (holders tab), BubbleMaps</li>
        <li><strong>What's "good"?</strong>
          <ul>
            <li>No single non-exchange/non-LP wallet holding >5% of supply</li>
            <li>Top 10 wallets collectively <30% (excluding LP and known exchange wallets)</li>
            <li>Holder count growing over time, not stagnating</li>
            <li>Wide distribution across hundreds/thousands of wallets</li>
          </ul>
        </li>
      </ul>

      <h3>BubbleMaps — Wallet Clustering</h3>
      <ul>
        <li>BubbleMaps creates a visual map showing connections between wallets that hold a token</li>
        <li>It detects wallets that have sent funds to each other, suggesting they're controlled by the same entity</li>
        <li><strong>What to look for:</strong> Large clusters of connected wallets each holding "small" amounts that collectively add up to a huge position. This is how insiders hide concentrated holdings.</li>
        <li>If you see the BubbleMaps visualization covered in connected clusters, the token is likely controlled by a small group</li>
      </ul>

      <h3>Dev Wallet Analysis</h3>
      <ul>
        <li>Find the deployer wallet on Solscan — it's the wallet that created the token</li>
        <li><strong>Check the dev's history:</strong> Have they launched other tokens? Did those tokens rug? A dev with a graveyard of dead tokens is a red flag.</li>
        <li><strong>Dev's current holdings:</strong> Did the dev sell immediately after launch? Are they still holding? Did they transfer tokens to other wallets?</li>
        <li><strong>Funding trail:</strong> Where did the dev's SOL come from? If it came from a known scammer wallet or a fresh CEX withdrawal right before launch, that's a pattern.</li>
      </ul>

      <h3>Bundle Detection</h3>
      <ul>
        <li>A <strong>bundle</strong> is when the deployer launches the token and buys a large supply in the same atomic transaction (Jito bundle)</li>
        <li>This doesn't show as a separate buy on basic scanners — it looks like the token just appeared with the dev holding tokens</li>
        <li><strong>GMGN</strong> has specific bundle detection that flags this behavior</li>
        <li>A bundled launch isn't always a scam (some devs do it to secure initial supply for marketing), but it's a significant risk factor because the dev can dump at any time</li>
      </ul>

      <h3>Fresh Wallet Analysis</h3>
      <ul>
        <li>"Fresh wallets" are newly created wallets with no history that suddenly buy a specific token</li>
        <li>Many fresh wallets buying at the same time often indicates an insider group coordinating</li>
        <li>GMGN tracks and flags fresh wallet activity on tokens</li>
      </ul>

      <div class="tip-box">
        <strong>Power Move:</strong> When you find a token you're interested in, spend 5 minutes on Solscan looking at the largest non-LP holders. Click into each one. Where did their tokens come from? When did they buy? Did they all buy within seconds of each other (coordinated)? This manual analysis takes practice but gives you insights no automated tool fully captures.
      </div>
    `
  },

  // =============================================
  // 13. CHART READING & TECHNICAL ANALYSIS
  // =============================================
  {
    id: "charts",
    keywords: ["chart", "charts", "technical analysis", "ta", "candle", "candlestick", "support", "resistance", "pattern", "read a chart", "dex screener chart", "price action", "volume analysis", "indicators"],
    aliases: ["chart", "technical analysis", "candlestick", "support", "resistance"],
    response: `
      <h3>Chart Reading for Meme Coins</h3>
      <p>Traditional TA has limited use for meme coins, but understanding price action, volume, and structure still gives you an edge over traders who buy blindly.</p>

      <h3>Candlestick Basics</h3>
      <ul>
        <li><strong>Green candle</strong> = price up (close > open). <strong>Red candle</strong> = price down (close < open).</li>
        <li><strong>Body</strong> = range between open and close. <strong>Wicks</strong> = highest and lowest price.</li>
        <li><strong>Long lower wick</strong> = buyers absorbed selling pressure (bullish)</li>
        <li><strong>Long upper wick</strong> = sellers rejected higher prices (bearish)</li>
        <li><strong>Small body + long wicks</strong> = indecision, potential reversal</li>
      </ul>

      <h3>Meme Coin Chart Patterns That Actually Matter</h3>
      <ul>
        <li><strong>The "Dev Dump" candle:</strong> Massive red candle right after launch or graduation — the dev/insiders selling their bags. If the token recovers from this and establishes new support, that's actually bullish (the sell pressure has been absorbed).</li>
        <li><strong>Higher lows:</strong> Each dip finds a higher floor than the previous dip. This shows increasing demand and is one of the most reliable bullish signals in meme coins.</li>
        <li><strong>Accumulation range:</strong> Price trades sideways in a tight range for hours or days. Holders are not selling, new buyers are accumulating. Often precedes a breakout.</li>
        <li><strong>Volume divergence:</strong> Price making new highs but volume is declining = the pump is running out of steam. Smart money is selling into the euphoria.</li>
        <li><strong>Market cap "walls":</strong> Meme coins reliably stall at round-number market caps: $100K, $500K, $1M, $5M, $10M, $50M, $100M. These are psychological barriers.</li>
        <li><strong>V-shaped recovery:</strong> Sharp dump followed by immediate sharp recovery = strong buy-the-dip demand. Often indicates whale accumulation on the dip.</li>
      </ul>

      <h3>Volume Analysis (Most Important Indicator for Meme Coins)</h3>
      <ul>
        <li><strong>Rising price + rising volume</strong> = healthy momentum, buyers are engaged</li>
        <li><strong>Rising price + falling volume</strong> = pump is losing steam, likely to reverse</li>
        <li><strong>Falling price + rising volume</strong> = panic selling or a big wallet dumping</li>
        <li><strong>Falling price + falling volume</strong> = slow bleed, interest dying</li>
        <li><strong>Volume spike on breakout</strong> = confirmation of the move. Without volume, breakouts fail.</li>
      </ul>

      <h3>Timeframes</h3>
      <ul>
        <li><strong>1-minute / 5-minute:</strong> For active trading, sniping, and timing entries on new tokens</li>
        <li><strong>15-minute / 1-hour:</strong> For identifying short-term trends and structure</li>
        <li><strong>4-hour / 1-day:</strong> For evaluating whether a token has sustained momentum or is dying</li>
        <li>Most meme coin trades are held for minutes to days, so lower timeframes matter most</li>
      </ul>

      <h3>Where to Read Charts</h3>
      <ul>
        <li><strong>DEX Screener (dexscreener.com)</strong> — Best free charting for all chains</li>
        <li><strong>Birdeye (birdeye.so)</strong> — Solana-focused, good analytics alongside charts</li>
        <li><strong>Built-in charts</strong> in Axiom, Photon, BullX, GMGN</li>
      </ul>

      <div class="tip-box">
        <strong>Honest Take on TA for Meme Coins:</strong> RSI, MACD, Bollinger Bands, and other traditional indicators have minimal predictive value for meme coins because prices are sentiment-driven, not fundamentals-driven. Focus on: (1) volume, (2) higher lows vs lower lows, (3) market cap level, and (4) holder count trend. These four things tell you more than any indicator.
      </div>
    `
  },

  // =============================================
  // 14. ENTRY & EXIT STRATEGIES
  // =============================================
  {
    id: "entry-exit",
    keywords: ["entry", "exit", "when to buy", "when to sell", "sell strategy", "buy strategy", "take profit", "stop loss", "position", "entry point", "exit point", "timing", "profit taking", "trailing stop", "how to sell", "sell meme coin", "when to exit"],
    aliases: ["entry", "exit", "take profit", "stop loss", "trailing stop", "sell strategy"],
    response: `
      <h3>Entry &amp; Exit Strategies</h3>
      <p>Having a plan before you enter a trade is what separates consistent traders from gamblers. Here's how experienced meme coin traders approach entries and exits.</p>

      <h3>Entry Strategies</h3>

      <h3>1. The "Conviction Entry"</h3>
      <ul>
        <li>You've done full research: RugCheck clean, holder distribution good, community active, narrative fits the current meta.</li>
        <li>Enter with a meaningful position (relative to your bankroll), often in one go.</li>
        <li>Best for: tokens you have high conviction on based on multiple converging signals.</li>
      </ul>

      <h3>2. The "Scout Entry"</h3>
      <ul>
        <li>Small initial buy (0.1-0.2 SOL) to get a position and start paying attention.</li>
        <li>If the token proves itself (holds support, grows holders, community develops), add more.</li>
        <li>Best for: early-stage tokens where you see potential but aren't fully convinced yet.</li>
      </ul>

      <h3>3. The "Dip Buy"</h3>
      <ul>
        <li>Wait for a pullback from an initial pump. Let the FOMO buyers get shaken out.</li>
        <li>Look for the price to establish support (test a level 2-3 times without breaking below).</li>
        <li>Enter on the bounce from support, ideally with increasing volume.</li>
        <li>Best for: tokens that have already proven themselves but had a healthy correction.</li>
      </ul>

      <h3>4. The "Breakout Entry"</h3>
      <ul>
        <li>Wait for the token to break above a key resistance level (previous high, round-number market cap) with strong volume.</li>
        <li>Enter immediately after the breakout confirms.</li>
        <li>Best for: tokens in accumulation ranges that are about to make their next move.</li>
      </ul>

      <h3>Exit Strategies</h3>

      <h3>Tiered Profit Taking (Most Recommended)</h3>
      <ul>
        <li>Sell in portions as price rises. Never sell 100% at once (you might miss more upside) and never hold 100% until the "top" (you'll never time it).</li>
        <li><strong>Example tiers:</strong>
          <ul>
            <li>At 2x: sell 25% (recovered half your investment)</li>
            <li>At 3-4x: sell 25% (now playing with house money)</li>
            <li>At 5-10x: sell 25% (locked in significant profit)</li>
            <li>Let final 25% ride with no sell target (this is your "lottery ticket" portion)</li>
          </ul>
        </li>
      </ul>

      <h3>Market Cap-Based Exits</h3>
      <ul>
        <li>Set exit targets based on market cap milestones rather than arbitrary price targets.</li>
        <li><strong>Why:</strong> "I'll sell when it hits $0.01" is meaningless without context. "I'll take profit when it reaches $5M market cap" is based on realistic assessment of where meme coins tend to stall.</li>
        <li>Study where similar tokens in the same narrative topped out. If every cat meme coin peaked around $20M MC, don't assume yours will reach $500M.</li>
      </ul>

      <h3>Loss Cutting</h3>
      <ul>
        <li>If a token drops 50%+ from your entry and the thesis is broken (community dying, dev suspicious, narrative over), cut the loss. Don't "hope" it recovers.</li>
        <li>The SOL you recover from cutting a loser can be deployed into a winner.</li>
        <li>Emotional attachment to a losing position is the most expensive bias in meme coin trading.</li>
      </ul>

      <div class="tip-box">
        <strong>The Golden Rule:</strong> "You never go broke taking profit." Selling at 3x when it eventually hits 10x feels bad. But selling at 3x when it eventually dumps to -80% feels great. You'll never time the exact top. Secure gains in tiers and move on.
      </div>

      <div class="warning-box">
        <strong>Exit Liquidity:</strong> If you're buying after a massive pump (200%+ in hours) and the token is all over Twitter, ask yourself: "Who will buy after me at a higher price?" If the answer is unclear, you might be the exit liquidity for earlier buyers.
      </div>
    `
  },

  // =============================================
  // 15. NARRATIVES & METAS
  // =============================================
  {
    id: "narratives",
    keywords: ["narrative", "narratives", "meta", "metas", "trend", "trending", "rotation", "sector", "theme", "what's hot", "current meta", "market cycle", "cycle"],
    aliases: ["narrative", "meta", "rotation", "trend"],
    response: `
      <h3>Narratives &amp; Metas in Meme Coin Trading</h3>
      <p>Meme coins trade on <strong>narratives</strong> — collective stories or themes that capture market attention. Understanding how narratives form, peak, and rotate is arguably the most important skill for meme coin profitability.</p>

      <h3>What Is a Narrative/Meta?</h3>
      <ul>
        <li>A <strong>narrative</strong> is a theme or category that becomes "hot" and attracts capital. Examples: AI tokens, cat meme coins, political tokens, celebrity tokens, "based" culture tokens.</li>
        <li>A <strong>meta</strong> is the current dominant narrative that's driving the most volume and returns. "The meta right now is AI agent tokens" means AI-themed tokens are what's working.</li>
        <li>Capital rotates between narratives. When one meta cools off, money flows to the next one.</li>
      </ul>

      <h3>How a Narrative Cycle Works</h3>
      <ol>
        <li><strong>Inception:</strong> One token in a new theme pumps big (e.g., GOAT kicked off the AI agent meta). Smart money notices.</li>
        <li><strong>Copycats emerge:</strong> Dozens of tokens in the same theme launch. Some are genuine, most are cash grabs. The best performers are the ones that move fastest while the narrative is hot.</li>
        <li><strong>CT amplification:</strong> Crypto Twitter latches on. KOLs start talking about the "new meta." Content creators make threads. FOMO kicks in.</li>
        <li><strong>Peak euphoria:</strong> Everyone is buying the narrative. New tokens in the theme launch to instantly high valuations. "You can't lose" sentiment. THIS IS USUALLY THE TOP.</li>
        <li><strong>Rotation:</strong> Smart money exits the overheated narrative and moves to the next one. Prices in the old narrative crash. Late buyers are left holding bags.</li>
        <li><strong>Survivors:</strong> 1-2 tokens from the narrative become "blue chips" (like WIF survived the dog meta). Everything else dies.</li>
      </ol>

      <h3>How to Trade Narratives</h3>
      <ul>
        <li><strong>Be early, not late.</strong> The biggest gains come in phases 1-2. By phase 4 (peak euphoria), the easy money is made.</li>
        <li><strong>Identify the "leader"</strong> — the first/biggest token in a narrative. The leader usually has the most sustained run. Copycats are higher risk/reward.</li>
        <li><strong>Watch for rotation signals:</strong> Volume declining in the current meta while a new theme emerges. Smart money wallets moving to a new category.</li>
        <li><strong>Don't fight the meta.</strong> If the market wants cat tokens, don't stubbornly hold dog tokens hoping they'll come back. Trade what's working NOW.</li>
        <li><strong>Layer your exposure:</strong> Buy the leader (lower risk, lower reward) AND a couple of early copycats (higher risk, higher reward).</li>
      </ul>

      <h3>Historical Narrative Examples</h3>
      <ul>
        <li><strong>Dog meta</strong> — BONK, WIF, POPCAT, MEW, MYRO (Solana dog/animal tokens dominating)</li>
        <li><strong>AI agent meta</strong> — GOAT, AI16Z, VIRTUAL, ZEREBRO, GRIFFAIN (AI-themed tokens)</li>
        <li><strong>Political tokens</strong> — tokens tied to elections, political figures, world events</li>
        <li><strong>Celebrity tokens</strong> — tokens launched by or themed around celebrities</li>
        <li><strong>"Art" meta</strong> — tokens tied to unique art styles or generative AI imagery</li>
      </ul>

      <div class="tip-box">
        <strong>Narrative Detection Workflow:</strong> Monitor GMGN's "trending" tab, DEX Screener's "Hot Pairs," and Crypto Twitter. When you see 3+ new tokens in the same theme gaining traction simultaneously, a narrative is forming. Move quickly — narratives can run for days or burn out in hours.
      </div>
    `
  },

  // =============================================
  // 16. KEY METRICS (DEEP)
  // =============================================
  {
    id: "metrics",
    keywords: ["market cap", "marketcap", "mcap", "liquidity", "volume", "fdv", "fully diluted", "supply", "total supply", "circulating supply", "holders", "metrics", "how to evaluate", "what to look at", "token metrics"],
    aliases: ["market cap", "liquidity", "volume", "fdv", "mcap"],
    response: `
      <h3>Key Metrics — What Experienced Traders Actually Look At</h3>

      <h3>Market Cap (MC)</h3>
      <ul>
        <li><strong>Formula:</strong> Token Price × Circulating Supply</li>
        <li><strong>Why price alone is meaningless:</strong> A token at $0.000001 sounds "cheap" but could have a $500M market cap if there are 500 trillion tokens. A token at $5 sounds "expensive" but could have a $5M market cap if there are only 1M tokens. Always think in market cap, not price.</li>
        <li><strong>Meme coin brackets:</strong>
          <ul>
            <li><strong>&lt;$100K</strong> — Micro cap. Bonding curve or just graduated. Maximum risk, maximum potential. Most die here.</li>
            <li><strong>$100K-$1M</strong> — Small cap. Has survived initial launch. Starting to build momentum. Still very risky.</li>
            <li><strong>$1M-$10M</strong> — Mid cap. Has real community traction. Getting CT attention. This is the "sweet spot" where many traders enter.</li>
            <li><strong>$10M-$50M</strong> — Established meme coin. May get CEX listing consideration. Lower upside but more proven.</li>
            <li><strong>$50M-$500M</strong> — Blue-chip meme territory. BONK, WIF, PEPE. Relatively "safer" but limited upside.</li>
            <li><strong>$500M+</strong> — Elite tier. DOGE, SHIB. Nearly impossible for a new token to reach without massive cultural phenomenon.</li>
          </ul>
        </li>
      </ul>

      <h3>Liquidity (LP)</h3>
      <ul>
        <li><strong>What it is:</strong> The total value in the trading pool. Liquidity determines how much you can buy/sell without massive price impact.</li>
        <li><strong>Liquidity-to-market-cap ratio:</strong> If a token has $10K in liquidity but a $1M market cap, that's a 1% ratio — dangerously thin. Selling just $5K would crash the price. A healthy ratio is 5-10%+ for smaller tokens.</li>
        <li><strong>Burned LP:</strong> LP tokens are sent to a burn address (dead wallet). This liquidity can NEVER be removed. This is the gold standard for safety.</li>
        <li><strong>Locked LP:</strong> LP tokens are time-locked in a contract. Safer than unlocked but the dev gets them back when the lock expires. Check the lock duration.</li>
        <li><strong>Unlocked LP:</strong> The dev can remove liquidity at any time. This is how classic rug pulls work. Avoid unless you know what you're doing.</li>
      </ul>

      <h3>Volume</h3>
      <ul>
        <li><strong>24h Volume:</strong> Total trading value in the last 24 hours. Higher = more active interest.</li>
        <li><strong>Volume/MC ratio:</strong> A token with $5M MC doing $10M in 24h volume is extremely actively traded (ratio of 2:1). A token with $5M MC doing $50K volume is dead (ratio of 0.01:1).</li>
        <li><strong>Volume trend:</strong> Is volume increasing, stable, or declining? Declining volume almost always precedes price decline.</li>
        <li><strong>Buy vs Sell volume:</strong> Some tools break down buy vs sell volume. Heavily sell-dominated volume is bearish even if total volume is "high."</li>
      </ul>

      <h3>Holder Count</h3>
      <ul>
        <li><strong>Growth rate matters most.</strong> A token going from 500 to 2,000 holders in a day is accumulating interest. A token stuck at 800 holders for a week is stagnating.</li>
        <li><strong>Absolute numbers:</strong> For a $1M MC token, 2,000+ holders is healthy. For a $10M MC token, 10,000+ is a good sign.</li>
        <li><strong>Distribution:</strong> 5,000 holders means nothing if 10 wallets hold 70%. Check the actual distribution, not just the count.</li>
      </ul>

      <h3>FDV (Fully Diluted Valuation)</h3>
      <ul>
        <li>FDV = Token Price × Total Supply (including tokens not yet in circulation)</li>
        <li>For most meme coins, FDV = MC because 100% of supply is in circulation from day one (no vesting, no unlocks)</li>
        <li>If FDV is significantly higher than MC, there are locked/vesting tokens that will enter circulation — potential future sell pressure</li>
      </ul>

      <div class="tip-box">
        <strong>Quick Evaluation Order:</strong> When you see a new token, check in this order: (1) RugCheck safety score, (2) Market cap — is it at a level where you see upside? (3) Liquidity — is it burned? What's the LP/MC ratio? (4) Holder count + distribution, (5) Volume trend — is interest growing or dying? (6) Community quality on Twitter/Telegram. If any of the first 3 fail, skip the token.
      </div>
    `
  },

  // =============================================
  // 17. RESEARCH TOOLS (COMPREHENSIVE)
  // =============================================
  {
    id: "tools",
    keywords: ["tools", "tracker", "tracking", "dex screener", "dexscreener", "birdeye", "rugcheck", "bubblemaps", "solscan", "etherscan", "research", "best tools", "essential tools", "what tools", "software", "cielo", "arkham"],
    aliases: ["dex screener", "dexscreener", "birdeye", "rugcheck", "bubblemaps", "solscan", "dextools", "geckoterminal", "defined", "cielo", "arkham", "tokensniffer", "goplus"],
    response: `
      <h3>Meme Coin Research Tools — Complete Stack</h3>

      <h3>Tier 1: Must-Have (Use Daily)</h3>
      <ul>
        <li><strong>DEX Screener (dexscreener.com)</strong> — Real-time charts, new pairs, trending tokens across ALL chains. The homepage of meme coin trading. Free. Bookmark it.</li>
        <li><strong>RugCheck (rugcheck.xyz)</strong> — Paste any Solana token CA to check: mint/freeze authority, LP status, top holder %, overall risk score. Use this BEFORE every single buy.</li>
        <li><strong>GMGN (gmgn.ai)</strong> — Smart money tracking, bundle detection, wallet profiling, new token scanner. The intelligence hub.</li>
        <li><strong>Birdeye (birdeye.so)</strong> — Solana-focused analytics. Token details, top traders, wallet tracking, trending tokens. Deep data.</li>
      </ul>

      <h3>Tier 2: Power User Tools</h3>
      <ul>
        <li><strong>BubbleMaps (bubblemaps.io)</strong> — Visual wallet clustering. See if "different" wallets holding a token are secretly connected (insider accumulation).</li>
        <li><strong>Solscan (solscan.io)</strong> — Solana blockchain explorer. Inspect any wallet, any token, any transaction in full detail.</li>
        <li><strong>Arkham Intelligence</strong> — Entity labeling. Identify which wallets belong to known funds, KOLs, exchanges, etc.</li>
        <li><strong>Cielo Finance</strong> — Multi-chain wallet tracker with Telegram notifications when tracked wallets trade.</li>
        <li><strong>DexTools (dextools.io)</strong> — Popular for ETH/BNB tokens. DextScore rates token safety. Good charting.</li>
        <li><strong>GeckoTerminal</strong> — By CoinGecko. Multi-chain DEX data and charts. Good for discovery.</li>
        <li><strong>Defined.fi</strong> — Multi-chain analytics with AI-powered insights.</li>
      </ul>

      <h3>Tier 3: EVM-Specific Tools</h3>
      <ul>
        <li><strong>TokenSniffer (tokensniffer.com)</strong> — EVM token auditor. Detects honeypots, scam patterns, contract similarity to known scams.</li>
        <li><strong>Etherscan / BscScan</strong> — Blockchain explorers for Ethereum and BNB Chain respectively.</li>
        <li><strong>GoPlus / GoPlusLabs</strong> — Token security API integrated into many platforms.</li>
        <li><strong>De.Fi Scanner</strong> — Smart contract auditing across EVM chains.</li>
        <li><strong>revoke.cash</strong> — Revoke token approvals you've granted to contracts (important for EVM wallet security).</li>
      </ul>

      <h3>Tier 4: Execution Tools</h3>
      <ul>
        <li><strong>Axiom, Photon, BullX, GMGN</strong> — Trading terminals (covered in detail in the Trading Terminals topic)</li>
        <li><strong>BONKbot, Trojan, Bloom, Maestro</strong> — Telegram trading bots (covered in Telegram Bots topic)</li>
        <li><strong>Jupiter (jup.ag)</strong> — Swap aggregator for standard trades</li>
      </ul>

      <h3>Tier 5: Tax &amp; Portfolio</h3>
      <ul>
        <li><strong>Koinly, CoinTracker, TaxBit, CoinLedger</strong> — Import on-chain transactions for tax reporting</li>
        <li><strong>Step Finance</strong> — Solana portfolio dashboard</li>
      </ul>

      <div class="tip-box">
        <strong>Minimum Viable Stack:</strong> If you're just getting started, you need exactly 4 things: <strong>Phantom</strong> (wallet) + <strong>DEX Screener</strong> (charts/discovery) + <strong>RugCheck</strong> (safety) + <strong>Axiom or Photon</strong> (trading). Add GMGN for smart money data when you're ready to level up.
      </div>
    `
  },

  // =============================================
  // 18. OTHER CHAINS
  // =============================================
  {
    id: "other-chains",
    keywords: ["ethereum", "eth chain", "erc20", "bnb chain", "bsc", "binance smart chain", "bep20", "base chain", "base", "arbitrum", "layer 2", "l2", "other chains", "which chain", "chain comparison", "multichain"],
    aliases: ["ethereum", "bnb", "base", "arbitrum", "polygon"],
    response: `
      <h3>Meme Coins on Other Chains</h3>

      <h3><span class="chain-tag eth">ETH</span> Ethereum</h3>
      <ul>
        <li><strong>Pros:</strong> Deepest liquidity, highest credibility, most likely to get tier-1 CEX listings. If a meme coin is going to become a multi-billion dollar asset, it'll likely be on ETH (or bridge to it).</li>
        <li><strong>Cons:</strong> Gas fees are $5-100+ per swap. Slower (~12-15s). Severe MEV/sandwich attacks. Not practical for small trades or rapid entries/exits.</li>
        <li><strong>Trading:</strong> Uniswap + MetaMask/Rabby. Use 1inch as aggregator. Maestro or Banana Gun for Telegram bot trading.</li>
        <li><strong>Notable meme coins:</strong> PEPE, SHIB, FLOKI, MOG, SPX6900, TURBO, WOJAK</li>
        <li><strong>Best for:</strong> Larger positions ($1K+) on established meme coins where gas fees are proportionally small.</li>
      </ul>

      <h3><span class="chain-tag bnb">BNB</span> BNB Chain</h3>
      <ul>
        <li><strong>Pros:</strong> Low fees ($0.10-0.50), fast transactions (~3s), large user base in Asia.</li>
        <li><strong>Cons:</strong> More centralized, historically plagued by scam tokens (highest scam rate of major chains), less cultural relevance for meme coins compared to SOL/ETH.</li>
        <li><strong>Trading:</strong> PancakeSwap + MetaMask. Four.Meme for new launches.</li>
        <li><strong>Notable meme coins:</strong> BABYDOGE, FLOKI (multi-chain)</li>
        <li><strong>Best for:</strong> Users who prefer EVM and want lower fees than Ethereum, or those targeting the Asian market.</li>
      </ul>

      <h3>Base (Coinbase L2)</h3>
      <ul>
        <li><strong>Pros:</strong> Very low fees ($0.01-0.10), Coinbase backing, easy fiat on-ramp from Coinbase app, growing ecosystem.</li>
        <li><strong>Cons:</strong> Smaller meme coin ecosystem than Solana, fewer dedicated tools.</li>
        <li><strong>Trading:</strong> Aerodrome, Uniswap (Base) + MetaMask/Coinbase Wallet.</li>
        <li><strong>Notable meme coins:</strong> BRETT, DEGEN, TOSHI, VIRTUAL</li>
        <li><strong>Best for:</strong> Coinbase users who want easy on-ramp, L2 fee savings, and exposure to a growing ecosystem.</li>
      </ul>

      <h3>Why Solana Still Dominates</h3>
      <table style="width:100%; font-size:12px; border-collapse:collapse; margin:10px 0;">
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:6px;"><strong>Factor</strong></td>
          <td style="padding:6px;"><strong>Solana</strong></td>
          <td style="padding:6px;"><strong>Ethereum</strong></td>
          <td style="padding:6px;"><strong>BNB</strong></td>
          <td style="padding:6px;"><strong>Base</strong></td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:6px;">Swap cost</td>
          <td style="padding:6px; color:#00ff88;">~$0.01</td>
          <td style="padding:6px; color:#ff4757;">$5-100+</td>
          <td style="padding:6px; color:#ffa502;">$0.10-0.50</td>
          <td style="padding:6px; color:#00ff88;">$0.01-0.10</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:6px;">Speed</td>
          <td style="padding:6px; color:#00ff88;">~400ms</td>
          <td style="padding:6px; color:#ff4757;">~12-15s</td>
          <td style="padding:6px;">~3s</td>
          <td style="padding:6px;">~2s</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:6px;">Meme volume</td>
          <td style="padding:6px; color:#00ff88;">Highest</td>
          <td style="padding:6px;">High</td>
          <td style="padding:6px;">Medium</td>
          <td style="padding:6px;">Growing</td>
        </tr>
        <tr style="border-bottom:1px solid #1e1e32;">
          <td style="padding:6px;">Tooling</td>
          <td style="padding:6px; color:#00ff88;">Best</td>
          <td style="padding:6px;">Good</td>
          <td style="padding:6px;">Basic</td>
          <td style="padding:6px;">Growing</td>
        </tr>
        <tr>
          <td style="padding:6px;">New launches/day</td>
          <td style="padding:6px; color:#00ff88;">Thousands</td>
          <td style="padding:6px;">Hundreds</td>
          <td style="padding:6px;">Hundreds</td>
          <td style="padding:6px;">Dozens</td>
        </tr>
      </table>

      <div class="tip-box">
        <strong>Multi-chain Strategy:</strong> Start on Solana — it has the best tools, lowest fees, and most activity. Once you're comfortable, explore ETH for larger-cap plays and Base for early ecosystem opportunities. BullX is helpful here as it supports trading on multiple chains from one interface.
      </div>
    `
  },

  // =============================================
  // 19. RISK MANAGEMENT (DEEP)
  // =============================================
  {
    id: "risk",
    keywords: ["risk", "risk management", "how much", "invest", "strategy", "position size", "portfolio", "manage", "loss", "lose", "bankroll", "money management"],
    aliases: ["risk management", "position size", "bankroll"],
    response: `
      <h3>Risk Management — The Survival Guide</h3>
      <p>The #1 differentiator between traders who last and those who blow up isn't picking winners — it's managing risk. Here's the framework experienced traders use.</p>

      <h3>The Bankroll System</h3>
      <ul>
        <li>Designate a specific amount as your meme coin bankroll. This is money you can lose entirely without impacting your life.</li>
        <li><strong>NEVER</strong> add more from savings, rent money, emergency fund, or credit. When the bankroll is gone, you're done until you earn more.</li>
        <li>Treat it like a poker bankroll — it's your working capital, not an investment account.</li>
      </ul>

      <h3>Position Sizing</h3>
      <ul>
        <li><strong>Max 5-10% of bankroll per trade.</strong> If you have 10 SOL allocated to meme coins, don't put more than 0.5-1 SOL on any single play.</li>
        <li><strong>Scale down for higher risk:</strong> Pump.fun bonding curve plays? Use 1-2% of bankroll. Post-graduation tokens with proven charts? Up to 10%.</li>
        <li><strong>The math:</strong> If each trade risks 5% of bankroll, you need 20 consecutive losses to blow up. That gives you enough runway to find winners. If each trade risks 50%, three losses and you're done.</li>
      </ul>

      <h3>The Risk/Reward Framework</h3>
      <ul>
        <li>Before entering, ask: "What's my realistic upside vs my realistic downside?"</li>
        <li><strong>Good setup:</strong> Entry at $500K MC, realistic target $5M MC (10x potential), downside is -80% (0.2x). Risk/reward = 10:5 or 2:1. Worth taking.</li>
        <li><strong>Bad setup:</strong> Entry at $50M MC after a massive pump, target $100M (2x potential), downside is -90% dump. Risk/reward = 2:9 or ~0.2:1. Terrible bet.</li>
        <li>Most winning meme coin trades are entered early when R/R is heavily skewed in your favor.</li>
      </ul>

      <h3>Profit-Taking Rules</h3>
      <ul>
        <li><strong>The 2x Rule:</strong> At 2x, sell half. You've recovered your initial investment. Everything remaining is pure profit ("house money").</li>
        <li><strong>Tiered exits:</strong> 25% at 3x, 25% at 5x, 25% at 10x, let 25% ride.</li>
        <li><strong>Time-based exits:</strong> If a token hasn't moved meaningfully in 3-5 days and community momentum is stalling, consider exiting and redeploying capital into something active.</li>
        <li><strong>Record your sells.</strong> Write down exactly what you sold, at what MC, and what the token did afterward. This data helps you refine your exit strategy over time.</li>
      </ul>

      <h3>Common Mistakes (From Hard Experience)</h3>
      <ul>
        <li><strong>Revenge trading</strong> — Lost money? The worst thing you can do is immediately throw more money at a "revenge" trade. Step away for at least an hour.</li>
        <li><strong>FOMO buying the top</strong> — The token is up 500% in 2 hours, all over Twitter, you buy. You are the exit liquidity. This single pattern accounts for the majority of losses.</li>
        <li><strong>Not taking profits</strong> — Watching a 10x become a -50%. "I'll sell at 20x" turns into "I'll sell when it recovers to my entry." Take profits on the way up.</li>
        <li><strong>Over-concentration</strong> — Putting 50%+ of bankroll in one token. Even the best setup can fail. Diversify across plays.</li>
        <li><strong>Averaging down on a dying token</strong> — Buying more of a losing position "to lower your average" only makes your loss bigger when it continues dying. Average down only on thesis-intact dips, never on copium.</li>
      </ul>

      <div class="warning-box">
        <strong>Statistical Reality:</strong> On-chain data consistently shows that the majority of meme coin wallets are net negative. The profitable minority wins by: (1) strict position sizing, (2) disciplined profit-taking, (3) cutting losers fast, and (4) staying in the game long enough for a big winner to materialize. It's a marathon, not a sprint.
      </div>
    `
  },

  // =============================================
  // 20. TRADING PSYCHOLOGY
  // =============================================
  {
    id: "psychology",
    keywords: ["psychology", "emotion", "emotional", "fear", "greed", "fomo", "panic", "mindset", "mental", "discipline", "patience", "addiction", "gambling", "tilt"],
    aliases: ["psychology", "emotion", "mindset", "discipline", "gambling"],
    response: `
      <h3>Trading Psychology — The Inner Game</h3>
      <p>Every experienced trader will tell you: the hardest part isn't finding good tokens. It's managing your own mind.</p>

      <h3>The Emotional Cycle of a Meme Coin Trader</h3>
      <ol>
        <li><strong>Excitement:</strong> You find a new token, it looks promising.</li>
        <li><strong>Euphoria:</strong> It's pumping! You're up 5x! You're a genius!</li>
        <li><strong>Greed:</strong> "I shouldn't sell, this is going to 100x."</li>
        <li><strong>Denial:</strong> It starts dipping. "Just a pullback, it'll recover."</li>
        <li><strong>Panic:</strong> It keeps dropping. -50% from the top. "Should I sell?"</li>
        <li><strong>Capitulation:</strong> You sell at the bottom for a loss. Five minutes later it pumps again.</li>
        <li><strong>Anger:</strong> "This market is rigged!" You revenge trade something worse.</li>
      </ol>
      <p>Every trader goes through this. The goal is to shorten the cycle and make rational decisions at each stage.</p>

      <h3>Cognitive Biases That Destroy Traders</h3>
      <ul>
        <li><strong>FOMO (Fear of Missing Out):</strong> The #1 killer. Seeing green candles and buying in at the top. Counter: have a plan before you trade. No plan = no trade.</li>
        <li><strong>Sunk Cost Fallacy:</strong> "I'm already down 60%, I can't sell now." Yes you can. The market doesn't care about your entry price.</li>
        <li><strong>Confirmation Bias:</strong> Only reading bullish takes, ignoring red flags. Counter: actively seek reasons NOT to buy.</li>
        <li><strong>Anchoring:</strong> Fixating on your entry price or the all-time high. "I'll sell when it gets back to where I bought." It might never.</li>
        <li><strong>Recency Bias:</strong> "The last 3 tokens I bought pumped, I can't lose!" You can. And you will. Overconfidence precedes the biggest losses.</li>
        <li><strong>Loss Aversion:</strong> The pain of losing $100 feels 2x stronger than the pleasure of gaining $100. This causes traders to hold losers too long and sell winners too early.</li>
      </ul>

      <h3>Rules for Emotional Discipline</h3>
      <ul>
        <li><strong>Pre-trade plan:</strong> Before buying, write down: entry price, target sell prices, maximum loss you'll accept. Then follow the plan.</li>
        <li><strong>Take breaks.</strong> After a big win or loss, step away for at least 30 minutes. Don't make the next trade on adrenaline.</li>
        <li><strong>Daily limits.</strong> Set a max loss for the day. When you hit it, stop trading. Come back tomorrow.</li>
        <li><strong>Trading journal.</strong> Record every trade: what you bought, why, what happened, what you felt. Review weekly. Patterns emerge.</li>
        <li><strong>No trading when compromised.</strong> Tired, drunk, emotional, angry, euphoric — all of these states lead to terrible decisions. Trade when clear-headed.</li>
        <li><strong>Celebrate taking profit.</strong> Even if the token keeps going up after you sell, you made money. That's a win. Period.</li>
      </ul>

      <div class="warning-box">
        <strong>Gambling Addiction:</strong> The volatility and dopamine hits from meme coin trading can become genuinely addictive. Warning signs: trading money you can't afford to lose, lying about losses, inability to stop even when you want to, neglecting work/relationships for trading. If this is you, please seek help. National Problem Gambling Helpline: 1-800-522-4700. Your health matters more than any trade.
      </div>
    `
  },

  // =============================================
  // 21. TAX & LEGAL
  // =============================================
  {
    id: "tax",
    keywords: ["tax", "taxes", "taxable", "irs", "capital gains", "report", "legal", "regulation", "sec", "illegal", "law", "tax implications"],
    aliases: ["tax", "irs", "capital gains"],
    response: `
      <h3>Tax &amp; Legal Considerations</h3>
      <div class="warning-box"><strong>Disclaimer:</strong> This is general educational information, NOT tax or legal advice. Consult a qualified tax professional for your specific situation.</div>

      <h3>Taxable Events (US)</h3>
      <ul>
        <li><strong>Selling meme coins for SOL/ETH/USD</strong> — Taxable. Capital gains/losses.</li>
        <li><strong>Swapping one token for another</strong> — Taxable. Treated as selling Token A and buying Token B.</li>
        <li><strong>Receiving airdropped tokens</strong> — Taxable as ordinary income at fair market value when received.</li>
        <li><strong>Buying and holding</strong> — NOT taxable until you sell/swap.</li>
      </ul>

      <h3>Short-Term vs Long-Term</h3>
      <ul>
        <li><strong>Held &lt;1 year:</strong> Short-term capital gains, taxed as ordinary income (10-37%).</li>
        <li><strong>Held &gt;1 year:</strong> Long-term capital gains (0%, 15%, or 20%). Most meme coin trades are short-term.</li>
      </ul>

      <h3>Tracking Your Trades</h3>
      <ul>
        <li>Every swap is a taxable event. With dozens of trades per day, manual tracking is impractical.</li>
        <li>Use <strong>Koinly, CoinTracker, TaxBit,</strong> or <strong>CoinLedger</strong> — connect your wallet and they import transactions automatically.</li>
        <li>Losses can offset gains. If you lost $5K on rugged tokens and made $8K on winners, you owe tax on $3K net gain, not $8K.</li>
        <li>Keep records even for total losses — tokens that went to zero are claimable as losses.</li>
      </ul>

      <div class="tip-box">
        <strong>Practical Advice:</strong> Don't ignore taxes hoping nobody notices. On-chain transactions are permanent public records. The IRS is increasingly sophisticated at tracking crypto. Set aside ~30% of your net profits for taxes so you're not surprised at filing time.
      </div>
    `
  },

  // =============================================
  // 22. TERMINOLOGY / GLOSSARY
  // =============================================
  {
    id: "terminology",
    keywords: ["terminology", "glossary", "terms", "slang", "lingo", "what does", "mean", "definition", "jargon", "ct", "crypto twitter", "degen", "ape", "fomo", "fud", "ngmi", "wagmi", "diamond hands", "paper hands", "whale", "bag", "shill"],
    aliases: ["glossary", "terminology", "slang", "jargon"],
    response: `
      <h3>Meme Coin Glossary</h3>

      <h3>Essential Terms</h3>
      <ul>
        <li><strong>Alpha</strong> — Early or insider information about a potentially profitable opportunity.</li>
        <li><strong>Ape / Ape in</strong> — Buy aggressively, often without much research. "I aped 5 SOL into that."</li>
        <li><strong>Bag / Bagholder</strong> — Your holdings. A "bagholder" holds a position that's deep underwater.</li>
        <li><strong>Based</strong> — Something considered admirable, authentic, or bold.</li>
        <li><strong>Bonding curve</strong> — Mathematical pricing curve used by pump.fun. Price rises as supply is bought.</li>
        <li><strong>Bundle</strong> — Multiple transactions packaged into one atomic execution (Jito bundle). In meme coins, refers to devs bundling their token creation with large buy orders.</li>
        <li><strong>CA</strong> — Contract Address. The unique identifier for a token.</li>
        <li><strong>Cabal</strong> — Insider group coordinating to buy early and shill to their audience for exit liquidity.</li>
        <li><strong>CT</strong> — Crypto Twitter (X). The main social hub for meme coin culture.</li>
        <li><strong>Degen</strong> — "Degenerate." A high-risk trader. Worn as a badge of honor in the community.</li>
        <li><strong>Dev</strong> — The token deployer/creator. "The dev rugged" or "dev is based."</li>
        <li><strong>Diamond Hands</strong> — Holding through extreme volatility without selling.</li>
        <li><strong>DYOR</strong> — "Do Your Own Research."</li>
        <li><strong>Exit Liquidity</strong> — YOU, when you buy the top so that earlier holders can sell at a profit.</li>
        <li><strong>FOMO</strong> — "Fear Of Missing Out." The emotional driver of bad entries.</li>
        <li><strong>FUD</strong> — "Fear, Uncertainty, Doubt." Negative sentiment, sometimes manufactured.</li>
        <li><strong>Graduation</strong> — When a pump.fun token fills its bonding curve and migrates to Raydium.</li>
        <li><strong>Honeypot</strong> — Token where you can buy but the contract blocks selling.</li>
        <li><strong>Jeet</strong> — Someone who sells too early or dumps on the community. Derogatory.</li>
        <li><strong>KOL</strong> — "Key Opinion Leader." Crypto influencer who can move markets with a post.</li>
        <li><strong>LP</strong> — Liquidity Pool. The paired assets enabling trading on a DEX.</li>
        <li><strong>MC / Market Cap</strong> — Price × circulating supply.</li>
        <li><strong>MEV</strong> — Maximal Extractable Value. Profit bots extract by reordering transactions.</li>
        <li><strong>Moon / Mooning</strong> — Massive price increase.</li>
        <li><strong>NFA</strong> — "Not Financial Advice." Standard disclaimer.</li>
        <li><strong>NGMI / WAGMI</strong> — "Not Gonna Make It" / "We're All Gonna Make It."</li>
        <li><strong>Paper Hands</strong> — Selling at the first sign of a dip.</li>
        <li><strong>Pump &amp; Dump</strong> — Artificially inflating price then selling en masse.</li>
        <li><strong>Rug Pull</strong> — Developers draining liquidity or dumping tokens, crashing price to zero.</li>
        <li><strong>Shill</strong> — Promoting a token, often for personal gain.</li>
        <li><strong>Slippage</strong> — Difference between expected and actual execution price.</li>
        <li><strong>Smart Money</strong> — Wallets with proven track records of profitable trading.</li>
        <li><strong>Snipe</strong> — Buying a token the instant it launches or lists.</li>
        <li><strong>SPL Token</strong> — Solana's token standard (equivalent to ERC-20 on Ethereum).</li>
        <li><strong>Whale</strong> — Large holder who can move price significantly.</li>
      </ul>
    `
  },

  // =============================================
  // 23. SOLANA DEEP DIVE
  // =============================================
  {
    id: "solana-deep",
    keywords: ["solana", "sol", "spl token", "spl", "solana ecosystem", "solana meme", "why solana", "solana network", "solana speed", "solana fees", "token account", "rent"],
    aliases: ["solana", "sol", "spl"],
    response: `
      <h3>Solana Meme Coin Ecosystem — Deep Dive</h3>

      <h3>Why Solana Won the Meme Coin War</h3>
      <p>In 2023-2024, Solana became the undisputed home of meme coin trading. The combination of near-instant transactions, negligible fees, and purpose-built tooling created an environment where meme coin culture could thrive in ways impossible on Ethereum (too expensive) or BNB (too many scams, less cultural relevance).</p>

      <h3>SPL Token System</h3>
      <ul>
        <li>All Solana tokens are <strong>SPL tokens</strong>, similar to ERC-20 on Ethereum.</li>
        <li>Each has a unique <strong>mint address</strong> (the CA you paste everywhere).</li>
        <li><strong>Critical properties to verify:</strong>
          <ul>
            <li><strong>Mint Authority:</strong> If enabled, the creator can mint unlimited new tokens. MUST be revoked for safety.</li>
            <li><strong>Freeze Authority:</strong> If enabled, the creator can freeze any wallet's tokens, preventing selling. MUST be revoked.</li>
            <li><strong>Supply:</strong> Most pump.fun tokens have 1B total supply. Fixed and verifiable.</li>
          </ul>
        </li>
      </ul>

      <h3>Token Accounts &amp; Rent</h3>
      <ul>
        <li>Each SPL token you hold requires a "token account" in your wallet, which costs ~0.002 SOL in rent (a deposit).</li>
        <li>If you trade dozens of tokens, these rent deposits add up.</li>
        <li><strong>Reclaim rent:</strong> Close empty token accounts (tokens you've fully sold) to get that SOL back. Phantom lets you do this in Settings → "Close empty accounts." Solscan and some terminals also offer this.</li>
        <li>This is basically free SOL sitting in your wallet — close those empty accounts regularly.</li>
      </ul>

      <h3>The Solana Trading Stack</h3>
      <ol>
        <li><strong>Wallet:</strong> Phantom (primary) + Ledger (vault)</li>
        <li><strong>Execution:</strong> Axiom or Photon (web terminal) + BONKbot or Trojan (Telegram bot for mobile/speed)</li>
        <li><strong>Charts/Discovery:</strong> DEX Screener (trending, new pairs) + Birdeye (deep analytics)</li>
        <li><strong>Safety:</strong> RugCheck (every token, every time)</li>
        <li><strong>Intelligence:</strong> GMGN (smart money, bundles, wallet tracking)</li>
        <li><strong>Deep research:</strong> BubbleMaps (holder clustering) + Solscan (manual wallet inspection)</li>
        <li><strong>Aggregator:</strong> Jupiter (for standard swaps, limit orders, DCA)</li>
      </ol>

      <h3>Network Considerations</h3>
      <ul>
        <li><strong>Congestion:</strong> During massive launches or market events, Solana can get congested. Transactions fail, RPCs slow down. This is when premium RPCs (Helius, QuickNode) and proper Jito tip settings matter most.</li>
        <li><strong>Failed transactions:</strong> If your swap keeps failing, try: (1) increase Jito tip, (2) increase slippage slightly, (3) try a different RPC endpoint, (4) reduce your trade size. Don't just spam the same failing transaction.</li>
        <li><strong>Compute units:</strong> Some complex swaps require more compute. Most terminals handle this automatically, but if you get "insufficient compute" errors, you may need to increase the compute budget in your swap settings.</li>
      </ul>

      <div class="tip-box">
        <strong>The Daily Routine of a Solana Meme Trader:</strong> Wake up → check GMGN trending and smart money moves → scan DEX Screener for new pairs gaining traction → check CT for narrative shifts → identify 2-3 tokens worth deeper research → RugCheck + BubbleMaps + chart review on each → enter positions on the best setups via Axiom/Photon → set take-profit levels → monitor throughout the day → take profits at targets. Rinse, repeat.
      </div>
    `
  },

  // =============================================
  // 24. COMMUNITY & FINDING ALPHA
  // =============================================
  {
    id: "community",
    keywords: ["community", "culture", "twitter", "telegram", "discord", "social media", "influencer", "kol", "alpha group", "call group", "cabal", "insider", "where to find", "find meme coins", "discovery", "new coins", "alpha"],
    aliases: ["alpha", "community", "kol", "cabal", "twitter"],
    response: `
      <h3>Finding Alpha &amp; Navigating the Community</h3>

      <h3>Where Alpha Lives</h3>
      <ul>
        <li><strong>Twitter/X (Crypto Twitter / CT)</strong> — The #1 platform. Narratives form here, tokens get signal-boosted, and the meme coin meta shifts based on what's trending. Follow active meme coin traders (not just big influencers — look for traders who share their actual positions and results).</li>
        <li><strong>Telegram</strong> — Every meme coin has a TG group. Quality of the group often reflects quality of the community. Active, genuine chat = healthier token. Dead group with bots = red flag.</li>
        <li><strong>GMGN Smart Money Tab</strong> — See what profitable wallets are buying in real-time. This IS alpha, delivered directly by on-chain data.</li>
        <li><strong>DEX Screener Trending</strong> — The "trending" and "hot pairs" sections surface tokens gaining volume. Good for spotting emerging narratives.</li>
        <li><strong>pump.fun Feed</strong> — Watch the live feed for tokens gaining bonding curve momentum. Sort by various metrics to find needles in the haystack.</li>
      </ul>

      <h3>Evaluating Alpha Sources</h3>
      <ul>
        <li><strong>Track records matter.</strong> Anyone can claim to find 100x tokens. Look for people who: share entries AND exits, show losses alongside wins, have a verifiable on-chain track record.</li>
        <li><strong>Paid alpha groups:</strong> Some are legitimate and provide genuine value. Many are scams that recycle publicly available information or coordinate dumps on members. If joining one, start with free trial if available. Check the group's reputation on CT.</li>
        <li><strong>KOL calls:</strong> When a major influencer "calls" a token, the price usually pumps immediately. The question is: did they buy before posting? (Usually yes.) Are they going to sell into your buy? (Often yes.) KOL calls can be traded, but you need to be FAST and understand you're playing a different game.</li>
      </ul>

      <h3>The Cabal Problem</h3>
      <ul>
        <li>A <strong>cabal</strong> is a group of insiders (often KOLs and developers) who coordinate to: create/fund a token → accumulate at low prices → simultaneously shill to their audiences → sell into the FOMO they created.</li>
        <li><strong>How to spot cabals:</strong> Multiple unrelated KOLs all posting about the same obscure token within the same hour. Token has suspicious wallet clustering on BubbleMaps. Dev wallet funded from wallets connected to known cabal members.</li>
        <li><strong>Cabals aren't illegal in crypto</strong> (they would be in traditional markets), but they're predatory. If you suspect a coordinated shill campaign, proceed with extreme caution or avoid entirely.</li>
      </ul>

      <div class="tip-box">
        <strong>Building Your Own Edge:</strong> The best alpha comes from developing your own research process, not from following someone else's calls. Spend time learning to read on-chain data, track wallets independently, identify narratives early, and evaluate tokens yourself. This skill compounds over time and can't be taken from you.
      </div>
    `
  },

  // =============================================
  // 25. AIRDROPS
  // =============================================
  {
    id: "airdrops",
    keywords: ["airdrop", "airdrops", "free tokens", "free crypto", "claim", "drop", "reward"],
    aliases: ["airdrop"],
    response: `
      <h3>Meme Coin Airdrops</h3>

      <h3>Types</h3>
      <ul>
        <li><strong>Holder airdrops:</strong> Tokens sent to holders of another token (BONK was airdropped to Solana NFT/DeFi users).</li>
        <li><strong>Interaction airdrops:</strong> Rewarding protocol users (Jupiter's JUP airdrop to active swappers).</li>
        <li><strong>Community airdrops:</strong> Rewards for active Telegram/Discord members.</li>
        <li><strong>Snapshot airdrops:</strong> A block height is chosen, all wallets meeting criteria at that moment receive tokens.</li>
      </ul>

      <h3>Positioning for Airdrops</h3>
      <ul>
        <li>Be an active Solana DeFi user across multiple protocols</li>
        <li>Hold established meme coins — new projects sometimes airdrop to existing communities</li>
        <li>Engage genuinely in communities early</li>
        <li>Use trading terminals, DEXs, and lending protocols — volume and activity often determine eligibility</li>
      </ul>

      <div class="warning-box">
        <strong>Airdrop Scams Are Everywhere:</strong> NEVER connect your wallet to unknown "claim" sites. NEVER approve transactions you don't understand. If random tokens appear in your wallet uninvited, do NOT interact with them — they may be dust attack scam tokens designed to drain your wallet when you try to sell/transfer them. Real airdrops are announced through verified official channels only.
      </div>
    `
  },

  // =============================================
  // 26. BRIDGE & CROSS-CHAIN
  // =============================================
  {
    id: "bridge",
    keywords: ["bridge", "cross-chain", "crosschain", "transfer", "move tokens", "wormhole", "debridge", "send from eth to sol", "swap chains"],
    aliases: ["bridge", "debridge", "wormhole", "cross-chain"],
    response: `
      <h3>Bridging Assets Between Chains</h3>

      <h3>Recommended Bridges</h3>
      <ul>
        <li><strong>deBridge (debridge.finance)</strong> — Fast, low-fee. Best for moving between Solana, Ethereum, BNB, Base. Currently the most recommended.</li>
        <li><strong>Wormhole/Portal</strong> — Oldest major Solana bridge. Rebuilt after 2022 exploit. Wide chain support.</li>
        <li><strong>Allbridge</strong> — Multi-chain with stablecoin focus.</li>
        <li><strong>Jupiter</strong> — Now supports some cross-chain swaps directly.</li>
      </ul>

      <h3>Common Scenarios</h3>
      <ul>
        <li><strong>ETH → SOL:</strong> Bridge USDC via deBridge, then swap for SOL on Jupiter.</li>
        <li><strong>CEX → Solana:</strong> Easiest: buy SOL on Coinbase/Binance, withdraw directly to Phantom. No bridge needed.</li>
      </ul>

      <div class="warning-box">
        <strong>Bridge Safety:</strong> Only use established bridges. Bridges have been targets of the biggest hacks in crypto history. Double-check URLs every time. Never rush a bridge transaction. Consider bridging stablecoins (USDC) rather than volatile assets to avoid price movement during the bridging process.
      </div>
    `
  },

  // =============================================
  // 27. ADVANCED STRATEGIES
  // =============================================
  {
    id: "advanced",
    keywords: ["advanced", "strategies", "advanced strategy", "pro", "professional", "experienced", "edge", "alpha strategy", "playbook"],
    aliases: ["advanced", "pro strategy", "edge"],
    response: `
      <h3>Advanced Strategies for Experienced Traders</h3>

      <h3>1. Narrative Front-Running</h3>
      <ul>
        <li>Identify emerging narratives before they reach peak CT awareness.</li>
        <li>Buy the strongest token in the narrative early, before KOLs start posting about it.</li>
        <li>Signals: new token category gaining volume on DEX Screener, smart money wallets buying multiple tokens in the same theme, a catalyst event (news, cultural moment) that maps to a token theme.</li>
      </ul>

      <h3>2. Graduation Sniping with Filters</h3>
      <ul>
        <li>Don't snipe every pump.fun graduation blindly. Set filters in your terminal:</li>
        <li>Minimum holder count on the bonding curve (e.g., 100+)</li>
        <li>No bundled dev wallet</li>
        <li>Active Telegram/Twitter already existing</li>
        <li>Theme fits current meta</li>
        <li>This dramatically improves your hit rate vs random sniping.</li>
      </ul>

      <h3>3. Wallet Clustering Analysis</h3>
      <ul>
        <li>When you find a wallet that made a great trade, dig deeper. What other tokens did they buy recently? What wallets fund them? You're not just copying one trade — you're mapping an entire trading operation.</li>
        <li>Build a "watch list" of 20-50 high-quality wallets. When 3+ of them buy the same token independently, that's a strong confluence signal.</li>
      </ul>

      <h3>4. Counter-Narrative Trading</h3>
      <ul>
        <li>When a narrative is at peak hype (everyone's talking about it, new tokens launching every hour), start looking for the NEXT narrative rather than piling into the current one.</li>
        <li>The biggest gains come from being early in the next cycle, not late in the current one.</li>
      </ul>

      <h3>5. Dev Wallet Intelligence</h3>
      <ul>
        <li>Track deployer wallets that have historically launched successful tokens (ones that reached $5M+ MC and held).</li>
        <li>When a "proven dev" launches something new, it warrants attention. Their track record suggests capability and potentially a genuine effort.</li>
        <li>Conversely, maintain a "blacklist" of deployer wallets that have rugged. If a new token comes from a blacklisted deployer, instant skip.</li>
      </ul>

      <h3>6. Liquidity Depth Trading</h3>
      <ul>
        <li>Some tokens have disproportionately deep liquidity relative to their market cap. This means large buys/sells cause less price impact.</li>
        <li>Deep liquidity = easier entry/exit. For the same market cap, prefer tokens with deeper LP. It means bigger players can enter without moving the market, which tends to attract more capital.</li>
      </ul>

      <div class="tip-box">
        <strong>The Honest Meta-Strategy:</strong> The traders who win long-term aren't the ones with the fanciest strategies. They're the ones who: (1) have ironclad risk management, (2) stay in the game through drawdowns, (3) continuously learn from losses, and (4) adapt quickly when the market shifts. Fancy strategies on top of poor discipline still lose money.
      </div>
    `
  }
];

// =============================================
// FALLBACK RESPONSES
// =============================================
const FALLBACK_RESPONSES = [
  `<p>I don't have a specific entry on that exact topic, but I can go deep on any of these areas:</p>
   <ul>
    <li><strong>Trading Platforms</strong> — Axiom, Photon, BullX, GMGN, Telegram bots</li>
    <li><strong>Execution</strong> — slippage, MEV, Jito bundles, RPC optimization</li>
    <li><strong>On-Chain Intel</strong> — smart money tracking, bundle detection, wallet analysis</li>
    <li><strong>Launch Strategies</strong> — pump.fun mechanics, graduation sniping, entry/exit frameworks</li>
    <li><strong>Scam Detection</strong> — rug pulls, honeypots, insider identification</li>
    <li><strong>Risk &amp; Strategy</strong> — position sizing, narratives, profit-taking systems</li>
   </ul>
   <p>Try rephrasing your question or select a topic from the sidebar.</p>`,

  `<p>That's a bit outside my specific coverage. I specialize in actionable meme coin trading intelligence:</p>
   <ul>
    <li>Solana ecosystem (pump.fun, Jupiter, Raydium, SPL tokens)</li>
    <li>Trading terminals (Axiom, Photon, BullX, GMGN)</li>
    <li>On-chain analysis (wallet tracking, holder distribution, bundle detection)</li>
    <li>Risk management and trading psychology</li>
    <li>Multi-chain coverage (ETH, BNB, Base)</li>
   </ul>
   <p>Ask about any of these topics for detailed, trader-level answers.</p>`
];

window.KNOWLEDGE_BASE = KNOWLEDGE_BASE;
window.FALLBACK_RESPONSES = FALLBACK_RESPONSES;
