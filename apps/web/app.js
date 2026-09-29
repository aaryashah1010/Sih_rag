(() => {
  const API_ROOT = "/api/v1";
  const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
  const tokenKey = "ipsakti.access_token";
  const refreshKey = "ipsakti.refresh_token";
  const sessionKey = "ipsakti.current_session";
  const jurisdictionKey = "ipsakti.jurisdiction";
  const fixtureIds = new Set(["active", "caution", "pass-caution", "abstain", "escalate", "escalation-confirmed", "components"]);
  let accessToken = sessionStorage.getItem(tokenKey);
  let refreshToken = sessionStorage.getItem(refreshKey);
  let currentSessionId = sessionStorage.getItem(sessionKey);
  let currentJurisdiction = sessionStorage.getItem(jurisdictionKey) || "INDIA";
  let lastChatRequest = null;
  let liveCitations = [];

  function uuid() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (!globalThis.crypto?.getRandomValues) throw new Error("Secure random generation is unavailable.");
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function storeTokens(tokens) {
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    sessionStorage.setItem(tokenKey, accessToken);
    sessionStorage.setItem(refreshKey, refreshToken);
  }

  function clearAuth() {
    accessToken = null;
    refreshToken = null;
    currentSessionId = null;
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(refreshKey);
    sessionStorage.removeItem(sessionKey);
    updateProfile(null);
    const sessions = document.getElementById("session-list");
    if (sessions) {
      const emptyState = document.createElement("li");
      emptyState.className = "rounded px-2.5 py-2 text-[11px] leading-relaxed text-slate-500";
      emptyState.textContent = "Sign in to load your saved conversations.";
      sessions.replaceChildren(emptyState);
    }
    const sessionCount = document.getElementById("session-count");
    if (sessionCount) sessionCount.textContent = "0";
  }

  function updateProfile(user) {
    const name = user?.display_name || user?.email || "Guest researcher";
    const email = user?.email || "Sign in to use the API";
    const menuEmail = user?.email || "Not signed in";
    ["profile-name", "menu-profile-name"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.textContent = name;
    });
    ["profile-email"].forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.textContent = email;
    });
    const menu = document.getElementById("menu-profile-email");
    if (menu) menu.textContent = menuEmail;
    const avatar = document.getElementById("profile-avatar");
    if (avatar) {
      avatar.textContent = name.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "G";
    }
    const accountAction = document.getElementById("profile-auth-action");
    if (accountAction) {
      const signedIn = Boolean(accessToken);
      accountAction.querySelector("span").textContent = signedIn ? "Sign out" : "Sign in";
      accountAction.onclick = signedIn ? handleSignOut : () => switchScenario("auth-login");
    }
  }

  async function rawRequest(path, options = {}, token = accessToken) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_ROOT}${path}`, { ...options, headers });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    return { response, data };
  }

  async function apiRequest(path, options = {}) {
    let result = await rawRequest(path, options);
    if (result.response.status === 401 && refreshToken && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/register") {
      const refreshed = await rawRequest("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }, null);
      if (refreshed.response.ok && refreshed.data?.access_token) {
        storeTokens(refreshed.data);
        result = await rawRequest(path, options);
      } else {
        clearAuth();
      }
    }
    if (!result.response.ok) {
      const error = new Error(result.data?.detail || "The request could not be completed.");
      error.code = result.data?.code || `HTTP_${result.response.status}`;
      error.status = result.response.status;
      throw error;
    }
    return result.data;
  }

  function ensureLivePanel() {
    let panel = document.getElementById("scenario-live");
    if (panel) return panel;
    const main = document.getElementById("chat-column");
    panel = document.createElement("section");
    panel.id = "scenario-live";
    panel.className = "flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-[760px] w-full mx-auto hidden";
    panel.setAttribute("aria-label", "Live conversation");
    const heading = document.createElement("h1");
    heading.className = "text-base font-semibold text-slate-900";
    heading.textContent = "Conversation";
    const messages = document.createElement("div");
    messages.id = "live-chat-messages";
    messages.className = "space-y-5";
    messages.setAttribute("role", "log");
    messages.setAttribute("aria-live", "polite");
    panel.append(heading, messages);
    main.insertBefore(panel, main.querySelector("footer"));
    return panel;
  }

  function switchScenario(scenarioId) {
    const aliases = { "auth-login": "auth", "auth-register": "auth" };
    const activePanel = aliases[scenarioId] || scenarioId;
    if (activePanel === "live") ensureLivePanel();
    const panels = ["new", "active", "caution", "pass-caution", "abstain", "escalate", "escalation-confirmed", "unavailable", "auth", "components", "live"];
    panels.forEach((id) => {
      const panel = id === "live" ? document.getElementById("scenario-live") : document.getElementById(`scenario-${id}`);
      if (panel) panel.classList.toggle("hidden", id !== activePanel);
    });
    document.querySelectorAll('[id^="btn-scen-"]').forEach((button) => {
      const selected = button.id === `btn-scen-${scenarioId}`;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("text-white", selected);
      button.classList.toggle("bg-[#0F4C42]", selected);
      button.classList.toggle("shadow-sm", selected);
    });
    const warning = document.getElementById("fixture-warning");
    if (warning) warning.classList.toggle("hidden", !fixtureIds.has(activePanel));
    if (activePanel === "new" && !demoMode) {
      liveCitations = [];
      renderEvidencePanel([]);
    }
    if (activePanel === "auth") window.setAuthTab(scenarioId === "auth-register" ? "register" : "login");
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar && window.innerWidth < 768) sidebar.classList.add("hidden");
    window.currentScenario = scenarioId;
  }

  function setAuthTab(tab) {
    const loginPane = document.getElementById("auth-login-pane");
    const registerPane = document.getElementById("auth-register-pane");
    const loginTab = document.getElementById("tab-login");
    const registerTab = document.getElementById("tab-register");
    if (!loginPane || !registerPane) return;
    const login = tab === "login";
    loginPane.classList.toggle("hidden", !login);
    registerPane.classList.toggle("hidden", login);
    loginTab?.classList.toggle("border-b-2", login);
    loginTab?.classList.toggle("border-[#0F4C42]", login);
    registerTab?.classList.toggle("border-b-2", !login);
    registerTab?.classList.toggle("border-[#0F4C42]", !login);
  }

  function readAuthForm(mode) {
    const register = mode === "register";
    const emailInput = document.getElementById(register ? "register-email" : "login-email");
    const passwordInput = document.getElementById(register ? "register-password" : "login-password");
    const feedback = document.getElementById(register ? "register-feedback" : "login-feedback");
    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    const valid = emailInput?.checkValidity() && password.length > 0 && (!register || password.length >= 10);
    if (feedback) feedback.textContent = "";
    if (!valid) {
      if (feedback) feedback.textContent = register
        ? "Enter a valid email and a password with at least 10 characters."
        : "Enter a valid email and password.";
      return null;
    }
    const payload = { email, password };
    if (register) payload.display_name = document.getElementById("register-name")?.value.trim() || null;
    return {
      endpoint: register ? "/auth/register" : "/auth/login",
      feedback,
      payload,
      button: document.querySelector(register ? '#auth-register-pane button[onclick*="handleAuth"]' : '#auth-login-pane button[onclick*="handleAuth"]'),
    };
  }

  async function handleAuth(mode) {
    const form = readAuthForm(mode);
    if (!form) return;
    if (form.button) form.button.disabled = true;
    try {
      const result = await apiRequest(form.endpoint, {
        method: "POST",
        body: JSON.stringify(form.payload),
      });
      storeTokens(result);
      currentSessionId = null;
      sessionStorage.removeItem(sessionKey);
      updateProfile(result.user);
      switchScenario("new");
      document.getElementById("prompt-textarea")?.focus();
      await refreshSessions();
    } catch (error) {
      if (form.feedback) form.feedback.textContent = `${error.message} (${error.code})`;
    } finally {
      if (form.button) form.button.disabled = false;
    }
  }

  async function handleSignOut() {
    if (refreshToken) {
      try {
        await rawRequest("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }, null);
      } catch {
        // Local credentials are cleared even if the server is unreachable.
      }
    }
    clearAuth();
    const dropdown = document.getElementById("user-menu-dropdown");
    dropdown?.classList.add("hidden");
    switchScenario("auth-login");
  }

  function setJurisdiction(value) {
    currentJurisdiction = value === "INTL" || value === "INTERNATIONAL" ? "INTERNATIONAL" : "INDIA";
    sessionStorage.setItem(jurisdictionKey, currentJurisdiction);
    const india = document.getElementById("jur-in");
    const international = document.getElementById("jur-intl");
    [india, international].forEach((button) => {
      const selected = button === (currentJurisdiction === "INDIA" ? india : international);
      button?.setAttribute("aria-pressed", String(selected));
      button?.classList.toggle("bg-white", selected);
      button?.classList.toggle("shadow-sm", selected);
      button?.classList.toggle("font-semibold", selected);
    });
    india?.querySelector("span")?.classList.toggle("hidden", currentJurisdiction !== "INDIA");
    const scope = document.getElementById("composer-scope");
    if (scope) scope.textContent = currentJurisdiction === "INDIA" ? "India jurisdiction" : "International jurisdiction";
  }

  function appendMessage(role, content) {
    const panel = ensureLivePanel();
    const messages = panel.querySelector("#live-chat-messages");
    const article = document.createElement("article");
    article.className = role === "USER"
      ? "ml-auto max-w-[88%] rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800"
      : "max-w-full rounded border border-slate-200 bg-white p-4 text-sm text-slate-800";
    const label = document.createElement("div");
    label.className = "mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500";
    label.textContent = role === "USER" ? "You" : "IP-SAKTI guidance";
    const body = document.createElement("p");
    body.className = "whitespace-pre-wrap leading-relaxed";
    body.textContent = content;
    article.append(label, body);
    messages.append(article);
    panel.scrollTop = panel.scrollHeight;
    return article;
  }

  function appendLoading() {
    const message = appendMessage("ASSISTANT", "Requesting evidence-backed guidance from the Node.js service…");
    message.dataset.loading = "true";
    return message;
  }

  function clearMessages() {
    const messages = document.getElementById("live-chat-messages");
    if (messages) messages.replaceChildren();
  }

  function citationPage(citation) {
    if (!citation.page_start) return "";
    if (citation.page_end && citation.page_end !== citation.page_start) {
      return `Pages ${citation.page_start}-${citation.page_end}`;
    }
    return `Page ${citation.page_start}`;
  }

  function renderEvidencePanel(citations) {
    const containers = [
      document.getElementById("evidence-drawer-content"),
      document.getElementById("mobile-sheet-content"),
    ].filter(Boolean);
    const normalized = Array.isArray(citations) ? citations : [];
    const count = document.getElementById("citation-count-badge");
    if (count) count.textContent = String(normalized.length);

    containers.forEach((container) => {
      container.replaceChildren();
      if (!normalized.length) {
        const empty = document.createElement("p");
        empty.className = "rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600";
        empty.textContent = "No citations are attached to this conversation yet. Evidence returned by the service will appear here.";
        container.append(empty);
        return;
      }

      normalized.forEach((citation) => {
        const item = document.createElement("article");
        item.className = "rounded border border-slate-200 bg-white p-3 space-y-2";
        const title = document.createElement("h4");
        title.className = "font-semibold text-xs leading-relaxed text-slate-900";
        title.textContent = [citation.id, citation.authority, citation.document, citation.locator].filter(Boolean).join(" · ") || "Source citation";
        item.append(title);

        const metadata = document.createElement("p");
        metadata.className = "text-[11px] leading-relaxed text-slate-600";
        metadata.textContent = [
          citation.version_date && `Version: ${citation.version_date}`,
          citationPage(citation),
          citation.retrieved_at && `Retrieved: ${citation.retrieved_at}`,
        ].filter(Boolean).join(" · ") || "The service did not provide additional version or page details.";
        item.append(metadata);

        const excerptText = citation.quoted_span || citation.excerpt;
        if (excerptText) {
          const excerpt = document.createElement("blockquote");
          excerpt.className = "border-l-2 border-teal-700 pl-2 text-[11px] leading-relaxed text-slate-700";
          excerpt.textContent = excerptText;
          item.append(excerpt);
        }
        if (citation.source_url && /^https?:\/\//i.test(citation.source_url)) {
          const link = document.createElement("a");
          link.href = citation.source_url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "inline-block text-xs font-medium text-teal-800 underline";
          link.textContent = "Open official source";
          item.append(link);
        }
        container.append(item);
      });
    });
  }

  function renderAnswer(response, loadingNode) {
    loadingNode?.remove();
    const panel = ensureLivePanel();
    const messages = panel.querySelector("#live-chat-messages");
    const card = document.createElement("article");
    card.className = "rounded border border-slate-200 bg-white shadow-sm";
    const header = document.createElement("div");
    header.className = "flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3";
    const decision = document.createElement("span");
    decision.className = "font-mono text-[11px] font-bold text-slate-800";
    decision.textContent = (response.decision || "RESULT").replaceAll("_", " ");
    const confidence = document.createElement("span");
    confidence.className = "text-[11px] text-slate-600";
    confidence.textContent = response.confidence == null
      ? "System confidence: not provided"
      : `System confidence: ${Math.round(response.confidence * 100)} / 100`;
    header.append(decision, confidence);

    const content = document.createElement("div");
    content.className = "space-y-4 p-4";
    const answer = document.createElement("p");
    answer.className = "whitespace-pre-wrap text-sm leading-relaxed text-slate-800";
    answer.textContent = response.answer || "The service returned no answer text.";
    content.append(answer);

    liveCitations = Array.isArray(response.citations) ? response.citations : [];
    renderEvidencePanel(liveCitations);
    if (liveCitations.length) {
      const evidence = document.createElement("section");
      evidence.className = "border-t border-slate-200 pt-3";
      const title = document.createElement("h2");
      title.className = "mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500";
      title.textContent = "Evidence returned by the service";
      evidence.append(title);
      const list = document.createElement("div");
      list.className = "space-y-2";
      liveCitations.forEach((citation) => {
        const item = document.createElement("details");
        item.className = "rounded border border-slate-200 bg-slate-50 px-3 py-2";
        const summary = document.createElement("summary");
        summary.className = "cursor-pointer text-xs font-medium text-teal-900";
        summary.textContent = [citation.id, citation.authority, citation.document, citation.locator].filter(Boolean).join(" · ");
        item.append(summary);
        const metadata = document.createElement("p");
        metadata.className = "mt-2 text-xs leading-relaxed text-slate-600";
        metadata.textContent = citationPage(citation) || "Page not supplied by the service.";
        item.append(metadata);
        if (citation.source_url && /^https?:\/\//i.test(citation.source_url)) {
          const link = document.createElement("a");
          link.href = citation.source_url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.className = "mt-2 inline-block text-xs font-medium text-teal-800 underline";
          link.textContent = "Open source";
          item.append(link);
        }
        list.append(item);
      });
      evidence.append(list);
      content.append(evidence);
    }

    if (Array.isArray(response.missing_information) && response.missing_information.length) {
      const missing = document.createElement("div");
      missing.className = "rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950";
      const heading = document.createElement("strong");
      heading.textContent = "Information still needed";
      const list = document.createElement("ul");
      list.className = "mt-1 list-disc pl-5";
      response.missing_information.forEach((fact) => {
        const item = document.createElement("li");
        item.textContent = fact;
        list.append(item);
      });
      missing.append(heading, list);
      content.append(missing);
    }

    const footer = document.createElement("p");
    footer.className = "border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500";
    footer.textContent = response.disclaimer || "Information and guidance only; not legal advice.";
    card.append(header, content, footer);
    messages.append(card);
    panel.scrollTop = panel.scrollHeight;
  }

  async function runChat(request, appendUserMessage) {
    switchScenario("live");
    if (appendUserMessage) appendMessage("USER", request.message);
    const loading = appendLoading();
    const sendButton = document.querySelector('button[onclick="handleSend()"]');
    if (sendButton) sendButton.disabled = true;
    try {
      if (!currentSessionId) {
        const session = await apiRequest("/sessions", {
          method: "POST",
          body: JSON.stringify({
            title: request.message.slice(0, 80),
            jurisdiction: currentJurisdiction,
            language: document.getElementById("lang-select")?.value || "en",
          }),
        });
        currentSessionId = session.id;
        sessionStorage.setItem(sessionKey, currentSessionId);
        request.session_id = currentSessionId;
      }
      const response = await apiRequest("/chat", {
        method: "POST",
        headers: { "Idempotency-Key": request.client_message_id },
        body: JSON.stringify({
          session_id: currentSessionId,
          client_message_id: request.client_message_id,
          message: request.message,
          jurisdiction: currentJurisdiction,
          language: document.getElementById("lang-select")?.value || "en",
          product_context: {},
        }),
      });
      renderAnswer(response, loading);
      lastChatRequest = null;
      document.getElementById("prompt-textarea").value = "";
      await refreshSessions();
    } catch (error) {
      loading.remove();
      showUnavailable(error);
    } finally {
      if (sendButton) sendButton.disabled = false;
    }
  }

  function showUnavailable(error) {
    const heading = document.getElementById("runtime-api-heading");
    const code = document.getElementById("runtime-api-code");
    const diagnostics = document.getElementById("runtime-api-message");
    if (heading) heading.textContent = "No evidence-backed answer was returned";
    const httpStatus = error.status ? ` · HTTP ${error.status}` : "";
    if (code) code.textContent = `${error.code || "REQUEST_FAILED"}${httpStatus}`;
    const requestStatus = document.getElementById("runtime-api-status");
    if (requestStatus) requestStatus.textContent = error.status ? `HTTP ${error.status}` : "Network error";
    const corpusStatus = document.getElementById("runtime-corpus-status");
    if (corpusStatus) corpusStatus.textContent = error.code === "RAG_CORPUS_UNAVAILABLE" ? "No active corpus" : "Not reported";
    const verifierStatus = document.getElementById("runtime-verifier-status");
    if (verifierStatus) verifierStatus.textContent = "Not reported";
    const corpusSync = document.getElementById("runtime-corpus-sync");
    if (corpusSync) corpusSync.textContent = "Not provided";
    if (diagnostics) diagnostics.textContent = `${error.message} Your question is preserved in the composer. No legal answer was generated.`;
    if (!demoMode) renderEvidencePanel([]);
    switchScenario("unavailable");
  }

  async function handleSend() {
    const textarea = document.getElementById("prompt-textarea");
    const message = textarea?.value.trim();
    if (!message) {
      textarea?.focus();
      return;
    }
    if (!accessToken) {
      switchScenario("auth-login");
      const feedback = document.getElementById("login-feedback");
      if (feedback) feedback.textContent = "Sign in to send your question. Your draft remains in the composer.";
      document.getElementById("login-email")?.focus();
      return;
    }
    lastChatRequest = { message, client_message_id: uuid() };
    await runChat(lastChatRequest, true);
  }

  async function retryConnection() {
    if (!lastChatRequest) {
      switchScenario("new");
      document.getElementById("prompt-textarea")?.focus();
      return;
    }
    await runChat(lastChatRequest, false);
  }

  async function refreshSessions() {
    if (!accessToken) return;
    try {
      const result = await apiRequest("/sessions?limit=20");
      const list = document.querySelector("#app-sidebar ul");
      if (!list) return;
      list.replaceChildren();
      const sessions = Array.isArray(result.items) ? result.items : [];
      const count = document.getElementById("session-count");
      if (count) count.textContent = String(sessions.length);
      if (!sessions.length) {
        const emptyState = document.createElement("li");
        emptyState.className = "rounded px-2.5 py-2 text-[11px] leading-relaxed text-slate-500";
        emptyState.textContent = "No saved conversations yet.";
        list.append(emptyState);
        return;
      }
      sessions.forEach((session) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "w-full rounded px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-100";
        button.textContent = session.title || "Research conversation";
        button.addEventListener("click", () => openSession(session.id));
        item.append(button);
        list.append(item);
      });
    } catch {
      return;
    }
  }

  async function openSession(sessionId) {
    try {
      currentSessionId = sessionId;
      sessionStorage.setItem(sessionKey, sessionId);
      const result = await apiRequest(`/sessions/${encodeURIComponent(sessionId)}/messages?limit=100`);
      clearMessages();
      (result.items || []).forEach((message) => appendMessage(message.role, message.content));
      switchScenario("live");
    } catch (error) {
      showUnavailable(error);
    }
  }

  function loadQuestion(type) {
    const examples = {
      "patent-nano": "I developed a new herbal formulation. What authoritative information would help assess possible patent and traditional-knowledge routes?",
      "ayurveda-aahara": "I am developing an Ayurveda nutrition product. What information is needed to understand whether food or medicine rules may be relevant?",
      "biodiversity-abs": "My product uses biological resources sourced in India. What facts and official sources should I review for a possible ABS route?",
      "cosmetic-herb": "I am developing a herbal skin-care product. What information helps distinguish a cosmetic route from other candidate routes?",
    };
    const textarea = document.getElementById("prompt-textarea");
    if (textarea) textarea.value = examples[type] || "";
    switchScenario("new");
    textarea?.focus();
  }

  function submitClassificationStep() {
    const selected = document.querySelector('input[name="claim_type"]:checked');
    const feedback = document.getElementById("classification-feedback");
    if (feedback) feedback.textContent = selected
      ? "This is an illustrative question. Describe your product in the composer to ask the connected service; this selection is not submitted as a classification."
      : "Choose an option or select Not sure.";
  }

  function confirmEscalation() {
    const alertBox = document.getElementById("escalation-confirmed-alert");
    if (!alertBox) return;
    alertBox.textContent = "Escalation is not connected to the API yet. Nothing was submitted or shared.";
    alertBox.classList.remove("hidden");
    alertBox.setAttribute("role", "status");
  }

  async function copyAnswerText() {
    const text = document.querySelector("#scenario-active .prose p")?.textContent || "";
    const feedback = document.getElementById("copy-feedback");
    try {
      await navigator.clipboard.writeText(text);
      if (feedback) feedback.textContent = "Brief copied.";
    } catch {
      if (feedback) feedback.textContent = "Clipboard access is unavailable in this browser.";
    }
  }

  function toggleUserDropdown() {
    document.getElementById("user-menu-dropdown")?.classList.toggle("hidden");
  }

  function toggleEvidenceDrawer() {
    if (window.innerWidth < 768) {
      document.getElementById("mobile-evidence-sheet")?.classList.remove("hidden");
      return;
    }
    document.getElementById("evidence-drawer")?.classList.toggle("hidden");
  }

  function toggleMobileEvidenceSheet() {
    document.getElementById("mobile-evidence-sheet")?.classList.add("hidden");
  }

  function toggleMobileSidebar() {
    document.getElementById("app-sidebar")?.classList.toggle("hidden");
  }

  function toggleDevice(device) {
    const frame = document.getElementById("viewport-frame");
    if (!frame) return;
    frame.style.maxWidth = device === "mobile" ? "390px" : "1536px";
    frame.style.margin = device === "mobile" ? "0 auto" : "0";
  }

  function openCitationDetail(citationId) {
    const citation = liveCitations.find((item) => item.id === citationId);
    if (citation) {
      if (citation.source_url && /^https?:\/\//i.test(citation.source_url)) {
        window.open(citation.source_url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const cardIds = { "cit-1": "cit-card-1", "cit-2": "cit-card-2", "cit-3": "cit-card-3", "cit-4": "cit-card-4" };
    const card = document.getElementById(cardIds[citationId]);
    if (!card) return;
    if (window.innerWidth < 768) {
      toggleMobileEvidenceSheet();
      return;
    }
    document.getElementById("evidence-drawer")?.classList.remove("hidden");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("ring-2", "ring-teal-600", "bg-teal-50");
    window.setTimeout(() => card.classList.remove("ring-2", "ring-teal-600", "bg-teal-50"), 2000);
  }

  window.switchScenario = switchScenario;
  window.setAuthTab = setAuthTab;
  window.handleAuth = handleAuth;
  window.handleSignOut = handleSignOut;
  window.setJurisdiction = setJurisdiction;
  window.handleSend = handleSend;
  window.retryConnection = retryConnection;
  window.refreshSessions = refreshSessions;
  window.loadQuestion = loadQuestion;
  window.submitClassificationStep = submitClassificationStep;
  window.confirmEscalation = confirmEscalation;
  window.copyAnswerText = copyAnswerText;
  window.toggleUserDropdown = toggleUserDropdown;
  window.toggleEvidenceDrawer = toggleEvidenceDrawer;
  window.toggleMobileEvidenceSheet = toggleMobileEvidenceSheet;
  window.toggleMobileSidebar = toggleMobileSidebar;
  window.toggleDevice = toggleDevice;
  window.openCitationDetail = openCitationDetail;

  const prototypeControls = document.getElementById("prototype-controls");
  prototypeControls?.classList.toggle("hidden", !demoMode);
  document.body.classList.toggle("demo-mode", demoMode);
  const fixtureNotice = document.getElementById("evidence-fixture-notice");
  const mobileFixtureNotice = document.getElementById("mobile-fixture-notice");
  fixtureNotice?.classList.toggle("hidden", !demoMode);
  mobileFixtureNotice?.classList.toggle("hidden", !demoMode);
  if (!demoMode) renderEvidencePanel([]);

  document.getElementById("prompt-textarea")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  });
  document.getElementById("lang-select")?.addEventListener("change", (event) => {
    sessionStorage.setItem("ipsakti.language", event.target.value);
  });
  setJurisdiction(currentJurisdiction);
  const savedLanguage = sessionStorage.getItem("ipsakti.language");
  if (savedLanguage && document.querySelector(`#lang-select option[value="${CSS.escape(savedLanguage)}"]`)) {
    document.getElementById("lang-select").value = savedLanguage;
  }
  document.getElementById("mobile-evidence-sheet")?.addEventListener("click", (event) => {
    if (event.target.id === "mobile-evidence-sheet") toggleMobileEvidenceSheet();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.getElementById("mobile-evidence-sheet")?.classList.add("hidden");
      document.getElementById("user-menu-dropdown")?.classList.add("hidden");
    }
  });
  if (accessToken) {
    apiRequest("/me").then(updateProfile).then(refreshSessions).catch(clearAuth);
  }
})();
