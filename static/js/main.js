// Deva AI — shared frontend utilities used across every page.

const Deva = (() => {
  function toastContainer() {
    let c = document.querySelector(".toast-container");
    if (!c) {
      c = document.createElement("div");
      c.className = "toast-container";
      document.body.appendChild(c);
    }
    return c;
  }

  function toast(message, type = "info", timeout = 4000) {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    toastContainer().appendChild(el);
    setTimeout(() => el.remove(), timeout);
  }

  async function api(path, options = {}) {
    const opts = { headers: { "Content-Type": "application/json" }, ...options };
    if (opts.body && typeof opts.body !== "string") opts.body = JSON.stringify(opts.body);
    const resp = await fetch(path, opts);
    let data = null;
    try { data = await resp.json(); } catch (e) { /* no body */ }
    if (!resp.ok) {
      const msg = (data && data.error) || `Request failed (${resp.status})`;
      throw new Error(msg);
    }
    return data;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Very small markdown-ish renderer: fenced code blocks + inline code + bold/italic + line breaks.
  function renderMarkdown(text) {
    if (!text) return "";
    let html = escapeHtml(text);
    html = html.replace(/```([a-zA-Z0-9]*)\n([\s\S]*?)```/g, (m, lang, code) => {
      return `<pre><code class="lang-${lang}">${code}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  async function refreshHealthBadge(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    try {
      const health = await api("/api/health");
      const o = health.ollama;
      if (o.ok && o.selected_model_available) {
        el.className = "badge badge-ok";
        el.innerHTML = `<span class="badge-dot"></span> Ollama connected · ${o.selected_model}`;
      } else if (o.ok && !o.selected_model_available) {
        el.className = "badge badge-warn";
        el.innerHTML = `<span class="badge-dot"></span> Ollama running, model '${o.selected_model}' not found`;
      } else {
        el.className = "badge badge-error";
        el.innerHTML = `<span class="badge-dot"></span> Ollama unreachable`;
      }
    } catch (e) {
      el.className = "badge badge-error";
      el.innerHTML = `<span class="badge-dot"></span> Backend unreachable`;
    }
  }

  function setupSidebar() {
    const toggle = document.querySelector("[data-sidebar-toggle]");
    const sidebar = document.querySelector(".sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        sidebar.classList.toggle("mobile-open");
      });
    }
  }

  document.addEventListener("DOMContentLoaded", setupSidebar);

  return { toast, api, escapeHtml, renderMarkdown, refreshHealthBadge };
})();
