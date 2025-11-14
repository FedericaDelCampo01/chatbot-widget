(function () {
  // Evitar doble carga
  if (window.__CHATBOT_WIDGET_LOADED__) return;
  window.__CHATBOT_WIDGET_LOADED__ = true;

  const CONFIG = window.__CHATBOT_WIDGET_CONFIG || {};

  if (!CONFIG.backendUrl || !CONFIG.siteId) {
    console.warn(
      "[Chatbot Widget] Falta backendUrl o siteId en window.__CHATBOT_WIDGET_CONFIG"
    );
    return;
  }

  const position = CONFIG.position || "bottom-right";
  const welcomeMessage =
    CONFIG.welcomeMessage || "¡Hola! ¿En qué puedo ayudarte hoy?";
  const theme = CONFIG.theme || {};

  // Estado interno
  let isOpen = false;
  let container;
  let bubbleButton;
  let chatWindow;
  let messagesContainer;
  let inputField;
  let sendButton;
  let isSending = false;

  // Aplicar tema + variables por defecto
  function applyTheme(root) {
    const vars = {
      "--chat-accent": "#10b981",
      "--chat-accent-foreground": "#ffffff",
      "--chat-bg": "#ffffff",
      "--chat-foreground": "#0f172a",
      "--chat-radius": "14px",
      "--chat-input-font-size": "17px",
      ...theme,
    };

    Object.entries(vars).forEach(([key, value]) => {
      if (!value) return;
      root.style.setProperty(key, value);
    });
  }

  // Inyectar CSS del widget
  function injectStyles() {
    const style = document.createElement("style");
    style.setAttribute("data-chatbot-widget", "true");
    style.textContent = `
      .cbw-container {
        position: fixed;
        z-index: 999999;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      /* ==== BURBUJA ==== */
      .cbw-bubble {
        width: 58px;
        height: 58px;
        border-radius: 9999px;
        background: var(--chat-accent);
        color: var(--chat-accent-foreground);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 10px 25px rgba(15, 23, 42, 0.25);
        border: none;
        outline: none;
      }

      .cbw-bubble-icon {
        font-size: 28px;
      }

      /* ==== VENTANA ==== */
      .cbw-window {
        position: absolute;
        bottom: 80px;
        right: 0; /* abrir hacia la izquierda */
        width: 340px;
        max-height: 520px;
        background: var(--chat-bg);
        color: var(--chat-foreground);
        border-radius: 18px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.20);
      }

      .cbw-header {
        padding: 12px 16px;
        background: linear-gradient(135deg, var(--chat-accent), #0ca678);
        color: var(--chat-accent-foreground);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .cbw-header-title {
        font-size: 16px;
        font-weight: 700;
      }

      .cbw-header-close {
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        font-size: 22px;
        padding: 4px;
      }

      /* ==== MENSAJES ==== */
      .cbw-messages {
        padding: 12px 14px;
        flex: 1;
        overflow-y: auto;
        background: radial-gradient(circle at top, #f7f7f7, #ececec);
      }

      .cbw-message {
        max-width: 85%;
        margin-bottom: 10px;
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 16px;
        line-height: 1.45;
        white-space: pre-wrap;
      }

      /* Usuario */
      .cbw-message-user {
        margin-left: auto;
        background: var(--chat-accent);
        color: var(--chat-accent-foreground);
        border-bottom-right-radius: 4px;
      }

      /* Bot estilo BURBUJA */
      .cbw-message-bot {
        margin-right: auto;
        background: white;
        color: #0f172a;
        border: 1px solid rgba(0,0,0,0.08);
        border-bottom-left-radius: 4px;
      }

      /* ==== FOOTER ==== */
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
        border-radius: 9999px;
        border: 1px solid #d1d5db;
        padding: 10px 14px;
        font-size: var(--chat-input-font-size);
        resize: none;
        max-height: 80px;
        outline: none;
      }

      .cbw-input:focus {
        border-color: var(--chat-accent);
        box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.4);
      }

      .cbw-send-btn {
        border-radius: 9999px;
        border: none;
        background: var(--chat-accent);
        color: var(--chat-accent-foreground);
        padding: 10px 14px;
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 48px;
        height: 48px;
      }

      .cbw-send-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }

      /* ==== POSICIONES ==== */
      .cbw-pos-bottom-right {
        right: 20px;
        bottom: 20px;
      }
      .cbw-pos-bottom-left {
        left: 20px;
        bottom: 20px;
      }
    `;
    document.head.appendChild(style);
  }

  function getPositionClass() {
    switch (position) {
      case "bottom-left":
        return "cbw-pos-bottom-left";
      case "bottom-right":
      default:
        return "cbw-pos-bottom-right";
    }
  }

  // Crear widget
  function createWidget() {
    container = document.createElement("div");
    container.className = `cbw-container ${getPositionClass()}`;

    // Burbuja
    bubbleButton = document.createElement("button");
    bubbleButton.className = "cbw-bubble";
    bubbleButton.innerHTML = `<div class="cbw-bubble-icon">💬</div>`;

    // Ventana
    chatWindow = document.createElement("div");
    chatWindow.className = "cbw-window";
    chatWindow.style.display = "none";

    // Header
    const header = document.createElement("div");
    header.className = "cbw-header";

    const title = document.createElement("div");
    title.className = "cbw-header-title";
    title.textContent = "Asistente virtual";

    const close = document.createElement("button");
    close.className = "cbw-header-close";
    close.innerHTML = "&times;";

    header.appendChild(title);
    header.appendChild(close);

    // Mensajes
    messagesContainer = document.createElement("div");
    messagesContainer.className = "cbw-messages";

    // Footer
    const footer = document.createElement("div");
    footer.className = "cbw-footer";

    const wrapper = document.createElement("div");
    wrapper.className = "cbw-input-wrapper";

    inputField = document.createElement("textarea");
    inputField.className = "cbw-input";
    inputField.placeholder = "Escribe tu mensaje...";
    inputField.rows = 1;

    sendButton = document.createElement("button");
    sendButton.className = "cbw-send-btn";
    sendButton.innerHTML = `➤`;

    wrapper.appendChild(inputField);
    wrapper.appendChild(sendButton);

    footer.appendChild(wrapper);

    // Armar ventana
    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(footer);

    // Agregar todo
    container.appendChild(chatWindow);
    container.appendChild(bubbleButton);

    document.body.appendChild(container);

    applyTheme(container);

    // Eventos
    bubbleButton.addEventListener("click", toggle);
    close.addEventListener("click", toggle);
    sendButton.addEventListener("click", handleSend);

    inputField.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    addBotMessage(welcomeMessage);
  }

  function addMessage(text, from) {
    const el = document.createElement("div");
    el.className =
      "cbw-message " + (from === "user" ? "cbw-message-user" : "cbw-message-bot");
    el.textContent = text;
    messagesContainer.appendChild(el);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addUserMessage(t) {
    addMessage(t, "user");
  }

  function addBotMessage(t) {
    addMessage(t, "bot");
  }

  // Estado de envío
  function setSending(s) {
    isSending = s;
    sendButton.disabled = s;
  }

  function toggle() {
    isOpen = !isOpen;
    chatWindow.style.display = isOpen ? "flex" : "none";
  }

  // Enviar al backend
  function handleSend() {
    if (isSending) return;
    const value = inputField.value.trim();
    if (!value) return;

    addUserMessage(value);
    inputField.value = "";
    setSending(true);

    sendMessageToBackend(value)
      .then((txt) => addBotMessage(txt || "No pude procesar tu mensaje."))
      .catch(() => addBotMessage("Error al conectar con el servidor."))
      .finally(() => setSending(false));
  }

  async function sendMessageToBackend(message) {
    const payload = {
      site_id: CONFIG.siteId,
      message,
      page_url: window.location.href,
      timestamp: Date.now(),
    };

    const res = await fetch(CONFIG.backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

      // Toda respuesta viene de n8n y siempre es un array
    if (Array.isArray(data) && data.length > 0) {
      return data[0].output || "Sin respuesta válida del backend.";
    }

    // Si por alguna razón no vino array, fallback
    return data.output || data.message || "Sin respuesta.";

  }

  function init() {
    injectStyles();
    createWidget();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
