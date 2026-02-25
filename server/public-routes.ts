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
import * as db from "./db";

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
function publicLayout(shopName: string, primaryColor: string, body: string, extraHead = ""): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(shopName)}</title>
  <meta name="description" content="Agende seu horário em ${escapeHtml(shopName)} de forma rápida e fácil." />
  ${extraHead}
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
  const serviceList = await db.getAllServicesWithMediaAndRatings(true);
  const primaryColor = "#C9A84C"; // cor padrão — futuramente vem de settings.primaryColor

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
  const bannerStyle = settings?.logoUrl
    ? `style="background-image:url('${escapeHtml(settings.logoUrl)}');background-size:cover;background-position:center"`
    : `style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)"`;

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

  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body));
}

// ─── Página de agendamento ────────────────────────────────────────────────────
async function renderBookingPage(slug: string, res: Response) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }

  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const barberList = await db.getAllBarbers(tenant.id);
  const serviceList = await db.getAllServicesWithMediaAndRatings(true);
  const primaryColor = "#C9A84C";

  const servicesOptions = serviceList.map((s) =>
    `<option value="${s.id}">${escapeHtml(s.name)} — ${formatPrice(s.price)} (${formatDuration(s.durationMinutes)})</option>`
  ).join("");

  const barbersOptions = barberList.map((b) =>
    `<option value="${b.id}">${escapeHtml(b.name)}</option>`
  ).join("");

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

        <div style="background:var(--surface2);border-radius:12px;padding:16px;margin-bottom:24px;text-align:center;color:var(--muted);font-size:13px" id="slots-area">
          Selecione um serviço e uma data para ver os horários disponíveis.
        </div>

        <div style="background:var(--primary-dim);border:1px solid var(--primary)44;border-radius:12px;padding:14px;margin-bottom:20px;font-size:13px;color:var(--muted)">
          💡 Para confirmar o agendamento, você precisará fazer login ou criar uma conta gratuita.
        </div>

        <a href="/pub/${slug}" id="confirm-btn"
          style="display:block;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:800;padding:16px;border-radius:14px;text-align:center;opacity:0.5;pointer-events:none">
          Confirmar Agendamento
        </a>
      </div>
    </div>

    <script>
      const dateInput = document.getElementById('date-input');
      const serviceSelect = document.getElementById('service-select');
      const confirmBtn = document.getElementById('confirm-btn');
      const slotsArea = document.getElementById('slots-area');

      function checkReady() {
        const ready = serviceSelect.value && dateInput.value;
        confirmBtn.style.opacity = ready ? '1' : '0.5';
        confirmBtn.style.pointerEvents = ready ? 'auto' : 'none';
        if (ready) {
          slotsArea.innerHTML = '<div style="color:var(--text);font-weight:600">✅ Horários disponíveis — faça login para confirmar</div>';
          confirmBtn.href = '/pub/${slug}/login?redirect=agendar&service=' + serviceSelect.value + '&date=' + dateInput.value + '&barber=' + document.getElementById('barber-select').value;
        }
      }

      serviceSelect.addEventListener('change', checkReady);
      dateInput.addEventListener('change', checkReady);
    </script>
  `;

  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body));
}

// ─── Registro das rotas ───────────────────────────────────────────────────────
export function registerPublicRoutes(app: Express): void {
  // Rota de desenvolvimento: /pub/:slug
  app.get("/pub/:slug", async (req: Request, res: Response) => {
    await renderShopPage(req.params.slug, res);
  });

  app.get("/pub/:slug/agendar", async (req: Request, res: Response) => {
    await renderBookingPage(req.params.slug, res);
  });

  // Roteamento por subdomínio (produção: slug.barberpro.com.br)
  // O middleware lê o header Host e extrai o slug do primeiro segmento
  app.use(async (req: Request, res: Response, next) => {
    const host = req.headers.host ?? "";
    // Ignora localhost, IPs, e domínios sem ponto duplo (ex: barberpro.com.br tem 2 pontos)
    const parts = host.split(".");
    if (parts.length < 3) return next(); // não é subdomínio
    const slug = parts[0];
    // Ignora slugs de sistema
    if (["www", "api", "app", "admin", "superadmin"].includes(slug)) return next();
    // Só intercepta rotas de página (não API)
    if (req.path.startsWith("/api/") || req.path.startsWith("/superadmin")) return next();

    if (req.path === "/" || req.path === "") {
      await renderShopPage(slug, res);
    } else if (req.path === "/agendar") {
      await renderBookingPage(slug, res);
    } else {
      next();
    }
  });
}
