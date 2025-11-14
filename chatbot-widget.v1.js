(function () {
  if (window.__CHATBOT_WIDGET_LOADED__) return;
  window.__CHATBOT_WIDGET_LOADED__ = true;

  const CONFIG = window.__CHATBOT_WIDGET_CONFIG || {};

  if (!CONFIG.backendUrl || !CONFIG.siteId) {
    console.warn("[Chatbot Widget] Falta backendUrl o siteId en window.__CHATBOT_WIDGET_CONFIG");
    return;
  }

  const position = CONFIG.position || "bottom-right";
  const welcomeMessage =
    CONFIG.welcomeMessage || "¡Hola! ¿En qué puedo ayudarte hoy?";
  const theme = CONFIG.theme || {};

  let isOpen = false;
  let container;
  let bubbleButton;
  let chatWindow;
  let messagesContainer;
  let inputField;
  let sendButton;
  let isSending = false;

  function applyTheme(root) {
    const vars = {
      "--chat-accent": "#10b981",
      "--chat-accent-foreground": "#ffffff",
      "--chat-bg": "#ffffff",
      "--chat-foreground": "#0f172a",
      "--chat-radius": "16px",
      "--chat-input-font-size": "15px",
      ...theme,
    };

    Object.entries(vars).forEach(([k, v]) => {
      root.style.setProperty(k, v);
    });
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.setAttribute("data-chatbot-widget", "true");
    style.textContent = `
      .cbw-container {
        position: fixed;
        z-index: 999999;
        font-family: system-ui, sans-serif;
      }

      .cbw-bubble {
        width: 60px;
        height: 60px;
        border-radius: 9999px;
        background: var(--chat-accent);
        color: var(--chat-accent-foreground);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
        border: none;
      }

      .cbw-bubble-icon {
        font-size: 30px;
      }

      .cbw-window {
        position: absolute;
        bottom: 80px;
        width: 350px;
        max-height: 520px;
        background: var(--chat-bg);
        color: var(--chat-foreground);
        border-radius: 20px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.25);
        animation: cbw-pop 0.2s ease-out;
      }

      @keyframes cbw-pop {
        from { opacity:0; transform:scale(0.9) }
        to { opacity:1; transform:scale(1) }
      }

      .cbw-header {
        padding: 12px 16px;
        background: var(--chat-accent);
        color: var(--chat-accent-foreground);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .cbw-header-title {
        font-size: 15px;
        font-weight: 600;
      }

      .cbw-header-close {
        background: transparent;
        border: none;
        color: white;
        font-size: 22px;
        cursor: pointer;
      }

      .cbw-messages {
        padding: 14px;
        flex: 1;
        overflow-y: auto;
        background: radial-gradient(circle at top, #f4f4f5, #e5e7eb);
      }

      .cbw-message {
        max-width: 85%;
        padding: 10px 14px;
        margin-bottom: 10px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.45;
        white-space: pre-wrap;
      }

      .cbw-message-user {
        margin-left: auto;
        background: var(--chat-accent);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .cbw-message-bot {
        margin-right: auto;
        background: white;
        color: #0f172a;
        border: 1px solid rgba(0,0,0,0.08);
        border-bottom-left-radius: 4px;
      }

      .cbw-footer {
        padding: 10px;
        background: #fafafa;
        border-top: 1px solid #e5e7eb;
      }

      .cbw-input-wrapper {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .cbw-input {
        flex: 1;
        border-radius: 20px;
        border: 1px solid #d1d5db;
        padding: 10px 14px;
        font-size: var(--chat-input-font-size);
      }

      .cbw-send-btn {
        border-radius: 50%;
        width: 44px;
        height: 44px;
        background: var(--chat-accent);
        color: white;
        border: none;
        cursor: pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 18px;
      }

      .cbw-pos-bottom-right { right: 20px; bottom: 20px; }
      .cbw-pos-bottom-left { left: 20px; bottom: 20px; }
      .cbw-pos-top-right { right: 20px; top: 20px; }
      .cbw-pos-top-left { left: 20px; top: 20px; }
    `;
    document.head.appendChild(style);
  }

  function getPositionClass() {
    switch (position) {
      case "bottom-left": return "cbw-pos-bottom-left";
      case "top-right": return "cbw-pos-top-right";
      case "top-left": return "cbw-pos-top-left";
      default: return "cbw-pos-bottom-right";
    }
  }

  function createWidget() {
    container = document.createElement("div");
    container.className = `cbw-container ${getPositionClass()}`;

    bubbleButton = document.createElement("button");
    bubbleButton.className = "cbw-bubble";
    bubbleButton.innerHTML = `<div class="cbw-bubble-icon">💬</div>`;

    chatWindow = document.createElement("div");
    chatWindow.className = "cbw-window";
    chatWindow.style.display = "none";

    const header = document.createElement("div");
    header.className = "cbw-header";
    header.innerHTML = `
      <div class="cbw-header-title">Asistente virtual</div>
      <button class="cbw-header-close">&times;</button>
    `;

    messagesContainer = document.createElement("div");
    messagesContainer.className = "cbw-messages";

    const footer = document.createElement("div");
    footer.className = "cbw-footer";

    const wrapper = document.createElement("div");
    wrapper.className = "cbw-input-wrapper";

    inputField = document.createElement("textarea");
    inputField.className = "cbw-input";
    inputField.rows = 1;
    inputField.placeholder = "Escribe tu mensaje...";

    sendButton = document.createElement("button");
    sendButton.className = "cbw-send-btn";
    sendButton.innerHTML = "➤";

    wrapper.appendChild(inputField);
    wrapper.appendChild(sendButton);
    footer.appendChild(wrapper);

    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(footer);

    container.appendChild(chatWindow);
    container.appendChild(bubbleButton);

    document.body.appendChild(container);

    applyTheme(container);

    bubbleButton.onclick = toggle;
    header.querySelector(".cbw-header-close").onclick = close;
    sendButton.onclick = handleSend;

    inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    addBotMessage(welcomeMessage);
  }

  function addMessage(text, from) {
    const div = document.createElement("div");
    div.className =
      "cbw-message " + (from === "user" ? "cbw-message-user" : "cbw-message-bot");
    div.textContent = text;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addUserMessage(t) { addMessage(t, "user"); }
  function addBotMessage(t) { addMessage(t, "bot"); }

  function setSendingState(s) {
    isSending = s;
    sendButton.disabled = s;
  }

  async function sendMessageToBackend(message) {
    const payload = {
      site_id: CONFIG.siteId,
      message,
      page_url: window.location.href,
      welcome_message: welcomeMessage,
      timestamp: Date.now(),
    };

    const res = await fetch(CONFIG.backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data = await res.json().catch(() => ({}));

    try {
      if (typeof data === "string") data = JSON.parse(data);
    } catch (_) {}

    return (
      data.output ||
      data.message ||
      data.answer ||
      data.text ||
      data.reply ||
      data.response ||
      Object.values(data)[0] ||
      "No pude procesar la respuesta."
    );
  }

  function toggle() { isOpen ? close() : open(); }
  function open() { chatWindow.style.display = "flex"; isOpen = true; }
  function close() { chatWindow.style.display = "none"; isOpen = false; }

  function handleSend() {
    if (isSending) return;

    const value = inputField.value.trim();
    if (!value) return;

    addUserMessage(value);
    inputField.value = "";
    setSendingState(true);

    sendMessageToBackend(value)
      .then((txt) => addBotMessage(txt))
      .catch(() => addBotMessage("Error al conectar con el asistente."))
      .finally(() => setSendingState(false));
  }

  function init() {
    injectStyles();
    createWidget();
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
