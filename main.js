(function () {
  const API_BASE = document.body?.dataset?.apiBase || "";

  function normalizeRootPath() {
    const script = document.querySelector('script[src*="main.js"]');
    if (!script) return "";
    const src = script.getAttribute("src") || "";
    return src.replace(/main\.js.*$/, "");
  }

  function fixPartialLinks(html, base) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;

    wrap.querySelectorAll('a[href^="/"]').forEach((a) => {
      a.href = `${base}${a.getAttribute("href").slice(1)}`;
    });
    wrap.querySelectorAll('img[src^="/"]').forEach((img) => {
      img.src = `${base}${img.getAttribute("src").slice(1)}`;
    });
    return wrap.innerHTML;
  }

  async function loadLayoutPartials() {
    const base = normalizeRootPath();
    const header = document.querySelector("header");
    const footer = document.querySelector("footer");

    if (header) {
      const html = await fetch(`${base}navbar.html`).then((r) => r.text());
      header.innerHTML = fixPartialLinks(html, base);
    }
    if (footer) {
      const html = await fetch(`${base}footer.html`).then((r) => r.text());
      footer.innerHTML = fixPartialLinks(html, base);
    }
  }

  async function postJson(path, payload) {
    const url = API_BASE ? `${API_BASE}${path}` : path;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error en servidor");
    return data;
  }

  function bindNewsletterForm() {
    const form = document.getElementById("newsletter-form");
    const status = document.getElementById("newsletter-status");
    if (!form || !status) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("newsletter-email")?.value?.trim();
      status.textContent = "Enviando...";
      try {
        await postJson("/api/subscribe", { email, source: location.pathname });
        form.reset();
        status.textContent = "¡Listo! Te suscribimos correctamente.";
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }

  function bindContactForm() {
    const form = document.getElementById("contact-form");
    const status = document.getElementById("contact-status");
    if (!form || !status) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById("contact-name")?.value?.trim(),
        email: document.getElementById("contact-email")?.value?.trim(),
        subject: document.getElementById("contact-subject")?.value?.trim(),
        message: document.getElementById("contact-message")?.value?.trim(),
      };

      status.textContent = "Enviando mensaje...";
      try {
        await postJson("/api/contact", payload);
        form.reset();
        status.textContent = "Mensaje enviado. Gracias por contactarnos.";
      } catch (err) {
        status.textContent = err.message;
      }
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/service-worker.js").catch(console.error);
  }

  async function subscribeToPush() {
    const btn = document.getElementById("push-btn");
    try {
      if (!("PushManager" in window)) throw new Error("Push no soportado en este navegador.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Debes permitir las notificaciones.");

      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        btn && (btn.textContent = "✅ Alertas activadas");
        return;
      }

      // Llave pública opcional. Si no existe, dejamos el flujo sin backend de push.
      if (!window.__VAPID_PUBLIC_KEY__) throw new Error("Push aún no configurado.");

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.__VAPID_PUBLIC_KEY__),
      });
      await postJson("/api/push/subscribe", sub);
      btn && (btn.textContent = "✅ Alertas activadas");
      btn && (btn.disabled = true);
    } catch (err) {
      alert(err.message || "No se pudo activar push");
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((ch) => ch.charCodeAt(0)));
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await loadLayoutPartials();
    } catch (e) {
      console.error("Error cargando header/footer", e);
    }

    bindNewsletterForm();
    bindContactForm();
    registerServiceWorker();

    document.addEventListener("click", (e) => {
      if (e.target && e.target.id === "push-btn") subscribeToPush();
    });
  });
})();
