/**
 * Degen Desk - Chat engine with AI backend + local knowledge base fallback
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

  // Chat history for AI context
  const chatHistory = [];

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

  function getLocalResponse(query) {
    const matches = findBestMatches(query, 3);

    if (matches.length === 0 || matches[0].score < 5) {
      return null; // No good local match — let AI handle it
    }

    // Only use local response if it's a strong match (sidebar topic clicks etc.)
    if (matches[0].score >= 30) {
      let response = matches[0].entry.response;
      if (matches.length >= 2 && matches[1].score >= 12 && matches[1].entry.id !== matches[0].entry.id) {
        const relatedName = matches[1].entry.keywords[0].replace(/^\w/, (c) => c.toUpperCase());
        response += `<div class="info-box" style="margin-top:12px;"><strong>&#128204; Related:</strong> You might also want to ask about <strong>${relatedName}</strong> for more context.</div>`;
      }
      return response;
    }

    return null; // Weak match — let AI handle it
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
    bubble.innerHTML =
      '<div class="typing-indicator"><span></span><span></span><span></span></div>';

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
    if (mobileTopics) {
      mobileTopics.style.display = "none";
    }
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

    // Add user message to UI
    const userMsg = createMessageElement(query, true);
    messagesContainer.appendChild(userMsg);
    scrollToBottom();

    // Clear input
    userInput.value = "";
    userInput.style.height = "auto";

    // Add to chat history
    chatHistory.push({ role: "user", content: query });

    // Show typing indicator
    const typing = createTypingIndicator();
    messagesContainer.appendChild(typing);
    scrollToBottom();

    // 1. Try strong local match first (for sidebar topic clicks)
    const localResponse = getLocalResponse(query);

    if (localResponse) {
      // Strong local match — use it immediately
      setTimeout(() => {
        typing.remove();
        showBotMessage(localResponse);
        chatHistory.push({ role: "assistant", content: localResponse.replace(/<[^>]*>/g, "").substring(0, 500) });
        isProcessing = false;
      }, 300 + Math.random() * 400);
      return;
    }

    // 2. No strong local match — call AI API
    const aiResponse = await getAIResponse(query);
    typing.remove();

    if (aiResponse) {
      showBotMessage(aiResponse);
      chatHistory.push({ role: "assistant", content: aiResponse.replace(/<[^>]*>/g, "").substring(0, 500) });
    } else {
      // 3. AI failed — fall back to best local match or generic fallback
      const matches = findBestMatches(query, 2);
      if (matches.length > 0 && matches[0].score > 0) {
        showBotMessage(matches[0].entry.response);
      } else {
        const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
        showBotMessage(FALLBACK_RESPONSES[idx]);
      }
    }

    isProcessing = false;
  }

  // =============================================
  // EVENT LISTENERS
  // =============================================

  sendBtn.addEventListener("click", () => {
    sendMessage(userInput.value);
  });

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
    sidebarClose.addEventListener("click", () => {
      closeSidebar();
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      closeSidebar();
    });
  }

  // Accordion section toggles
  document.querySelectorAll(".nav-section-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const section = toggle.parentElement;
      section.classList.toggle("open");
    });
  });

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
