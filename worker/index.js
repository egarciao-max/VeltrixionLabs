/**
 * Cloudflare Worker API para Oropezas.com
 * Endpoints:
 * - GET /api/health
 * - POST /api/contact
 * - POST /api/subscribe
 * - GET /api/articles
 * - POST /api/articles (opcional: con API_KEY)
 * - POST /api/ai
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({ ok: true, service: "oropezas-api", date: new Date().toISOString() });
      }

      if (url.pathname === "/api/contact" && request.method === "POST") {
        const body = await parseJson(request);
        validateContact(body);

        const item = {
          id: crypto.randomUUID(),
          ...body,
          createdAt: new Date().toISOString(),
          ip: request.headers.get("CF-Connecting-IP") || "unknown",
        };

        if (env.OROPEZAS_KV) {
          await env.OROPEZAS_KV.put(`contact:${item.id}`, JSON.stringify(item));
        }

        if (env.RESEND_API_KEY && env.CONTACT_TO_EMAIL && env.CONTACT_FROM_EMAIL) {
          await sendWithResend(env, {
            to: env.CONTACT_TO_EMAIL,
            subject: `[Contacto] ${item.subject}`,
            html: `<p><strong>Nombre:</strong> ${escapeHtml(item.name)}</p>
                   <p><strong>Email:</strong> ${escapeHtml(item.email)}</p>
                   <p><strong>Mensaje:</strong><br>${escapeHtml(item.message)}</p>`,
          });
        }

        return json({ ok: true, id: item.id, message: "Mensaje recibido" }, 201);
      }

      if (url.pathname === "/api/subscribe" && request.method === "POST") {
        const body = await parseJson(request);
        validateEmail(body?.email);

        const item = {
          id: crypto.randomUUID(),
          email: body.email.trim().toLowerCase(),
          source: (body.source || "web").slice(0, 120),
          createdAt: new Date().toISOString(),
        };

        if (env.OROPEZAS_KV) {
          await env.OROPEZAS_KV.put(`subscriber:${item.email}`, JSON.stringify(item));
        }

        return json({ ok: true, message: "Suscripción registrada" }, 201);
      }

      if (url.pathname === "/api/articles" && request.method === "GET") {
        const seed = [
          { slug: "article-open-cerrado", title: "SLP Open 2026 cierra con éxito total", category: "Deportes", date: "2026-04-05" },
          { slug: "article-mejia", title: "Nicolás Mejía se corona campeón", category: "Deportes", date: "2026-04-06" },
          { slug: "fraude-whatsapp", title: "Alerta por fraude de WhatsApp", category: "Tecnología", date: "2026-04-07" },
        ];
        return json({ ok: true, items: seed });
      }

      if (url.pathname === "/api/articles" && request.method === "POST") {
        requireApiKey(request, env.API_KEY);
        const body = await parseJson(request);
        if (!body?.slug || !body?.title) throw httpError(400, "slug y title son obligatorios");

        const article = {
          id: crypto.randomUUID(),
          slug: safeSlug(body.slug),
          title: String(body.title).slice(0, 180),
          category: String(body.category || "General").slice(0, 80),
          date: body.date || new Date().toISOString().slice(0, 10),
          excerpt: String(body.excerpt || "").slice(0, 320),
          body: String(body.body || "").slice(0, 20000),
        };

        if (!env.OROPEZAS_KV) throw httpError(500, "KV no está configurado");
        await env.OROPEZAS_KV.put(`article:${article.slug}`, JSON.stringify(article));
        return json({ ok: true, article }, 201);
      }

      if (url.pathname === "/api/ai" && request.method === "POST") {
        const body = await parseJson(request);
        const prompt = String(body?.prompt || "").trim();
        if (!prompt) throw httpError(400, "prompt es obligatorio");

        if (!env.GEMINI_API_KEY) {
          return json({ ok: true, mode: "mock", answer: "Gemini no configurado todavía." });
        }

        const answer = await askGemini(env.GEMINI_API_KEY, prompt);
        return json({ ok: true, answer });
      }
if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
  const body = await parseJson(request);

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    throw httpError(400, "Suscripción push inválida");
  }

  const subscription = {
    id: crypto.randomUUID(),
    endpoint: String(body.endpoint),
    keys: {
      p256dh: String(body.keys.p256dh),
      auth: String(body.keys.auth),
    },
    createdAt: new Date().toISOString(),
    userAgent: request.headers.get("User-Agent") || "unknown",
  };

  if (!env.OROPEZAS_KV) throw httpError(500, "KV no está configurado");

  await env.OROPEZAS_KV.put(
    `push:${subscription.id}`,
    JSON.stringify(subscription)
  );

  return json({ ok: true, id: subscription.id, message: "Push suscrito" }, 201);
}
      return json({ ok: false, error: "Not found" }, 404);
    } catch (err) {
      const status = err.status || 500;
      return json({ ok: false, error: err.message || "Internal error" }, status);
    }
  },
};

function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return res;
}
function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } }));
}
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

async function parseJson(request) {
  try { return await request.json(); }
  catch { throw httpError(400, "JSON inválido"); }
}

function validateEmail(email) {
  if (!email || typeof email !== "string") throw httpError(400, "email es obligatorio");
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  if (!ok) throw httpError(400, "email inválido");
}

function validateContact(body) {
  if (!body || typeof body !== "object") throw httpError(400, "payload inválido");
  for (const key of ["name", "email", "subject", "message"]) {
    if (!body[key] || typeof body[key] !== "string") throw httpError(400, `${key} es obligatorio`);
  }
  validateEmail(body.email);
  if (body.message.trim().length < 10) throw httpError(400, "message debe tener al menos 10 caracteres");
}

function requireApiKey(request, expected) {
  if (!expected) throw httpError(500, "API_KEY no está configurada");
  const provided = request.headers.get("x-api-key");
  if (provided !== expected) throw httpError(401, "No autorizado");
}

function safeSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function sendWithResend(env, { to, subject, html }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.CONTACT_FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) throw httpError(502, "Resend rechazó el envío");
}

async function askGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw httpError(502, "Gemini no respondió correctamente");
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta";
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
