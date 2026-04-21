/**
 * Degen Desk - Chat engine with AI backend, local KB fallback, multi-conversation support
 */

// =============================================
// Toast notifications (window.DegenToast)
// Lightweight, self-contained transient notification system.
// Usage: DegenToast.show("Message", "error" | "success" | "info", { title, duration })
// =============================================
window.DegenToast = (function () {
  const ICONS = {
    error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  function getContainer() {
    let el = document.getElementById("toast-container");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast-container";
      document.body.appendChild(el);
    }
    return el;
  }

  function show(message, type, opts) {
    if (!message) return;
    type = type || "info";
    opts = opts || {};
    const duration = opts.duration != null ? opts.duration : (type === "error" ? 5000 : 3500);

    const container = getContainer();
    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;

    const icon = document.createElement("div");
    icon.className = "toast-icon";
    icon.innerHTML = ICONS[type] || ICONS.info;

    const body = document.createElement("div");
    body.className = "toast-body";
    if (opts.title) {
      const strong = document.createElement("strong");
      strong.textContent = opts.title;
      body.appendChild(strong);
    }
    const msg = document.createElement("span");
    msg.textContent = message;
    body.appendChild(msg);

    const close = document.createElement("button");
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = "&times;";

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(close);
    container.appendChild(toast);

    let timer;
    function dismiss() {
      if (toast.classList.contains("toast-leaving")) return;
      clearTimeout(timer);
      toast.classList.add("toast-leaving");
      toast.addEventListener(
        "animationend",
        () => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        },
        { once: true }
      );
    }
    close.addEventListener("click", dismiss);
    timer = setTimeout(dismiss, duration);

    return { dismiss };
  }

  return {
    show,
    error: (msg, opts) => show(msg, "error", opts),
    success: (msg, opts) => show(msg, "success", opts),
    info: (msg, opts) => show(msg, "info", opts),
  };
})();

