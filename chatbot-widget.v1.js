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

  // Utilidad: aplicar tema
  function applyTheme(root) {
    const vars = {
      "--chat-accent": "#10b981",
      "--chat-accent-foreground": "#ffffff",
      "--chat-bg": "#ffffff",
      "--chat-foreground": "#0f172a",
      "--chat-radius": "12px",
      "--chat-input-font-size": "14px",
      ...theme,
    };

    Object.entries(vars).forEach(([key, value]) => {
      if (!value) return;
      root.style.setProperty(key, value);
    });
  }

  // Inyectar estilos CSS
  function injectStyles() {
    const style = document.createElement("style");
    style.setAttribute("data-chatbot-widget", "true");
    style.textContent = `
      .cbw-container {
        position: fixed;
        z-index: 999999;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      /* 💬 BURBUJA */
      .cbw-bubble {
        width: 56px;
        height: 56px;
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
        font-size: 26px;
      }

      /* 🪟 VENTANA DEL CHAT — ahora se abre hacia la IZQUIERDA */
      .cbw-window {
        position: absolute;
        bottom: 76px;
        width: 360px;
        max-height: 520px;
        max-width: calc(100vw - 60px);

        background: var(--chat-bg);
        color: var(--chat-foreground);
        border-radius: 16px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.35);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(148, 163, 184, 0.35);

        right: 0;   /* <<--- ESTA LÍNEA HACE QUE SE ABRA HACIA LA IZQUIERDA */
        left: auto;
      }

      /* HEADER */
      .cbw-header {
        padding: 12px 16px;
        background: linear-gradient(135deg, var(--chat-accent), #059669);
        color: var(--chat-accent-foreground);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .cbw-header-title {
        font-size: 15px;
        font-weight: 600;
      }

      .cbw-header-subtitle {
        font-size: 11px;
        opacity: 0.9;
      }

      .cbw-header-left {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .cbw-header-close {
        background: transparent;
        border: none;
        color: inherit;
        cursor: pointer;
        font-size: 22px;
        padding: 4px;
      }

      /* 🌤 MENSAJES con fondo nube */
      .cbw-messages {
        padding: 12px 14px;
        flex: 1;
        overflow-y: auto;
        background: radial-gradient(circle at top, #f4f4f5, #e5e7eb);
      }

      /* 💬 Estilo general de burbuja */
      .cbw-message {
        max-width: 85%;
        margin-bottom: 8px;
        padding: 10px 12px;
        border-radius: 14px;
        font-size: 14px;
        line-height: 1.45;
        white-space: pre-wrap;
      }

      /* 🟢 Mensaje del USUARIO */
      .cbw-message-user {
        margin-left: auto;
        background: var(--chat-accent);
        color: var(--chat-accent-foreground);
        border-bottom-right-radius: 2px;
      }

      /* ⚪ Mensaje del BOT – estilo “bubble” */
      .cbw-message-bot {
        margin-right: auto;
        background: #ffffff;
        color: #374151;
        border-radius: 14px;
        border: 1px solid #e5e7eb;
        border-bottom-left-radius: 4px;
      }

      /* FOOTER */
      .cbw-footer {
        padding: 10px;
        background: #fafafa;
        border-top: 1px solid #e5e7eb;
      }

      .cbw-input-wrapper {
        display: flex;
        gap: 6px;
        align-items: flex-end;
      }

      /* ✏️ INPUT */
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

      /* 📤 BOTÓN DE ENVIAR */
      .cbw-send-btn {
        border-radius: 9999px;
        border: none;
        background: var(--chat-accent);
        color: var(--chat-accent-foreground);
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        min-width: 40px;
      }

      .cbw-send-btn:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .cbw-send-icon {
        margin-left: 4px;
      }

      /* ⚡ Powered by */
      .cbw-powered {
        margin-top: 4px;
        font-size: 10px;
        text-align: right;
        color: #9ca3af;
      }

      /* 📍 Posiciones */
      .cbw-pos-bottom-right {
        right: 20px;
        bottom: 20px;
      }
      .cbw-pos-bottom-left {
        left: 20px;
        bottom: 20px;
      }
      .cbw-pos-top-right {
        right: 20px;
        top: 20px;
      }
      .cbw-pos-top-left {
        left: 20px;
        top: 20px;
      }

    `;
    document.head.appendChild(style);
  }

  function getPositionClass() {
    switch (position) {
      case "bottom-left":
        return "cbw-pos-bottom-left";
      case "top-right":
        return "cbw-pos-top-right";
      case "top-left":
        return "cbw-pos-top-left";
      case "bottom-right":
      default:
        return "cbw-pos-bottom-right";
    }
  }

  // Crear estructura del widget
  function createWidget() {
    container = document.createElement("div");
    container.className = `cbw-container ${getPositionClass()}`;

    // Burbuja
    bubbleButton = document.createElement("button");
    bubbleButton.className = "cbw-bubble";
    bubbleButton.setAttribute("aria-label", "Abrir chatbot");
    const bubbleIcon = document.createElement("div");
    bubbleIcon.className = "cbw-bubble-icon";
    bubbleIcon.textContent = "💬";
    bubbleButton.appendChild(bubbleIcon);

    // Ventana
    chatWindow = document.createElement("div");
    chatWindow.className = "cbw-window";
    chatWindow.style.display = "none";

    // Header
    const header = document.createElement("div");
    header.className = "cbw-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "cbw-header-left";
    const title = document.createElement("div");
    title.className = "cbw-header-title";
    title.textContent = "Asistente virtual";

    const subtitle = document.createElement("div");
    subtitle.className = "cbw-header-subtitle";
    subtitle.textContent = "Responde sobre tu sitio en tiempo real";

    headerLeft.appendChild(title);
    headerLeft.appendChild(subtitle);

    const closeBtn = document.createElement("button");
    closeBtn.className = "cbw-header-close";
    closeBtn.innerHTML = "&times;";

    header.appendChild(headerLeft);
    header.appendChild(closeBtn);

    // Zona de mensajes
    messagesContainer = document.createElement("div");
    messagesContainer.className = "cbw-messages";

    // Footer
    const footer = document.createElement("div");
    footer.className = "cbw-footer";

    const inputWrapper = document.createElement("div");
    inputWrapper.className = "cbw-input-wrapper";

    inputField = document.createElement("textarea");
    inputField.className = "cbw-input";
    inputField.rows = 1;
    inputField.placeholder = "Escribe tu mensaje...";

    sendButton = document.createElement("button");
    sendButton.className = "cbw-send-btn";
    sendButton.innerHTML = `<span>Enviar</span><span class="cbw-send-icon">➤</span>`;

    inputWrapper.appendChild(inputField);
    inputWrapper.appendChild(sendButton);

    const powered = document.createElement("div");
    powered.className = "cbw-powered";
    powered.textContent = "Chatbot by TuEmpresa";

    footer.appendChild(inputWrapper);
    footer.appendChild(powered);

    // Armar ventana
    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(footer);

    // Agregar todo
    container.appendChild(chatWindow);
    container.appendChild(bubbleButton);

    document.body.appendChild(container);

    // Tema
    applyTheme(container);

    // Eventos
    bubbleButton.addEventListener("click", toggle);
    closeBtn.addEventListener("click", close);
    sendButton.addEventListener("click", handleSend);

    inputField.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Mensaje de bienvenida
    addBotMessage(welcomeMessage);
  }

  function addMessage(text, from) {
    const msg = document.createElement("div");
    msg.className =
      "cbw-message " + (from === "user" ? "cbw-message-user" : "cbw-message-bot");
    msg.textContent = text;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addUserMessage(text) {
    addMessage(text, "user");
  }

  function addBotMessage(text) {
    addMessage(text, "bot");
  }

  function setSendingState(sending) {
    isSending = sending;
    sendButton.disabled = sending;
    sendButton.style.opacity = sending ? "0.7" : "1";
  }

  function handleSend() {
    if (isSending) return;
    const value = inputField.value.trim();
    if (!value) return;

    addUserMessage(value);
    inputField.value = "";
    setSendingState(true);

    sendMessageToBackend(value)
      .then((answer) => {
        addBotMessage(answer || "No pude procesar tu pregunta en este momento.");
      })
      .catch((err) => {
        console.error("[Chatbot Widget] Error al enviar mensaje:", err);
        addBotMessage("Ocurrió un error al conectar con el asistente.");
      })
      .finally(() => {
        setSendingState(false);
      });
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
      headers: {
        "Content-Type": "application/json",
        "X-Chatbot-Widget": "v1",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error("Respuesta HTTP no OK: " + res.status);
    }

    const data = await res.json().catch(() => ({}));
    // Ajustá esta clave según tu n8n (por ejemplo: data.answer, data.message, etc.)
    return data.answer || data.message || JSON.stringify(data);
  }

  function open() {
    if (!container) return;
    chatWindow.style.display = "flex";
    isOpen = true;
  }

  function close() {
    if (!container) return;
    chatWindow.style.display = "none";
    isOpen = false;
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  // Exponer API global
  window.ChatbotWidget = {
    open,
    close,
    toggle,
  };

  // Inicializar cuando el DOM esté listo
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
