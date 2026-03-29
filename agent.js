/**
 * Degen Desk - Chat engine and UI interaction
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
  // MATCHING ENGINE
  // =============================================

  function scoreEntry(query, entry) {
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    let score = 0;

    for (const kw of entry.keywords) {
      if (q === kw) {
        score += 100;
      } else if (q.includes(kw)) {
        score += 50;
      } else if (kw.includes(q)) {
        score += 40;
      }
    }

    for (const word of words) {
      for (const kw of entry.keywords) {
        if (kw === word) {
          score += 15;
        } else if (kw.includes(word)) {
          score += 8;
        } else if (word.includes(kw) && kw.length > 3) {
          score += 6;
        }
      }
    }

    if (entry.aliases) {
      for (const alias of entry.aliases) {
        if (q.includes(alias)) {
          score += 60;
        }
        for (const word of words) {
          if (word === alias) {
            score += 40;
          }
        }
      }
    }

    const responseText = entry.response.toLowerCase().replace(/<[^>]*>/g, "");
    for (const word of words) {
      if (word.length > 3 && responseText.includes(word)) {
        score += 2;
      }
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

  function generateResponse(query) {
    const matches = findBestMatches(query, 3);

    if (matches.length === 0 || matches[0].score < 5) {
      const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
      return FALLBACK_RESPONSES[idx];
    }

    let response = matches[0].entry.response;

    if (matches.length >= 2 && matches[1].score >= 12 && matches[1].entry.id !== matches[0].entry.id) {
      const relatedName = matches[1].entry.keywords[0].replace(/^\w/, (c) => c.toUpperCase());
      response += `<div class="info-box" style="margin-top:12px;"><strong>&#128204; Related:</strong> You might also want to ask about <strong>${relatedName}</strong> for more context.</div>`;
    }

    return response;
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

  // Hide mobile topics after first message is sent
  function hideMobileTopics() {
    if (mobileTopics) {
      mobileTopics.style.display = "none";
    }
  }

  // =============================================
  // SEND MESSAGE HANDLER
  // =============================================

  function sendMessage(text) {
    const query = text.trim();
    if (!query) return;

    // Hide mobile topic pills after first interaction
    hideMobileTopics();

    const userMsg = createMessageElement(query, true);
    messagesContainer.appendChild(userMsg);
    scrollToBottom();

    userInput.value = "";
    userInput.style.height = "auto";

    const typing = createTypingIndicator();
    messagesContainer.appendChild(typing);
    scrollToBottom();

    const delay = 400 + Math.random() * 600;
    setTimeout(() => {
      typing.remove();

      const response = generateResponse(query);
      const botMsg = createMessageElement("", false);
      botMsg.querySelector(".message-bubble").innerHTML = response;
      messagesContainer.appendChild(botMsg);
      scrollToBottom();
    }, delay);
  }

  // =============================================
  // EVENT LISTENERS
  // =============================================

  // Send button
  sendBtn.addEventListener("click", () => {
    sendMessage(userInput.value);
  });

  // Enter key
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(userInput.value);
    }
  });

  // Auto-resize textarea
  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  });

  // Sidebar open
  sidebarToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    openSidebar();
  });

  // Sidebar close button
  if (sidebarClose) {
    sidebarClose.addEventListener("click", () => {
      closeSidebar();
    });
  }

  // Overlay click closes sidebar
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