(function () {
  const messagesContainer = document.getElementById("messages");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const attachBtn = document.getElementById("attach-btn");
  const imageInput = document.getElementById("image-input");
  const imagePreviews = document.getElementById("image-previews");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebarClose = document.getElementById("sidebar-close");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const topicButtons = document.querySelectorAll(".topic-btn");
  const welcomeMessage = document.getElementById("welcome-message");

  // Auth / conversation UI elements
  const newChatBtn = document.getElementById("new-chat-btn");
  const chatList = document.getElementById("chat-list");
  const chatListEmpty = document.getElementById("chat-list-empty");
  const googleSignInBtn = document.getElementById("google-sign-in");
  const userProfile = document.getElementById("user-profile");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const signOutBtn = document.getElementById("sign-out-btn");
  const topicsToggle = document.getElementById("topics-toggle");
  const topicsContent = document.getElementById("topics-content");

  // Chat history for AI context
  let chatHistory = [];

  // =============================================
  // TOPICS ACCORDION
  // =============================================

  let topicsOpen = false;
  if (topicsToggle) {
    topicsToggle.addEventListener("click", () => {
      topicsOpen = !topicsOpen;
      topicsToggle.classList.toggle("open", topicsOpen);
      topicsContent.classList.toggle("open", topicsOpen);
    });
  }

  // =============================================
  // AUTH & CONVERSATION INTEGRATION
  // =============================================

  if (window.DegenAuth) {
    DegenAuth.onAuthChange(async (user) => {
      if (user) {
        googleSignInBtn.style.display = "none";
        userProfile.style.display = "flex";
        userAvatar.src = user.photoURL || "";
        userName.textContent = user.displayName || "User";
        chatListEmpty.innerHTML = `
          <div class="empty-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p class="empty-title">No chats yet</p>
          <p class="empty-hint">Start a new conversation to see it here.</p>
        `;
        // Load subscription tier
        const tier = await DegenAuth.loadUserTier();
        updateTierUI(tier);
        await refreshChatList();
      } else {
        googleSignInBtn.style.display = "flex";
        userProfile.style.display = "none";
        userAvatar.src = "";
        userName.textContent = "";
        chatListEmpty.innerHTML = `
          <div class="empty-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p class="empty-title">Sign in to save your chats</p>
          <p class="empty-hint">Your conversations will sync across devices.</p>
        `;
        chatListEmpty.style.display = "";
        // Clear any rendered conversation items
        const items = chatList.querySelectorAll(".chat-list-item");
        items.forEach((el) => el.remove());
        // Reset to welcome view
        startNewChat();
      }
    });

    googleSignInBtn.addEventListener("click", () => DegenAuth.signIn());
    signOutBtn.addEventListener("click", () => DegenAuth.signOut());

    newChatBtn.addEventListener("click", () => {
      startNewChat();
      closeSidebar();
    });
  }

  async function refreshChatList() {
    if (!DegenAuth.currentUser) return;
    const conversations = await DegenAuth.listConversations();

    // Remove existing items
    const items = chatList.querySelectorAll(".chat-list-item");
    items.forEach((el) => el.remove());

    if (conversations.length === 0) {
      chatListEmpty.style.display = "";
      return;
    }

    chatListEmpty.style.display = "none";

    conversations.forEach((conv) => {
      const item = document.createElement("div");
      item.className = "chat-list-item";
      if (conv.id === DegenAuth.currentConversationId) {
        item.classList.add("active");
      }

      const titleSpan = document.createElement("span");
      titleSpan.className = "chat-list-title";
      titleSpan.textContent = conv.title || "New chat";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "chat-list-delete";
      deleteBtn.title = "Delete chat";
      deleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await DegenAuth.deleteConversation(conv.id);
        await refreshChatList();
        if (conv.id === DegenAuth.currentConversationId) {
          startNewChat();
        }
      });

      item.addEventListener("click", async () => {
        await loadConversation(conv.id);
        closeSidebar();
      });

      item.appendChild(titleSpan);
      item.appendChild(deleteBtn);
      chatList.appendChild(item);
    });
  }

  async function loadConversation(convId) {
    const messages = await DegenAuth.loadConversation(convId);
    clearChatUI();
    chatHistory = [];

    for (const msg of messages) {
      const isUser = msg.role === "user";
      const el = createMessageElement(msg.content, isUser);
      if (!isUser) {
        el.querySelector(".message-bubble").innerHTML = msg.content;
      }
      messagesContainer.appendChild(el);
      chatHistory.push({
        role: msg.role,
        content: isUser ? msg.content : msg.content.replace(/<[^>]*>/g, "").substring(0, 500),
      });
    }

    scrollToBottom();

    // Update active state in sidebar
    const items = chatList.querySelectorAll(".chat-list-item");
    items.forEach((el) => el.classList.remove("active"));
    // Find and mark active
    const allItems = chatList.querySelectorAll(".chat-list-item");
    // Refresh to show active state
    await refreshChatList();
  }

  function startNewChat() {
    DegenAuth.currentConversationId = null;
    chatHistory = [];
    clearChatUI();

    // Re-show welcome message
    const existingWelcome = document.getElementById("welcome-message");
    if (!existingWelcome) {
      messagesContainer.innerHTML = "";
      // Recreate welcome
      const welcomeHTML = `
        <div class="message bot-message" id="welcome-message">
          <div class="message-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div class="message-content">
            <div class="message-bubble welcome-bubble">
              <div class="welcome-hero">
                <h2>Welcome to Degen Desk</h2>
                <p class="welcome-tagline">Expert-level crypto and Solana meme coin intelligence.</p>
              </div>
              <p class="welcome-intro">Ask me anything about <strong>Bitcoin, Ethereum, DeFi</strong>, Solana meme coins, trading platforms, MEV, scam detection, wallet tracking on Solscan, chart reading, or on-chain research. I cover all major chains.</p>
              <div class="welcome-suggestions-label">Try asking</div>
              <div class="welcome-grid">
                <button class="welcome-card" data-query="What are meme coins and how do they work?">
                  <span class="welcome-card-icon">&#128640;</span>
                  <span class="welcome-card-text">
                    <strong>Meme coin basics</strong>
                    <span>What they are and how they work</span>
                  </span>
                </button>
                <button class="welcome-card" data-query="How do I detect rug pulls, scams, and bundled launches?">
                  <span class="welcome-card-icon">&#128721;</span>
                  <span class="welcome-card-text">
                    <strong>Spot a rug pull</strong>
                    <span>Red flags before you ape in</span>
                  </span>
                </button>
                <button class="welcome-card" data-query="What are the current meme coin narratives and metas? How do I identify which narrative is running and spot the next rotation?">
                  <span class="welcome-card-icon">&#127754;</span>
                  <span class="welcome-card-text">
                    <strong>Narratives &amp; Metas</strong>
                    <span>Spot the rotation, ride the wave</span>
                  </span>
                </button>
                <button class="welcome-card" data-query="What are the best entry and exit strategies for meme coins?">
                  <span class="welcome-card-icon">&#128176;</span>
                  <span class="welcome-card-text">
                    <strong>Entry &amp; exit</strong>
                    <span>When to buy, when to take profit</span>
                  </span>
                </button>
              </div>

              <div id="ios-waitlist" class="ios-waitlist">
                <div class="ios-waitlist-head">
                  <span class="ios-waitlist-icon">&#127909;</span>
                  <div>
                    <strong>iOS app coming soon</strong>
                    <span>Get notified the day it drops on the App Store.</span>
                  </div>
                </div>
                <form id="ios-waitlist-form" class="ios-waitlist-form" autocomplete="off">
                  <input type="email" id="ios-waitlist-email" placeholder="you@example.com" required aria-label="Email address" />
                  <button type="submit" id="ios-waitlist-submit">Notify me</button>
                </form>
                <div id="ios-waitlist-msg" class="ios-waitlist-msg" hidden></div>
              </div>
            </div>
          </div>
        </div>
      `;
      messagesContainer.innerHTML = welcomeHTML;
      attachWaitlistHandler();
    }
  }

  // Waitlist is re-created on every welcome render, so handler must re-bind too
  function attachWaitlistHandler() {
    const form = document.getElementById("ios-waitlist-form");
    const emailInput = document.getElementById("ios-waitlist-email");
    const submitBtn = document.getElementById("ios-waitlist-submit");
    const msgEl = document.getElementById("ios-waitlist-msg");
    if (!form || !emailInput || !submitBtn || !msgEl) return;
    if (form.dataset.bound === "1") return; // already bound
    form.dataset.bound = "1";

    function showMsg(text, type) {
      msgEl.textContent = text;
      msgEl.className = "ios-waitlist-msg " + (type || "");
      msgEl.hidden = false;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = (emailInput.value || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMsg("Please enter a valid email address.", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      msgEl.hidden = true;

      try {
        if (window.DegenAuth && typeof window.DegenAuth.logEvent === "function") {
          window.DegenAuth.logEvent("ios_waitlist_signup", { email_domain: email.split("@")[1] || "" });
        }

        const db = firebase.firestore();
        await db
          .collection("ios_waitlist")
          .doc(email)
          .set(
            {
              email: email,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              source: "homepage_welcome",
              userAgent: navigator.userAgent || null,
              referralCode:
                (window.DegenAuth && window.DegenAuth.getReferralCode && window.DegenAuth.getReferralCode()) || null,
            },
            { merge: true }
          );

        showMsg("You're on the list! We'll email you the moment the iOS app drops.", "success");
        emailInput.value = "";
        submitBtn.textContent = "Added";
      } catch (err) {
        console.error("[Waitlist] save failed:", err);
        showMsg("Something went wrong. Try again in a moment.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Notify me";
      }
    });
  }

  function clearChatUI() {
    // Remove all messages
    const allMsgs = messagesContainer.querySelectorAll(".message");
    allMsgs.forEach((m) => m.remove());
    // Remove welcome if exists
    const welcome = document.getElementById("welcome-message");
    if (welcome) welcome.remove();
  }

  // =============================================
  // SIDEBAR MANAGEMENT
  // =============================================

  function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("visible");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("visible");
  }

  // =============================================
  // LOCAL MATCHING ENGINE (FALLBACK)
  // =============================================

  function scoreEntry(query, entry) {
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    let score = 0;

    for (const kw of entry.keywords) {
      if (q === kw) score += 100;
      else if (q.includes(kw)) score += 50;
      else if (kw.includes(q)) score += 40;
    }

    for (const word of words) {
      for (const kw of entry.keywords) {
        if (kw === word) score += 15;
        else if (kw.includes(word)) score += 8;
        else if (word.includes(kw) && kw.length > 3) score += 6;
      }
    }

    if (entry.aliases) {
      for (const alias of entry.aliases) {
        if (q.includes(alias)) score += 60;
        for (const word of words) {
          if (word === alias) score += 40;
        }
      }
    }

    const responseText = entry.response.toLowerCase().replace(/<[^>]*>/g, "");
    for (const word of words) {
      if (word.length > 3 && responseText.includes(word)) score += 2;
    }

    return score;
  }

  function findBestMatches(query, maxResults = 2) {
    const scored = KNOWLEDGE_BASE.map((entry) => ({
      entry,
      score: scoreEntry(query, entry),
    }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, maxResults);
  }

  const sidebarQueries = new Set();
  document.querySelectorAll(".topic-btn").forEach((btn) => {
    const q = btn.getAttribute("data-query");
    if (q) sidebarQueries.add(q.trim());
  });

  function getLocalResponse(query) {
    if (!sidebarQueries.has(query.trim())) {
      return null;
    }
    const matches = findBestMatches(query, 3);
    if (matches.length === 0 || matches[0].score < 20) {
      return null;
    }
    let response = matches[0].entry.response;
    if (matches.length >= 2 && matches[1].score >= 12 && matches[1].entry.id !== matches[0].entry.id) {
      const relatedName = matches[1].entry.keywords[0].replace(/^\w/, (c) => c.toUpperCase());
      response += `<div class="info-box" style="margin-top:12px;"><strong>&#128204; Related:</strong> You might also want to ask about <strong>${relatedName}</strong> for more context.</div>`;
    }
    return response;
  }

  // =============================================
  // AI API CALL
  // =============================================

  async function getAIResponse(query, attachedImages) {
    try {
      const uid = window.DegenAuth?.currentUser?.uid || null;
      const body = {
        message: query,
        history: chatHistory.slice(-6),
        uid: uid,
      };
      if (Array.isArray(attachedImages) && attachedImages.length > 0) {
        body.images = attachedImages.map((img) => img.dataUrl);
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        const errData = await response.json();
        if (errData.imageLimit) {
          const headline = errData.upgrade
            ? "&#9888;&#65039; Daily image limit reached"
            : "&#9888;&#65039; Daily image cap reached";
          const cta = errData.upgrade
            ? `<a href="/pricing.html" style="display:inline-block;margin-top:10px;padding:10px 20px;background:linear-gradient(135deg,#00ff88,#00cc6a);color:#000;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">Upgrade to Pro</a>`
            : "";
          return `<div class="warning-box"><strong>${headline}</strong><p style="margin-top:8px;">${escapeHtml(errData.error || "")}</p>${cta}</div>`;
        }
        if (errData.upgrade) {
          return `<div class="warning-box"><strong>&#9888;&#65039; Daily limit reached</strong><p style="margin-top:8px;">You've used all 15 free messages today. Upgrade to <strong>Pro</strong> for unlimited messages and a smarter AI model.</p><a href="/pricing.html" style="display:inline-block;margin-top:10px;padding:10px 20px;background:linear-gradient(135deg,#00ff88,#00cc6a);color:#000;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">Upgrade to Pro</a></div>`;
        }
        return null;
      }

      if (response.status === 401) {
        const errData = await response.json().catch(() => ({}));
        if (errData.requireAuth) {
          return `<div class="warning-box"><strong>&#128274; Sign in required</strong><p style="margin-top:8px;">Please sign in to attach images to your messages.</p></div>`;
        }
      }

      if (!response.ok) {
        console.error("API error:", response.status);
        if (window.DegenToast) {
          DegenToast.error("We couldn't reach the AI. Using local knowledge instead.", {
            title: "Connection issue",
          });
        }
        return null;
      }
      const data = await response.json();
      return data.reply || null;
    } catch (err) {
      console.error("Failed to reach AI:", err);
      if (window.DegenToast) {
        DegenToast.error("Network error. Check your connection and try again.", {
          title: "Offline",
        });
      }
      return null;
    }
  }

  // Tier UI
  function updateTierUI(tier) {
    const sub = document.querySelector(".sidebar-user-sub");
    const upgradeBtn = document.getElementById("sidebar-upgrade-btn");
    if (sub) {
      if (tier === "pro") {
        sub.textContent = "Pro plan";
        sub.style.color = "#00ff88";
        if (upgradeBtn) upgradeBtn.classList.add("hidden");
      } else {
        sub.textContent = "Free plan";
        sub.style.color = "";
        if (upgradeBtn) upgradeBtn.classList.remove("hidden");
      }
    }
  }

  // =============================================
  // UI FUNCTIONS
  // =============================================

  function createMessageElement(content, isUser, opts) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user-message" : "bot-message"}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerHTML = isUser ? "&#128100;" : "&#9000;";

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (isUser) {
      const images = opts && Array.isArray(opts.images) ? opts.images : [];
      let html = "";
      if (images.length > 0) {
        html += '<div class="user-images">';
        for (const img of images) {
          const src = typeof img === "string" ? img : img.dataUrl;
          if (src) html += `<img src="${src}" alt="Attached image" />`;
        }
        html += "</div>";
      }
      if (content) {
        html += `<p>${escapeHtml(content)}</p>`;
      }
      bubble.innerHTML = html;
    } else {
      bubble.innerHTML = content;
    }

    contentDiv.appendChild(bubble);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    return messageDiv;
  }

  function createTypingIndicator() {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message bot-message";
    messageDiv.id = "typing-indicator";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerHTML = "&#9000;";

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';

    contentDiv.appendChild(bubble);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);

    return messageDiv;
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function hideWelcome() {
    const welcome = document.getElementById("welcome-message");
    if (welcome) welcome.remove();
  }

  function showBotMessage(html) {
    const botMsg = createMessageElement("", false);
    botMsg.querySelector(".message-bubble").innerHTML = html;
    messagesContainer.appendChild(botMsg);
    scrollToBottom();
  }

  // =============================================
  // IMAGE ATTACHMENTS
  // Max 2 images per message, resized client-side before upload.
  // =============================================

  const MAX_IMAGES = 2;
  const MAX_IMAGE_DIMENSION = 1568; // OpenAI vision internal scale
  const JPEG_QUALITY = 0.85;
  const pendingImages = []; // array of { dataUrl: string, id: string }

  function notify(msg, type) {
    if (window.DegenToast) {
      if (type === "error") DegenToast.error(msg);
      else if (type === "success") DegenToast.success(msg);
      else DegenToast.info(msg);
    } else {
      console.log(`[${type || "info"}]`, msg);
    }
  }

  // Resize a File/Blob to an OpenAI-friendly JPEG data URL.
  function resizeImageToDataUrl(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Failed to decode image"));
        img.onload = () => {
          let { width, height } = img;
          if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
            if (width >= height) {
              height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
              width = MAX_IMAGE_DIMENSION;
            } else {
              width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
              height = MAX_IMAGE_DIMENSION;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          // Use JPEG for all images (smaller than PNG, vision models don't care)
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(fileOrBlob);
    });
  }

  function renderImagePreviews() {
    if (!imagePreviews) return;
    if (pendingImages.length === 0) {
      imagePreviews.innerHTML = "";
      imagePreviews.hidden = true;
    } else {
      imagePreviews.hidden = false;
      imagePreviews.innerHTML = pendingImages
        .map(
          (img) => `
          <div class="image-preview-thumb" data-id="${img.id}">
            <img src="${img.dataUrl}" alt="Attached image" />
            <button type="button" class="remove-img" aria-label="Remove image" data-id="${img.id}">&times;</button>
          </div>`
        )
        .join("");
    }
    if (attachBtn) {
      attachBtn.disabled = pendingImages.length >= MAX_IMAGES;
    }
    if (typeof updateSendBtnState === "function") updateSendBtnState();
  }

  async function addImageFile(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      notify("That file doesn't look like an image.", "error");
      return;
    }
    if (pendingImages.length >= MAX_IMAGES) {
      notify(`You can attach up to ${MAX_IMAGES} images per message.`, "error");
      return;
    }
    // Require sign-in so the server can track per-user daily limits.
    if (!window.DegenAuth || !DegenAuth.currentUser) {
      notify("Sign in to attach images.", "error");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      pendingImages.push({
        dataUrl,
        id: "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      });
      renderImagePreviews();
    } catch (err) {
      console.error("Image processing failed:", err);
      notify("Couldn't process that image. Please try another.", "error");
    }
  }

  function clearPendingImages() {
    pendingImages.length = 0;
    if (imageInput) imageInput.value = "";
    renderImagePreviews();
  }

  // Attach button → open native file picker (camera or library on iOS)
  if (attachBtn && imageInput) {
    attachBtn.addEventListener("click", () => {
      if (!window.DegenAuth || !DegenAuth.currentUser) {
        notify("Sign in to attach images.", "error");
        return;
      }
      if (pendingImages.length >= MAX_IMAGES) {
        notify(`You can attach up to ${MAX_IMAGES} images per message.`, "error");
        return;
      }
      imageInput.click();
    });

    imageInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      const slots = MAX_IMAGES - pendingImages.length;
      const chosen = files.slice(0, slots);
      for (const f of chosen) {
        // eslint-disable-next-line no-await-in-loop
        await addImageFile(f);
      }
      // Reset so selecting the same file again still fires 'change'
      imageInput.value = "";
    });
  }

  // Remove-thumb click (event delegation)
  if (imagePreviews) {
    imagePreviews.addEventListener("click", (e) => {
      const btn = e.target.closest(".remove-img");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const idx = pendingImages.findIndex((img) => img.id === id);
      if (idx >= 0) {
        pendingImages.splice(idx, 1);
        renderImagePreviews();
      }
    });
  }

  // Paste-from-clipboard: catch screenshots pasted into the composer
  if (userInput) {
    userInput.addEventListener("paste", async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItems = [];
      for (const item of items) {
        if (item.kind === "file" && item.type && item.type.startsWith("image/")) {
          imageItems.push(item);
        }
      }
      if (imageItems.length === 0) return; // normal text paste — let it through

      e.preventDefault();
      if (!window.DegenAuth || !DegenAuth.currentUser) {
        notify("Sign in to attach images.", "error");
        return;
      }
      const slots = MAX_IMAGES - pendingImages.length;
      if (slots <= 0) {
        notify(`You can attach up to ${MAX_IMAGES} images per message.`, "error");
        return;
      }
      const chosen = imageItems.slice(0, slots);
      for (const item of chosen) {
        const file = item.getAsFile();
        if (file) {
          // eslint-disable-next-line no-await-in-loop
          await addImageFile(file);
        }
      }
    });
  }

  // =============================================
  // SEND MESSAGE HANDLER
  // =============================================

  let isProcessing = false;

  async function sendMessage(text) {
    const query = (text || "").trim();
    // Snapshot pending images so the preview row can be cleared before the
    // network call returns.
    const sentImages = pendingImages.slice();
    if (!query && sentImages.length === 0) return;
    if (isProcessing) return;

    isProcessing = true;
    if (typeof updateSendBtnState === "function") updateSendBtnState();
    hideWelcome();

    // If logged in and no current conversation, create one
    if (window.DegenAuth && DegenAuth.currentUser && !DegenAuth.currentConversationId) {
      await DegenAuth.createConversation("New chat");
    }

    // Add user message to UI (with inline image thumbnails if any)
    const userMsg = createMessageElement(query, true, { images: sentImages });
    messagesContainer.appendChild(userMsg);
    scrollToBottom();

    // Clear input + pending images
    userInput.value = "";
    userInput.style.height = "auto";
    clearPendingImages();

    // Add to chat history (text only — images are not kept in history)
    chatHistory.push({ role: "user", content: query });

    // Save user message
    if (window.DegenAuth && DegenAuth.currentUser) {
      const titleUpdated = await DegenAuth.saveMessage("user", query || "(image)");
      if (titleUpdated) refreshChatList();
    }

    // Show typing indicator
    const typing = createTypingIndicator();
    messagesContainer.appendChild(typing);
    scrollToBottom();

    // 1. Try strong local match first (sidebar topic clicks)
    // Skip local matching when images are attached — the user wants vision.
    const localResponse = sentImages.length === 0 ? getLocalResponse(query) : null;

    if (localResponse) {
      setTimeout(async () => {
        typing.remove();
        showBotMessage(localResponse);
        chatHistory.push({ role: "assistant", content: localResponse.replace(/<[^>]*>/g, "").substring(0, 500) });
        if (window.DegenAuth && DegenAuth.currentUser) {
          await DegenAuth.saveMessage("assistant", localResponse);
        }
        isProcessing = false;
        if (typeof updateSendBtnState === "function") updateSendBtnState();
      }, 300 + Math.random() * 400);
      return;
    }

    // 2. Call AI API (with any attached images)
    const aiResponse = await getAIResponse(query, sentImages);
    typing.remove();

    if (aiResponse) {
      showBotMessage(aiResponse);
      chatHistory.push({ role: "assistant", content: aiResponse.replace(/<[^>]*>/g, "").substring(0, 500) });
      if (window.DegenAuth && DegenAuth.currentUser) {
        await DegenAuth.saveMessage("assistant", aiResponse);
      }
    } else {
      const matches = findBestMatches(query, 2);
      let fallbackResponse;
      if (matches.length > 0 && matches[0].score > 0) {
        fallbackResponse = matches[0].entry.response;
      } else {
        const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
        fallbackResponse = FALLBACK_RESPONSES[idx];
      }
      showBotMessage(fallbackResponse);
      if (window.DegenAuth && DegenAuth.currentUser) {
        await DegenAuth.saveMessage("assistant", fallbackResponse);
      }
    }

    isProcessing = false;
    if (typeof updateSendBtnState === "function") updateSendBtnState();
  }

  // =============================================
  // EVENT LISTENERS
  // =============================================

  sendBtn.addEventListener("click", () => sendMessage(userInput.value));

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(userInput.value);
    }
  });

  function updateSendBtnState() {
    const hasText = userInput.value.trim().length > 0;
    const hasImages = pendingImages.length > 0;
    sendBtn.disabled = (!hasText && !hasImages) || isProcessing;
  }

  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
    updateSendBtnState();
  });

  // Initial state — nothing typed yet
  updateSendBtnState();

  sidebarToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    openSidebar();
  });

  if (sidebarClose) {
    sidebarClose.addEventListener("click", closeSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeSidebar);
  }

  // Sidebar topic buttons
  topicButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const query = btn.getAttribute("data-query");
      userInput.value = query;
      sendMessage(query);
      closeSidebar();
    });
  });

  // Welcome-screen suggestion cards — delegated so re-rendered welcomes still work
  messagesContainer.addEventListener("click", (e) => {
    const card = e.target.closest(".welcome-card[data-query]");
    if (!card) return;
    const query = card.getAttribute("data-query");
    if (!query) return;
    userInput.value = query;
    sendMessage(query);
  });


  // Focus input on load (desktop only)
  if (window.innerWidth > 768) {
    userInput.focus();
  }

  // Wire up the static-HTML waitlist on initial page load (before any re-render)
  attachWaitlistHandler();
})();
