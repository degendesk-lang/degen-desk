/**
 * Degen Desk - Chat engine with AI backend, local KB fallback, multi-conversation support
 */

(function () {
  const messagesContainer = document.getElementById("messages");
  const userInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebarClose = document.getElementById("sidebar-close");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const topicButtons = document.querySelectorAll(".topic-btn");
  const mobileTopicPills = document.querySelectorAll(".mobile-topic-pill");
  const mobileTopics = document.getElementById("mobile-topics");
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
        chatListEmpty.innerHTML = "<p>No conversations yet</p>";
        await refreshChatList();
      } else {
        googleSignInBtn.style.display = "flex";
        userProfile.style.display = "none";
        userAvatar.src = "";
        userName.textContent = "";
        chatListEmpty.innerHTML = "<p>Sign in to save your chats</p>";
        chatListEmpty.style.display = "block";
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
      chatListEmpty.style.display = "block";
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
            <div class="message-bubble">
              <h2>Welcome to Degen Desk</h2>
              <p>I'm an expert-level meme coin intelligence agent built with the knowledge of experienced <strong>Solana meme coin traders</strong>. I also cover Ethereum, BNB Chain, Base, and the broader crypto ecosystem.</p>
              <div class="welcome-grid">
                <div class="welcome-card"><div class="welcome-card-icon">&#128187;</div><div class="welcome-card-text"><strong>Trading Platforms</strong><span>Axiom, Photon, BullX, GMGN, TG bots</span></div></div>
                <div class="welcome-card"><div class="welcome-card-icon">&#9889;</div><div class="welcome-card-text"><strong>Execution &amp; MEV</strong><span>Jito bundles, slippage, sandwich protection</span></div></div>
                <div class="welcome-card"><div class="welcome-card-icon">&#128373;</div><div class="welcome-card-text"><strong>On-Chain Intel</strong><span>Smart money, bundle detection, wallets</span></div></div>
                <div class="welcome-card"><div class="welcome-card-icon">&#128721;</div><div class="welcome-card-text"><strong>Scam Detection</strong><span>Rug pulls, honeypots, cabal identification</span></div></div>
              </div>
              <p style="margin-top:4px;">Ask me anything, or select a topic from the sidebar.</p>
            </div>
          </div>
        </div>
      `;
      messagesContainer.innerHTML = welcomeHTML;
    }

    // Show mobile topics again
    if (mobileTopics) mobileTopics.style.display = "";
  }

  function clearChatUI() {
    // Remove all messages
    const allMsgs = messagesContainer.querySelectorAll(".message");
    allMsgs.forEach((m) => m.remove());
    // Remove mobile topics
    if (mobileTopics) mobileTopics.style.display = "none";
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
  document.querySelectorAll(".topic-btn, .mobile-topic-pill").forEach((btn) => {
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

  async function getAIResponse(query) {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: chatHistory.slice(-6),
        }),
      });
      if (!response.ok) {
        console.error("API error:", response.status);
        return null;
      }
      const data = await response.json();
      return data.reply || null;
    } catch (err) {
      console.error("Failed to reach AI:", err);
      return null;
    }
  }

  // =============================================
  // UI FUNCTIONS
  // =============================================

  function createMessageElement(content, isUser) {
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
      bubble.innerHTML = `<p>${escapeHtml(content)}</p>`;
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

  function hideMobileTopics() {
    if (mobileTopics) mobileTopics.style.display = "none";
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
  // SEND MESSAGE HANDLER
  // =============================================

  let isProcessing = false;

  async function sendMessage(text) {
    const query = text.trim();
    if (!query || isProcessing) return;

    isProcessing = true;
    hideMobileTopics();
    hideWelcome();

    // If logged in and no current conversation, create one
    if (window.DegenAuth && DegenAuth.currentUser && !DegenAuth.currentConversationId) {
      await DegenAuth.createConversation("New chat");
    }

    // Add user message to UI
    const userMsg = createMessageElement(query, true);
    messagesContainer.appendChild(userMsg);
    scrollToBottom();

    // Clear input
    userInput.value = "";
    userInput.style.height = "auto";

    // Add to chat history
    chatHistory.push({ role: "user", content: query });

    // Save user message
    if (window.DegenAuth && DegenAuth.currentUser) {
      const titleUpdated = await DegenAuth.saveMessage("user", query);
      if (titleUpdated) refreshChatList();
    }

    // Show typing indicator
    const typing = createTypingIndicator();
    messagesContainer.appendChild(typing);
    scrollToBottom();

    // 1. Try strong local match first (sidebar topic clicks)
    const localResponse = getLocalResponse(query);

    if (localResponse) {
      setTimeout(async () => {
        typing.remove();
        showBotMessage(localResponse);
        chatHistory.push({ role: "assistant", content: localResponse.replace(/<[^>]*>/g, "").substring(0, 500) });
        if (window.DegenAuth && DegenAuth.currentUser) {
          await DegenAuth.saveMessage("assistant", localResponse);
        }
        isProcessing = false;
      }, 300 + Math.random() * 400);
      return;
    }

    // 2. Call AI API
    const aiResponse = await getAIResponse(query);
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

  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  });

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

  // Mobile topic pill buttons
  mobileTopicPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const query = pill.getAttribute("data-query");
      userInput.value = query;
      sendMessage(query);
    });
  });

  // Focus input on load (desktop only)
  if (window.innerWidth > 768) {
    userInput.focus();
  }
})();
