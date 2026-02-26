/**
 * Barber Pro — Páginas Públicas por Subdomínio
 *
 * Cada barbearia tem sua própria página pública acessível em:
 *   slug.barberpro.com.br  (produção)
 *   localhost:3000/pub/slug (desenvolvimento)
 *
 * Roteamento: o middleware lê o header Host, extrai o slug
 * (primeiro segmento antes do primeiro ponto) e busca o tenant.
 * Em desenvolvimento, usa o path /pub/:slug para facilitar testes.
 */

import type { Express, Request, Response } from "express";
import cookieParser from "cookie-parser";
import * as db from "./db";
import { sendBookingConfirmationEmail, sendBarberNotificationEmail } from "./email";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(price: string | number): string {
  const n = typeof price === "string" ? parseFloat(price) : price;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function stars(avg: number | null): string {
  if (avg === null) return "";
  const full = Math.round(avg);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

// ─── Layout base da página pública ───────────────────────────────────────────
function buildTrackingScripts(settings: any): string {
  let scripts = "";
  if (settings?.ga4MeasurementId) {
    const gid = settings.ga4MeasurementId;
    scripts += `\n  <!-- Google Analytics 4 -->\n  <script async src="https://www.googletagmanager.com/gtag/js?id=${gid}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gid}');</script>`;
  }
  if (settings?.facebookPixelId) {
    const pid = settings.facebookPixelId;
    scripts += `\n  <!-- Facebook Pixel -->\n  <script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pid}');fbq('track','PageView');</script>\n  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pid}&ev=PageView&noscript=1"/></noscript>`;
  }
  return scripts;
}

function publicLayout(shopName: string, primaryColor: string, body: string, extraHead = "", settings?: any): string {
  const trackingScripts = buildTrackingScripts(settings);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(shopName)}</title>
  <meta name="description" content="Agende seu horário em ${escapeHtml(shopName)} de forma rápida e fácil." />
  ${extraHead}
  ${trackingScripts}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary: ${primaryColor};
      --primary-dim: ${primaryColor}22;
      --bg: #0A0A0A;
      --surface: #141414;
      --surface2: #1E1E1E;
      --border: #2A2A2A;
      --text: #F0EEE8;
      --muted: #888880;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
    a { color: var(--primary); text-decoration: none; }
    img { max-width: 100%; display: block; }

    /* Hero */
    .hero { position: relative; min-height: 420px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 40px 24px; text-align: center; overflow: hidden; }
    .hero-bg { position: absolute; inset: 0; background: linear-gradient(to bottom, #00000044 0%, #0A0A0ACC 60%, #0A0A0A 100%); z-index: 1; }
    .hero-img { position: absolute; inset: 0; object-fit: cover; width: 100%; height: 100%; opacity: 0.5; z-index: 0; }
    .hero-content { position: relative; z-index: 2; }
    .hero-logo { width: 90px; height: 90px; border-radius: 22px; object-fit: cover; border: 3px solid var(--primary); margin: 0 auto 16px; box-shadow: 0 8px 32px #00000066; }
    .hero-name { font-size: 32px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 8px; }
    .hero-address { font-size: 14px; color: var(--muted); margin-bottom: 24px; }
    .hero-cta { display: inline-block; background: var(--primary); color: #0A0A0A; font-size: 16px; font-weight: 800; padding: 14px 36px; border-radius: 50px; letter-spacing: 0.5px; }
    .hero-cta:hover { opacity: 0.9; }

    /* Seções */
    .section { padding: 48px 24px; max-width: 900px; margin: 0 auto; }
    .section-title { font-size: 20px; font-weight: 800; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; }
    .section-title::after { content: ""; flex: 1; height: 1px; background: var(--border); }

    /* Cards de serviço */
    .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .service-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; transition: border-color 0.2s; }
    .service-card:hover { border-color: var(--primary); }
    .service-thumb { width: 100%; height: 160px; object-fit: cover; background: var(--surface2); }
    .service-thumb-placeholder { width: 100%; height: 160px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 36px; }
    .service-body { padding: 16px; }
    .service-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .service-desc { font-size: 12px; color: var(--muted); margin-bottom: 12px; line-height: 1.5; }
    .service-meta { display: flex; align-items: center; justify-content: space-between; }
    .service-price { font-size: 18px; font-weight: 900; color: var(--primary); }
    .service-duration { font-size: 12px; color: var(--muted); }
    .service-rating { font-size: 12px; color: #FBBF24; margin-top: 6px; }

    /* Galeria */
    .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .gallery-img { width: 100%; height: 200px; object-fit: cover; border-radius: 12px; }

    /* Avaliações */
    .reviews-list { display: flex; flex-direction: column; gap: 14px; }
    .review-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
    .review-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .review-name { font-size: 14px; font-weight: 700; }
    .review-stars { color: #FBBF24; font-size: 14px; }
    .review-comment { font-size: 13px; color: var(--muted); line-height: 1.6; }
    .review-service { font-size: 11px; color: var(--primary); margin-top: 6px; }

    /* Equipe */
    .team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; }
    .team-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px 16px; text-align: center; }
    .team-photo { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; margin: 0 auto 12px; border: 2px solid var(--primary); background: var(--surface2); }
    .team-photo-placeholder { width: 72px; height: 72px; border-radius: 50%; background: var(--surface2); margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; border: 2px solid var(--primary); }
    .team-name { font-size: 14px; font-weight: 700; }
    .team-role { font-size: 11px; color: var(--muted); margin-top: 2px; }

    /* Info */
    .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .info-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
    .info-label { font-size: 11px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
    .info-value { font-size: 15px; font-weight: 600; }

    /* Footer */
    .footer { text-align: center; padding: 32px 24px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--border); margin-top: 32px; }
    .footer a { color: var(--primary); }

    /* CTA fixo mobile */
    .cta-fixed { display: none; position: fixed; bottom: 0; left: 0; right: 0; padding: 16px 24px; background: linear-gradient(to top, var(--bg) 60%, transparent); z-index: 50; }
    @media (max-width: 640px) {
      .cta-fixed { display: block; }
      .hero-cta { display: none; }
    }
    .cta-fixed-btn { display: block; background: var(--primary); color: #0A0A0A; font-size: 16px; font-weight: 800; padding: 16px; border-radius: 16px; text-align: center; }

    /* Empty state */
    .empty { text-align: center; padding: 40px; color: var(--muted); }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

// ─── Página principal da barbearia ───────────────────────────────────────────
async function renderShopPage(slug: string, res: Response) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) {
    res.status(404).send(`<!DOCTYPE html><html><body style="background:#0A0A0A;color:#F0EEE8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><h1 style="font-size:48px;margin-bottom:8px">404</h1><p style="color:#888">Barbearia não encontrada.</p><p style="margin-top:16px"><a href="https://barberpro.com.br" style="color:#C9A84C">Barber Pro</a></p></div></body></html>`);
    return;
  }

  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const barberList = await db.getAllBarbers(tenant.id);
  const serviceList = await db.getAllServicesWithMediaAndRatings(true, tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";

  // Galeria
  const galleryUrls: string[] = settings?.galleryUrls
    ? JSON.parse(settings.galleryUrls).filter(Boolean)
    : [];

  // Avaliações recentes (máx 6)
  const allReviewsRaw: Array<{ id: number; clientId: number; serviceId: number; rating: number; comment: string | null; createdAt: Date }> = [];
  for (const svc of serviceList.slice(0, 10)) {
    const r = await db.getReviewsByService(svc.id);
    allReviewsRaw.push(...r);
  }
  const recentReviews = allReviewsRaw
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Mapa serviceId → nome
  const serviceMap = Object.fromEntries(serviceList.map((s) => [s.id, s.name]));

  // Mapa clientId → nome
  const clientIds = [...new Set(recentReviews.map((r) => r.clientId))];
  const clientMap: Record<number, string> = {};
  for (const cid of clientIds) {
    const c = await db.getClientById(cid);
    if (c) clientMap[cid] = c.name;
  }

  // ── Seção: Serviços ──────────────────────────────────────────────────────
  const servicesHtml = serviceList.length === 0
    ? `<div class="empty">Nenhum serviço cadastrado ainda.</div>`
    : serviceList.map((s) => `
      <div class="service-card">
        ${s.thumbnailUrl
          ? `<img class="service-thumb" src="${escapeHtml(s.thumbnailUrl)}" alt="${escapeHtml(s.name)}" loading="lazy" />`
          : `<div class="service-thumb-placeholder">✂️</div>`
        }
        <div class="service-body">
          <div class="service-name">${escapeHtml(s.name)}</div>
          ${s.description ? `<div class="service-desc">${escapeHtml(s.description)}</div>` : ""}
          ${s.avgRating ? `<div class="service-rating">${stars(s.avgRating)} ${s.avgRating} (${s.reviewCount})</div>` : ""}
          <div class="service-meta">
            <span class="service-price">${formatPrice(s.price)}</span>
            <span class="service-duration">${formatDuration(s.durationMinutes)}</span>
          </div>
        </div>
      </div>
    `).join("");

  // ── Seção: Galeria ───────────────────────────────────────────────────────
  const galleryHtml = galleryUrls.length === 0 ? "" : `
    <div class="section">
      <div class="section-title">Galeria</div>
      <div class="gallery-grid">
        ${galleryUrls.map((url) => `<img class="gallery-img" src="${escapeHtml(url)}" alt="Foto do ambiente" loading="lazy" />`).join("")}
      </div>
    </div>
  `;

  // ── Seção: Equipe ────────────────────────────────────────────────────────
  const teamHtml = barberList.length === 0 ? "" : `
    <div class="section">
      <div class="section-title">Nossa Equipe</div>
      <div class="team-grid">
        ${barberList.map((b) => `
          <div class="team-card">
            ${(b as any).photoUrl
              ? `<img class="team-photo" src="${escapeHtml((b as any).photoUrl)}" alt="${escapeHtml(b.name)}" />`
              : `<div class="team-photo-placeholder">💈</div>`
            }
            <div class="team-name">${escapeHtml(b.name)}</div>
            <div class="team-role">${(b as any).role === "super_admin" ? "Proprietário" : "Barbeiro"}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  // ── Seção: Avaliações ────────────────────────────────────────────────────
  const reviewsHtml = recentReviews.length === 0 ? "" : `
    <div class="section">
      <div class="section-title">Avaliações</div>
      <div class="reviews-list">
        ${recentReviews.map((r) => `
          <div class="review-card">
            <div class="review-header">
              <span class="review-name">${escapeHtml(clientMap[r.clientId] ?? "Cliente")}</span>
              <span class="review-stars">${stars(r.rating)}</span>
            </div>
            ${r.comment ? `<div class="review-comment">${escapeHtml(r.comment)}</div>` : ""}
            <div class="review-service">Serviço: ${escapeHtml(serviceMap[r.serviceId] ?? "—")}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  // ── Seção: Informações ───────────────────────────────────────────────────
  const address = [settings?.address, settings?.addressNumber, settings?.addressComplement].filter(Boolean).join(", ");
  const infoHtml = `
    <div class="section">
      <div class="section-title">Informações</div>
      <div class="info-grid">
        ${settings?.phone ? `<div class="info-card"><div class="info-label">Telefone</div><div class="info-value">${escapeHtml(settings.phone)}</div></div>` : ""}
        ${settings?.whatsapp ? `<div class="info-card"><div class="info-label">WhatsApp</div><div class="info-value">${escapeHtml(settings.whatsapp)}</div></div>` : ""}
        ${address ? `<div class="info-card"><div class="info-label">Endereço</div><div class="info-value">${escapeHtml(address)}</div></div>` : ""}
        ${settings?.instagram ? `<div class="info-card"><div class="info-label">Instagram</div><div class="info-value"><a href="https://instagram.com/${escapeHtml(settings.instagram)}" target="_blank">@${escapeHtml(settings.instagram)}</a></div></div>` : ""}
      </div>
    </div>
  `;

  const agendamentoUrl = `/pub/${slug}/agendar`;
  const bannerUrl = (settings as any)?.bannerUrl;
  const bannerStyle = bannerUrl
    ? `style="background-image:url('${escapeHtml(bannerUrl)}');background-size:cover;background-position:center"`
    : settings?.logoUrl
      ? `style="background-image:url('${escapeHtml(settings.logoUrl)}');background-size:cover;background-position:center"`
      : `style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)"` ;

  const body = `
    <!-- Hero -->
    <div class="hero" ${bannerStyle}>
      <div class="hero-bg"></div>
      <div class="hero-content">
        ${settings?.logoUrl ? `<img class="hero-logo" src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings?.shopName ?? tenant.name)}" />` : `<div style="width:90px;height:90px;border-radius:22px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 16px;border:3px solid var(--primary)">💈</div>`}
        <div class="hero-name">${escapeHtml(settings?.shopName ?? tenant.name)}</div>
        ${address ? `<div class="hero-address">📍 ${escapeHtml(address)}</div>` : ""}
        <a href="${agendamentoUrl}" class="hero-cta">Agendar Horário</a>
      </div>
    </div>

    <!-- Serviços -->
    <div class="section">
      <div class="section-title">Serviços</div>
      <div class="services-grid">${servicesHtml}</div>
    </div>

    ${galleryHtml}
    ${teamHtml}
    ${reviewsHtml}
    ${infoHtml}

    <div class="footer">
      Powered by <a href="https://barberpro.com.br" target="_blank">Barber Pro</a>
    </div>

    <!-- CTA fixo mobile -->
    <div class="cta-fixed">
      <a href="${agendamentoUrl}" class="cta-fixed-btn">Agendar Horário</a>
    </div>
  `;

   res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

// ─── Rota de agendamentoe login Página de agendamento ────────────────────────────────────────────────────
async function renderBookingPage(slug: string, res: Response, req?: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const barberList = await db.getAllBarbers(tenant.id);
  const serviceList = await db.getAllServicesWithMediaAndRatings(true, tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";

  // Verificar se o cliente está logado via cookie de sessão
  const clientSessionRaw = req?.cookies?.[`client_session_${slug}`] ?? req?.cookies?.["client_session"];
  let loggedClient: { id: number; name: string; email: string } | null = null;
  if (clientSessionRaw) {
    try { loggedClient = JSON.parse(Buffer.from(clientSessionRaw, "base64").toString()); } catch {}
  }

  const hasMp = !!(settings as any)?.mercadoPagoAccessToken;
  const servicesOptions = serviceList.map((s) =>
    `<option value="${s.id}" data-duration="${s.durationMinutes}" data-price="${s.price}">${escapeHtml(s.name)} — ${formatPrice(s.price)} (${formatDuration(s.durationMinutes)})</option>`
  ).join("");
  const barbersOptions = barberList.map((b) =>
    `<option value="${b.id}">${escapeHtml(b.name)}</option>`
  ).join("");
  const firstBarberId = barberList[0]?.id ?? 1;

  const loginSection = loggedClient
    ? `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:13px;font-weight:700">${escapeHtml(loggedClient.name)}</div><div style="font-size:11px;color:var(--muted)">${escapeHtml(loggedClient.email)}</div></div>
        <a href="/pub/${slug}/logout" style="font-size:12px;color:var(--muted)">Sair</a>
       </div>`
    : `<div style="background:var(--primary-dim);border:1px solid var(--primary)44;border-radius:12px;padding:14px;margin-bottom:20px;font-size:13px;color:var(--muted)">
        💡 <a href="/pub/${slug}/login?redirect=agendar" style="color:var(--primary);font-weight:700">Faça login</a> ou <a href="/pub/${slug}/cadastro?redirect=agendar" style="color:var(--primary);font-weight:700">crie uma conta</a> para confirmar o agendamento.
       </div>`;

  const loggedClientJson = loggedClient ? JSON.stringify(loggedClient) : "null";
  const hasMpJson = JSON.stringify(hasMp);

  const body = `
    <div style="max-width:480px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
        <a href="/pub/${slug}" style="color:var(--muted);font-size:20px">←</a>
        <div>
          <div style="font-size:18px;font-weight:800">${escapeHtml(settings?.shopName ?? tenant.name)}</div>
          <div style="font-size:12px;color:var(--muted)">Agendamento Online</div>
        </div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px">
        <h2 style="font-size:18px;font-weight:800;margin-bottom:24px">Escolha seu horário</h2>
        <div style="margin-bottom:18px">
          <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">SERVIÇO</label>
          <select id="service-select" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px">
            <option value="">Selecione um serviço</option>
            ${servicesOptions}
          </select>
        </div>
        <div style="margin-bottom:18px">
          <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">PROFISSIONAL</label>
          <select id="barber-select" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px">
            <option value="">Qualquer profissional</option>
            ${barbersOptions}
          </select>
        </div>
        <div style="margin-bottom:18px">
          <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">DATA</label>
          <input type="date" id="date-input" min="${new Date().toISOString().split("T")[0]}"
            style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
        </div>
        <div id="slots-area" style="margin-bottom:20px">
          <div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">
            Selecione um serviço e uma data para ver os horários disponíveis.
          </div>
        </div>
        ${loginSection}
        <button id="confirm-btn" disabled
          style="width:100%;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:800;padding:16px;border-radius:14px;text-align:center;opacity:0.5;border:none;cursor:not-allowed">
          Confirmar Agendamento
        </button>
        <div id="success-msg" style="display:none;margin-top:16px;background:#22C55E22;border:1px solid #22C55E44;border-radius:12px;padding:16px;text-align:center;font-size:14px;color:#4ADE80"></div>
        <div id="error-msg" style="display:none;margin-top:16px;background:#EF444422;border:1px solid #EF444444;border-radius:12px;padding:14px;text-align:center;font-size:13px;color:#F87171"></div>
      </div>
    </div>
    <script>
      var SLUG = '${slug}';
      var LOGGED_CLIENT = ${loggedClientJson};
      var FIRST_BARBER = '${firstBarberId}';
      var serviceSelect = document.getElementById('service-select');
      var barberSelect = document.getElementById('barber-select');
      var dateInput = document.getElementById('date-input');
      var slotsArea = document.getElementById('slots-area');
      var confirmBtn = document.getElementById('confirm-btn');
      var successMsg = document.getElementById('success-msg');
      var errorMsg = document.getElementById('error-msg');
      var selectedSlot = null;

      function getSelectedDuration() {
        var opt = serviceSelect.options[serviceSelect.selectedIndex];
        return opt ? parseInt(opt.dataset.duration || '30') : 30;
      }

      async function loadSlots() {
        selectedSlot = null;
        updateConfirmBtn();
        if (!serviceSelect.value || !dateInput.value) {
          slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Selecione um serviço e uma data para ver os horários disponíveis.</div>';
          return;
        }
        slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Carregando horários...</div>';
        var barberId = barberSelect.value || FIRST_BARBER;
        var duration = getSelectedDuration();
        try {
          var r = await fetch('/pub-api/slots?barberId=' + barberId + '&date=' + dateInput.value + '&duration=' + duration);
          var slots = await r.json();
          if (!slots.length) {
            slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Nenhum horário disponível nesta data.</div>';
            return;
          }
          var html = '<div style="font-size:12px;color:var(--muted);margin-bottom:10px;letter-spacing:1px">HORÁRIOS DISPONÍVEIS</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
          slots.forEach(function(s) {
            html += '<button onclick="selectSlot(\'' + s.startTime + '\',\'' + s.endTime + '\',this)" style="padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-weight:600;cursor:pointer">' + s.startTime + '</button>';
          });
          html += '</div>';
          slotsArea.innerHTML = html;
        } catch(e) {
          slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:#F87171;font-size:13px">Erro ao carregar horários.</div>';
        }
      }

      function selectSlot(start, end, btn) {
        selectedSlot = { startTime: start, endTime: end };
        document.querySelectorAll('#slots-area button').forEach(function(b) {
          b.style.background = 'var(--surface2)';
          b.style.borderColor = 'var(--border)';
          b.style.color = 'var(--text)';
        });
        btn.style.background = 'var(--primary)';
        btn.style.borderColor = 'var(--primary)';
        btn.style.color = '#0A0A0A';
        updateConfirmBtn();
      }

      function updateConfirmBtn() {
        var ready = selectedSlot && serviceSelect.value && LOGGED_CLIENT;
        if (selectedSlot && serviceSelect.value && !LOGGED_CLIENT) {
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          confirmBtn.style.cursor = 'pointer';
          confirmBtn.textContent = 'Faça login para confirmar';
          confirmBtn.onclick = function() {
            window.location.href = '/pub/' + SLUG + '/login?redirect=agendar&service=' + serviceSelect.value + '&date=' + dateInput.value + '&barber=' + barberSelect.value + '&start=' + selectedSlot.startTime + '&end=' + selectedSlot.endTime;
          };
        } else if (ready) {
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          confirmBtn.style.cursor = 'pointer';
          confirmBtn.textContent = 'Confirmar Agendamento';
          confirmBtn.onclick = confirmBooking;
        } else {
          confirmBtn.disabled = true;
          confirmBtn.style.opacity = '0.5';
          confirmBtn.style.cursor = 'not-allowed';
          confirmBtn.textContent = 'Confirmar Agendamento';
          confirmBtn.onclick = null;
        }
      }

      var HAS_MP = ${hasMpJson};
      var lastAppointmentId = null;
      var lastServicePrice = null;

      function getSelectedPrice() {
        var opt = serviceSelect.options[serviceSelect.selectedIndex];
        return opt ? parseFloat(opt.dataset.price || '0') : 0;
      }

      async function confirmBooking() {
        if (!LOGGED_CLIENT || !selectedSlot || !serviceSelect.value) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirmando...';
        errorMsg.style.display = 'none';
        var barberId = barberSelect.value || FIRST_BARBER;
        try {
          var r = await fetch('/pub-api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: SLUG,
              clientId: LOGGED_CLIENT.id,
              barberId: parseInt(barberId),
              serviceId: parseInt(serviceSelect.value),
              date: dateInput.value,
              startTime: selectedSlot.startTime,
              endTime: selectedSlot.endTime,
            })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao confirmar agendamento');
          lastAppointmentId = data.id;
          lastServicePrice = getSelectedPrice();
          // Mostrar painel de pagamento ou mensagem de sucesso simples
          confirmBtn.style.display = 'none';
          if (HAS_MP && lastServicePrice > 0) {
            showPaymentPanel(data.id, lastServicePrice, dateInput.value, selectedSlot.startTime);
          } else {
            successMsg.innerHTML = '✅ Agendamento confirmado!<br><strong>' + dateInput.value + ' às ' + selectedSlot.startTime + '</strong><br><br><a href="/pub/' + SLUG + '" style="color:var(--primary)">← Voltar para a página da barbearia</a>';
            successMsg.style.display = 'block';
          }
        } catch(e) {
          errorMsg.textContent = e.message;
          errorMsg.style.display = 'block';
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirmar Agendamento';
        }
      }

      function showPaymentPanel(appointmentId, price, date, time) {
        var priceFormatted = 'R$ ' + price.toFixed(2).replace('.', ',');
        successMsg.innerHTML = [
          '<div style="text-align:center;margin-bottom:20px">',
            '<div style="font-size:32px;margin-bottom:8px">✅</div>',
            '<div style="font-size:16px;font-weight:800;color:#4ADE80">Agendamento confirmado!</div>',
            '<div style="font-size:13px;color:var(--muted);margin-top:4px">' + date + ' às ' + time + '</div>',
          '</div>',
          '<div style="font-size:13px;color:var(--muted);margin-bottom:16px;text-align:center">Como deseja pagar?</div>',
          '<div style="display:flex;flex-direction:column;gap:10px">',
            '<button onclick="payOnline(' + appointmentId + ',' + price + ')" id="btn-pay-online"',
              ' style="width:100%;padding:14px;background:var(--primary);color:#0A0A0A;font-size:15px;font-weight:800;border:none;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">',
              '💳 Pagar Online (' + priceFormatted + ')',
            '</button>',
            '<button onclick="payPix(' + appointmentId + ',' + price + ')" id="btn-pay-pix"',
              ' style="width:100%;padding:14px;background:var(--surface2);color:var(--text);font-size:15px;font-weight:700;border:1px solid var(--border);border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">',
              '📱 Pagar via Pix (' + priceFormatted + ')',
            '</button>',
            '<button onclick="payAtShop()"',
              ' style="width:100%;padding:14px;background:transparent;color:var(--muted);font-size:14px;font-weight:600;border:1px solid var(--border);border-radius:12px;cursor:pointer">',
              'Pagar na barbearia',
            '</button>',
          '</div>',
          '<div id="payment-status" style="margin-top:14px;text-align:center;font-size:13px"></div>',
        ].join('');
        successMsg.style.display = 'block';
      }

      function payAtShop() {
        successMsg.innerHTML = '✅ Agendamento confirmado!<br><strong>' + (lastAppointmentId ? '' : '') + '</strong><br><div style="font-size:13px;color:var(--muted);margin-top:8px">Você pagará na barbearia no dia do atendimento.</div><br><a href="/pub/' + SLUG + '" style="color:var(--primary)">← Voltar para a página da barbearia</a>';
      }

      async function payOnline(appointmentId, price) {
        var btn = document.getElementById('btn-pay-online');
        var status = document.getElementById('payment-status');
        btn.disabled = true;
        btn.textContent = 'Aguarde...';
        status.textContent = '';
        try {
          var r = await fetch('/pub-api/mp-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: SLUG, appointmentId: appointmentId, price: price })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao criar pagamento');
          window.location.href = data.checkoutUrl;
        } catch(e) {
          status.style.color = '#F87171';
          status.textContent = e.message;
          btn.disabled = false;
          btn.textContent = '💳 Pagar Online';
        }
      }

      async function payPix(appointmentId, price) {
        var btn = document.getElementById('btn-pay-pix');
        var status = document.getElementById('payment-status');
        btn.disabled = true;
        btn.textContent = 'Gerando QR Code...';
        status.textContent = '';
        try {
          var r = await fetch('/pub-api/pix-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: SLUG, appointmentId: appointmentId, price: price })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao gerar Pix');
          // Mostrar QR Code e código copia-e-cola
          document.getElementById('payment-status').innerHTML = [
            '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:20px;margin-top:8px">',
              '<div style="font-size:13px;font-weight:700;margin-bottom:12px">📱 Pague via Pix</div>',
              data.qrCodeBase64 ? '<img src="data:image/png;base64,' + data.qrCodeBase64 + '" style="width:180px;height:180px;display:block;margin:0 auto 12px" />' : '',
              '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Código Pix (copia e cola):</div>',
              '<div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:11px;word-break:break-all;color:var(--text);font-family:monospace">' + data.pixCode + '</div>',
              '<button onclick="navigator.clipboard.writeText(\'' + data.pixCode.replace(/'/g, "\\'") + '\').then(function(){this.textContent=\'✅ Copiado!\';}).bind(this)" style="margin-top:10px;width:100%;padding:10px;background:var(--primary);color:#0A0A0A;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-size:13px">Copiar código Pix</button>',
              '<div style="font-size:11px;color:var(--muted);margin-top:10px">Após o pagamento, seu agendamento será confirmado automaticamente.</div>',
            '</div>',
          ].join('');
          btn.style.display = 'none';
        } catch(e) {
          status.style.color = '#F87171';
          status.textContent = e.message;
          btn.disabled = false;
          btn.textContent = '📱 Pagar via Pix';
        }
      }

      serviceSelect.addEventListener('change', loadSlots);
      barberSelect.addEventListener('change', loadSlots);
      dateInput.addEventListener('change', loadSlots);

      // Pré-preencher campos via query string
      var params = new URLSearchParams(window.location.search);
      if (params.get('service')) serviceSelect.value = params.get('service');
      if (params.get('date')) dateInput.value = params.get('date');
      if (params.get('barber')) barberSelect.value = params.get('barber');
      if (params.get('service') && params.get('date')) loadSlots().then(function() {
        var startParam = params.get('start');
        var endParam = params.get('end');
        if (startParam && endParam) {
          setTimeout(function() {
            var btn = document.querySelector('#slots-area button[style*="' + startParam + '"]');
            if (!btn) {
              document.querySelectorAll('#slots-area button').forEach(function(b) {
                if (b.textContent.trim() === startParam) selectSlot(startParam, endParam, b);
              });
            }
          }, 500);
        }
      });
    </script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

// ─── Página de avaliaçãoastro do cliente ─────────────────────────────────────
async function renderLoginPage(slug: string, res: Response, req: Request, mode: "login" | "cadastro" = "login") {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
  const redirect = (req.query.redirect as string) ?? "";
  const service = (req.query.service as string) ?? "";
  const date = (req.query.date as string) ?? "";
  const barber = (req.query.barber as string) ?? "";
  const start = (req.query.start as string) ?? "";
  const end = (req.query.end as string) ?? "";
  const isLogin = mode === "login";
  const queryStr = `redirect=${redirect}&service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}`;
  const body = `
    <div style="max-width:400px;margin:0 auto;padding:48px 24px">
      <div style="text-align:center;margin-bottom:32px">
        ${settings?.logoUrl ? `<img src="${escapeHtml(settings.logoUrl)}" style="width:72px;height:72px;border-radius:18px;object-fit:cover;margin:0 auto 16px;border:2px solid var(--primary)" />` : `<div style="font-size:48px;margin-bottom:16px">💈</div>`}
        <div style="font-size:20px;font-weight:800">${escapeHtml(settings?.shopName ?? tenant.name)}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">${isLogin ? "Faça login para agendar" : "Crie sua conta gratuita"}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px">
        <!-- Botão Google OAuth -->
        <a href="/pub-api/oauth-start?slug=${slug}&redirect=${redirect}&service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;background:#fff;color:#1a1a1a;border:1.5px solid #e0e0e0;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
          Continuar com Google
        </a>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="flex:1;height:1px;background:var(--border)"></div>
          <span style="font-size:12px;color:var(--muted)">ou</span>
          <div style="flex:1;height:1px;background:var(--border)"></div>
        </div>
        <form id="auth-form">
          ${!isLogin ? `<div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">NOME COMPLETO</label>
            <input type="text" id="name-input" required placeholder="Seu nome" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>` : ""}
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">EMAIL</label>
            <input type="email" id="email-input" required placeholder="seu@email.com" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>
          <div style="margin-bottom:${!isLogin ? "16" : "24"}px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">SENHA</label>
            <input type="password" id="password-input" required placeholder="${isLogin ? "Sua senha" : "Mínimo 6 caracteres"}" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>
          ${!isLogin ? `<div style="margin-bottom:24px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">TELEFONE</label>
            <input type="tel" id="phone-input" required placeholder="(11) 99999-9999" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>` : ""}
          <button type="submit" id="submit-btn" style="width:100%;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:800;padding:16px;border-radius:14px;border:none;cursor:pointer">
            ${isLogin ? "Entrar" : "Criar Conta"}
          </button>
          <div id="auth-error" style="display:none;margin-top:12px;color:#F87171;font-size:13px;text-align:center"></div>
        </form>
        <div style="text-align:center;margin-top:20px;font-size:13px;color:var(--muted)">
          ${isLogin
            ? `Não tem conta? <a href="/pub/${slug}/cadastro?${queryStr}" style="color:var(--primary);font-weight:700">Criar conta gratuita</a>`
            : `Já tem conta? <a href="/pub/${slug}/login?${queryStr}" style="color:var(--primary);font-weight:700">Fazer login</a>`
          }
        </div>
      </div>
    </div>
    <script>
      document.getElementById('auth-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var btn = document.getElementById('submit-btn');
        var errEl = document.getElementById('auth-error');
        btn.disabled = true;
        btn.textContent = 'Aguarde...';
        errEl.style.display = 'none';
        var body = {
          email: document.getElementById('email-input').value,
          password: document.getElementById('password-input').value,
          slug: '${slug}'
        };
        ${!isLogin ? `body.name = document.getElementById('name-input').value; body.phone = document.getElementById('phone-input').value;` : ""}
        try {
          var r = await fetch('/pub-api/${isLogin ? "login" : "register"}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro de autenticação');
          var qs = '?service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}';
          window.location.href = '/pub/${slug}/' + ('${redirect}' || '') + qs;
        } catch(e) {
          errEl.textContent = e.message;
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = '${isLogin ? "Entrar" : "Criar Conta"}';
        }
      });
    </script>
  `;
   res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

// ─── Página de perfilAvaliação Pós-Atendimento ────────────────────────────────────
async function renderReviewPage(slug: string, appointmentIdStr: string, res: Response, req: Request) {
  const appointmentId = parseInt(appointmentIdStr);
  if (isNaN(appointmentId)) { res.status(400).send("ID de agendamento inválido."); return; }

  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
  const shopName = settings?.shopName ?? tenant.name;

  // Verificar se o agendamento existe e está concluído
  const appt = await db.getAppointmentById(appointmentId);
  if (!appt) { res.status(404).send("Agendamento não encontrado."); return; }
  if (appt.status !== "completed") {
    const body = `
      <div style="max-width:480px;margin:0 auto;padding:48px 24px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <div style="font-size:18px;font-weight:800;margin-bottom:8px">Avaliação Indisponível</div>
        <div style="font-size:14px;color:var(--muted)">Este agendamento ainda não foi concluído ou foi cancelado.</div>
        <a href="/pub/${slug}" style="display:inline-block;margin-top:24px;background:var(--primary);color:#0A0A0A;font-weight:700;padding:12px 28px;border-radius:50px">Voltar</a>
      </div>`;
    res.send(publicLayout(shopName, primaryColor, body, "", settings));
    return;
  }

  // Verificar se já foi avaliado
  const existingReview = await db.getReviewByAppointmentId(appointmentId);

  // Buscar dados do serviço e barbeiro
  const service = await db.getServiceById(appt.serviceId);
  const barber = await db.getBarberById(appt.barberId);
  const client = await db.getClientById(appt.clientId);

  // Verificar rating pré-selecionado via query string (link do e-mail)
  const preRating = req.query.rating ? parseInt(req.query.rating as string) : 0;

  if (existingReview) {
    // Já avaliado: mostrar agradecimento
    const starsHtml = "★".repeat(existingReview.rating) + "☆".repeat(5 - existingReview.rating);
    const body = `
      <div style="max-width:480px;margin:0 auto;padding:48px 24px;text-align:center">
        <div style="font-size:56px;margin-bottom:16px">🌟</div>
        <div style="font-size:22px;font-weight:900;margin-bottom:8px">Obrigado pela avaliação!</div>
        <div style="font-size:32px;color:#FBBF24;margin:16px 0">${starsHtml}</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:8px">Sua opinião é muito importante para nós.</div>
        ${existingReview.comment ? `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin:20px 0;font-size:14px;font-style:italic;color:var(--muted)">"​${escapeHtml(existingReview.comment)}"​</div>` : ""}
        <a href="/pub/${slug}" style="display:inline-block;margin-top:24px;background:var(--primary);color:#0A0A0A;font-weight:700;padding:12px 28px;border-radius:50px">Agendar novamente</a>
      </div>`;
    res.send(publicLayout(shopName, primaryColor, body, "", settings));
    return;
  }

  // Formatar data
  const [year, month, day] = appt.date.split("-");
  const dateStr = `${day}/${month}/${year}`;

  const body = `
    <div style="max-width:480px;margin:0 auto;padding:32px 24px">
      <!-- Cabeçalho -->
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-size:48px;margin-bottom:12px">✂️</div>
        <div style="font-size:22px;font-weight:900;margin-bottom:6px">Como foi seu atendimento?</div>
        <div style="font-size:14px;color:var(--muted)">Sua opinião ajuda outros clientes e melhora nosso serviço.</div>
      </div>

      <!-- Detalhes do atendimento -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:28px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px;letter-spacing:0.5px">ATENDIMENTO</div>
        <div style="font-size:16px;font-weight:800;margin-bottom:4px">${escapeHtml(service?.name ?? "Serviço")}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">com ${escapeHtml(barber?.name ?? "Profissional")}</div>
        <div style="font-size:12px;color:var(--muted)">📅 ${dateStr} às ${appt.startTime.slice(0, 5)}</div>
      </div>

      <!-- Formulário de avaliação -->
      <form id="reviewForm">
        <input type="hidden" name="appointmentId" value="${appointmentId}" />
        <input type="hidden" name="slug" value="${escapeHtml(slug)}" />

        <!-- Seleção de estrelas -->
        <div style="margin-bottom:24px">
          <div style="font-size:13px;color:var(--muted);margin-bottom:12px;letter-spacing:0.5px">SUA NOTA</div>
          <div id="starContainer" style="display:flex;gap:8px;justify-content:center">
            ${[1,2,3,4,5].map(n => `
              <button type="button" onclick="selectStar(${n})" id="star${n}"
                style="background:none;border:none;font-size:44px;cursor:pointer;padding:4px;transition:transform 0.1s;color:${n <= preRating ? '#FBBF24' : '#2A2A2A'}">
                ★
              </button>`).join("")}
          </div>
          <input type="hidden" name="rating" id="ratingInput" value="${preRating}" />
          <div id="ratingLabel" style="text-align:center;font-size:13px;color:var(--muted);margin-top:8px;height:18px">${preRating > 0 ? ["Péssimo","Ruim","Regular","Bom","Excelente!"][preRating-1] : ""}</div>
        </div>

        <!-- Comentário -->
        <div style="margin-bottom:24px">
          <label style="display:block;font-size:13px;color:var(--muted);margin-bottom:8px;letter-spacing:0.5px">COMENTÁRIO (OPCIONAL)</label>
          <textarea name="comment" placeholder="Conte como foi sua experiência..."
            style="width:100%;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;resize:vertical;min-height:100px;font-family:inherit"
          ></textarea>
        </div>

        <!-- Botão enviar -->
        <button type="submit" id="submitBtn"
          style="width:100%;padding:16px;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:800;border:none;border-radius:14px;cursor:pointer">
          Enviar Avaliação
        </button>
        <div id="errorMsg" style="display:none;color:#F87171;font-size:13px;text-align:center;margin-top:12px"></div>
      </form>
    </div>

    <script>
      const labels = ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Excelente!'];
      let currentRating = ${preRating};

      function selectStar(n) {
        currentRating = n;
        document.getElementById('ratingInput').value = n;
        document.getElementById('ratingLabel').textContent = labels[n-1];
        for (let i = 1; i <= 5; i++) {
          var btn = document.getElementById('star' + i);
          btn.style.color = i <= n ? '#FBBF24' : '#2A2A2A';
          btn.style.transform = i === n ? 'scale(1.2)' : 'scale(1)';
        }
      }

      // Inicializar estrelas pré-selecionadas
      if (currentRating > 0) selectStar(currentRating);

      document.getElementById('reviewForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        var rating = parseInt(document.getElementById('ratingInput').value);
        if (!rating || rating < 1) {
          document.getElementById('errorMsg').style.display = 'block';
          document.getElementById('errorMsg').textContent = 'Por favor, selecione uma nota.';
          return;
        }
        var btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        document.getElementById('errorMsg').style.display = 'none';
        try {
          var formData = new FormData(this);
          var data = Object.fromEntries(formData.entries());
          var r = await fetch('/pub-api/submit-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          var result = await r.json();
          if (!r.ok) throw new Error(result.error || 'Erro ao enviar avaliação');
          // Sucesso: mostrar mensagem
          document.getElementById('reviewForm').innerHTML = '<div style="text-align:center;padding:32px 0"><div style="font-size:56px;margin-bottom:16px">🌟</div><div style="font-size:22px;font-weight:900;margin-bottom:8px">Obrigado!</div><div style="font-size:14px;color:var(--muted);margin-bottom:24px">Sua avaliação foi registrada com sucesso.</div><a href="/pub/${slug}" style="display:inline-block;background:var(--primary);color:#0A0A0A;font-weight:700;padding:12px 28px;border-radius:50px">Agendar novamente</a></div>';
        } catch(err) {
          btn.disabled = false;
          btn.textContent = 'Enviar Avaliação';
          document.getElementById('errorMsg').style.display = 'block';
          document.getElementById('errorMsg').textContent = err.message;
        }
      });
    </script>
  `;
  res.send(publicLayout(shopName, primaryColor, body, "", settings));
}

// ─── Página de perfilas ─────────────────────────────────────────────
// ─── Página de Meus Agendamentos ─────────────────────────────────────────
async function renderMyAppointmentsPage(slug: string, res: Response, req: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";

  // Verificar sessão do cliente
  const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ?? req.cookies?.["client_session"];
  let loggedClient: { id: number; name: string; email: string } | null = null;
  if (clientSessionRaw) {
    try { loggedClient = JSON.parse(Buffer.from(clientSessionRaw, "base64").toString()); } catch {}
  }

  if (!loggedClient) {
    res.redirect(`/pub/${slug}/login?redirect=meus-agendamentos`);
    return;
  }

  // Buscar agendamentos do cliente com dados de serviço e barbeiro
  const rawAppts = await db.getClientAppointments(loggedClient.id);
  const allServices = await db.getAllServicesWithMediaAndRatings(true, tenant.id);
  const allBarbers = await db.getAllBarbers(tenant.id);
  const serviceMap = Object.fromEntries(allServices.map((s) => [s.id, s]));
  const barberMap = Object.fromEntries(allBarbers.map((b) => [b.id, b]));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rawAppts.filter((a: any) => a.date >= today && a.status !== "cancelled");
  const past = rawAppts.filter((a: any) => a.date < today || a.status === "cancelled");

  function statusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      scheduled: { label: "Agendado", color: "#3B82F6" },
      confirmed: { label: "Confirmado", color: "#22C55E" },
      in_progress: { label: "Em andamento", color: "#F59E0B" },
      completed: { label: "Concluído", color: "#6B7280" },
      cancelled: { label: "Cancelado", color: "#EF4444" },
      no_show: { label: "Não compareceu", color: "#EF4444" },
    };
    const s = map[status] ?? { label: status, color: "#6B7280" };
    return `<span style="background:${s.color}22;color:${s.color};font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;letter-spacing:0.5px">${s.label}</span>`;
  }

  function apptCard(a: any, canCancel: boolean) {
    const svc = serviceMap[a.serviceId];
    const barber = barberMap[a.barberId];
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:15px;font-weight:800;margin-bottom:4px">${escapeHtml(svc?.name ?? "Serviço")}</div>
            <div style="font-size:13px;color:var(--muted)">${barber ? escapeHtml(barber.name) : "Qualquer profissional"}</div>
          </div>
          ${statusBadge(a.status)}
        </div>
        <div style="display:flex;align-items:center;gap:16px;font-size:13px;color:var(--muted);margin-bottom:${canCancel ? "16" : "0"}px">
          <span>📅 ${a.date}</span>
          <span>🕐 ${a.startTime} – ${a.endTime}</span>
          ${svc ? `<span style="color:var(--primary);font-weight:700">${formatPrice(svc.price)}</span>` : ""}
        </div>
        ${canCancel ? `
          <button onclick="cancelAppt(${a.id}, this)" style="width:100%;padding:10px;background:transparent;border:1px solid #EF444466;border-radius:10px;color:#F87171;font-size:13px;font-weight:600;cursor:pointer">
            Cancelar agendamento
          </button>` : ""}
      </div>`;
  }

  const upcomingHtml = upcoming.length === 0
    ? `<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px">Nenhum agendamento próximo.<br><a href="/pub/${slug}/agendar" style="color:var(--primary);font-weight:700">Agendar agora</a></div>`
    : upcoming.map((a: any) => apptCard(a, ["scheduled", "confirmed"].includes(a.status))).join("");

  const pastHtml = past.length === 0
    ? `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">Nenhum agendamento anterior.</div>`
    : past.slice(0, 10).map((a: any) => apptCard(a, false)).join("");

  const body = `
    <div style="max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
        <div style="display:flex;align-items:center;gap:12px">
          <a href="/pub/${slug}" style="color:var(--muted);font-size:20px">←</a>
          <div>
            <div style="font-size:18px;font-weight:800">Meus Agendamentos</div>
            <div style="font-size:12px;color:var(--muted)">${escapeHtml(loggedClient.name)}</div>
          </div>
        </div>
        <a href="/pub/${slug}/agendar" style="background:var(--primary);color:#0A0A0A;font-size:13px;font-weight:800;padding:10px 16px;border-radius:10px">+ Novo</a>
      </div>

      <div style="font-size:14px;font-weight:800;margin-bottom:16px;color:var(--muted);letter-spacing:1px">PRÓXIMOS</div>
      ${upcomingHtml}

      ${past.length > 0 ? `
        <div style="font-size:14px;font-weight:800;margin:28px 0 16px;color:var(--muted);letter-spacing:1px">HISTÓRICO</div>
        ${pastHtml}
      ` : ""}
    </div>
    <script>
      async function cancelAppt(id, btn) {
        if (!confirm('Deseja cancelar este agendamento?')) return;
        btn.disabled = true;
        btn.textContent = 'Cancelando...';
        try {
          var r = await fetch('/pub-api/cancel-appointment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId: id, slug: '${slug}' })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao cancelar');
          window.location.reload();
        } catch(e) {
          alert(e.message);
          btn.disabled = false;
          btn.textContent = 'Cancelar agendamento';
        }
      }
    </script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

export function registerPublicRoutes(app: Express): void {
  app.use(cookieParser());
  // Rota de desenvolvimento: /pub/:slug
  app.get("/pub/:slug", async (req: Request, res: Response) => {
    await renderShopPage(req.params.slug, res);
  });

  app.get("/pub/:slug/agendar", async (req: Request, res: Response) => {
    await renderBookingPage(req.params.slug, res, req);
  });


  // ─── API REST pública (usada pelo JavaScript das páginas HTML) ─────────────
  // GET /pub-api/slots?barberId=1&date=2026-03-01&duration=30
  app.get("/pub-api/slots", async (req: Request, res: Response) => {
    try {
      const barberId = parseInt(req.query.barberId as string);
      const date = req.query.date as string;
      const duration = parseInt(req.query.duration as string) || 30;
      if (!barberId || !date) { res.status(400).json({ error: "barberId e date são obrigatórios" }); return; }
      const slots = await db.getAvailableSlots(barberId, date, duration);
      res.json(slots);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/login  { email, password, slug }
  app.post("/pub-api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) { res.status(400).json({ error: "Email e senha são obrigatórios" }); return; }
      const account = await db.getClientAccountByEmail(email);
      if (!account) { res.status(401).json({ error: "Email ou senha incorretos" }); return; }
      let bcrypt: any;
      try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
      const valid = bcrypt ? await bcrypt.compare(password, account.passwordHash) : password === account.passwordHash;
      if (!valid) { res.status(401).json({ error: "Email ou senha incorretos" }); return; }
      const client = await db.getClientById(account.clientId);
      if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
      const sessionData = Buffer.from(JSON.stringify({ id: client.id, name: client.name, email: client.email })).toString("base64");
      const slug = req.body.slug as string;
      res.cookie(`client_session_${slug}`, sessionData, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.cookie("client_session", sessionData, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.json({ id: client.id, name: client.name, email: client.email });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/register  { name, email, password, phone, slug }
  app.post("/pub-api/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password, phone, slug } = req.body;
      if (!name || !email || !password || !phone) { res.status(400).json({ error: "Todos os campos são obrigatórios" }); return; }
      if (password.length < 6) { res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" }); return; }
      const existing = await db.getClientAccountByEmail(email);
      if (existing) { res.status(409).json({ error: "Email já cadastrado. Faça login." }); return; }
      let bcrypt: any;
      try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
      const passwordHash = bcrypt ? await bcrypt.hash(password, 10) : password;
      const clientId = await db.createClient({ name, email, phone, isActive: true });
      await db.createClientAccount({ clientId, email, passwordHash });
      const client = await db.getClientById(clientId);
      const sessionData = Buffer.from(JSON.stringify({ id: clientId, name, email })).toString("base64");
      res.cookie(`client_session_${slug}`, sessionData, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.cookie("client_session", sessionData, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.json({ id: clientId, name, email });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/book  { slug, clientId, barberId, serviceId, date, startTime, endTime }
  app.post("/pub-api/book", async (req: Request, res: Response) => {
    try {
      const { slug, clientId, barberId, serviceId, date, startTime, endTime } = req.body;
      if (!clientId || !barberId || !serviceId || !date || !startTime || !endTime) {
        res.status(400).json({ error: "Dados incompletos para o agendamento" }); return;
      }
      const available = await db.checkSlotAvailability(barberId, date, startTime, endTime);
      if (!available) { res.status(409).json({ error: "Horário não disponível. Por favor, escolha outro horário." }); return; }
      const apptId = await db.createAppointment({ clientId, barberId, serviceId, date, startTime, endTime, status: "confirmed" } as any);
      // Buscar dados para notificações
      const client = await db.getClientById(clientId);
      const service = await db.getServiceById(serviceId);
      const barberData = await db.getBarberById(barberId);
      // Notificar barbeiro via push
      const pushToken = await db.getBarberPushToken(barberId);
      if (pushToken) {
        await db.sendExpoPushNotification(
          pushToken,
          "📅 Novo agendamento online",
          `${client?.name ?? "Cliente"} agendou ${service?.name ?? "Serviço"} para ${date} às ${startTime}`,
          { appointmentId: apptId, screen: "agenda", source: "web" },
          { channelId: "online-booking", badge: 1 }
        );
      }
      // Buscar dados comuns para e-mails
      const tenant2 = slug ? await db.getTenantBySlug(slug) : null;
      const settings2 = await db.getShopSettings();
      const shopName2 = settings2?.shopName ?? tenant2?.name ?? "Barbearia";
      // Enviar e-mail de confirmação ao cliente
      if (client?.email) {
        await sendBookingConfirmationEmail({
          clientName: client.name,
          clientEmail: client.email,
          shopName: shopName2,
          shopSlug: slug ?? "",
          serviceName: service?.name ?? "Serviço",
          barberName: barberData?.name ?? "Profissional",
          date,
          startTime,
          endTime,
          price: service ? `R$ ${parseFloat(service.price).toFixed(2).replace(".", ",")}` : undefined,
        });
      }
      // Enviar e-mail de notificação ao barbeiro
      if (barberData?.email) {
        await sendBarberNotificationEmail({
          barberName: barberData.name,
          barberEmail: barberData.email,
          clientName: client?.name ?? "Cliente",
          clientPhone: (client as any)?.phone ?? undefined,
          shopName: shopName2,
          serviceName: service?.name ?? "Serviço",
          date,
          startTime,
          endTime,
        });
      }
      res.json({ id: apptId, success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /pub-api/oauth-start — inicia o fluxo OAuth Google para clientes públicos
  app.get("/pub-api/oauth-start", (req: Request, res: Response) => {
    const slug = req.query.slug as string;
    const redirect = (req.query.redirect as string) ?? "";
    const service = (req.query.service as string) ?? "";
    const date = (req.query.date as string) ?? "";
    const barber = (req.query.barber as string) ?? "";
    const start = (req.query.start as string) ?? "";
    const end = (req.query.end as string) ?? "";
    const appId = process.env.VITE_APP_ID ?? "";
    const portalUrl = process.env.VITE_OAUTH_PORTAL_URL ?? "https://manus.im";
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://localhost:3000`;
    // Callback URL com parâmetros de contexto codificados no state
    const callbackUrl = `${apiBaseUrl}/pub-api/oauth-callback`;
    const stateData = Buffer.from(JSON.stringify({ slug, redirect, service, date, barber, start, end })).toString("base64");
    const redirectUri = callbackUrl;
    const state = Buffer.from(redirectUri).toString("base64");
    const loginUrl = new URL(`${portalUrl}/app-auth`);
    loginUrl.searchParams.set("appId", appId);
    loginUrl.searchParams.set("redirectUri", redirectUri);
    loginUrl.searchParams.set("state", state);
    loginUrl.searchParams.set("type", "signIn");
    loginUrl.searchParams.set("ctx", stateData);
    res.redirect(loginUrl.toString());
  });

  // GET /pub-api/oauth-callback — processa o retorno do OAuth e cria sessão de cliente público
  app.get("/pub-api/oauth-callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const ctx = req.query.ctx as string;
    if (!code || !state) { res.status(400).send("Parâmetros inválidos"); return; }
    try {
      // Decodificar contexto
      let slug = "", redirect = "", service = "", date = "", barber = "", start = "", end = "";
      if (ctx) {
        try {
          const parsed = JSON.parse(Buffer.from(ctx, "base64").toString());
          slug = parsed.slug ?? ""; redirect = parsed.redirect ?? "";
          service = parsed.service ?? ""; date = parsed.date ?? "";
          barber = parsed.barber ?? ""; start = parsed.start ?? ""; end = parsed.end ?? "";
        } catch {}
      }
      // Trocar code por token via SDK
      const { sdk } = await import("./_core/sdk.js");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.email) { res.status(400).send("E-mail não disponível na conta Google."); return; }
      // Buscar ou criar cliente público para o tenant
      let clientId: number | null = null;
      let clientName = userInfo.name ?? userInfo.email.split("@")[0];
      if (slug) {
        const tenant = await db.getTenantBySlug(slug);
        if (tenant) {
          // Buscar cliente existente pelo e-mail
          const allClients = await db.getAllClients(tenant.id);
          const existing = allClients.find((c: any) => c.email === userInfo.email);
          if (existing) {
            clientId = existing.id;
            clientName = existing.name;
          } else {
            // Criar novo cliente
            clientId = await db.createClient({
              name: clientName,
              email: userInfo.email,
              tenantId: tenant.id,
              isActive: true,
            } as any);
          }
        }
      }
      // Criar sessão de cliente público
      const sessionData = { id: clientId, name: clientName, email: userInfo.email };
      const sessionCookie = Buffer.from(JSON.stringify(sessionData)).toString("base64");
      const cookieKey = slug ? `client_session_${slug}` : "client_session";
      res.cookie(cookieKey, sessionCookie, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      // Redirecionar de volta
      const qs = `?service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}`;
      const target = redirect ? `/pub/${slug}/${redirect}${qs}` : `/pub/${slug}`;
      res.redirect(target);
    } catch (e: any) {
      console.error("[OAuth Público] Erro:", e);
      res.status(500).send("Erro ao processar login com Google. Tente novamente.");
    }
  });

  // GET /pub/:slug/login
  app.get("/pub/:slug/login", async (req: Request, res: Response) => {
    await renderLoginPage(req.params.slug, res, req, "login");
  });

  // GET /pub/:slug/cadastro
  app.get("/pub/:slug/cadastro", async (req: Request, res: Response) => {
    await renderLoginPage(req.params.slug, res, req, "cadastro");
  });

  // GET /pub/:slug/logout
  app.get("/pub/:slug/logout", (req: Request, res: Response) => {
    const slug = req.params.slug;
    res.clearCookie(`client_session_${slug}`);
    res.clearCookie("client_session");
    res.redirect(`/pub/${slug}`);
  });

  // GET /pub/:slug/meus-agendamentos
  app.get("/pub/:slug/meus-agendamentos", async (req: Request, res: Response) => {
    await renderMyAppointmentsPage(req.params.slug, res, req);
  });

  // POST /pub-api/cancel-appointment
  app.post("/pub-api/cancel-appointment", async (req: Request, res: Response) => {
    try {
      const { appointmentId, slug } = req.body;
      if (!appointmentId) { res.status(400).json({ error: "appointmentId é obrigatório" }); return; }
      // Verificar sessão do cliente
      const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ?? req.cookies?.["client_session"];
      if (!clientSessionRaw) { res.status(401).json({ error: "Não autenticado" }); return; }
      let loggedClient: { id: number } | null = null;
      try { loggedClient = JSON.parse(Buffer.from(clientSessionRaw, "base64").toString()); } catch {}
      if (!loggedClient) { res.status(401).json({ error: "Sessão inválida" }); return; }
      // Verificar que o agendamento pertence ao cliente
      const appts = await db.getClientAppointments(loggedClient.id);
      const appt = appts.find((a: any) => a.id === parseInt(appointmentId));
      if (!appt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
      if ((appt as any).status === "cancelled") { res.status(400).json({ error: "Agendamento já cancelado" }); return; }
      await db.updateAppointment(parseInt(appointmentId), { status: "cancelled" });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Avaliação Pós-Atendimento ─────────────────────────────────────────────
  // GET /pub/:slug/avaliar/:appointmentId — Página de avaliação
  app.get("/pub/:slug/avaliar/:appointmentId", async (req: Request, res: Response) => {
    await renderReviewPage(req.params.slug, req.params.appointmentId, res, req);
  });

  // POST /pub-api/submit-review — Enviar avaliação
  app.post("/pub-api/submit-review", async (req: Request, res: Response) => {
    try {
      const { appointmentId, slug, rating, comment } = req.body;
      if (!appointmentId || !rating) { res.status(400).json({ error: "appointmentId e rating são obrigatórios" }); return; }
      const ratingNum = parseInt(rating);
      if (ratingNum < 1 || ratingNum > 5) { res.status(400).json({ error: "Rating deve ser entre 1 e 5" }); return; }

      const appt = await db.getAppointmentById(parseInt(appointmentId));
      if (!appt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
      if (appt.status !== "completed") { res.status(400).json({ error: "Apenas agendamentos concluídos podem ser avaliados" }); return; }

      // Verificar se já existe avaliação
      const existing = await db.getReviewByAppointmentId(parseInt(appointmentId));
      if (existing) { res.status(400).json({ error: "Este agendamento já foi avaliado" }); return; }

      await db.createReview({
        clientId: appt.clientId,
        serviceId: appt.serviceId,
        appointmentId: parseInt(appointmentId),
        rating: ratingNum,
        comment: comment?.trim() || undefined,
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/mp-checkout — Criar preferência Checkout Pro do Mercado Pago
  app.post("/pub-api/mp-checkout", async (req: Request, res: Response) => {
    try {
      const { slug, appointmentId, price } = req.body;
      if (!slug || !appointmentId || !price) { res.status(400).json({ error: "Dados incompletos" }); return; }
      const tenant = await db.getTenantBySlug(slug);
      if (!tenant) { res.status(404).json({ error: "Barbearia não encontrada" }); return; }
      const settings = await db.getShopSettingsByTenantId(tenant.id);
      const accessToken = (settings as any)?.mercadoPagoAccessToken;
      if (!accessToken) { res.status(400).json({ error: "Pagamento online não configurado para esta barbearia" }); return; }
      const appt = await db.getAppointmentById(parseInt(appointmentId));
      if (!appt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
      const service = await db.getServiceById(appt.serviceId);
      const client = await db.getClientById(appt.clientId);
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://localhost:3000`;
      const mpClient = new MercadoPagoConfig({ accessToken });
      const preference = new Preference(mpClient);
      const pref = await preference.create({
        body: {
          items: [{
            id: String(appt.serviceId),
            title: service?.name ?? "Serviço de Barbearia",
            quantity: 1,
            unit_price: parseFloat(String(price)),
            currency_id: "BRL",
          }],
          payer: client?.email ? { email: client.email } : undefined,
          back_urls: {
            success: `${apiBaseUrl}/pub/${slug}/pagamento/sucesso`,
            failure: `${apiBaseUrl}/pub/${slug}/pagamento/falha`,
            pending: `${apiBaseUrl}/pub/${slug}/pagamento/pendente`,
          },
          auto_return: "approved",
          external_reference: JSON.stringify({
            appointmentId: parseInt(appointmentId),
            clientId: appt.clientId,
            barberId: appt.barberId,
            serviceId: appt.serviceId,
            servicePrice: parseFloat(String(price)),
            date: appt.date,
            startTime: appt.startTime,
            slug,
          }),
          notification_url: `${apiBaseUrl}/api/mp/webhook`,
        }
      });
      res.json({ checkoutUrl: pref.init_point ?? pref.sandbox_init_point });
    } catch (e: any) {
      console.error("[MP Checkout]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/pix-checkout — Criar pagamento Pix via Mercado Pago
  app.post("/pub-api/pix-checkout", async (req: Request, res: Response) => {
    try {
      const { slug, appointmentId, price } = req.body;
      if (!slug || !appointmentId || !price) { res.status(400).json({ error: "Dados incompletos" }); return; }
      const tenant = await db.getTenantBySlug(slug);
      if (!tenant) { res.status(404).json({ error: "Barbearia não encontrada" }); return; }
      const settings = await db.getShopSettingsByTenantId(tenant.id);
      const accessToken = (settings as any)?.mercadoPagoAccessToken;
      if (!accessToken) { res.status(400).json({ error: "Pagamento online não configurado para esta barbearia" }); return; }
      const appt = await db.getAppointmentById(parseInt(appointmentId));
      if (!appt) { res.status(404).json({ error: "Agendamento não encontrado" }); return; }
      const service = await db.getServiceById(appt.serviceId);
      const client = await db.getClientById(appt.clientId);
      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://localhost:3000`;
      const mpClient = new MercadoPagoConfig({ accessToken });
      const payment = new Payment(mpClient);
      const paymentData = await payment.create({
        body: {
          transaction_amount: parseFloat(String(price)),
          description: service?.name ?? "Serviço de Barbearia",
          payment_method_id: "pix",
          payer: {
            email: client?.email ?? "cliente@barberpro.com.br",
            first_name: client?.name?.split(" ")[0] ?? "Cliente",
            last_name: client?.name?.split(" ").slice(1).join(" ") || "Barber",
          },
          external_reference: JSON.stringify({
            appointmentId: parseInt(appointmentId),
            clientId: appt.clientId,
            barberId: appt.barberId,
            serviceId: appt.serviceId,
            servicePrice: parseFloat(String(price)),
            date: appt.date,
            startTime: appt.startTime,
            slug,
          }),
          notification_url: `${apiBaseUrl}/api/mp/webhook`,
        }
      });
      const txInfo = (paymentData as any).point_of_interaction?.transaction_data;
      res.json({
        pixCode: txInfo?.qr_code ?? "",
        qrCodeBase64: txInfo?.qr_code_base64 ?? "",
        paymentId: paymentData.id,
      });
    } catch (e: any) {
      console.error("[Pix Checkout]", e);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /pub/:slug/pagamento/sucesso — Página de retorno após pagamento aprovado
  app.get("/pub/:slug/pagamento/sucesso", async (req: Request, res: Response) => {
    const { slug } = req.params;
    const paymentId = req.query.payment_id as string;
    const tenant = await db.getTenantBySlug(slug);
    const settings = tenant ? await db.getShopSettingsByTenantId(tenant.id) : null;
    const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
    const shopName = settings?.shopName ?? tenant?.name ?? "Barbearia";
    // Processar pagamento aprovado usando as credenciais do tenant
    if (paymentId && tenant) {
      const accessToken = (settings as any)?.mercadoPagoAccessToken;
      if (accessToken) {
        try {
          const mpClient = new MercadoPagoConfig({ accessToken });
          const payment = new Payment(mpClient);
          const paymentData = await payment.get({ id: paymentId });
          if (paymentData.status === "approved" && paymentData.external_reference) {
            const ref = JSON.parse(paymentData.external_reference) as any;
            const service = await db.getServiceById(ref.serviceId);
            const price = String(ref.servicePrice);
            await db.createSale({
              clientId: ref.clientId, barberId: ref.barberId, appointmentId: ref.appointmentId,
              subtotal: price, discount: "0", total: price,
              paymentMethod: "mercado_pago", paymentStatus: "paid",
              mercadoPagoPaymentId: paymentId,
              notes: `Pago via Mercado Pago (web). ID: ${paymentId}`,
            } as any, [{ itemType: "service", itemId: ref.serviceId, itemName: service?.name ?? "Serviço", quantity: 1, unitPrice: price, total: price }]);
            await db.updateAppointment(ref.appointmentId, { status: "confirmed" } as any);
          }
        } catch (err) { console.error("[MP success page]", err); }
      }
    }
    const body = `
      <div style="max-width:400px;margin:80px auto;padding:32px 24px;text-align:center">
        <div style="font-size:64px;margin-bottom:16px">✅</div>
        <div style="font-size:22px;font-weight:900;margin-bottom:8px">Pagamento confirmado!</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:32px">Seu agendamento está confirmado. Até logo!</div>
        <a href="/pub/${slug}" style="display:inline-block;background:var(--primary);color:#0A0A0A;font-weight:800;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:15px">← Voltar para ${escapeHtml(shopName)}</a>
      </div>
    `;
    res.send(publicLayout(shopName, primaryColor, body, "", settings));
  });

  // GET /pub/:slug/pagamento/falha — Página de retorno após falha no pagamento
  app.get("/pub/:slug/pagamento/falha", async (req: Request, res: Response) => {
    const { slug } = req.params;
    const tenant = await db.getTenantBySlug(slug);
    const settings = tenant ? await db.getShopSettingsByTenantId(tenant.id) : null;
    const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
    const shopName = settings?.shopName ?? tenant?.name ?? "Barbearia";
    const body = `
      <div style="max-width:400px;margin:80px auto;padding:32px 24px;text-align:center">
        <div style="font-size:64px;margin-bottom:16px">❌</div>
        <div style="font-size:22px;font-weight:900;margin-bottom:8px">Pagamento não concluído</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:32px">Houve um problema com o pagamento. Tente novamente ou pague na barbearia.</div>
        <a href="/pub/${slug}/agendar" style="display:inline-block;background:var(--primary);color:#0A0A0A;font-weight:800;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:15px">Tentar novamente</a>
      </div>
    `;
    res.send(publicLayout(shopName, primaryColor, body, "", settings));
  });

  // GET /pub/:slug/pagamento/pendente — Página de retorno para pagamento pendente
  app.get("/pub/:slug/pagamento/pendente", async (req: Request, res: Response) => {
    const { slug } = req.params;
    const tenant = await db.getTenantBySlug(slug);
    const settings = tenant ? await db.getShopSettingsByTenantId(tenant.id) : null;
    const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
    const shopName = settings?.shopName ?? tenant?.name ?? "Barbearia";
    const body = `
      <div style="max-width:400px;margin:80px auto;padding:32px 24px;text-align:center">
        <div style="font-size:64px;margin-bottom:16px">⏳</div>
        <div style="font-size:22px;font-weight:900;margin-bottom:8px">Pagamento em análise</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:32px">Seu pagamento está sendo processado. Você receberá uma confirmação em breve.</div>
        <a href="/pub/${slug}" style="display:inline-block;background:var(--primary);color:#0A0A0A;font-weight:800;padding:14px 32px;border-radius:50px;text-decoration:none;font-size:15px">← Voltar para ${escapeHtml(shopName)}</a>
      </div>
    `;
    res.send(publicLayout(shopName, primaryColor, body, "", settings));
  });

  // Roteamento por subdomínio (produção: slug.barberpro.com.br)
  // O middleware lê o header Host e extrai o slug do primeiro segmento
  // Também suporta domínios customizados configurados pelo barbeiro
  app.use(async (req: Request, res: Response, next) => {
    const host = (req.headers.host ?? "").split(":")[0]; // remove porta se houver
    // Ignora caminhos de API e superadmin
    if (req.path.startsWith("/api/") || req.path.startsWith("/superadmin") || req.path.startsWith("/admin") || req.path.startsWith("/pub/") || req.path.startsWith("/pub-api/") || req.path.startsWith("/status")) return next();

    const parts = host.split(".");

    // 1º: Tentar resolver por domínio customizado (ex: agendamento.minhababarbearia.com.br)
    // Só busca se o host não parece ser o domínio principal do sistema
    const isSystemDomain = host.includes("manus.computer") || host.includes("barberpro.com.br") || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (!isSystemDomain) {
      const customTenant = await db.getTenantByCustomDomain(host);
      if (customTenant) {
        const { slug } = customTenant;
        if (req.path === "/" || req.path === "") {
          await renderShopPage(slug, res);
          return;
        } else if (req.path === "/agendar") {
          await renderBookingPage(slug, res, req);
          return;
        } else if (req.path.startsWith("/avaliar/")) {
          const appointmentId = req.path.split("/avaliar/")[1];
          await renderReviewPage(slug, appointmentId, res, req);
          return;
        } else if (req.path === "/meus-agendamentos") {
          await renderMyAppointmentsPage(slug, res, req);
          return;
        }
      }
    }

    // 2º: Tentar resolver por subdomínio (ex: minhababarbearia.barberpro.com.br)
    if (parts.length < 3) return next(); // não é subdomínio
    const slug = parts[0];
    // Ignora slugs de sistema
    if (["www", "api", "app", "admin", "superadmin"].includes(slug)) return next();

    if (req.path === "/" || req.path === "") {
      await renderShopPage(slug, res);
    } else if (req.path === "/agendar") {
      await renderBookingPage(slug, res, req);
    } else {
      next();
    }
  });
}
