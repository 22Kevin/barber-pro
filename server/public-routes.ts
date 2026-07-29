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
import { sql } from "drizzle-orm";
import { sendBookingConfirmationEmail, sendBarberNotificationEmail, sendPasswordResetEmail } from "./email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Sessão do cliente: assinada com HMAC (anti-forjamento) ────────────────────
const CLIENT_SESSION_SECRET = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "barber-pro-client-fallback";
const CLIENT_COOKIE_SECURE = process.env.NODE_ENV === "production";
function encodeClientSession(data: any): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", CLIENT_SESSION_SECRET).update(payload).digest("base64url");
  return payload + "." + sig;
}
function decodeClientSession(token?: string | null): any | null {
  try {
    if (!token) return null;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", CLIENT_SESSION_SECRET).update(payload).digest("base64url");
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch { return null; }
}
import { asaasEnabled, getOrCreateAsaasCustomer, createAsaasCharge, createAsaasSubscription, asaasDefaultDueDate, getAsaasPaymentStatus } from "./asaas";

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

// ─── Mapa de fontes por estilo ───────────────────────────────────────────────
const FONT_STYLE_CSS: Record<string, string> = {
  moderno:     '"Helvetica Neue", Arial, sans-serif',
  bold:        '"Helvetica Neue", Arial, sans-serif',
  classico:    'Georgia, "Times New Roman", serif',
  elegante:    'Palatino, "Palatino Linotype", Georgia, serif',
  minimalista: '"Helvetica Neue", Arial, sans-serif',
};
const FONT_STYLE_WEIGHT: Record<string, string> = {
  moderno:     '400',
  bold:        '900',
  classico:    '400',
  elegante:    '700',
  minimalista: '200',
};

function publicLayout(shopName: string, primaryColor: string, body: string, extraHead = "", settings?: any, slug = ""): string {
  const trackingScripts = buildTrackingScripts(settings);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(settings?.seoTitle || shopName)}</title>
  <meta name="description" content="${escapeHtml(settings?.seoDescription || `Agende seu horário em ${shopName} de forma rápida e fácil.`)}" />
  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Barber Pro" />
  ${slug ? `<meta property="og:url" content="https://usebarberpro.com/pub/${slug}" /><link rel="canonical" href="https://usebarberpro.com/pub/${slug}" />` : ""}
  <meta property="og:title" content="${escapeHtml(settings?.seoTitle || shopName)}" />
  <meta property="og:description" content="${escapeHtml(settings?.seoDescription || `Agende seu horário em ${shopName} de forma rápida e fácil.`)}" />
  ${settings?.seoImageUrl ? `<meta property="og:image" content="${escapeHtml(settings.seoImageUrl)}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />` : (settings?.bannerUrl ? `<meta property="og:image" content="${escapeHtml(settings.bannerUrl)}" />` : (settings?.logoUrl ? `<meta property="og:image" content="${escapeHtml(settings.logoUrl)}" />` : ""))}
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(settings?.seoTitle || shopName)}" />
  <meta name="twitter:description" content="${escapeHtml(settings?.seoDescription || `Agende seu horário em ${shopName} de forma rápida e fácil.`)}" />
  ${extraHead}
  ${trackingScripts}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary: ${primaryColor};
      --primary-dim: ${primaryColor}22;
      --bg: ${(settings as any)?.backgroundColor ?? '#0A0A0A'};
      --surface: #141414;
      --surface2: #1E1E1E;
      --border: #2A2A2A;
      --text: ${(() => { const bg = (settings as any)?.backgroundColor ?? '#0A0A0A'; const r=parseInt(bg.slice(1,3)||'0a',16), g=parseInt(bg.slice(3,5)||'0a',16), b=parseInt(bg.slice(5,7)||'0a',16); return (r*299+g*587+b*114)/1000 > 128 ? '#111111' : '#F0EEE8'; })()};
      --muted: ${(() => { const bg = (settings as any)?.backgroundColor ?? '#0A0A0A'; const r=parseInt(bg.slice(1,3)||'0a',16), g=parseInt(bg.slice(3,5)||'0a',16), b=parseInt(bg.slice(5,7)||'0a',16); return (r*299+g*587+b*114)/1000 > 128 ? '#555555' : '#888880'; })()};
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
    /* Estilo de texto escolhido pelo barbeiro */
    :root {
      --font-styled-family: ${FONT_STYLE_CSS[settings?.fontStyle ?? 'moderno'] ?? FONT_STYLE_CSS.moderno};
      --font-styled-weight: ${FONT_STYLE_WEIGHT[settings?.fontStyle ?? 'moderno'] ?? '400'};
    }
    .font-styled { font-family: var(--font-styled-family); font-weight: var(--font-styled-weight); }
    .font-styled-title { font-family: var(--font-styled-family); font-weight: var(--font-styled-weight); }
    a { color: var(--primary); text-decoration: none; }
    img { max-width: 100%; display: block; }

    /* Hero */
    .hero { position: relative; min-height: 420px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 40px 24px; text-align: center; overflow: hidden; }
    .hero-bg { position: absolute; inset: 0; background: linear-gradient(to bottom, #00000044 0%, #0A0A0ACC 60%, #0A0A0A 100%); z-index: 1; }
    .hero-img { position: absolute; inset: 0; object-fit: cover; width: 100%; height: 100%; opacity: 0.5; z-index: 0; }
    .hero-content { position: relative; z-index: 2; }
    .hero-logo { width: 90px; height: 90px; border-radius: 22px; object-fit: cover; border: 3px solid var(--primary); margin: 0 auto 16px; box-shadow: 0 8px 32px #00000066; }
    .hero-name { font-size: 32px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 8px; font-family: var(--font-styled-family, inherit); }
    .hero-address { font-size: 14px; color: var(--muted); margin-bottom: 24px; }
    .hero-cta { display: inline-block; background: var(--primary); color: #0A0A0A; font-size: 16px; font-weight: 800; padding: 14px 36px; border-radius: 50px; letter-spacing: 0.5px; font-family: var(--font-styled-family, inherit); }
    .hero-cta:hover { opacity: 0.9; }
    @keyframes pulse-green { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(74,222,128,0.4); } 50% { opacity:0.7; box-shadow:0 0 0 6px rgba(74,222,128,0); } }

    /* Seções */
    .section { padding: 48px 24px; max-width: 900px; margin: 0 auto; }
    .section-title { font-size: 20px; font-weight: 800; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; font-family: var(--font-styled-family, inherit); }
    .section-title::after { content: ""; flex: 1; height: 1px; background: var(--border); }

    /* Cards de serviço */
    .services-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .service-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; transition: border-color 0.2s, transform 0.25s cubic-bezier(0.4,0,0.2,1); will-change: transform; transform: translateZ(0); backface-visibility: hidden; }
    .service-card:hover { border-color: var(--primary); transform: scale(1.03) translateZ(0); }
    .service-thumb { width: 100%; height: 160px; object-fit: cover; background: var(--surface2); }
    .service-thumb-placeholder { width: 100%; height: 160px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 36px; }
    .service-body { padding: 16px; }
    .service-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .service-desc { font-size: 12px; color: var(--muted); margin-bottom: 12px; line-height: 1.5; }
    .service-meta { display: flex; align-items: center; justify-content: space-between; }
    .service-price { font-size: 18px; font-weight: 900; color: var(--primary); }
    .service-duration { font-size: 12px; color: var(--muted); }
    .service-rating { font-size: 12px; color: #FBBF24; margin-top: 6px; }

    /* Galeria — Carrossel */
    .gallery-carousel { position: relative; overflow: hidden; border-radius: 20px; background: var(--surface2); }
    .gallery-track { display: flex; transition: transform 0.45s cubic-bezier(.4,0,.2,1); will-change: transform; }
    .gallery-slide { flex: 0 0 100%; position: relative; }
    .gallery-slide img { width: 100%; height: 340px; object-fit: cover; display: block; cursor: zoom-in; }
    @media (max-width: 640px) { .gallery-slide img { height: 220px; } }
    .gallery-nav { position: absolute; top: 50%; transform: translateY(-50%); background: #00000088; border: 1px solid #ffffff22; color: #fff; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; z-index: 10; transition: background 0.2s; user-select: none; }
    .gallery-nav:hover { background: #000000cc; }
    .gallery-prev { left: 12px; }
    .gallery-next { right: 12px; }
    .gallery-dots { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 10; }
    .gallery-dot { width: 7px; height: 7px; border-radius: 50%; background: #ffffff55; cursor: pointer; transition: background 0.2s, transform 0.2s; }
    .gallery-dot.active { background: #fff; transform: scale(1.3); }
    .gallery-counter { position: absolute; top: 12px; right: 14px; background: #00000088; color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; z-index: 10; }
    /* Lightbox */
    .lightbox-overlay { display: none; position: fixed; inset: 0; background: #000000ee; z-index: 9999; align-items: center; justify-content: center; }
    .lightbox-overlay.open { display: flex; }
    .lightbox-img { max-width: 94vw; max-height: 90vh; border-radius: 12px; object-fit: contain; box-shadow: 0 20px 80px #000; }
    .lightbox-close { position: fixed; top: 20px; right: 24px; color: #fff; font-size: 32px; cursor: pointer; line-height: 1; opacity: 0.8; }
    .lightbox-close:hover { opacity: 1; }
    .lightbox-nav { position: fixed; top: 50%; transform: translateY(-50%); background: #ffffff22; border: none; color: #fff; border-radius: 50%; width: 48px; height: 48px; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .lightbox-nav:hover { background: #ffffff44; }
    .lightbox-lprev { left: 16px; }
    .lightbox-lnext { right: 16px; }

    /* Painel de Abas */
    .tabs-section { padding: 0 24px 48px; max-width: 900px; margin: 0 auto; }
    .tabs-header { display: flex; gap: 0; border-bottom: 2px solid var(--border); margin-bottom: 28px; overflow-x: auto; scrollbar-width: none; }
    .tabs-header::-webkit-scrollbar { display: none; }
    .tab-btn { padding: 12px 22px; font-size: 14px; font-weight: 800; color: var(--muted); background: none; border: none; border-bottom: 3px solid transparent; margin-bottom: -2px; cursor: pointer; white-space: nowrap; transition: color 0.2s, border-color 0.2s; letter-spacing: 0.3px; }
    .tab-btn.active { color: var(--text); border-bottom-color: var(--primary); }
    .tab-btn:hover:not(.active) { color: var(--text); }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    /* Grid de cards dentro das abas */
    .tab-cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: start; }
    @media (max-width: 700px) { .tab-cards-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
    @media (max-width: 380px) { .tab-cards-grid { grid-template-columns: 1fr; gap: 12px; } }

    /* Card unificado — 1 card = 1 elemento completo */
    .tab-card { background: #1a2035; border: 1px solid rgba(155,48,255,0.15); border-radius: 16px; overflow: hidden; transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), border-color 0.2s ease, box-shadow 0.25s cubic-bezier(0.4,0,0.2,1); will-change: transform; transform: translateZ(0); backface-visibility: hidden; cursor: pointer; display: flex !important; flex-direction: column !important; text-decoration: none; color: inherit; height: 100%; }
    .tab-card:hover { border-color: rgba(155,48,255,0.5); transform: scale(1.03) translateZ(0); box-shadow: 0 8px 32px rgba(155,48,255,0.15); }

    /* Imagem do card */
    .tab-card-img-wrap { position: relative; width: 100%; aspect-ratio: 4/3; overflow: hidden; flex-shrink: 0; }
    .tab-card-img-wrap::after { content: ""; position: absolute; bottom: 0; left: 0; right: 0; height: 50%; background: linear-gradient(to bottom, transparent, #1a2035); pointer-events: none; }
    .tab-card-thumb { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.25s cubic-bezier(0.4,0,0.2,1); will-change: transform; backface-visibility: hidden; }
    .tab-card:hover .tab-card-thumb { transform: scale(1.03); }
    .tab-card-thumb-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #1e1040 0%, #2d1b69 50%, #1a0a3d 100%); display: flex !important; align-items: center; justify-content: center; font-size: 48px; color: rgba(155,48,255,0.5); }

    /* Corpo do card */
    .tab-card-body { padding: 14px; flex: 1; display: flex !important; flex-direction: column !important; }
    .tab-card-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; color: #fff; }
    .tab-card-desc { font-size: 12px; color: var(--muted); margin-bottom: 10px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
    .tab-card-rating { font-size: 11px; color: #FBBF24; margin-bottom: 8px; }

    /* Rodapé do card — preço + duração */
    .tab-card-meta { display: flex !important; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(155,48,255,0.1); gap: 8px; }
    .tab-card-price { font-size: 15px; font-weight: 900; color: var(--primary); }
    .tab-card-duration { font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 3px; white-space: nowrap; }

    /* Estado preço bloqueado */
    .tab-card-price-blur { font-size: 15px; font-weight: 900; color: var(--primary); filter: blur(5px); user-select: none; pointer-events: none; }
    .tab-card-cta { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 9px 12px; background: linear-gradient(135deg, #9b30ff, #7c3aed); color: #fff; border-radius: 10px; font-weight: 600; font-size: 12px; border: none; cursor: pointer; text-decoration: none; margin-top: 8px; transition: opacity 0.2s; }
    .tab-card-cta:hover { opacity: 0.85; }
    /* Steps dentro da aba Como Funciona */
    .how-tab { padding: 8px 0; }

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
    .info-grid { display: flex; flex-direction: column; gap: 12px; }
    .info-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 0; overflow: hidden; text-decoration: none; display: block; transition: transform 0.15s, box-shadow 0.15s; }
    .info-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
    .info-card-inner { display: flex; align-items: center; gap: 16px; padding: 18px 20px; }
    .info-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 22px; }
    .info-icon-wa { background: linear-gradient(135deg, #25D366, #128C7E); }
    .info-icon-maps { background: linear-gradient(135deg, #EA4335, #FBBC05); }
    .info-icon-ig { background: linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); }
    .info-text { flex: 1; min-width: 0; }
    .info-label { font-size: 11px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; font-weight: 600; }
    .info-value { font-size: 15px; font-weight: 700; color: var(--foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .info-arrow { color: var(--muted); font-size: 18px; flex-shrink: 0; }

    /* Como Funciona */
    .how-it-works { background: var(--surface); border-radius: 24px; margin: 0 24px 8px; padding: 40px 32px; max-width: 852px; }
    .steps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; }
    .step-card { background: var(--bg); border: 1px solid var(--border); border-radius: 16px; padding: 24px 16px; text-align: center; position: relative; }
    .step-number { width: 32px; height: 32px; border-radius: 50%; font-size: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .step-icon { font-size: 28px; margin-bottom: 10px; }
    .step-title { font-size: 14px; font-weight: 800; margin-bottom: 6px; }
    .step-desc { font-size: 12px; color: var(--muted); line-height: 1.5; }
    @media (max-width: 640px) {
      .how-it-works { margin: 0 16px 8px; padding: 28px 20px; }
      .steps-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    }

    /* Planos de Assinatura */
    .plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
    .plan-card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 28px 22px; position: relative; transition: border-color 0.2s, transform 0.2s; display: flex; flex-direction: column; }
    .plan-card:hover { border-color: var(--primary); transform: translateY(-2px); }
    .plan-popular { border-color: var(--primary); }
    .plan-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; color: #0A0A0A; white-space: nowrap; }
    .plan-name { font-size: 20px; font-weight: 900; margin-bottom: 8px; }
    .plan-price { margin-bottom: 8px; }
    .plan-currency { font-size: 16px; font-weight: 700; vertical-align: top; margin-top: 6px; display: inline-block; }
    .plan-value { font-size: 42px; font-weight: 900; line-height: 1; }
    .plan-period { font-size: 14px; color: var(--muted); }
    .plan-desc { font-size: 13px; color: var(--muted); margin-bottom: 16px; line-height: 1.5; }
    .plan-features { list-style: none; margin-bottom: 24px; flex: 1; }
    .plan-features li { font-size: 13px; color: var(--muted); padding: 5px 0; border-bottom: 1px solid var(--border); }
    .plan-features li:last-child { border-bottom: none; }
    .plan-cta-btn { width: 100%; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; cursor: pointer; transition: opacity 0.2s; }
    .plan-cta-btn:hover { opacity: 0.85; }
    @media (max-width: 640px) { .plans-grid { grid-template-columns: 1fr; } }

    /* Modal de Assinatura */
    .plan-modal-overlay { display: none; position: fixed; inset: 0; background: #00000088; z-index: 200; align-items: flex-end; justify-content: center; }
    .plan-modal-overlay.open { display: flex; }
    .plan-modal { background: var(--surface); border-radius: 24px 24px 0 0; padding: 28px 24px 40px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
    .plan-modal-title { font-size: 20px; font-weight: 900; margin-bottom: 4px; }
    .plan-modal-sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }
    .plan-modal-section { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--muted); margin-bottom: 10px; }
    .plan-service-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; cursor: pointer; }
    .plan-service-item.selected { border-color: var(--primary); }
    .plan-service-check { width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .plan-service-item.selected .plan-service-check { background: var(--primary); border-color: var(--primary); color: #0A0A0A; }
    .plan-modal-confirm { width: 100%; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 800; margin-top: 20px; cursor: pointer; }

    /* Navbar */
    .pub-navbar { position: sticky; top: 0; z-index: 100; background: #0A0A0Aee; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); padding: 0 20px; height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .pub-navbar-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--text); }
    .pub-navbar-logo { width: 32px; height: 32px; border-radius: 8px; object-fit: cover; border: 1.5px solid var(--primary); flex-shrink: 0; }
    .pub-navbar-logo-placeholder { width: 32px; height: 32px; border-radius: 8px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1.5px solid var(--primary); flex-shrink: 0; }
    .pub-navbar-name { font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
    .pub-navbar-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .pub-navbar-login { background: var(--primary); color: #0A0A0A; font-size: 13px; font-weight: 800; padding: 8px 16px; border-radius: 50px; text-decoration: none; white-space: nowrap; }
    .pub-navbar-login:hover { opacity: 0.9; }
    .pub-navbar-user { display: flex; align-items: center; gap: 8px; text-decoration: none; }
    .pub-navbar-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: #0A0A0A; font-size: 13px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 2px solid var(--primary); overflow: hidden; }
    .pub-navbar-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .pub-navbar-username { font-size: 13px; font-weight: 700; max-width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pub-navbar-dropdown { position: relative; }
    .pub-navbar-dropdown-menu { display: none; position: absolute; top: calc(100% + 8px); right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 6px; min-width: 180px; box-shadow: 0 8px 32px #00000066; z-index: 200; }
    .pub-navbar-dropdown.open .pub-navbar-dropdown-menu { display: block; }
    .pub-navbar-dropdown-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: var(--text); text-decoration: none; cursor: pointer; transition: background 0.15s; }
    .pub-navbar-dropdown-item:hover { background: var(--surface2); }
    .pub-navbar-dropdown-item.danger { color: #F87171; }
    .pub-navbar-chevron { font-size: 10px; color: var(--muted); margin-left: 2px; transition: transform 0.2s; }
    .pub-navbar-dropdown.open .pub-navbar-chevron { transform: rotate(180deg); }

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

    /* Preço bloqueado */
    .price-locked { font-size: 13px; font-weight: 700; color: var(--muted); background: var(--surface2); border: 1px dashed var(--border); border-radius: 8px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 5px; transition: color 0.2s, border-color 0.2s; }
    .price-locked:hover { color: var(--primary); border-color: var(--primary); }

    /* Banner CTA de desbloqueio */
    .cta-unlock-banner { background: linear-gradient(135deg, rgba(155,48,255,0.12) 0%, rgba(124,58,237,0.06) 100%); border: 1px solid rgba(155,48,255,0.3); border-radius: 16px; padding: 20px 24px; margin: 0 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; backdrop-filter: blur(4px); }
    .cta-unlock-content { display: flex; align-items: center; gap: 16px; }
    .cta-unlock-icon { font-size: 32px; flex-shrink: 0; }
    .cta-unlock-title { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
    .cta-unlock-sub { font-size: 13px; color: var(--muted); line-height: 1.4; }
    .cta-unlock-btn { background: var(--primary); color: #0A0A0A; font-size: 14px; font-weight: 800; padding: 12px 24px; border-radius: 50px; white-space: nowrap; letter-spacing: 0.3px; flex-shrink: 0; }
    .cta-unlock-btn:hover { opacity: 0.9; }
    @media (max-width: 640px) {
      .cta-unlock-banner { flex-direction: column; text-align: center; }
      .cta-unlock-content { flex-direction: column; }
      .cta-unlock-btn { width: 100%; text-align: center; padding: 14px; }
    }

    /* Banner de download do app */
    .app-download-banner { background: linear-gradient(135deg, #1a1a1a 0%, #222 100%); border: 1px solid var(--border); border-radius: 24px; padding: 32px 28px; margin: 0 24px 32px; max-width: 900px; margin-left: auto; margin-right: auto; display: flex; align-items: center; gap: 24px; }
    .app-download-icon { width: 72px; height: 72px; border-radius: 18px; object-fit: cover; flex-shrink: 0; border: 2px solid var(--primary); }
    .app-download-icon-placeholder { width: 72px; height: 72px; border-radius: 18px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 32px; flex-shrink: 0; border: 2px solid var(--primary); }
    .app-download-text { flex: 1; }
    .app-download-title { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
    .app-download-sub { font-size: 13px; color: var(--muted); line-height: 1.5; }
    .app-download-buttons { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .app-store-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 700; color: var(--text); transition: border-color 0.2s; }
    .app-store-btn:hover { border-color: var(--primary); color: var(--text); }
    .app-store-btn span { font-size: 20px; }
    @media (max-width: 640px) {
      .app-download-banner { flex-direction: column; text-align: center; }
      .app-download-buttons { justify-content: center; }
    }
    /* Banner PWA */
  #pwa-banner { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999; padding: 12px 16px; background: #161616; border-top: 1px solid #2A2A2A; align-items: center; gap: 12px; box-shadow: 0 -4px 24px #00000088; }
  #pwa-banner.show { display: flex; }
  #pwa-banner-icon { width: 44px; height: 44px; border-radius: 10px; object-fit: cover; border: 1.5px solid var(--primary); flex-shrink: 0; }
  #pwa-banner-icon-placeholder { width: 44px; height: 44px; border-radius: 10px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; border: 1.5px solid var(--primary); }
  #pwa-banner-text { flex: 1; min-width: 0; }
  #pwa-banner-title { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #pwa-banner-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }
  #pwa-banner-btn { background: var(--primary); color: #0A0A0A; font-size: 12px; font-weight: 800; padding: 8px 14px; border-radius: 8px; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
  #pwa-banner-close { background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; padding: 4px; flex-shrink: 0; line-height: 1; }
  @media (min-width: 640px) { #pwa-banner { display: none !important; } }
</style>
</head>
<body>
  <!-- Banner de instalação PWA (mobile only) -->
  <div id="pwa-banner">
    ${settings?.logoUrl
      ? `<img id="pwa-banner-icon" src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings?.shopName || shopName)}" />`
      : `<div id="pwa-banner-icon-placeholder">✂️</div>`
    }
    <div id="pwa-banner-text">
      <div id="pwa-banner-title">${escapeHtml(settings?.shopName || shopName)}</div>
      <div id="pwa-banner-sub">Adicionar à tela inicial</div>
    </div>
    <button id="pwa-banner-btn" onclick="pwaBannerInstall()">Instalar</button>
    <button id="pwa-banner-close" onclick="pwaBannerDismiss()" aria-label="Fechar">×</button>
  </div>
  <script>
    var _pwaDeferredPrompt = null;
    var _pwaBannerDismissed = false;
    try { _pwaBannerDismissed = !!localStorage.getItem('pwa_banner_dismissed'); } catch(e) {}
    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      _pwaDeferredPrompt = e;
      if (!_pwaBannerDismissed) {
        setTimeout(function() { var b = document.getElementById('pwa-banner'); if (b) b.classList.add('show'); }, 3000);
      }
    });
    function pwaBannerInstall() {
      var b = document.getElementById('pwa-banner');
      if (b) b.classList.remove('show');
      if (_pwaDeferredPrompt) { _pwaDeferredPrompt.prompt(); _pwaDeferredPrompt.userChoice.then(function() { _pwaDeferredPrompt = null; }); }
    }
    function pwaBannerDismiss() {
      var b = document.getElementById('pwa-banner');
      if (b) b.classList.remove('show');
      try { localStorage.setItem('pwa_banner_dismissed', '1'); } catch(e) {}
    }
  </script>
  ${body}
  <!-- Rodapé Barber Pro -->
  <footer style="background:#0A0A0A;border-top:1px solid #1A1A1A;padding:40px 24px 32px;margin-top:48px;">
    <div style="max-width:900px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:12px;">
          <span style="width:36px;height:36px;border-radius:10px;background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.3);display:inline-flex;align-items:center;justify-content:center;font-size:18px;">✂️</span>
          <span style="font-size:18px;font-weight:900;color:#C9A84C;letter-spacing:0.5px;">Barber Pro</span>
        </div>
        <div style="font-size:13px;color:#555;margin-bottom:20px;line-height:1.5;">Sistema completo de gestão para barbearias</div>
        <a href="https://usebarberpro.com" style="display:inline-block;background:#C9A84C;color:#0A0A0A;font-size:13px;font-weight:800;padding:12px 24px;border-radius:50px;letter-spacing:0.3px;text-decoration:none;">Criar minha conta gratuita</a>
      </div>
      <div style="text-align:center;margin-bottom:16px;padding-top:20px;border-top:1px solid #1A1A1A;">
        <div style="font-size:11px;color:#3A3A3A;margin-bottom:8px;">Powered by Barber Pro — Eldunari Ltda | CNPJ: 66.991.137/0001-63 — Franca/SP</div>
        <div style="font-size:11px;">
          <a href="/privacidade" style="color:#555;text-decoration:none;">Privacidade</a>
          <span style="color:#2A2A2A;margin:0 6px;">|</span>
          <a href="/termos" style="color:#555;text-decoration:none;">Termos</a>
          <span style="color:#2A2A2A;margin:0 6px;">|</span>
          <a href="/lgpd" style="color:#555;text-decoration:none;">LGPD</a>
        </div>
      </div>
      <div style="text-align:center;font-size:11px;color:#333;display:flex;align-items:center;justify-content:center;gap:6px;">
        <span>🔒</span>
        <span>Seus dados são protegidos pela <a href="/privacidade" style="color:#555;text-decoration:underline;">LGPD</a></span>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

// ─── Helper: Página 404 estilizada ───────────────────────────────────────────
function notFoundPage(slug: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Barbearia não encontrada — Barber Pro</title>
  <meta name="description" content="Esta página de barbearia não existe. Cadastre sua barbearia gratuitamente no Barber Pro." />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0A; color: #F0EEE8; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; }
    .logo { font-size: 13px; font-weight: 900; letter-spacing: 3px; color: #C9A84C; text-transform: uppercase; margin-bottom: 48px; }
    .code { font-size: 96px; font-weight: 900; line-height: 1; background: linear-gradient(135deg, #C9A84C, #9a7a2e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 12px; }
    p { font-size: 15px; color: #888880; line-height: 1.6; max-width: 400px; margin-bottom: 40px; }
    .slug-hint { background: #161616; border: 1px solid #2A2A2A; border-radius: 12px; padding: 16px 20px; margin-bottom: 40px; max-width: 420px; width: 100%; }
    .slug-hint-label { font-size: 11px; color: #888880; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
    .slug-hint-url { font-family: monospace; font-size: 14px; color: #C9A84C; word-break: break-all; }
    .actions { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; }
    .btn-primary { display: block; background: linear-gradient(135deg, #e8c97a, #C9A84C); color: #0A0A0A; font-size: 15px; font-weight: 800; padding: 16px 24px; border-radius: 12px; text-decoration: none; transition: opacity 0.2s; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { display: block; background: transparent; color: #C9A84C; font-size: 14px; font-weight: 600; padding: 14px 24px; border-radius: 12px; border: 1px solid rgba(201,168,76,0.3); text-decoration: none; transition: border-color 0.2s; }
    .btn-ghost:hover { border-color: #C9A84C; }
    .footer { margin-top: 48px; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="logo">✦ Barber Pro</div>
  <div class="code">404</div>
  <h1>Barbearia não encontrada</h1>
  <p>O link que você acessou não corresponde a nenhuma barbearia cadastrada na plataforma.</p>
  <div class="slug-hint">
    <div class="slug-hint-label">Você tentou acessar</div>
    <div class="slug-hint-url">usebarberpro.com/${escapeHtml(slug)}</div>
  </div>
  <div class="actions">
    <a href="https://usebarberpro.com" class="btn-primary">🏠 Voltar para o início</a>
    <a href="https://usebarberpro.com/#cadastro" class="btn-ghost">✂️ Cadastrar minha barbearia</a>
  </div>
  <div class="footer">
    <div style="margin-bottom:8px;"><span style="color:#C9A84C;font-weight:800;">Barber Pro</span> — Eldunari Ltda | CNPJ: 66.991.137/0001-63</div>
    <div><a href="/privacidade" style="color:#555;font-size:11px;text-decoration:none;">Privacidade</a> | <a href="/termos" style="color:#555;font-size:11px;text-decoration:none;">Termos</a> | <a href="/lgpd" style="color:#555;font-size:11px;text-decoration:none;">LGPD</a></div>
  </div>
</body>
</html>`;
}

// ─── Página principal da barbearia ───────────────────────────────────────────
async function renderShopPage(slug: string, res: Response, req?: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) {
    res.status(404).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Barbearia não encontrada — Barber Pro</title>
  <meta name="description" content="Esta página de barbearia não existe. Cadastre sua barbearia gratuitamente no Barber Pro." />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0A; color: #F0EEE8; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; }
    .logo { font-size: 13px; font-weight: 900; letter-spacing: 3px; color: #C9A84C; text-transform: uppercase; margin-bottom: 48px; }
    .code { font-size: 96px; font-weight: 900; line-height: 1; background: linear-gradient(135deg, #C9A84C, #9a7a2e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 16px; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 12px; }
    p { font-size: 15px; color: #888880; line-height: 1.6; max-width: 400px; margin-bottom: 40px; }
    .slug-hint { background: #161616; border: 1px solid #2A2A2A; border-radius: 12px; padding: 16px 20px; margin-bottom: 40px; max-width: 420px; width: 100%; }
    .slug-hint-label { font-size: 11px; color: #888880; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
    .slug-hint-url { font-family: monospace; font-size: 14px; color: #C9A84C; word-break: break-all; }
    .actions { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; }
    .btn-primary { display: block; background: linear-gradient(135deg, #e8c97a, #C9A84C); color: #0A0A0A; font-size: 15px; font-weight: 800; padding: 16px 24px; border-radius: 12px; text-decoration: none; transition: opacity 0.2s; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-ghost { display: block; background: transparent; color: #C9A84C; font-size: 14px; font-weight: 600; padding: 14px 24px; border-radius: 12px; border: 1px solid rgba(201,168,76,0.3); text-decoration: none; transition: border-color 0.2s; }
    .btn-ghost:hover { border-color: #C9A84C; }
    .footer { margin-top: 48px; font-size: 12px; color: #555; }
  </style>
</head>
<body>
  <div class="logo">✦ Barber Pro</div>
  <div class="code">404</div>
  <h1>Barbearia não encontrada</h1>
  <p>O link que você acessou não corresponde a nenhuma barbearia cadastrada na plataforma.</p>
  <div class="slug-hint">
    <div class="slug-hint-label">Você tentou acessar</div>
    <div class="slug-hint-url">usebarberpro.com/${escapeHtml(slug)}</div>
  </div>
  <div class="actions">
    <a href="https://usebarberpro.com" class="btn-primary">🏠 Voltar para o início</a>
    <a href="https://usebarberpro.com/#cadastro" class="btn-ghost">✂️ Cadastrar minha barbearia</a>
  </div>
  <div class="footer">
    <div style="margin-bottom:8px;"><span style="color:#C9A84C;font-weight:800;">Barber Pro</span> — Eldunari Ltda | CNPJ: 66.991.137/0001-63</div>
    <div><a href="/privacidade" style="color:#555;font-size:11px;text-decoration:none;">Privacidade</a> | <a href="/termos" style="color:#555;font-size:11px;text-decoration:none;">Termos</a> | <a href="/lgpd" style="color:#555;font-size:11px;text-decoration:none;">LGPD</a></div>
  </div>
</body>
</html>`);

    return;
  }

  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const barberList = await db.getAllBarbers(tenant.id);
  const serviceList = await db.getAllServicesWithMediaAndRatings(true, tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
  // Horários de funcionamento — usa o primeiro barbeiro ativo como referência da barbearia
  let shopWorkingHours: any[] = [];
  try {
    if (barberList.length > 0) {
      shopWorkingHours = await db.getWorkingHours(barberList[0].id);
    }
  } catch {}
  // Status de abertura da barbearia (Aberto/Fechado agora)
  let shopOpenStatus: { isOpen: boolean; isLunch?: boolean; opensAt: string | null; closesAt: string | null; lunchStart: string | null; lunchEnd: string | null } = { isOpen: false, isLunch: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };
  try { shopOpenStatus = await db.getShopOpenStatus(tenant.id); } catch {}

  // Verificar se o cliente está logado via cookie de sessão
  const clientSessionRaw = req?.cookies?.[`client_session_${slug}`] ;
  let loggedClient: { id: number; name: string; email: string } | null = null;
  if (clientSessionRaw) {
    loggedClient = decodeClientSession(clientSessionRaw);
  }
  const isLoggedIn = !!loggedClient;

  // Galeria — suporte a JSON e texto com \n (legado)
  const galleryUrls: string[] = (() => {
    if (!settings?.galleryUrls) return [];
    const raw = settings.galleryUrls.trim();
    if (raw.startsWith('[')) {
      try { return (JSON.parse(raw) as string[]).filter(Boolean); } catch {}
    }
    return raw.split('\n').map((u: string) => u.trim()).filter(Boolean);
  })();

  // Avaliações recentes (máx 6) — filtradas por tenant para isolamento
  const allReviewsRaw: Array<{ id: number; clientId: number; serviceId: number | null; rating: number; comment: string | null; createdAt: Date }> = [];
  for (const svc of serviceList.slice(0, 10)) {
    const r = await db.getReviewsByService(svc.id, tenant.id);
    allReviewsRaw.push(...r);
  }
  const recentReviews = allReviewsRaw
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  // Mapa serviceId → nome
  const serviceMap = Object.fromEntries(serviceList.map((s) => [s.id, s.name]));

  // Mapa clientId → nome
  const clientIds = Array.from(new Set(recentReviews.map((r) => r.clientId)));
  const clientMap: Record<number, string> = {};
  for (const cid of clientIds) {
    const c = await db.getClientById(cid);
    if (c) clientMap[cid] = c.name;
  }

  // ── Buscar Produtos de Venda ─────────────────────────────────────────────
  const productList = await db.getAllProductsWithMedia(true, tenant.id);
  const saleProducts = productList.filter((p: any) => p.productType === 'sale' || !p.productType);

  // ── Helper: preço com lock para visitantes ───────────────────────────────
  const priceHtml = (price: string | number, duration?: string) => isLoggedIn
    ? `<span class="tab-card-price">${formatPrice(price)}</span>`
    : `<span class="tab-card-price-blur">R$ ${formatPrice(price).replace('R$','').trim()}</span>`;
  const ctaLoginHtml = (redirectUrl = '') => !isLoggedIn
    ? `<a href="/pub/${slug}/login?redirect=${redirectUrl}" class="tab-card-cta">🔓 Entrar para ver preço</a>`
    : '';

  // ── Seção: Cards de Serviços (para o painel de abas) ─────────────────────
  const servicesTabHtml = serviceList.length === 0
    ? `<div class="empty">Nenhum serviço cadastrado ainda.</div>`
    : serviceList.map((s) => `
      <div class="tab-card" onclick="location.href='/pub/${slug}/servico/${s.id}'" role="link" tabindex="0">
        <div class="tab-card-img-wrap">
          ${s.thumbnailUrl
            ? `<img class="tab-card-thumb" src="${escapeHtml(s.thumbnailUrl)}" alt="${escapeHtml(s.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="tab-card-thumb-placeholder" style="display:none">✂</div>`
            : `<div class="tab-card-thumb-placeholder">✂</div>`
          }
        </div>
        <div class="tab-card-body">
          <div class="tab-card-name">${escapeHtml(s.name)}</div>
          ${s.description ? `<div class="tab-card-desc">${escapeHtml(s.description)}</div>` : ""}
          ${s.avgRating ? `<div class="tab-card-rating">★ ${s.avgRating} (${s.reviewCount})</div>` : ""}
          <div class="tab-card-meta">
            ${priceHtml(s.price)}
            <span class="tab-card-duration">⏱ ${formatDuration(s.durationMinutes)}</span>
          </div>
          ${ctaLoginHtml(`servico/${s.id}`)}
        </div>
      </div>
    `).join("");

  // ── Seção: Cards de Produtos (para o painel de abas) ─────────────────────
  const productsTabHtml = saleProducts.length === 0
    ? `<div class="empty">Nenhum produto disponível.</div>`
    : saleProducts.map((p: any) => {
        const inStock = p.stockQuantity == null || p.stockQuantity > 0;
        return `
      <div class="tab-card" role="article">
        <div class="tab-card-img-wrap" onclick="location.href='/pub/${slug}/produto/${p.id}'" style="cursor:pointer">
          ${p.thumbnailUrl
            ? `<img class="tab-card-thumb" src="${escapeHtml(p.thumbnailUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="tab-card-thumb-placeholder" style="display:none">🧴</div>`
            : `<div class="tab-card-thumb-placeholder">🧴</div>`
          }
        </div>
        <div class="tab-card-body">
          <div class="tab-card-name" onclick="location.href='/pub/${slug}/produto/${p.id}'" style="cursor:pointer">${escapeHtml(p.name)}</div>
          ${p.description ? `<div class="tab-card-desc">${escapeHtml(p.description)}</div>` : ""}
          <div class="tab-card-meta">
            ${priceHtml(p.price)}
            ${p.stockQuantity != null ? `<span class="tab-card-duration">${inStock ? "📦 " + p.stockQuantity + " em estoque" : "Sem estoque"}</span>` : ""}
          </div>
          ${isLoggedIn
            ? (inStock
                ? `<button onclick="cartAdd(${p.id},'${escapeHtml(p.name).replace(/'/g,"\\'")}',${Number(p.price)},${p.stockQuantity ?? 99})" style="display:block;width:100%;padding:11px;background:var(--primary);color:#0A0A0A;font-size:14px;font-weight:800;border-radius:10px;border:none;cursor:pointer;margin-top:8px">🛒 Adicionar ao carrinho</button>`
                : `<a href="/pub/${slug}/produto/${p.id}" style="display:block;width:100%;padding:11px;background:transparent;color:var(--primary);font-size:14px;font-weight:800;border-radius:10px;border:2px solid var(--primary);text-align:center;text-decoration:none;margin-top:8px;box-sizing:border-box">📦 Encomendar</a>`)
            : `<a href="/pub/${slug}/login?redirect=produtos" style="display:block;width:100%;padding:11px;background:var(--primary);color:#0A0A0A;font-size:14px;font-weight:800;border-radius:10px;text-align:center;text-decoration:none;margin-top:8px">🔒 Entrar para comprar</a>`
          }
        </div>
      </div>
    `;}).join("");

  // ── Seção: Galeria (Carrossel) ────────────────────────────────────────────
  const galleryHtml = galleryUrls.length === 0 ? "" : `
    <div class="section">
      <div class="section-title">Galeria</div>
      <div class="gallery-carousel" id="galleryCarousel">
        <div class="gallery-track" id="galleryTrack">
          ${galleryUrls.map((url, i) => `
            <div class="gallery-slide">
              <img src="${escapeHtml(url)}" alt="Foto ${i + 1}" loading="lazy" onclick="openLightbox(${i})" />
            </div>
          `).join("")}
        </div>
        ${galleryUrls.length > 1 ? `
          <button class="gallery-nav gallery-prev" onclick="galleryMove(-1)">&#8249;</button>
          <button class="gallery-nav gallery-next" onclick="galleryMove(1)">&#8250;</button>
          <div class="gallery-dots">${galleryUrls.map((_, i) => `<div class="gallery-dot${i === 0 ? " active" : ""}" onclick="galleryGoTo(${i})"></div>`).join("")}</div>
          <div class="gallery-counter" id="galleryCounter">1 / ${galleryUrls.length}</div>
        ` : ""}
      </div>
      <!-- Lightbox -->
      <div class="lightbox-overlay" id="lightboxOverlay" onclick="if(event.target===this)closeLightbox()">
        <span class="lightbox-close" onclick="closeLightbox()">×</span>
        <img class="lightbox-img" id="lightboxImg" src="" alt="" />
        ${galleryUrls.length > 1 ? `
          <button class="lightbox-nav lightbox-lprev" onclick="lightboxMove(-1)">&#8249;</button>
          <button class="lightbox-nav lightbox-lnext" onclick="lightboxMove(1)">&#8250;</button>
        ` : ""}
      </div>
      <script>
        var _galleryUrls = ${JSON.stringify(galleryUrls)};
        var _gIdx = 0;
        var _gAutoplay;
        function galleryGoTo(i) {
          _gIdx = (i + _galleryUrls.length) % _galleryUrls.length;
          document.getElementById('galleryTrack').style.transform = 'translateX(-' + (_gIdx * 100) + '%)';
          document.querySelectorAll('.gallery-dot').forEach(function(d, j) { d.classList.toggle('active', j === _gIdx); });
          var ctr = document.getElementById('galleryCounter');
          if (ctr) ctr.textContent = (_gIdx + 1) + ' / ' + _galleryUrls.length;
        }
        function galleryMove(dir) { clearInterval(_gAutoplay); galleryGoTo(_gIdx + dir); startAutoplay(); }
        function startAutoplay() { _gAutoplay = setInterval(function() { galleryGoTo(_gIdx + 1); }, 4000); }
        startAutoplay();
        // Lightbox
        var _lbIdx = 0;
        function openLightbox(i) {
          _lbIdx = i;
          document.getElementById('lightboxImg').src = _galleryUrls[i];
          document.getElementById('lightboxOverlay').classList.add('open');
          document.body.style.overflow = 'hidden';
        }
        function closeLightbox() {
          document.getElementById('lightboxOverlay').classList.remove('open');
          document.body.style.overflow = '';
        }
        function lightboxMove(dir) {
          _lbIdx = (_lbIdx + dir + _galleryUrls.length) % _galleryUrls.length;
          document.getElementById('lightboxImg').src = _galleryUrls[_lbIdx];
        }
        document.addEventListener('keydown', function(e) {
          if (!document.getElementById('lightboxOverlay').classList.contains('open')) return;
          if (e.key === 'ArrowLeft') lightboxMove(-1);
          if (e.key === 'ArrowRight') lightboxMove(1);
          if (e.key === 'Escape') closeLightbox();
        });
      <\/script>
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
            <div class="team-role">${(b as any).role === "super_admin" ? "Proprietário" : (b as any).role === "receptionist" ? "Recepcionista" : (b as any).jobTitle || "Barbeiro"}</div>
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
            <div class="review-service">Serviço: ${escapeHtml(r.serviceId != null ? (serviceMap[r.serviceId] ?? "—") : "Produto")}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  // ── Seção: Informações ────────────────────────────────────────────────────────────────────────
  const address = [settings?.address, settings?.addressNumber, settings?.addressComplement].filter(Boolean).join(", ");
  const waNumber = (settings?.whatsapp || settings?.phone || "").replace(/\D/g, "");
  const waLink = waNumber ? `https://wa.me/55${waNumber}` : "";
  const mapsQuery = address ? encodeURIComponent(address) : "";
  const mapsLink = settings?.googleMapsUrl || (mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : "");
  const igHandle = (settings?.instagram || "").replace(/^@/, "");
  const igLink = igHandle ? `https://instagram.com/${igHandle}` : "";

  const infoHtml = `
    <div class="section">
      <div class="section-title">Informações</div>
      <div class="info-grid">
        ${waLink ? `
        <a href="${waLink}" target="_blank" class="info-card">
          <div class="info-card-inner">
            <div class="info-icon info-icon-wa">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </div>
            <div class="info-text">
              <div class="info-label">WhatsApp</div>
              <div class="info-value">${escapeHtml(settings?.whatsapp || settings?.phone || "")}</div>
            </div>
            <div class="info-arrow">›</div>
          </div>
        </a>` : ""}
        ${mapsLink ? `
        <a href="${mapsLink}" target="_blank" class="info-card">
          <div class="info-card-inner">
            <div class="info-icon info-icon-maps">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </div>
            <div class="info-text">
              <div class="info-label">Endereço — toque para abrir no mapa</div>
              <div class="info-value">${escapeHtml(address)}</div>
            </div>
            <div class="info-arrow">›</div>
          </div>
        </a>` : ""}
        ${igLink ? `
        <a href="${igLink}" target="_blank" class="info-card">
          <div class="info-card-inner">
            <div class="info-icon info-icon-ig">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </div>
            <div class="info-text">
              <div class="info-label">Instagram</div>
              <div class="info-value">@${escapeHtml(igHandle)}</div>
            </div>
            <div class="info-arrow">›</div>
          </div>
        </a>` : ""}
      </div>
    </div>
  `;


  // ── Seção: Horários de Funcionamento ────────────────────────────────────────
  const workingDays = shopWorkingHours.filter((h: any) => h.isWorking);
  const hoursHtml = workingDays.length === 0 ? "" : (() => {
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const fmt = (t: string) => t ? t.slice(0, 5) : "";
    const rows = workingDays.map((h: any) => {
      const lunch = h.lunchStart && h.lunchEnd
        ? ` <span style="font-size:11px;color:var(--muted)">(almoço ${fmt(h.lunchStart)}–${fmt(h.lunchEnd)})</span>`
        : "";
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:14px;font-weight:600">${dayNames[h.dayOfWeek]}</span>
        <span style="font-size:13px;color:var(--muted)">${fmt(h.startTime)} – ${fmt(h.endTime)}${lunch}</span>
      </div>`;
    }).join("");
    return `
    <div class="section">
      <div class="section-title">⏰ Horários de Funcionamento</div>
      <div style="background:var(--surface2);border-radius:14px;padding:4px 16px">${rows}</div>
    </div>`;
  })();

  const agendamentoUrl = `/pub/${slug}/agendar`;

  // ── Seção: Planos de Assinatura ────────────────────────────────────────────
  let subscriptionPlansHtml = "";
  let planServicesData: Record<number, any[]> = {};
  try {
    const plans = await db.getSubscriptionPlansByTenantId(tenant.id);
    if (plans && plans.length > 0) {
      // Buscar serviços de cada plano
      for (const plan of plans) {
        const svcs = await db.getSubscriptionPlanServices(plan.id);
        planServicesData[plan.id] = svcs ?? [];
      }
        const planCards = (plans as any[]).map((plan: any, idx: number) => {
          const isPopular = idx === Math.floor(plans.length / 2) && plans.length > 1;
          const svcs = planServicesData[plan.id] ?? [];
          const svcList = svcs.length > 0
            ? svcs.map((s: any) => `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin-bottom:4px"><span style="color:var(--primary)">✓</span>${escapeHtml(s.serviceName)}</div>`).join("")
            : "";
          const servicesJson = escapeHtml(JSON.stringify(svcs.map((s: any) => ({ id: s.serviceId, name: s.serviceName, price: s.servicePrice }))));
          const priceDisplay = isLoggedIn
            ? `<div style="font-size:22px;font-weight:900;color:var(--primary);margin-bottom:2px">R$ ${Number(plan.price).toFixed(2).replace(".", ",")}<span style="font-size:13px;font-weight:500;color:var(--muted)">/mês</span></div>`
            : `<a href="/pub/${slug}/login" class="price-locked" style="margin-bottom:4px">🔒 Ver preço</a>`;
          return `
            <div class="tab-card" style="position:relative;display:flex;flex-direction:column">
              ${isPopular ? `<div style="position:absolute;top:12px;right:12px;background:${primaryColor};color:#0A0A0A;font-size:10px;font-weight:900;padding:3px 10px;border-radius:20px;letter-spacing:0.5px">POPULAR</div>` : ""}
              <div class="tab-card-thumb-placeholder" style="height:100px;font-size:28px;background:${primaryColor}18">🏷️</div>
              <div class="tab-card-body" style="flex:1;display:flex;flex-direction:column">
                <div class="tab-card-name" style="font-size:15px;margin-bottom:6px">${escapeHtml(plan.name)}</div>
                ${plan.description ? `<div class="tab-card-desc" style="margin-bottom:10px">${escapeHtml(plan.description)}</div>` : ""}
                <div style="margin-bottom:10px">
                  <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Inclui</div>
                  <div style="font-size:12px;color:var(--muted);margin-bottom:4px"><span style="color:var(--primary)">✓</span> ${plan.recurrences} agendamento${plan.recurrences !== 1 ? "s" : ""}/mês</div>
                  ${svcList}
                  <div style="font-size:12px;color:var(--muted);margin-top:4px"><span style="color:var(--primary)">✓</span> Cancele quando quiser</div>
                </div>
                <div class="tab-card-meta" style="margin-top:auto;padding-top:10px;border-top:1px solid var(--border);flex-direction:column;align-items:flex-start;gap:10px">
                  ${priceDisplay}
                  <a href="/pub/${slug}/plano/${plan.id}" style="display:block;width:100%;padding:10px;border-radius:10px;font-size:13px;font-weight:800;text-align:center;background:${isPopular ? `var(--primary)` : `transparent`};color:${isPopular ? `#0A0A0A` : `var(--primary)`};border:2px solid var(--primary);letter-spacing:0.3px;text-decoration:none">${isLoggedIn ? 'VER PLANO' : 'ENTRAR PARA ASSINAR'}</a>
                </div>
              </div>
            </div>
          `;
        }).join("");
        const planModalScript = [
          '<script>',
          '  var _pubBase = "/pub/' + slug + '";',
          '  var _planData = {};',
          '  function openPlanModal(planId, name, price, maxSvc, maxPrd, recurrences, servicesJson) {',
          '    _planData = { planId, name, price, maxSvc, maxPrd, recurrences, selectedServices: [] };',
          '    try { _planData.services = JSON.parse(decodeURIComponent(servicesJson)); } catch(e) { _planData.services = []; }',
          '    document.getElementById("planModalTitle").textContent = name;',
          '    document.getElementById("planModalSub").textContent = "R$ " + price.toFixed(2).replace(".",",") + "/m\u00eas \u00b7 " + recurrences + " agendamento" + (recurrences !== 1 ? "s" : "") + " por m\u00eas";',
          '    var svcHtml = "";',
          '    if (_planData.services.length > 0) {',
          '      svcHtml += "<div class=plan-modal-section>Escolha " + (maxSvc >= 999 ? "todos os" : maxSvc) + " servi\u00e7o" + (maxSvc !== 1 ? "s" : "") + " do plano:</div>";',
          '      _planData.services.forEach(function(s) {',
          '        svcHtml += "<div class=plan-service-item id=svc_" + s.id + " onclick=togglePlanService(" + s.id + ")>" +',
          '          "<div class=plan-service-check id=svcCheck_" + s.id + "></div>" +',
          '          "<div style=flex:1><div style=font-size:14px;font-weight:600>" + s.name + "</div>" +',
          '          "<div style=font-size:12px;color:var(--muted)>R$ " + Number(s.price).toFixed(2).replace(".",",") + "</div></div></div>";',
          '      });',
          '    }',
          '    document.getElementById("planModalServices").innerHTML = svcHtml;',
          '    document.getElementById("planModalOverlay").classList.add("open");',
          '  }',
          '  function closePlanModal() { document.getElementById("planModalOverlay").classList.remove("open"); }',
          '  function togglePlanService(id) {',
          '    var idx = _planData.selectedServices.indexOf(id);',
          '    if (idx >= 0) {',
          '      _planData.selectedServices.splice(idx, 1);',
          '      document.getElementById("svc_" + id).classList.remove("selected");',
          '      document.getElementById("svcCheck_" + id).textContent = "";',
          '    } else {',
          '      if (_planData.maxSvc < 999 && _planData.selectedServices.length >= _planData.maxSvc) {',
          '        pubAlert("Você pode escolher no máximo " + _planData.maxSvc + " serviço" + (_planData.maxSvc !== 1 ? "s" : "") + ".", "warning");',
          '        return;',
          '      }',
          '      _planData.selectedServices.push(id);',
          '      document.getElementById("svc_" + id).classList.add("selected");',
          '      document.getElementById("svcCheck_" + id).textContent = "\u2713";',
          '    }',
          '  }',
          '  function confirmPlanSubscription() {',
          '    if (_planData.services.length > 0 && _planData.selectedServices.length === 0) {',
          '      pubAlert("Selecione pelo menos um serviço para continuar.", "warning");',
          '      return;',
          '    }',
          '    var url = _pubBase + "/agendar?planId=" + _planData.planId + "&selectedServices=" + _planData.selectedServices.join(",");',
          '    window.location.href = url;',
          '  }',
          '<\/script>',
        ].join('\n');
        subscriptionPlansHtml = [
          '<div style="margin-bottom:16px">',
          '  <p style="color:var(--muted);font-size:14px;margin:0">Assine um plano e garanta seus horários todo mês com desconto.</p>',
          '</div>',
          '<div class="tab-cards-grid">' + planCards + '</div>',
          '<!-- Modal de Assinatura -->',
          '<div class="plan-modal-overlay" id="planModalOverlay" onclick="if(event.target===this)closePlanModal()">',
          '  <div class="plan-modal">',
          '    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">',
          '      <div>',
          '        <div class="plan-modal-title" id="planModalTitle"></div>',
          '        <div class="plan-modal-sub" id="planModalSub"></div>',
          '      </div>',
          '      <button onclick="closePlanModal()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer">×</button>',
          '    </div>',
          '    <div id="planModalServices"></div>',
          '    <button class="plan-modal-confirm" id="planModalConfirm" style="background:' + primaryColor + ';color:#0A0A0A;border:none" onclick="confirmPlanSubscription()">Continuar para Agendamento</button>',
          '  </div>',
          '</div>',
          planModalScript,
        ].join('\n');
    }
  } catch (e) { /* planos opcionais */ }

  // Seção Como Funciona
  const howItWorksHtml = `
    <div class="section how-it-works">
      <div class="section-title">Como Funciona</div>
      <div class="steps-grid">
        <div class="step-card">
          <div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">1</div>
          <div class="step-icon">✂</div>
          <div class="step-title">Escolha o Serviço</div>
          <div class="step-desc">Selecione o corte ou tratamento que deseja.</div>
        </div>
        <div class="step-card">
          <div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">2</div>
          <div class="step-icon">💈</div>
          <div class="step-title">Escolha o Barbeiro</div>
          <div class="step-desc">Selecione seu profissional favorito.</div>
        </div>
        <div class="step-card">
          <div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">3</div>
          <div class="step-icon">📅</div>
          <div class="step-title">Escolha o Horário</div>
          <div class="step-desc">Veja os horários disponíveis e escolha o melhor para você.</div>
        </div>
        <div class="step-card">
          <div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">4</div>
          <div class="step-icon">✅</div>
          <div class="step-title">Confirme</div>
          <div class="step-desc">Confirme o agendamento e receba lembretes automáticos.</div>
        </div>
      </div>
    </div>
  `;
  // Banner de CTA para visitantes não logados
  const ctaUnlockBanner = "";  // Preços agora visíveis para todos
  const bannerUrl = (settings as any)?.bannerUrl;
  const bannerStyle = bannerUrl
    ? `style="background-image:url('${escapeHtml(bannerUrl)}');background-size:cover;background-position:center"`
    : settings?.logoUrl
      ? `style="background-image:url('${escapeHtml(settings.logoUrl)}');background-size:cover;background-position:center"`
      : `style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)"` ;

  // ── Navbar superior ──────────────────────────────────────────────────────
  const clientInitials = loggedClient
    ? loggedClient.name.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()
    : "";
  const clientPhotoUrl = (loggedClient as any)?.photoUrl ?? "";

  const navbarHtml = `
    <nav class="pub-navbar">
      <a href="/pub/${slug}" class="pub-navbar-brand">
        ${settings?.logoUrl
          ? `<img class="pub-navbar-logo" src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings?.shopName ?? tenant.name)}" />`
          : `<div class="pub-navbar-logo-placeholder">💈</div>`
        }
        <span class="pub-navbar-name">${escapeHtml(settings?.shopName ?? tenant.name)}</span>
      </a>
      <div class="pub-navbar-actions">
        ${isLoggedIn && saleProducts.length > 0 ? `
        <button id="cart-nav-btn" onclick="cartOpen()" style="position:relative;background:none;border:none;cursor:pointer;padding:6px;display:flex;align-items:center;color:var(--text)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span id="cart-nav-badge" style="display:none;position:absolute;top:0;right:0;background:var(--primary);color:#0A0A0A;font-size:10px;font-weight:900;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;line-height:1">0</span>
        </button>
        ` : ""}
        ${isLoggedIn && loggedClient
          ? `<div class="pub-navbar-dropdown" id="navbarDropdown">
              <button onclick="toggleNavDropdown()" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:8px;color:var(--text);padding:0">
                <div class="pub-navbar-avatar">
                  ${clientPhotoUrl ? `<img src="${escapeHtml(clientPhotoUrl)}" alt="" />` : clientInitials}
                </div>
                <span class="pub-navbar-username">${escapeHtml(loggedClient.name.split(" ")[0])}</span>
                <span class="pub-navbar-chevron">▼</span>
              </button>
              <div class="pub-navbar-dropdown-menu">
                <a href="/pub/${slug}/perfil" class="pub-navbar-dropdown-item">👤 Meu Perfil</a>
                <a href="/pub/${slug}/meus-agendamentos" class="pub-navbar-dropdown-item">📅 Meus Agendamentos</a>
                <a href="/pub/${slug}/agendar" class="pub-navbar-dropdown-item">✂ Agendar Horário</a>
                <div style="height:1px;background:var(--border);margin:4px 0"></div>
                <a href="/pub/${slug}/logout" class="pub-navbar-dropdown-item danger">🚪 Sair</a>
              </div>
            </div>`
          : `<a href="/pub/${slug}/login" class="pub-navbar-login">Entrar</a>`
        }
      </div>
    </nav>
    <script>
      function toggleNavDropdown() {
        var d = document.getElementById('navbarDropdown');
        if (d) d.classList.toggle('open');
      }
      document.addEventListener('click', function(e) {
        var d = document.getElementById('navbarDropdown');
        if (d && !d.contains(e.target)) d.classList.remove('open');
      });
    <\/script>
  `;

  const body = `
    ${navbarHtml}
    <!-- Hero -->
    <div class="hero" ${bannerStyle}>
      <div class="hero-bg"></div>
      <div class="hero-content">
        ${settings?.logoUrl ? `<img class="hero-logo" src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings?.shopName ?? tenant.name)}" />` : `<div style="width:90px;height:90px;border-radius:22px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto 16px;border:3px solid var(--primary)">💈</div>`}
        <div class="hero-name">${escapeHtml(settings?.shopName ?? tenant.name)}</div>
        <div id="shop-status-badge">${shopOpenStatus.isOpen
          ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.4);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#4ade80;margin-bottom:8px;letter-spacing:0.3px"><span style="width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;animation:pulse-green 2s infinite"></span>Aberto agora${shopOpenStatus.closesAt ? ` · fecha às ${shopOpenStatus.closesAt}` : ""}</div>`
          : shopOpenStatus.isLunch && shopOpenStatus.lunchEnd
            ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.4);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:8px;letter-spacing:0.3px"><span style="width:7px;height:7px;border-radius:50%;background:#fbbf24;display:inline-block"></span>Horário de almoço · volta às ${shopOpenStatus.lunchEnd}</div>`
            : shopOpenStatus.opensAt
              ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#f87171;margin-bottom:8px;letter-spacing:0.3px"><span style="width:7px;height:7px;border-radius:50%;background:#f87171;display:inline-block"></span>Fechado · abre às ${shopOpenStatus.opensAt}</div>`
              : ""
        }</div>
        ${address ? `<div class="hero-address">📍 ${escapeHtml(address)}</div>` : ""}
        <a href="${agendamentoUrl}" class="hero-cta">Agendar Horário</a>
      </div>
    </div>

    ${galleryHtml}

    <!-- Painel de Abas: Serviços / Produtos / Assinaturas / Como Funciona -->
    <div class="tabs-section">
      <div class="tabs-header">
        <button class="tab-btn active" onclick="switchTab('services',this)">✂ Serviços</button>
        ${saleProducts.length > 0 ? `<button class="tab-btn" onclick="switchTab('products',this)">🧴 Produtos</button>` : ""}
        ${subscriptionPlansHtml ? `<button class="tab-btn" onclick="switchTab('plans',this)">🏷️ Assinaturas</button>` : ""}
        <button class="tab-btn" onclick="switchTab('how',this)">ℹ️ Como Funciona</button>
      </div>

      <!-- Aba: Serviços -->
      <div class="tab-panel active" id="tab-services">
        ${!isLoggedIn ? `<div class="cta-unlock-banner" style="margin:0 0 20px">
          <div class="cta-unlock-content"><div class="cta-unlock-icon">✨</div><div><div class="cta-unlock-title">Acesse preços exclusivos</div><div class="cta-unlock-sub">Cadastre-se grátis e veja os valores de todos os serviços e produtos.</div></div></div>
          <a href="/pub/${slug}/login" class="cta-unlock-btn">Entrar / Cadastrar</a>
        </div>` : ""}
        <div class="tab-cards-grid">${servicesTabHtml}</div>
      </div>

      <!-- Aba: Produtos -->
      ${saleProducts.length > 0 ? `<div class="tab-panel" id="tab-products">
        ${!isLoggedIn ? `<div class="cta-unlock-banner" style="margin:0 0 20px">
          <div class="cta-unlock-content"><div class="cta-unlock-icon">✨</div><div><div class="cta-unlock-title">Acesse preços exclusivos</div><div class="cta-unlock-sub">Cadastre-se grátis e veja os valores de todos os serviços e produtos.</div></div></div>
          <a href="/pub/${slug}/login" class="cta-unlock-btn">Entrar / Cadastrar</a>
        </div>` : ""}
        <div class="tab-cards-grid">${productsTabHtml}</div>
      </div>` : ""}

      <!-- Aba: Assinaturas -->
      ${subscriptionPlansHtml ? `<div class="tab-panel" id="tab-plans">${subscriptionPlansHtml}</div>` : ""}

      <!-- Aba: Como Funciona -->
      <div class="tab-panel" id="tab-how">
        <div class="how-tab">
          <div class="steps-grid">
            <div class="step-card"><div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">1</div><div class="step-icon">✂</div><div class="step-title">Escolha o Serviço</div><div class="step-desc">Selecione o corte ou tratamento que deseja.</div></div>
            <div class="step-card"><div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">2</div><div class="step-icon">💈</div><div class="step-title">Escolha o Barbeiro</div><div class="step-desc">Selecione seu profissional favorito.</div></div>
            <div class="step-card"><div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">3</div><div class="step-icon">📅</div><div class="step-title">Escolha o Horário</div><div class="step-desc">Veja os horários disponíveis e escolha o melhor para você.</div></div>
            <div class="step-card"><div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">4</div><div class="step-icon">✅</div><div class="step-title">Confirme</div><div class="step-desc">Confirme o agendamento e receba lembretes automáticos.</div></div>
          </div>
        </div>
      </div>
    </div>

    <script>
      function switchTab(id, btn) {
        document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
        btn.classList.add('active');
        var panel = document.getElementById('tab-' + id);
        if (panel) panel.classList.add('active');
      }
    <\/script>

    ${teamHtml}
    ${hoursHtml}
    ${reviewsHtml}
    ${infoHtml}


    <!-- CTA fixo mobile -->
    <div class="cta-fixed">
      <a href="${agendamentoUrl}" class="cta-fixed-btn">Agendar Horário</a>
    </div>
    <script>
      // Atualização automática do badge Aberto/Fechado a cada 60s
      (function() {
        function renderBadge(d) {
          if (d.isOpen) {
            return '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.4);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#4ade80;margin-bottom:8px"><span style="width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;animation:pulse-green 2s infinite"></span>Aberto agora' + (d.closesAt ? ' · fecha às ' + d.closesAt : '') + '</div>';
          } else if (d.isLunch && d.lunchEnd) {
            return '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.4);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:8px"><span style="width:7px;height:7px;border-radius:50%;background:#fbbf24;display:inline-block"></span>Horário de almoço · volta às ' + d.lunchEnd + '</div>';
          } else if (d.opensAt) {
            return '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#f87171;margin-bottom:8px"><span style="width:7px;height:7px;border-radius:50%;background:#f87171;display:inline-block"></span>Fechado · abre às ' + d.opensAt + '</div>';
          }
          return '';
        }
        function refreshBadge() {
          var badge = document.getElementById('shop-status-badge');
          if (!badge) return;
          fetch('/pub-api/shop-status?slug=${slug}')
            .then(function(r) { return r.json(); })
            .then(function(d) { badge.innerHTML = renderBadge(d); })
            .catch(function() { /* silencioso */ });
        }
        setInterval(refreshBadge, 60000);
      })();
    </script>

    ${isLoggedIn ? `
    <!-- DRAWER DO CARRINHO (lateral direita) -->
    <div id="cart-overlay" onclick="cartClose()" style="display:none;position:fixed;inset:0;z-index:998;background:rgba(0,0,0,0.5)"></div>
    <div id="cart-drawer" style="display:none;position:fixed;top:0;right:0;bottom:0;width:100%;max-width:380px;z-index:999;background:var(--bg);border-left:1px solid var(--border);flex-direction:column;animation:slideInRight 0.25s ease">
      <!-- Header do drawer -->
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span style="font-size:16px;font-weight:800;color:var(--text)">Carrinho</span>
          <span id="cart-count-badge" style="background:var(--primary);color:#0A0A0A;font-size:11px;font-weight:900;padding:2px 8px;border-radius:20px">0</span>
        </div>
        <button onclick="cartClose()" style="background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer;padding:4px;line-height:1">✕</button>
      </div>
      <!-- Itens -->
      <div id="cart-items" style="flex:1;overflow-y:auto;padding:16px 20px"></div>
      <!-- Footer com total e checkout -->
      <div id="cart-footer" style="display:none;padding:16px 20px 28px;border-top:1px solid var(--border);flex-shrink:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <span style="font-size:14px;color:var(--muted);font-weight:600">Total</span>
          <span id="cart-total-modal" style="font-size:22px;font-weight:900;color:var(--primary)">R$ 0,00</span>
        </div>
        <button onclick="cartCheckout()" style="display:block;width:100%;padding:15px;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:900;border-radius:14px;border:none;cursor:pointer">Finalizar pedido →</button>
      </div>
    </div>

    <!-- MODAL DE CHECKOUT -->
    <div id="checkout-modal" style="display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.7);align-items:flex-end;justify-content:center">
      <div style="background:var(--bg);border-radius:24px 24px 0 0;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;animation:slideUp 0.3s ease">
        <div style="padding:20px 20px 0;display:flex;justify-content:space-between;align-items:center">
          <h2 style="font-size:20px;font-weight:900;color:var(--text);margin:0">💳 Finalizar Pedido</h2>
          <button onclick="checkoutClose()" style="background:none;border:none;font-size:24px;color:var(--muted);cursor:pointer">✕</button>
        </div>
        <div id="checkout-body" style="padding:20px 20px 32px"></div>
      </div>
    </div>

    <style>
      @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
    </style>

    
    ` : ""}

  `;res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, `
    <script src="/cart.js"></script>
    <script>cartInit('${slug}');</script>
   `, settings, slug));
}

// ─── Rota de agendamentoe login Página de agendamento ────────────────────────────────────────────────────
async function renderBookingPage(slug: string, res: Response, req?: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const barberList = await db.getAllBarbers(tenant.id);
  const serviceList = await db.getAllServicesWithMediaAndRatings(true, tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";

  // Verificar se o cliente está logado via cookie de sessão
  const clientSessionRaw = req?.cookies?.[`client_session_${slug}`] ;
  let loggedClient: { id: number; name: string; email: string } | null = null;
  if (clientSessionRaw) {
    loggedClient = decodeClientSession(clientSessionRaw);
  }

  const waNumber = ((settings as any)?.whatsapp || (settings as any)?.phone || "").replace(/\D/g, "");
  const waNumberJson = JSON.stringify(waNumber ? "55" + waNumber : "");

  // Dados dos serviços e barbeiros em JSON para o JS da página
  const servicesJson = JSON.stringify(serviceList.map((s) => ({
    id: s.id,
    name: s.name,
    price: s.price,
    durationMinutes: s.durationMinutes,
    thumbnailUrl: (s as any).thumbnailUrl ?? null,
    description: (s as any).description ?? null,
  })));
  const bookableBarbers = (barberList as any[]).filter((b: any) => b.role !== "receptionist");
  const barbersJson = JSON.stringify(bookableBarbers.map((b) => ({
    id: b.id,
    name: b.name,
    photoUrl: b.photoUrl ?? null,
    specialties: b.specialties ?? null,
  })));
  const firstBarberId = bookableBarbers[0]?.id ?? 1;

  const loggedClientJson = loggedClient ? JSON.stringify(loggedClient) : "null";
  const hasAsaas = !!(process.env.ASAAS_API_KEY);
  const hasAsaasJson = JSON.stringify(hasAsaas);

  // Gerar os próximos 30 dias para o calendário
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calendarDays: { iso: string; day: number; weekday: string; month: string }[] = [];
  const weekdayShort = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthShort = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    calendarDays.push({
      iso: d.toISOString().split("T")[0],
      day: d.getDate(),
      weekday: weekdayShort[d.getDay()],
      month: monthShort[d.getMonth()],
    });
  }
  const calendarJson = JSON.stringify(calendarDays);

  const body = `
    <style>
      .booking-page { max-width: 520px; margin: 0 auto; padding: 20px 16px 100px; }
      .booking-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
      .booking-back { color: var(--muted); font-size: 22px; text-decoration: none; line-height: 1; padding: 4px; }
      .booking-title { font-size: 17px; font-weight: 800; }
      .booking-subtitle { font-size: 12px; color: var(--muted); margin-top: 2px; }

      /* Etapas */
      .step-indicator { display: flex; align-items: center; gap: 0; margin-bottom: 28px; }
      .step-dot { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; flex-shrink: 0; transition: all 0.2s; }
      .step-dot.active { background: var(--primary); color: #0A0A0A; box-shadow: 0 0 0 4px var(--primary-dim); }
      .step-dot.done { background: #22C55E; color: #fff; }
      .step-dot.pending { background: var(--surface2); color: var(--muted); }
      .step-line { flex: 1; height: 2px; background: var(--border); margin: 0 4px; transition: background 0.3s; }
      .step-line.done { background: #22C55E; }

      /* Serviços — grade 2 colunas com foto */
      .step-section-title { font-size: 17px; font-weight: 800; margin-bottom: 16px; }
      .services-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 360px) { .services-grid2 { grid-template-columns: 1fr; } }
      .svc-card2 { background: var(--surface); border: 2px solid var(--border); border-radius: 16px; overflow: hidden; cursor: pointer; transition: border-color 0.15s, transform 0.25s cubic-bezier(0.4,0,0.2,1); position: relative; will-change: transform; transform: translateZ(0); backface-visibility: hidden; }
      .svc-card2:hover { border-color: var(--primary); transform: scale(1.03) translateZ(0); }
      .svc-card2.selected { border-color: var(--primary); }
      .svc-card2.selected::after { content: '✓'; position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; background: var(--primary); color: #0A0A0A; font-size: 12px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
      .svc-thumb2 { width: 100%; height: 110px; object-fit: cover; background: var(--surface2); display: block; }
      .svc-thumb2-placeholder { width: 100%; height: 110px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 32px; }
      .svc-body2 { padding: 10px 12px 12px; }
      .svc-name2 { font-size: 13px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; }
      .svc-meta2 { font-size: 11px; color: var(--muted); }
      .svc-price2 { font-size: 14px; font-weight: 900; color: var(--primary); margin-top: 4px; }

      /* Barbeiros */
      .barbers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
      .barber-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 12px 12px; background: var(--surface); border: 2px solid var(--border); border-radius: 16px; cursor: pointer; transition: all 0.15s; }
      .barber-card:hover { border-color: var(--primary); transform: translateY(-2px); }
      .barber-card.selected { border-color: var(--primary); background: var(--primary-dim); }
      .barber-avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; background: var(--surface2); border: 2.5px solid var(--border); }
      .barber-card.selected .barber-avatar { border-color: var(--primary); }
      .barber-avatar-placeholder { width: 64px; height: 64px; border-radius: 50%; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: var(--muted); border: 2.5px solid var(--border); }
      .barber-card.selected .barber-avatar-placeholder { border-color: var(--primary); }
      .barber-name { font-size: 12px; font-weight: 700; text-align: center; line-height: 1.3; }
      .barber-spec { font-size: 10px; color: var(--muted); text-align: center; }
      .barber-check-badge { width: 20px; height: 20px; border-radius: 50%; background: var(--primary); color: #0A0A0A; font-size: 11px; font-weight: 900; display: none; align-items: center; justify-content: center; }
      .barber-card.selected .barber-check-badge { display: flex; }

      /* Calendário mensal */
      .cal-month-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .cal-month-label { font-size: 15px; font-weight: 800; }
      .cal-nav-btn { background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; transition: background 0.15s; }
      .cal-nav-btn:hover { background: var(--surface); border-color: var(--primary); }
      .cal-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
      .cal-header-cell { text-align: center; font-size: 11px; font-weight: 700; color: var(--muted); padding: 4px 0 8px; text-transform: uppercase; }
      .cal-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
      .cal-cell:hover:not(.cal-empty):not(.cal-past):not(.cal-disabled) { border-color: var(--primary); color: var(--primary); }
      .cal-cell.cal-today { background: var(--surface2); font-weight: 800; }
      .cal-cell.cal-selected { background: var(--primary); color: #0A0A0A; font-weight: 900; border-color: var(--primary); }
      .cal-cell.cal-past { color: var(--muted); opacity: 0.35; cursor: not-allowed; }
      .cal-cell.cal-empty { cursor: default; }
      .cal-cell.cal-disabled { color: var(--muted); opacity: 0.3; cursor: not-allowed; }

      /* Slots */
      .period-section { margin-top: 20px; }
      .period-label { font-size: 12px; color: var(--muted); letter-spacing: 0.8px; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
      .period-label-icon { font-size: 16px; }
      .period-label-line { flex: 1; height: 1px; background: var(--border); }
      .slots-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .slot-btn { padding: 10px 16px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.15s; min-width: 76px; text-align: center; }
      .slot-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-dim); }
      .slot-btn.selected { background: var(--primary); border-color: var(--primary); color: #0A0A0A; }

      /* Resumo */
      .booking-summary { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
      .summary-hero { display: flex; align-items: center; gap: 14px; padding: 16px; border-bottom: 1px solid var(--border); }
      .summary-svc-thumb { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; background: var(--surface2); flex-shrink: 0; }
      .summary-svc-thumb-placeholder { width: 56px; height: 56px; border-radius: 12px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
      .summary-svc-name { font-size: 15px; font-weight: 800; }
      .summary-svc-price { font-size: 18px; font-weight: 900; color: var(--primary); margin-top: 2px; }
      .summary-rows { padding: 12px 16px; }
      .summary-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 6px 0; }
      .summary-label { color: var(--muted); }
      .summary-value { font-weight: 700; }
      .summary-divider { height: 1px; background: var(--border); margin: 4px 0; }

      /* Botões de navegação */
      .booking-nav { display: flex; gap: 10px; margin-top: 20px; }
      .btn-back-step { flex: 1; padding: 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer; transition: background 0.15s; }
      .btn-back-step:hover { background: var(--surface2); }
      .btn-next-step { flex: 2; padding: 14px; background: var(--primary); border: none; border-radius: 14px; color: #0A0A0A; font-size: 15px; font-weight: 800; cursor: pointer; opacity: 0.4; pointer-events: none; transition: opacity 0.2s; }
      .btn-next-step.ready { opacity: 1; pointer-events: auto; }

      /* Login banner */
      .login-banner { background: var(--primary-dim); border: 1px solid var(--primary)44; border-radius: 12px; padding: 14px; margin-bottom: 16px; font-size: 13px; color: var(--muted); }
      .login-banner a { color: var(--primary); font-weight: 700; }

      /* Mensagens */
      .msg-success { background: #22C55E22; border: 1px solid #22C55E44; border-radius: 12px; padding: 20px; text-align: center; font-size: 14px; color: #4ADE80; }
      .msg-error { background: #EF444422; border: 1px solid #EF444444; border-radius: 12px; padding: 14px; text-align: center; font-size: 13px; color: #F87171; margin-top: 12px; }

      /* Etapa 1 — serviço principal + accordion */
      .main-svc-card { display: flex; align-items: center; gap: 14px; background: var(--surface); border: 2px solid var(--primary); border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
      .main-svc-thumb { width: 80px; height: 80px; object-fit: cover; flex-shrink: 0; background: var(--surface2); }
      .main-svc-thumb-placeholder { width: 80px; height: 80px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; }
      .main-svc-body { flex: 1; padding: 12px 14px 12px 0; }
      .main-svc-name { font-size: 15px; font-weight: 800; }
      .main-svc-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
      .main-svc-price { font-size: 16px; font-weight: 900; color: var(--primary); margin-top: 4px; }
      .main-svc-remove { background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; padding: 12px 14px 12px 8px; line-height: 1; flex-shrink: 0; transition: color 0.15s; }
      .main-svc-remove:hover { color: #ef4444; }
      .add-more-toggle { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: var(--surface); border: 1.5px dashed var(--border); border-radius: 14px; cursor: pointer; font-size: 14px; font-weight: 700; color: var(--primary); margin-bottom: 12px; transition: background 0.15s; }
      .add-more-toggle:hover { background: var(--surface2); }
      .selected-summary { background: var(--surface2); border-radius: 12px; padding: 12px 16px; margin-top: 12px; }
      .selected-summary-title { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 8px; }
      .selected-summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
      .selected-summary-total { display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; padding-top: 8px; margin-top: 6px; border-top: 1px solid var(--border); }
      .svc-card2.extra-selected { border-color: var(--primary); }
      .svc-card2.extra-selected::after { content: '✓'; position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; background: var(--primary); color: #0A0A0A; font-size: 12px; font-weight: 900; display: flex; align-items: center; justify-content: center; }

      /* Calendário — dias indisponíveis */
      .cal-cell.cal-unavailable { color: var(--muted); opacity: 0.25; cursor: not-allowed; }
      .cal-cell.cal-loading { opacity: 0.5; cursor: wait; }

      /* Slots loading */
      .slots-loading { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px; color: var(--muted); font-size: 13px; }
      .slots-empty { text-align: center; padding: 24px; color: var(--muted); font-size: 13px; background: var(--surface2); border-radius: 12px; }
    </style>

    <div class="booking-page">
      <!-- Cabeçalho -->
      <div class="booking-header">
        <a href="/pub/${slug}" class="booking-back">←</a>
        <div>
          <div class="booking-title">${escapeHtml(settings?.shopName ?? tenant.name)}</div>
          <div class="booking-subtitle">Agendamento Online</div>
        </div>
        ${loggedClient
          ? `<div style="margin-left:auto;text-align:right"><div style="font-size:13px;font-weight:700">${escapeHtml(loggedClient.name.split(' ')[0])}</div><a href="/pub/${slug}/logout" style="font-size:11px;color:var(--muted)">Sair</a></div>`
          : `<a href="/pub/${slug}/login?redirect=agendar" style="margin-left:auto;background:var(--primary);color:#0A0A0A;font-size:12px;font-weight:800;padding:8px 14px;border-radius:10px;text-decoration:none">Entrar</a>`
        }
      </div>

      <!-- Indicador de etapas -->
      <div class="step-indicator" id="step-indicator">
        <div class="step-dot active" id="dot-1">1</div>
        <div class="step-line" id="line-1"></div>
        <div class="step-dot pending" id="dot-2">2</div>
        <div class="step-line" id="line-2"></div>
        <div class="step-dot pending" id="dot-3">3</div>
        <div class="step-line" id="line-3"></div>
        <div class="step-dot pending" id="dot-4">4</div>
      </div>

      <!-- Etapa 1: Serviço selecionado + adicionar mais -->
      <div id="step-1">
        <!-- Título dinâmico (muda conforme estado) -->
        <div id="step1-title" class="step-section-title">✂ Escolha um serviço</div>

        <!-- Grade de seleção de serviço principal (visível quando nenhum serviço está selecionado) -->
        <div id="main-svc-select" class="services-grid2" style="margin-bottom:16px;"></div>

        <!-- Card do serviço principal selecionado (visível após seleção) -->
        <div id="main-svc-card" class="main-svc-card" style="display:none"></div>

        <!-- Accordion: adicionar mais serviços (visível somente após seleção) -->
        <div class="add-more-toggle" id="add-more-toggle" onclick="toggleAddMore()" style="display:none">
          <span id="add-more-icon">＋</span>
          <span>Adicionar mais serviços</span>
        </div>
        <div id="add-more-panel" style="display:none">
          <div class="services-grid2" id="services-list"></div>
        </div>

        <!-- Resumo dos serviços extras selecionados -->
        <div id="selected-summary" style="display:none" class="selected-summary"></div>

        ${!loggedClient ? `<div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;font-size:12px;color:var(--muted);text-align:center;padding:12px;margin-top:16px;">Você precisará fazer login ou criar uma conta gratuita para confirmar o agendamento.</div>` : ""}
        <div class="booking-nav">
          <button class="btn-next-step" id="btn-step1-next" onclick="goToStep(2)" style="flex:1">Próximo →</button>
        </div>
      </div>

      <!-- Etapa 2: Profissional -->
      <div id="step-2" style="display:none">
        <div class="step-section-title">💈 Escolha o profissional</div>
        <div class="barbers-grid" id="barbers-list"></div>
        <div class="booking-nav">
          <button class="btn-back-step" onclick="goToStep(1)">← Voltar</button>
          <button class="btn-next-step ready" id="btn-step2-next" onclick="goToStep(3)">Próximo →</button>
        </div>
      </div>

      <!-- Etapa 3: Data e Horário -->
      <div id="step-3" style="display:none">
        <div class="step-section-title">📅 Escolha a data</div>
        <!-- Navegação do mês -->
        <div class="cal-month-nav">
          <button class="cal-nav-btn" id="cal-prev" onclick="changeMonth(-1)">‹</button>
          <div class="cal-month-label" id="cal-month-label"></div>
          <button class="cal-nav-btn" id="cal-next" onclick="changeMonth(1)">›</button>
        </div>
        <!-- Grade do calendário -->
        <div class="cal-grid" id="cal-grid"></div>
        <!-- Horários -->
        <div id="slots-area" style="margin-top:8px">
          <div class="slots-empty">Selecione uma data para ver os horários disponíveis.</div>
        </div>
        <div class="booking-nav">
          <button class="btn-back-step" onclick="goToStep(2)">← Voltar</button>
          <button class="btn-next-step" id="btn-step3-next" onclick="goToStep(4)">Próximo →</button>
        </div>
      </div>

      <!-- Etapa 4: Confirmação -->
      <div id="step-4" style="display:none">
        <div class="step-section-title">✅ Confirmar Agendamento</div>
        <div class="booking-summary" id="booking-summary"></div>
        ${loggedClient
          ? ``
          : `<div class="login-banner">💡 <a href="/pub/${slug}/login?redirect=agendar">Faça login</a> ou <a href="/pub/${slug}/cadastro?redirect=agendar">crie uma conta</a> para confirmar.</div>`
        }
        <button id="confirm-btn" ${loggedClient ? `` : `disabled`}
          style="width:100%;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:800;padding:16px;border-radius:14px;border:none;cursor:${loggedClient ? `pointer` : `not-allowed`};opacity:${loggedClient ? `1` : `0.5`}">
          ${loggedClient ? `Confirmar Agendamento` : `Faça login para confirmar`}
        </button>
        <div id="success-msg" style="display:none;margin-top:16px" class="msg-success"></div>
        <div id="error-msg" style="display:none;margin-top:12px" class="msg-error"></div>
        <div class="booking-nav" style="margin-top:12px">
          <button class="btn-back-step" onclick="goToStep(3)">← Voltar</button>
        </div>
      </div>
    </div>

    <script>
      var SLUG = '${slug}';
      var LOGGED_CLIENT = ${loggedClientJson};
      var SERVICES = ${servicesJson};
      var BARBERS = ${barbersJson};
      var CALENDAR = ${calendarJson};
      var HAS_ASAAS = ${hasAsaasJson};
      var WA_NUMBER = ${waNumberJson};

      var selectedService = null;   // serviço principal (compatibilidade)
      var selectedServices = [];    // todos os serviços selecionados (inclui o principal)
      var selectedBarber = BARBERS.length > 0 ? BARBERS[0] : null; // padrão: primeiro barbeiro
      var selectedDate = null;
      var selectedSlot = null;
      var lastAppointmentId = null;
      var lastServicePrice = null;
      var currentStep = 1;

      // ─── Navegação entre etapas ─────────────────────────────────────────────
      function goToStep(n) {
        if (n === 1) { /* sem validação */ }
        else if (n === 2 && !selectedService) { pubAlert('Selecione um serviço primeiro.', 'warning'); return; }
        else if (n === 3) { /* barbeiro já tem padrão */ }
        else if (n === 4 && !selectedSlot) { pubAlert('Selecione um horário primeiro.', 'warning'); return; }

        for (var i = 1; i <= 4; i++) {
          var el = document.getElementById('step-' + i);
          if (el) el.style.display = i === n ? 'block' : 'none';
        }
        // Atualizar dots
        for (var i = 1; i <= 4; i++) {
          var dot = document.getElementById('dot-' + i);
          var line = document.getElementById('line-' + i);
          if (dot) {
            if (i < n) { dot.className = 'step-dot done'; dot.textContent = '✓'; }
            else if (i === n) { dot.className = 'step-dot active'; dot.textContent = String(i); }
            else { dot.className = 'step-dot pending'; dot.textContent = String(i); }
          }
          if (line) {
            line.className = 'step-line' + (i < n ? ' done' : '');
          }
        }
        currentStep = n;
        if (n === 3) renderCalendar();
        if (n === 4) renderSummary();
        window.scrollTo(0, 0);
      }

      // ─── Etapa 1: Serviço principal + accordion de serviços extras ──────────
      function fmtDur(min) {
        return min >= 60 ? Math.floor(min/60) + 'h' + (min%60 ? (min%60)+'min' : '') : min + 'min';
      }
      function fmtPrice(p) { return 'R$ ' + parseFloat(p).toFixed(2).replace('.', ','); }

      function renderMainServiceCard() {
        var el = document.getElementById('main-svc-card');
        var selectEl = document.getElementById('main-svc-select');
        var addMoreEl = document.getElementById('add-more-toggle');
        var titleEl = document.getElementById('step1-title');
        var btnNext = document.getElementById('btn-step1-next');

        if (!selectedService) {
          // Modo seleção: esconde card e accordion, mostra grade de escolha
          if (el) el.style.display = 'none';
          if (addMoreEl) addMoreEl.style.display = 'none';
          if (titleEl) titleEl.textContent = '✂ Escolha um serviço';
          if (btnNext) { btnNext.classList.remove('ready'); }

          if (!selectEl) return;
          if (SERVICES.length === 0) {
            selectEl.style.display = 'block';
            selectEl.innerHTML = '<div style="text-align:center;padding:32px 16px;color:var(--muted);font-size:14px">Nenhum servi&ccedil;o dispon&iacute;vel no momento.</div>';
            return;
          }
          selectEl.style.display = 'grid';
          var html = '';
          SERVICES.forEach(function(s) {
            var thumbHtml = s.thumbnailUrl
              ? '<img class="svc-thumb2" src="' + escHtml(s.thumbnailUrl) + '" alt="" loading="lazy" />'
              : '<div class="svc-thumb2-placeholder">✂</div>';
            html += '<div class="svc-card2" onclick="selectService(' + s.id + ')">' +
              thumbHtml +
              '<div class="svc-body2">' +
                '<div class="svc-name2">' + escHtml(s.name) + '</div>' +
                '<div class="svc-meta2">⏱ ' + fmtDur(s.durationMinutes) + '</div>' +
                '<div class="svc-price2">' + fmtPrice(s.price) + '</div>' +
              '</div>' +
            '</div>';
          });
          selectEl.innerHTML = html;
          return;
        }

        // Modo exibição: esconde grade, mostra card com botão de remover
        if (selectEl) selectEl.style.display = 'none';
        if (addMoreEl) addMoreEl.style.display = '';
        if (titleEl) titleEl.textContent = '✂ Serviço selecionado';
        if (btnNext) { btnNext.classList.add('ready'); }

        var s = selectedService;
        var thumbHtml = s.thumbnailUrl
          ? '<img class="main-svc-thumb" src="' + escHtml(s.thumbnailUrl) + '" alt="" loading="lazy" />'
          : '<div class="main-svc-thumb-placeholder">✂</div>';

        el.style.display = 'flex';
        el.innerHTML = thumbHtml +
          '<div class="main-svc-body">' +
            '<div class="main-svc-name">' + escHtml(s.name) + '</div>' +
            '<div class="main-svc-meta">⏱ ' + fmtDur(s.durationMinutes) + '</div>' +
            '<div class="main-svc-price">' + fmtPrice(s.price) + '</div>' +
          '</div>' +
          '<button class="main-svc-remove" onclick="removeMainService()" title="Remover serviço">✕</button>';
      }

      function removeMainService() {
        selectedService = null;
        selectedServices = [];
        var summaryEl = document.getElementById('selected-summary');
        if (summaryEl) { summaryEl.style.display = 'none'; summaryEl.innerHTML = ''; }
        var addMorePanel = document.getElementById('add-more-panel');
        if (addMorePanel) addMorePanel.style.display = 'none';
        renderMainServiceCard();
      }

      function renderServices() {
        var list = document.getElementById('services-list');
        if (!list) return;
        var html = '';
        SERVICES.forEach(function(s) {
          // Não mostrar o serviço principal na lista de extras
          if (selectedService && s.id === selectedService.id) return;
          var isExtra = selectedServices.some(function(x) { return x.id === s.id; });
          var thumbHtml = s.thumbnailUrl
            ? '<img class="svc-thumb2" src="' + escHtml(s.thumbnailUrl) + '" alt="" loading="lazy" />'
            : '<div class="svc-thumb2-placeholder">✂</div>';
          html += '<div class="svc-card2' + (isExtra ? ' extra-selected' : '') + '" id="svc-' + s.id + '" onclick="toggleExtraService(' + s.id + ')">' +
            thumbHtml +
            '<div class="svc-body2">' +
              '<div class="svc-name2">' + escHtml(s.name) + '</div>' +
              '<div class="svc-meta2">⏱ ' + fmtDur(s.durationMinutes) + '</div>' +
              '<div class="svc-price2">' + fmtPrice(s.price) + '</div>' +
            '</div></div>';
        });
        list.innerHTML = html || '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Nenhum outro serviço disponível.</div>';
      }

      function toggleExtraService(id) {
        var svc = SERVICES.find(function(s) { return s.id === id; });
        if (!svc) return;
        var idx = selectedServices.findIndex(function(s) { return s.id === id; });
        if (idx >= 0) {
          selectedServices.splice(idx, 1);
        } else {
          selectedServices.push(svc);
        }
        renderServices();
        renderSelectedSummary();
        selectedSlot = null;
      }

      function renderSelectedSummary() {
        var el = document.getElementById('selected-summary');
        if (!el) return;
        if (selectedServices.length === 0) {
          el.style.display = 'none';
          return;
        }
        var totalMin = (selectedService ? selectedService.durationMinutes : 0) +
          selectedServices.reduce(function(acc, s) { return acc + s.durationMinutes; }, 0);
        var totalPrice = (selectedService ? parseFloat(selectedService.price) : 0) +
          selectedServices.reduce(function(acc, s) { return acc + parseFloat(s.price); }, 0);
        var rows = selectedServices.map(function(s) {
          return '<div class="selected-summary-row"><span>' + escHtml(s.name) + '</span><span>' + fmtPrice(s.price) + '</span></div>';
        }).join('');
        el.innerHTML =
          '<div class="selected-summary-title">Serviços adicionados</div>' +
          rows +
          '<div class="selected-summary-total"><span>Total: ' + fmtDur(totalMin) + '</span><span>' + fmtPrice(String(totalPrice)) + '</span></div>';
        el.style.display = 'block';
      }

      function toggleAddMore() {
        var panel = document.getElementById('add-more-panel');
        var icon = document.getElementById('add-more-icon');
        if (!panel) return;
        var isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';
        if (icon) icon.textContent = isOpen ? '＋' : '－';
        if (!isOpen) renderServices();
      }

      function selectService(id) {
        var svc = SERVICES.find(function(s) { return s.id === id; });
        if (!svc) {
          // Serviço não encontrado na lista (pode estar inativo) — exibe grade normalmente
          renderMainServiceCard();
          return;
        }
        selectedService = svc;
        // Remover o serviço principal dos extras se ele estiver lá
        selectedServices = selectedServices.filter(function(s) { return s.id !== id; });
        renderMainServiceCard();
        renderServices();
        renderSelectedSummary();
        selectedSlot = null;
      }

      // ─── Etapa 2: Barbeiros (com foto grande) ────────────────────────────────
      function renderBarbers() {
        var list = document.getElementById('barbers-list');
        var html = '';
        BARBERS.forEach(function(b) {
          var initials = b.name.split(' ').map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
          var isSel = selectedBarber && selectedBarber.id === b.id;
          html += '<div class="barber-card' + (isSel ? ' selected' : '') + '" id="barber-' + b.id + '" onclick="selectBarber(' + b.id + ')">';
          if (b.photoUrl) {
            html += '<img class="barber-avatar" src="' + escHtml(b.photoUrl) + '" alt="' + escHtml(b.name) + '" onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;flex&quot;" />';
            html += '<div class="barber-avatar-placeholder" style="display:none">' + initials + '</div>';
          } else {
            html += '<div class="barber-avatar-placeholder">' + initials + '</div>';
          }
          html += '<div class="barber-name">' + escHtml(b.name) + '</div>';
          if (b.specialties) html += '<div class="barber-spec">' + escHtml(b.specialties.split(',')[0].trim()) + '</div>';
          html += '<div class="barber-check-badge">✓</div>';
          html += '</div>';
        });
        list.innerHTML = html;
      }

      function selectBarber(id) {
        selectedBarber = BARBERS.find(function(b) { return b.id === id; }) || null;
        document.querySelectorAll('.barber-card').forEach(function(el) { el.classList.remove('selected'); });
        var card = document.getElementById('barber-' + id);
        if (card) card.classList.add('selected');
        selectedSlot = null;
      }

      // ─── Etapa 3: Calendário Mensal + Slots ──────────────────────────────────
      var calViewYear = new Date().getFullYear();
      var calViewMonth = new Date().getMonth(); // 0-indexed
      var MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      var WEEKDAY_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

      // Cache de disponibilidade por dia: { 'YYYY-MM-DD': true/false/null }
      var dayAvailCache = {};

      async function prefetchMonthAvailability(year, month) {
        var barberId = selectedBarber ? selectedBarber.id : ${firstBarberId};
        var extraMin = selectedServices.reduce(function(acc, s) { return acc + s.durationMinutes; }, 0);
        var duration = (selectedService ? selectedService.durationMinutes : 30) + extraMin;
        var today = new Date(); today.setHours(0,0,0,0);
        var maxDate = new Date(today); maxDate.setDate(today.getDate() + 60);
        var firstDay = new Date(year, month, 1);
        var lastDay = new Date(year, month + 1, 0);
        var promises = [];
        for (var d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
          var dt = new Date(d);
          if (dt < today || dt > maxDate) continue;
          var iso = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
          if (dayAvailCache[iso] !== undefined) continue;
          dayAvailCache[iso] = null; // marcando como "carregando"
          (function(isoDate) {
            promises.push(
              fetch('/pub-api/slots?barberId=' + barberId + '&date=' + isoDate + '&duration=' + duration)
                .then(function(r) { return r.json(); })
                .then(function(slots) { dayAvailCache[isoDate] = slots.length > 0; })
                .catch(function() { dayAvailCache[isoDate] = false; })
            );
          })(iso);
        }
        if (promises.length > 0) {
          await Promise.all(promises);
          renderCalendar();
        }
      }

      function renderCalendar() {
        var today = new Date();
        today.setHours(0,0,0,0);
        var maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 60);

        var label = document.getElementById('cal-month-label');
        if (label) label.textContent = MONTH_NAMES[calViewMonth] + ' ' + calViewYear;

        var prevBtn = document.getElementById('cal-prev');
        var nextBtn = document.getElementById('cal-next');
        if (prevBtn) prevBtn.disabled = (calViewYear === today.getFullYear() && calViewMonth <= today.getMonth());
        if (nextBtn) {
          nextBtn.disabled = (calViewYear > maxDate.getFullYear() || (calViewYear === maxDate.getFullYear() && calViewMonth >= maxDate.getMonth()));
        }

        var grid = document.getElementById('cal-grid');
        var html = '';
        WEEKDAY_NAMES.forEach(function(d) {
          html += '<div class="cal-header-cell">' + d + '</div>';
        });

        var firstDay = new Date(calViewYear, calViewMonth, 1).getDay();
        var daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

        for (var i = 0; i < firstDay; i++) {
          html += '<div class="cal-cell cal-empty"></div>';
        }

        for (var day = 1; day <= daysInMonth; day++) {
          var d = new Date(calViewYear, calViewMonth, day);
          d.setHours(0,0,0,0);
          var iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
          var isToday = (d.getTime() === today.getTime());
          var isPast = d < today;
          var isFuture = d > maxDate;
          var isSel = selectedDate === iso;
          var cls = 'cal-cell';
          var avail = dayAvailCache[iso];
          var isUnavail = (!isPast && !isFuture && avail === false);
          if (isSel) cls += ' cal-selected';
          else if (isToday) cls += ' cal-today';
          if (isPast || isFuture) cls += ' cal-past';
          else if (isUnavail) cls += ' cal-unavailable';
          var dataAttr = ' data-iso="' + iso + '"';
          var clickable = (!isPast && !isFuture && !isUnavail) ? ' data-clickable="1"' : '';
          html += '<div class="' + cls + '"' + dataAttr + clickable + '>' + day + '</div>';
        }

        grid.innerHTML = html;
        // Event delegation para cliques nos dias
        grid.onclick = function(e) {
          var cell = e.target.closest('[data-clickable]');
          if (cell) selectDate(cell.getAttribute('data-iso'));
        };
        if (selectedDate) loadSlots();
        // Pré-carregar disponibilidade dos dias do mês em background
        prefetchMonthAvailability(calViewYear, calViewMonth);
      }

      function changeMonth(delta) {
        calViewMonth += delta;
        if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
        if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
        renderCalendar();
      }

      function selectDate(iso) {
        selectedDate = iso;
        selectedSlot = null;
        renderCalendar();
        var btn = document.getElementById('btn-step3-next');
        if (btn) btn.className = 'btn-next-step';
        loadSlots();
      }

      async function loadSlots() {
        var slotsArea = document.getElementById('slots-area');
        if (!selectedDate || !selectedService) {
          slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Selecione uma data para ver os horários.</div>';
          return;
        }
        slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Carregando horários...</div>';
        var barberId = selectedBarber ? selectedBarber.id : ${firstBarberId};
        var extraMin = selectedServices.reduce(function(acc, s) { return acc + s.durationMinutes; }, 0);
        var duration = (selectedService ? selectedService.durationMinutes : 30) + extraMin;
        try {
          var r = await fetch('/pub-api/slots?barberId=' + barberId + '&date=' + selectedDate + '&duration=' + duration);
          var slots = await r.json();
          if (!slots.length) {
            slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Nenhum horário disponível nesta data.</div>';
            return;
          }
          // Dividir em manhã (< 12h), tarde (12-18h), noite (>= 18h)
          var manha = slots.filter(function(s) { return parseInt(s.startTime) < 12; });
          var tarde = slots.filter(function(s) { var h = parseInt(s.startTime); return h >= 12 && h < 18; });
          var noite = slots.filter(function(s) { return parseInt(s.startTime) >= 18; });
          function slotBtn(s) {
            return '<button class="slot-btn" data-start="' + s.startTime + '" data-end="' + s.endTime + '">' + s.startTime + '</button>';
          }
          var html = '<div style="margin-top:16px">';
          if (manha.length) {
            html += '<div class="period-section"><div class="period-label"><span class="period-label-icon">☀️</span><span>Manhã</span><span class="period-label-line"></span></div><div class="slots-row">';
            manha.forEach(function(s) { html += slotBtn(s); });
            html += '</div></div>';
          }
          if (tarde.length) {
            html += '<div class="period-section"><div class="period-label"><span class="period-label-icon">🌤️</span><span>Tarde</span><span class="period-label-line"></span></div><div class="slots-row">';
            tarde.forEach(function(s) { html += slotBtn(s); });
            html += '</div></div>';
          }
          if (noite.length) {
            html += '<div class="period-section"><div class="period-label"><span class="period-label-icon">🌙</span><span>Noite</span><span class="period-label-line"></span></div><div class="slots-row">';
            noite.forEach(function(s) { html += slotBtn(s); });
            html += '</div></div>';
          }
          html += '</div>';
          slotsArea.innerHTML = html;
          // Event delegation para cliques nos slots
          slotsArea.onclick = function(e) {
            var btn = e.target.closest('.slot-btn');
            if (!btn) return;
            var start = btn.getAttribute('data-start');
            var end = btn.getAttribute('data-end');
            selectedSlot = { startTime: start, endTime: end };
            document.querySelectorAll('.slot-btn').forEach(function(b) { b.classList.remove('selected'); });
            btn.classList.add('selected');
            var nextBtn = document.getElementById('btn-step3-next');
            if (nextBtn) nextBtn.className = 'btn-next-step ready';
          };
        } catch(e) {
          slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:#F87171;font-size:13px">Erro ao carregar horários.</div>';
        }
      }

      function selectSlot(start, end, btn) {
        selectedSlot = { startTime: start, endTime: end };
        document.querySelectorAll('.slot-btn').forEach(function(b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        var nextBtn = document.getElementById('btn-step3-next');
        if (nextBtn) nextBtn.className = 'btn-next-step ready';
      }

      // ─── Etapa 4: Resumo ──────────────────────────────────────────────────────
      function renderSummary() {
        var el = document.getElementById('booking-summary');
        if (!el) return;
        var allSvcs = selectedService ? [selectedService].concat(selectedServices) : [];
        var svcName = allSvcs.length > 1
          ? allSvcs.map(function(s) { return s.name; }).join(' + ')
          : (selectedService ? selectedService.name : '—');
        var svcThumb = selectedService && selectedService.thumbnailUrl ? selectedService.thumbnailUrl : null;
        var totalPrice = allSvcs.reduce(function(acc, s) { return acc + parseFloat(s.price); }, 0);
        var barberName = selectedBarber ? selectedBarber.name : 'Qualquer profissional';
        var barberPhoto = selectedBarber && selectedBarber.photoUrl ? selectedBarber.photoUrl : null;
        var barberInitials = selectedBarber ? selectedBarber.name.split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase() : '?';
        var dateFormatted = selectedDate ? selectedDate.split('-').reverse().join('/') : '—';
        var timeStr = selectedSlot ? selectedSlot.startTime + ' – ' + selectedSlot.endTime : '—';
        var price = allSvcs.length > 0 ? 'R$ ' + totalPrice.toFixed(2).replace('.', ',') : '—';

        var thumbHtml = svcThumb
          ? '<img class="summary-svc-thumb" src="' + escHtml(svcThumb) + '" alt="" />'
          : '<div class="summary-svc-thumb-placeholder">✂</div>';

        var barberAvatarHtml = barberPhoto
          ? '<img style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid var(--primary);flex-shrink:0" src="' + escHtml(barberPhoto) + '" alt="" />'
          : '<div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--muted);flex-shrink:0;border:2px solid var(--border)">' + barberInitials + '</div>';

        el.innerHTML =
          '<div class="summary-hero">' +
            thumbHtml +
            '<div>' +
              '<div class="summary-svc-name">' + escHtml(svcName) + '</div>' +
              '<div class="summary-svc-price">' + price + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="summary-rows">' +
            '<div class="summary-row"><span class="summary-label">Profissional</span><span class="summary-value" style="display:flex;align-items:center;gap:8px">' + barberAvatarHtml + escHtml(barberName) + '</span></div>' +
            '<div class="summary-divider"></div>' +
            '<div class="summary-row"><span class="summary-label">Data</span><span class="summary-value">' + dateFormatted + '</span></div>' +
            '<div class="summary-row"><span class="summary-label">Horário</span><span class="summary-value">' + timeStr + '</span></div>' +
          '</div>';

        var btn = document.getElementById('confirm-btn');
        if (btn && !LOGGED_CLIENT) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
          btn.textContent = 'Faça login para confirmar';
          btn.onclick = function() {
            window.location.href = '/pub/' + SLUG + '/login?redirect=agendar&service=' + selectedService.id + '&date=' + selectedDate + '&barber=' + (selectedBarber ? selectedBarber.id : '') + '&start=' + selectedSlot.startTime + '&end=' + selectedSlot.endTime;
          };
        } else if (btn && LOGGED_CLIENT) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
          btn.textContent = 'Confirmar Agendamento';
          btn.onclick = confirmBooking;
        }
      }

      // ─── Confirmar Agendamento ────────────────────────────────────────────────
      async function confirmBooking() {
        if (!LOGGED_CLIENT || !selectedSlot || !selectedService) return;
        var btn = document.getElementById('confirm-btn');
        var errorMsg = document.getElementById('error-msg');
        var successMsg = document.getElementById('success-msg');
        btn.disabled = true;
        btn.textContent = 'Confirmando...';
        errorMsg.style.display = 'none';
        var barberId = selectedBarber ? selectedBarber.id : ${firstBarberId};
        try {
          var r = await fetch('/pub-api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: SLUG,
              clientId: LOGGED_CLIENT.id,
              barberId: parseInt(barberId),
              serviceId: parseInt(selectedService.id),
              date: selectedDate,
              startTime: selectedSlot.startTime,
              endTime: selectedSlot.endTime,
            })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao confirmar agendamento');
          lastAppointmentId = data.id;
          lastServicePrice = parseFloat(selectedService.price);
          btn.style.display = 'none';
          if (HAS_ASAAS && lastServicePrice > 0) {
            showPaymentPanel(data.id, lastServicePrice, selectedDate, selectedSlot.startTime);
          } else {
            var dateFormatted = selectedDate.split('-').reverse().join('/');
            var svcName = selectedService ? selectedService.name : 'Serviço';
            var barberName = selectedBarber ? selectedBarber.name : 'profissional';
            var waMsg = 'Olá! Meu agendamento foi confirmado:%0A%0A✂ ' + encodeURIComponent(svcName) + '%0A📅 ' + dateFormatted + ' às ' + selectedSlot.startTime + '%0A💈 ' + encodeURIComponent(barberName);
            var waHtml = WA_NUMBER
              ? '<a href="https://wa.me/' + WA_NUMBER + '?text=' + waMsg + '" target="_blank" style="display:block;margin-top:14px;padding:14px;background:#25D366;color:#fff;font-size:14px;font-weight:800;border-radius:12px;text-decoration:none;text-align:center">📲 Confirmar pelo WhatsApp</a>'
              : '';
            successMsg.innerHTML =
              '<div style="text-align:center;margin-bottom:16px">' +
                '<div style="font-size:32px;margin-bottom:8px">✅</div>' +
                '<div style="font-size:16px;font-weight:800;color:#4ADE80">Agendamento confirmado!</div>' +
                '<div style="font-size:13px;color:var(--muted);margin-top:4px">' + dateFormatted + ' às ' + selectedSlot.startTime + '</div>' +
              '</div>' +
              waHtml +
              '<a href="/pub/' + SLUG + '" style="display:block;margin-top:10px;text-align:center;color:var(--primary);font-size:13px">← Voltar para a página da barbearia</a>';
            successMsg.style.display = 'block';
          }
        } catch(e) {
          errorMsg.textContent = e.message;
          errorMsg.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Confirmar Agendamento';
        }
      }

      // ─── Utilitários ──────────────────────────────────────────────────────────
      function escHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      // ─── Inicializar ──────────────────────────────────────────────────────────
      renderBarbers();
      renderMainServiceCard();

      // Pré-preencher via query string (retorno do login ou clique em "Agendar")
      var params = new URLSearchParams(window.location.search);
      if (params.get('service')) {
        var svcId = parseInt(params.get('service'));
        selectService(svcId);
      }
      // Se não veio ?service= na URL, selectedService permanece null
      // e renderMainServiceCard() já exibe a grade de seleção
      if (params.get('barber')) {
        var bid = parseInt(params.get('barber'));
        var found = BARBERS.find(function(b) { return b.id === bid; });
        if (found) { selectedBarber = found; }
      }
      if (params.get('date')) selectedDate = params.get('date');
      if (params.get('start') && params.get('end')) {
        selectedSlot = { startTime: params.get('start'), endTime: params.get('end') };
      }
      // Se voltou do login com dados preenchidos, ir direto para confirmação
      if (params.get('service') && params.get('date') && params.get('start')) {
        goToStep(4);
      }

      // ─── Pagamento (Asaas) ────────────────────────────────────────────────────
      function showPaymentPanel(appointmentId, price, date, time) {
        var priceFormatted = 'R$ ' + price.toFixed(2).replace('.', ',');
        var successMsg = document.getElementById('success-msg');
        successMsg.innerHTML = [
          '<div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;overflow:hidden">',
            // Header de sucesso
            '<div style="background:linear-gradient(135deg,#22C55E18 0%,#22C55E06 100%);border-bottom:1px solid #22C55E28;padding:28px 24px;text-align:center">',
              '<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#22C55E33,#22C55E11);border:2px solid #22C55E55;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:28px">✅</div>',
              '<div style="font-size:19px;font-weight:900;color:#4ADE80;margin-bottom:6px">Agendamento Confirmado!</div>',
              '<div style="display:inline-flex;align-items:center;gap:6px;background:#22C55E18;border:1px solid #22C55E33;border-radius:20px;padding:5px 14px;font-size:13px;color:#4ADE80;font-weight:600">📅 ' + date.split('-').reverse().join('/') + ' às ' + time + '</div>',
            '</div>',
            // Seção de pagamento
            '<div style="padding:24px">',
              '<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:16px">Como deseja pagar?</div>',
              '<div style="display:flex;flex-direction:column;gap:10px">',
                // Botão Cartão
                '<button onclick="payOnline(' + appointmentId + ',' + price + ')" id="btn-pay-online" style="display:flex;align-items:center;gap:14px;width:100%;padding:16px 18px;background:var(--primary);color:#0A0A0A;font-size:15px;font-weight:800;border:none;border-radius:14px;cursor:pointer;text-align:left;box-shadow:0 4px 14px var(--primary)44">',
                  '<div style="width:40px;height:40px;border-radius:10px;background:#0A0A0A22;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">💳</div>',
                  '<div style="flex:1">',
                    '<div style="font-size:14px;font-weight:800">Pagar com Cartão</div>',
                    '<div style="font-size:12px;font-weight:600;opacity:0.75;margin-top:1px">Crédito ou Débito • ' + priceFormatted + '</div>',
                  '</div>',
                  '<div style="font-size:18px;opacity:0.6">›</div>',
                '</button>',
                // Botão Pix
                '<button onclick="payPix(' + appointmentId + ',' + price + ')" id="btn-pay-pix" style="display:flex;align-items:center;gap:14px;width:100%;padding:16px 18px;background:var(--surface2);color:var(--text);font-size:15px;font-weight:700;border:1.5px solid var(--border);border-radius:14px;cursor:pointer;text-align:left">',
                  '<div style="width:40px;height:40px;border-radius:10px;background:#22C55E18;border:1px solid #22C55E33;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">📱</div>',
                  '<div style="flex:1">',
                    '<div style="font-size:14px;font-weight:700">Pagar via Pix</div>',
                    '<div style="font-size:12px;color:var(--muted);margin-top:1px">QR Code instantâneo • ' + priceFormatted + '</div>',
                  '</div>',
                  '<div style="font-size:18px;color:var(--muted)">›</div>',
                '</button>',
                // Botão Pagar na Barbearia
                '<button onclick="payAtShop()" style="display:flex;align-items:center;gap:14px;width:100%;padding:14px 18px;background:transparent;color:var(--muted);font-size:14px;font-weight:600;border:1px solid var(--border);border-radius:14px;cursor:pointer;text-align:left">',
                  '<div style="width:40px;height:40px;border-radius:10px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🏪</div>',
                  '<div>Pagar na barbearia</div>',
                '</button>',
              '</div>',
              '<div id="payment-status" style="margin-top:14px;font-size:13px"></div>',
            '</div>',
          '</div>',
        ].join('');
        successMsg.style.display = 'block';
        successMsg.style.background = 'transparent';
        successMsg.style.border = 'none';
        successMsg.style.padding = '0';
      }

      function payAtShop() {
        var successMsg = document.getElementById('success-msg');
        var dateFormatted = selectedDate ? selectedDate.split('-').reverse().join('/') : '';
        var svcName = selectedService ? selectedService.name : 'Serviço';
        var barberName = selectedBarber ? selectedBarber.name : 'profissional';
        var waMsg = 'Olá! Meu agendamento foi confirmado:%0A%0A✂ ' + encodeURIComponent(svcName) + '%0A📅 ' + dateFormatted + ' às ' + (selectedSlot ? selectedSlot.startTime : '') + '%0A💈 ' + encodeURIComponent(barberName);
        var waHtml = WA_NUMBER
          ? '<a href="https://wa.me/' + WA_NUMBER + '?text=' + waMsg + '" target="_blank" style="display:block;margin-top:14px;padding:14px;background:#25D366;color:#fff;font-size:14px;font-weight:800;border-radius:12px;text-decoration:none;text-align:center">📲 Confirmar pelo WhatsApp</a>'
          : '';
        successMsg.innerHTML =
          '<div style="text-align:center;margin-bottom:12px">' +
            '<div style="font-size:32px;margin-bottom:8px">✅</div>' +
            '<div style="font-size:16px;font-weight:800;color:#4ADE80">Agendamento confirmado!</div>' +
            '<div style="font-size:13px;color:var(--muted);margin-top:4px">Você pagará na barbearia no dia do atendimento.</div>' +
          '</div>' +
          waHtml +
          '<a href="/pub/' + SLUG + '" style="display:block;margin-top:10px;text-align:center;color:var(--primary);font-size:13px">← Voltar para a página da barbearia</a>';
      }

      // ─── Modal de CPF para Pix ────────────────────────────────────────────────
      function showCpfModal(onConfirm) {
        var overlay = document.createElement('div');
        overlay.id = 'cpf-modal-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
        overlay.innerHTML =
          '<div style="background:#1a2035;border:1px solid rgba(155,48,255,0.3);border-radius:20px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">' +
            '<div style="text-align:center;margin-bottom:20px">' +
              '<div style="font-size:36px;margin-bottom:8px">📱</div>' +
              '<div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:4px">Informe seu CPF</div>' +
              '<div style="font-size:13px;color:#8b949e">Necessário para gerar a cobrança Pix via Asaas</div>' +
            '</div>' +
            '<input id="cpf-modal-input" type="text" placeholder="000.000.000-00" maxlength="14" inputmode="numeric" style="width:100%;padding:14px 16px;background:#0d1117;border:1px solid rgba(155,48,255,0.3);border-radius:12px;color:#fff;font-size:16px;text-align:center;letter-spacing:2px;box-sizing:border-box;margin-bottom:8px" />' +
            '<div id="cpf-modal-error" style="color:#F87171;font-size:12px;text-align:center;min-height:18px;margin-bottom:12px"></div>' +
            '<div style="display:flex;gap:10px">' +
              '<button onclick="document.getElementById(&quot;cpf-modal-overlay&quot;).remove()" style="flex:1;padding:12px;border-radius:12px;border:1px solid rgba(155,48,255,0.3);background:transparent;color:#8b949e;font-size:14px;font-weight:600;cursor:pointer">Cancelar</button>' +
              '<button id="cpf-modal-confirm" style="flex:1;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#9b30ff,#7c3aed);color:#fff;font-size:14px;font-weight:700;cursor:pointer">Confirmar</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(overlay);
        var input = document.getElementById('cpf-modal-input');
        input.focus();
        input.oninput = function() {
          var v = this.value.replace(/[^0-9]/g,'').slice(0,11);
          if (v.length > 9) this.value = v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6,9)+'-'+v.slice(9);
          else if (v.length > 6) this.value = v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6);
          else if (v.length > 3) this.value = v.slice(0,3)+'.'+v.slice(3);
          else this.value = v;
        };
        document.getElementById('cpf-modal-confirm').onclick = function() {
          var cpf = input.value.replace(/[^0-9]/g,'');
          if (cpf.length < 11) {
            document.getElementById('cpf-modal-error').textContent = 'CPF inválido. Digite os 11 dígitos.';
            input.style.borderColor = '#F87171';
            return;
          }
          overlay.remove();
          onConfirm(cpf);
        };
      }

      // ─── Pagamento via Pix (Asaas) ───────────────────────────────────────────────
      async function payPix(appointmentId, price) {
        var btn = document.getElementById('btn-pay-pix');
        var status = document.getElementById('payment-status');
        var clientCpf = LOGGED_CLIENT && LOGGED_CLIENT.cpf ? LOGGED_CLIENT.cpf : null;
        if (!clientCpf) {
          showCpfModal(function(cpf) { doPix(appointmentId, price, cpf, btn, status); });
          return;
        }
        doPix(appointmentId, price, clientCpf, btn, status);
      }
      async function doPix(appointmentId, price, clientCpf, btn, status) {
        btn.disabled = true; btn.textContent = 'Gerando QR Code...';
        try {
          var r = await fetch('/pub-api/asaas-pix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: SLUG, appointmentId, amount: price, description: 'Agendamento', clientCpf }) });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao gerar Pix');
          var paymentId = data.paymentId;
          status.innerHTML =
            '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-top:8px">' +
              '<div style="background:linear-gradient(135deg,#22C55E22 0%,#22C55E08 100%);border-bottom:1px solid #22C55E33;padding:16px;text-align:center">' +
                '<div style="font-size:15px;font-weight:800;color:#4ADE80">📱 Pague via Pix</div>' +
                '<div style="font-size:12px;color:var(--muted);margin-top:2px">Escaneie o QR Code ou copie o código</div>' +
              '</div>' +
              '<div style="padding:20px;text-align:center">' +
                (data.pixQrCode ? '<img src="data:image/png;base64,' + data.pixQrCode + '" style="width:200px;height:200px;display:block;margin:0 auto 16px;border-radius:12px;border:2px solid var(--border)" />' : '') +
                '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px">Código Pix (Copia e Cola)</div>' +
                '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:11px;word-break:break-all;font-family:monospace;text-align:left;margin-bottom:12px" id="pix-code">' + (data.pixCopyCola || '') + '</div>' +
                '<button onclick="copyPixCode()" style="width:100%;padding:10px;background:var(--primary);color:#0A0A0A;font-size:13px;font-weight:800;border:none;border-radius:10px;cursor:pointer;margin-bottom:12px">📋 Copiar código Pix</button>' +
                '<div style="font-size:12px;color:var(--muted);line-height:1.5" id="pix-confirm-msg">Após o pagamento, seu agendamento será confirmado automaticamente.</div>' +
                '<button onclick="checkPixPayment(&quot;' + paymentId + '&quot;)" style="margin-top:10px;width:100%;padding:10px;background:var(--surface2);color:var(--text);font-size:13px;font-weight:700;border:1.5px solid var(--border);border-radius:10px;cursor:pointer">🔄 Verificar pagamento</button>' +
              '</div>' +
            '</div>';
          btn.style.display = 'none';
        } catch(e) { status.style.color = '#F87171'; status.textContent = e.message; btn.disabled = false; btn.textContent = '📱 Pagar via Pix'; }
      }
      function copyPixCode() {
        var el = document.getElementById('pix-code');
        if (el) { navigator.clipboard.writeText(el.textContent).then(function() { pubAlert('Código Pix copiado! ✓', 'success'); }); }
      }
      async function checkPixPayment(paymentId) {
        try {
          var r = await fetch('/pub-api/asaas-payment-status/' + paymentId);
          var data = await r.json();
          var msg = document.getElementById('pix-confirm-msg');
          if (data.paid) {
            showPaymentSuccess('pix');
          } else {
            if (msg) msg.innerHTML = '<span style="color:var(--muted)">⏳ Pagamento ainda não confirmado. Aguarde alguns segundos e tente novamente.</span>';
          }
        } catch(e) { console.error('Erro ao verificar pagamento', e); }
      }
      // ─── Máscaras de campos ────────────────────────────────────────────────────
      function detectCardBrand(value) {
        var v = value.replace(/[^0-9]/g, '');
        var brand = '';
        if (/^4/.test(v)) brand = '💳 Visa';
        else if (/^(5[1-5]|2[2-7])/.test(v)) brand = '💳 Master';
        else if (/^3[47]/.test(v)) brand = '💳 Amex';
        else if (/^606282/.test(v)) brand = '💳 Hiper';
        else if (/^(6011|65|64[4-9]|622)/.test(v)) brand = '💳 Elo';
        else if (/^36/.test(v)) brand = '💳 Diners';
        var el = document.getElementById('cc-brand');
        if (el) el.textContent = v.length >= 1 ? brand.split(' ')[1] || '' : '';
      }
      function maskCardNumber(el) {
        var v = el.value.replace(/[^0-9]/g,'').substring(0,16);
        el.value = v.replace(/([0-9]{4})(?=[0-9])/g,'$1 ').trim();
      }
      function maskCpfInput(el) {
        var v = el.value.replace(/[^0-9]/g,'').substring(0,11);
        if (v.length > 9) v = v.replace(/([0-9]{3})([0-9]{3})([0-9]{3})([0-9]{1,2})/,'$1.$2.$3-$4');
        else if (v.length > 6) v = v.replace(/([0-9]{3})([0-9]{3})([0-9]{1,3})/,'$1.$2.$3');
        else if (v.length > 3) v = v.replace(/([0-9]{3})([0-9]{1,3})/,'$1.$2');
        el.value = v;
      }
      function maskCpf(el) {
        var v = el.value.replace(/[^0-9]/g,'').substring(0,11);
        if (v.length > 9) v = v.replace(/([0-9]{3})([0-9]{3})([0-9]{3})([0-9]{1,2})/,'$1.$2.$3-$4');
        else if (v.length > 6) v = v.replace(/([0-9]{3})([0-9]{3})([0-9]{1,3})/,'$1.$2.$3');
        else if (v.length > 3) v = v.replace(/([0-9]{3})([0-9]{1,3})/,'$1.$2');
        el.value = v;
      }
      function maskCep(el) {
        var v = el.value.replace(/[^0-9]/g,'').substring(0,8);
        if (v.length > 5) v = v.replace(/([0-9]{5})([0-9]{1,3})/,'$1-$2');
        el.value = v;
      }
      function maskMonth(el) {
        var v = el.value.replace(/[^0-9]/g,'').substring(0,2);
        if (v.length === 2) { var n = parseInt(v); if (n < 1) v = '01'; if (n > 12) v = '12'; }
        el.value = v;
      }
      // ─── Pagamento via Cartão (Asaas) ─────────────────────────────────────────
      async function payOnline(appointmentId, price) {
        var status = document.getElementById('payment-status');
        var inpStyle = 'padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;width:100%;box-sizing:border-box';
        var inpStyleFlex = 'padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;flex:1;box-sizing:border-box';
        status.innerHTML =
          '<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-top:8px">' +
            '<div style="font-size:15px;font-weight:800;margin-bottom:4px">💳 Dados do Cartão</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">🔒 Pagamento seguro via Asaas</div>' +
            '<div style="display:flex;flex-direction:column;gap:10px">' +
              '<div>' +
                '<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:4px">Nome no cartão</label>' +
                '<input id="cc-name" placeholder="Ex: JOAO DA SILVA" autocomplete="cc-name" style="' + inpStyle + '" />' +
              '</div>' +
              '<div>' +
                '<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:4px">Número do cartão</label>' +
                '<div style="position:relative">' +
                  '<input id="cc-number" placeholder="0000 0000 0000 0000" maxlength="19" inputmode="numeric" autocomplete="cc-number" oninput="maskCardNumber(this);detectCardBrand(this.value)" style="' + inpStyle + ';letter-spacing:1px;padding-right:56px" />' +
                  '<span id="cc-brand" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:22px;line-height:1"></span>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex;gap:10px">' +
                '<div style="flex:1;min-width:0">' +
                  '<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:4px">Mês</label>' +
                  '<input id="cc-month" placeholder="MM" maxlength="2" inputmode="numeric" autocomplete="cc-exp-month" oninput="maskMonth(this)" style="' + inpStyleFlex + '" />' +
                '</div>' +
                '<div style="flex:1;min-width:0">' +
                  '<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:4px">Ano</label>' +
                  '<input id="cc-year" placeholder="AAAA" maxlength="4" inputmode="numeric" autocomplete="cc-exp-year" style="' + inpStyleFlex + '" />' +
                '</div>' +
              '</div>' +
              '<div>' +
                '<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:4px">CVV</label>' +
                '<input id="cc-cvv" placeholder="123" maxlength="4" inputmode="numeric" autocomplete="cc-csc" style="' + inpStyle + ';max-width:120px" />' +
              '</div>' +
              '<div>' +
                '<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:4px">CPF do titular</label>' +
                '<input id="cc-cpf" placeholder="000.000.000-00" maxlength="14" inputmode="numeric" oninput="maskCpf(this)" style="' + inpStyle + '" />' +
              '</div>' +
              '<div style="display:flex;gap:10px">' +
                '<div style="flex:1">' +
                  '<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:4px">CEP</label>' +
                  '<input id="cc-cep" placeholder="00000-000" maxlength="9" inputmode="numeric" oninput="maskCep(this)" style="' + inpStyleFlex + '" />' +
                '</div>' +
                '<div style="flex:1">' +
                  '<label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;display:block;margin-bottom:4px">Nº endereço</label>' +
                  '<input id="cc-addr-num" placeholder="Ex: 123" inputmode="numeric" style="' + inpStyleFlex + '" />' +
                '</div>' +
              '</div>' +
              '<div id="cc-error" style="color:#F87171;font-size:13px;display:none"></div>' +
              '<button id="cc-submit-btn" onclick="submitCard(' + appointmentId + ',' + price + ')" style="padding:14px;background:var(--primary);color:#0A0A0A;font-size:14px;font-weight:800;border:none;border-radius:12px;cursor:pointer;width:100%;margin-top:4px">🔒 Confirmar Pagamento</button>' +
            '</div>' +
          '</div>';
      }
      async function submitCard(appointmentId, price) {
        var ccError = document.getElementById('cc-error');
        ccError.style.display = 'none';
        var name = document.getElementById('cc-name').value.trim();
        var number = document.getElementById('cc-number').value.replace(/ /g,'');
        var month = document.getElementById('cc-month').value.trim();
        var year = document.getElementById('cc-year').value.trim();
        var cvv = document.getElementById('cc-cvv').value.trim();
        var cpf = document.getElementById('cc-cpf').value.replace(/[^0-9]/g,'');
        var cep = document.getElementById('cc-cep').value.replace(/[^0-9]/g,'');
        var addrNum = document.getElementById('cc-addr-num').value.trim();
        if (!name || !number || !month || !year || !cvv || !cpf) {
          ccError.textContent = 'Preencha todos os campos obrigatórios.'; ccError.style.display = 'block'; return;
        }
        var btn = document.getElementById('cc-submit-btn'); btn.disabled = true; btn.textContent = '⏳ Processando...';
        try {
          var r = await fetch('/pub-api/asaas-card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
            slug: SLUG, appointmentId, amount: price, description: 'Agendamento',
            cardHolderName: name, cardNumber: number, cardExpMonth: month, cardExpYear: year, cardCvv: cvv,
            holderCpfCnpj: cpf, holderPostalCode: cep, holderAddressNumber: addrNum,
          }) });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao processar cartão');
          showPaymentSuccess('card');
        } catch(e) {
          ccError.textContent = e.message; ccError.style.display = 'block';
          btn.disabled = false; btn.textContent = '🔒 Confirmar Pagamento';
        }
      }
      // ─── Tela de confirmação pós-pagamento ────────────────────────────────────
      function showPaymentSuccess(method) {
        var svcName = selectedServices.length > 0 ? selectedServices.map(function(s) { return s.name; }).join(' + ') : (selectedService ? selectedService.name : 'Serviço');
        var barberName = selectedBarber ? selectedBarber.name : 'profissional';
        var dateFormatted = selectedDate ? selectedDate.split('-').reverse().join('/') : '';
        var timeStr = selectedSlot ? selectedSlot.startTime : '';
        var methodLabel = method === 'pix' ? '📱 Pix' : '💳 Cartão de crédito';
        var waMsg = 'Olá! Meu agendamento foi confirmado e o pagamento realizado:%0A%0A✂ ' + encodeURIComponent(svcName) + '%0A📅 ' + dateFormatted + ' às ' + timeStr + '%0A💈 ' + encodeURIComponent(barberName) + '%0A💳 Pago via ' + (method === 'pix' ? 'Pix' : 'Cartão');
        var waHtml = WA_NUMBER
          ? '<a href="https://wa.me/' + WA_NUMBER + '?text=' + waMsg + '" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:14px;background:#25D366;color:#fff;font-size:14px;font-weight:800;border-radius:12px;text-decoration:none">📲 Enviar confirmação pelo WhatsApp</a>'
          : '';
        var statusEl = document.getElementById('payment-status');
        statusEl.innerHTML =
          '<div style="background:var(--surface);border:1px solid #22C55E44;border-radius:16px;overflow:hidden;margin-top:8px">' +
            '<div style="background:linear-gradient(135deg,#22C55E22 0%,#22C55E08 100%);border-bottom:1px solid #22C55E33;padding:24px;text-align:center">' +
              '<div style="width:64px;height:64px;border-radius:50%;background:#22C55E22;border:2px solid #22C55E55;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:28px">✅</div>' +
              '<div style="font-size:17px;font-weight:900;color:#4ADE80">Pagamento Confirmado!</div>' +
              '<div style="font-size:13px;color:var(--muted);margin-top:4px">Seu agendamento está confirmado</div>' +
            '</div>' +
            '<div style="padding:20px">' +
              '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">' +
                '<div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px">Resumo do agendamento</div>' +
                '<div style="display:flex;flex-direction:column;gap:8px">' +
                  '<div style="display:flex;justify-content:space-between;font-size:13px">' +
                    '<span style="color:var(--muted)">✂ Serviço</span>' +
                    '<span style="font-weight:700;color:var(--text)">' + svcName + '</span>' +
                  '</div>' +
                  '<div style="display:flex;justify-content:space-between;font-size:13px">' +
                    '<span style="color:var(--muted)">📅 Data e hora</span>' +
                    '<span style="font-weight:700;color:var(--text)">' + dateFormatted + ' às ' + timeStr + '</span>' +
                  '</div>' +
                  '<div style="display:flex;justify-content:space-between;font-size:13px">' +
                    '<span style="color:var(--muted)">💈 Profissional</span>' +
                    '<span style="font-weight:700;color:var(--text)">' + barberName + '</span>' +
                  '</div>' +
                  '<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:8px;display:flex;justify-content:space-between;font-size:13px">' +
                    '<span style="color:var(--muted)">💳 Forma de pagamento</span>' +
                    '<span style="font-weight:700;color:#4ADE80">' + methodLabel + '</span>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              waHtml +
              '<a href="/pub/' + SLUG + '" style="display:block;margin-top:12px;text-align:center;color:var(--primary);font-size:13px;font-weight:600;text-decoration:none">← Voltar para a página da barbearia</a>' +
            '</div>' +
          '</div>';
      }
    </script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

// ─── Página de avaliaçãoastro do cliente ─────────────────────────────────────
async function renderLoginPage(slug: string, res: Response, req: Request, mode: "login" | "cadastro" = "login") {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
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
  const loginError = (req.query.error as string) ?? "";
  const loginErrorMsg = loginError === "google_failed"
    ? "Não foi possível fazer login com Google. Tente novamente ou use e-mail e senha."
    : loginError === "1" ? "Credenciais inválidas. Verifique seu e-mail e senha." : "";
  const shopName = escapeHtml(settings?.shopName ?? tenant.name);
  const logoUrl = settings?.logoUrl ? escapeHtml(settings.logoUrl) : "";
  const bannerUrl = (settings as any)?.bannerUrl ? escapeHtml((settings as any).bannerUrl) : "";
  const body = `
    <style>
      .login-wrap { display:flex; min-height:100vh; align-items:stretch; }
      .login-side { display:none; flex:1; position:relative; overflow:hidden; }
      @media (min-width:768px) { .login-side { display:flex; flex-direction:column; align-items:center; justify-content:center; } }
      .login-side-bg { position:absolute;inset:0;background:${bannerUrl ? `url('${bannerUrl}') center/cover no-repeat` : `linear-gradient(135deg, ${primaryColor}33 0%, #0a0a0a 100%)`}; }
      .login-side-overlay { position:absolute;inset:0;background:linear-gradient(to bottom, #0a0a0a88 0%, #0a0a0aCC 100%); }
      .login-side-content { position:relative;z-index:1;text-align:center;padding:40px; }
      .login-form-col { flex:0 0 100%; max-width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; }
      @media (min-width:768px) { .login-form-col { flex:0 0 420px; max-width:420px; padding:48px 40px; } }
      .login-card { width:100%; max-width:380px; }
    </style>
    <div class="login-wrap">
      <!-- Lado esquerdo: banner / branding -->
      <div class="login-side">
        <div class="login-side-bg"></div>
        <div class="login-side-overlay"></div>
        <div class="login-side-content">
          <!-- Cabeçalho: foto + nome alinhados horizontalmente -->
          <div style="display:flex;align-items:center;gap:16px;justify-content:center;margin-bottom:24px">
            ${logoUrl
              ? `<img src="${logoUrl}" style="width:72px;height:72px;border-radius:18px;object-fit:cover;border:3px solid ${primaryColor};box-shadow:0 8px 32px #00000066;flex-shrink:0;display:block" />`
              : `<div style="width:72px;height:72px;border-radius:18px;background:#ffffff14;display:flex;align-items:center;justify-content:center;font-size:36px;flex-shrink:0;border:3px solid ${primaryColor}">💈</div>`
            }
            <div style="text-align:left">
              <div style="font-size:24px;font-weight:900;letter-spacing:-0.5px;line-height:1.2">${shopName}</div>
              <div style="font-size:13px;color:#ffffff88;margin-top:4px">Agendamento Online</div>
            </div>
          </div>
          <div style="font-size:14px;color:#ffffff99;line-height:1.6;max-width:280px;margin:0 auto 32px">Agende seu horário de forma rápida e fácil.</div>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <div style="background:#ffffff14;border:1px solid #ffffff22;border-radius:12px;padding:10px 16px;font-size:13px;color:#ffffffcc">✂ Serviços</div>
            <div style="background:#ffffff14;border:1px solid #ffffff22;border-radius:12px;padding:10px 16px;font-size:13px;color:#ffffffcc">📅 Agendamentos</div>
            <div style="background:#ffffff14;border:1px solid #ffffff22;border-radius:12px;padding:10px 16px;font-size:13px;color:#ffffffcc">⭐ Fidelidade</div>
          </div>
        </div>
      </div>
      <!-- Lado direito: formulário -->
      <div class="login-form-col">
        <div class="login-card">
          <!-- Logo mobile (só aparece em telas pequenas) -->
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:16px" class="login-mobile-header">
            ${logoUrl ? `<img src="${logoUrl}" style="width:52px;height:52px;border-radius:12px;object-fit:cover;border:2px solid ${primaryColor};flex-shrink:0;display:block" />` : `<div style="width:52px;height:52px;border-radius:12px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">💈</div>`}
            <div style="display:flex;flex-direction:column;justify-content:center;min-width:0">
              <div style="font-size:17px;font-weight:900;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${shopName}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px">Agendamento Online</div>
            </div>
          </div>
          <style>@media (min-width:768px) { .login-mobile-header { display:none !important; } }</style>
          <div style="margin-bottom:24px">
            <div style="font-size:22px;font-weight:900;margin-bottom:4px">${isLogin ? "Bem-vindo de volta" : "Criar conta gratuita"}</div>
            <div style="font-size:13px;color:var(--muted)">${isLogin ? "Faça login para agendar e acompanhar seus serviços." : "Cadastre-se e agende seus horários com facilidade."}</div>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px">
        ${loginErrorMsg ? `<div style="background:#F8717122;border:1px solid #F8717144;color:#F87171;padding:12px 14px;border-radius:10px;font-size:13px;margin-bottom:16px;line-height:1.5">${loginErrorMsg}</div>` : ""}
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
            <div style="position:relative">
              <input type="password" id="password-input" required placeholder="${isLogin ? "Sua senha" : "Mínimo 6 caracteres"}" style="width:100%;padding:12px 44px 12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
              <button type="button" id="toggle-password" onclick="(function(){var i=document.getElementById('password-input');var b=document.getElementById('toggle-password');if(i.type==='password'){i.type='text';b.innerHTML='&#128065;&#65038;'}else{i.type='password';b.innerHTML='&#128065;'}})()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:4px;line-height:1">&#128065;</button>
            </div>
          </div>
          ${!isLogin ? `<div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">TELEFONE</label>
            <input type="tel" id="phone-input" required placeholder="(11) 99999-9999" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" oninput="(function(e){var d=e.target.value.replace(/\\D/g,'').slice(0,11);if(d.length<=2)e.target.value=d.length?'('+d:'';else if(d.length<=6)e.target.value='('+d.slice(0,2)+') '+d.slice(2);else if(d.length<=10)e.target.value='('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);else e.target.value='('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7)})(event)" />
          </div>` : ""}
          ${!isLogin ? `<div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">CPF <span style="color:var(--muted);font-weight:400">(necessário para pagamento online)</span></label>
            <input type="text" id="cpf-input" placeholder="000.000.000-00" maxlength="14" inputmode="numeric" oninput="(function(e){var v=e.target.value.replace(/[^0-9]/g,'').slice(0,11);if(v.length>9)e.target.value=v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6,9)+'-'+v.slice(9);else if(v.length>6)e.target.value=v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6);else if(v.length>3)e.target.value=v.slice(0,3)+'.'+v.slice(3);else e.target.value=v;})(event)" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>` : ""}
          ${!isLogin ? `<div style="margin-bottom:24px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">DATA DE NASCIMENTO <span style="color:var(--muted);font-weight:400">(opcional — usamos para enviar um cupom no seu aniversário 🎂)</span></label>
            <input type="date" id="birth-date-input" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>` : ""}
          ${!isLogin ? `<div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:12px;padding:16px;margin:16px 0">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:12px">
              <input type="checkbox" id="lgpd-consent" required style="margin-top:2px;width:16px;height:16px;accent-color:var(--primary);flex-shrink:0" />
              <span style="font-size:12px;color:var(--muted);line-height:1.6">Li e aceito a <a href="/privacidade" style="color:var(--primary)">Pol&iacute;tica de Privacidade</a> e autorizo o tratamento dos meus dados pessoais (nome, e-mail, telefone, CPF) pela Eldunari LTDA (Barber Pro) para gerenciar minha conta de agendamentos, conforme a Lei 13.709/2018 (LGPD). <strong style="color:var(--text)">Obrigat&oacute;rio para criar sua conta.</strong></span>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:14px">
              <input type="checkbox" id="marketing-consent" style="margin-top:2px;width:16px;height:16px;accent-color:var(--primary);flex-shrink:0" />
              <span style="font-size:12px;color:var(--muted);line-height:1.6">Aceito receber promo&ccedil;&otilde;es e lembretes desta barbearia via WhatsApp e e-mail. <strong style="color:var(--muted)">Opcional.</strong></span>
            </label>
            <div style="font-size:11px;color:#444;line-height:1.6;padding-top:12px;border-top:1px solid rgba(201,168,76,0.15)">
              Seus dados s&atilde;o usados apenas para gerenciar seus agendamentos e nunca ser&atilde;o vendidos a terceiros.<br>
              <a href="/privacidade" style="color:#C9A84C;text-decoration:none;">Pol&iacute;tica de Privacidade</a> &middot; <a href="/lgpd" style="color:#C9A84C;text-decoration:none;">LGPD</a>
            </div>
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
        ${isLogin ? `<div style="text-align:center;margin-top:12px;font-size:13px">
          <a href="/pub/${slug}/forgot-password" style="color:var(--muted);text-decoration:underline">Esqueci minha senha</a>
        </div>` : ""}
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
        ${!isLogin ? `
        var consentEl = document.getElementById('lgpd-consent');
        if (!consentEl.checked) {
          errEl.textContent = 'Voc\u00ea precisa aceitar os termos para continuar.';
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Criar Conta';
          return;
        }` : ""}
        var body = {
          email: document.getElementById('email-input').value,
          password: document.getElementById('password-input').value,
          slug: '${slug}'
        };
        ${!isLogin ? `body.name = document.getElementById('name-input').value; body.phone = document.getElementById('phone-input').value; body.lgpdConsent = true; var mkEl = document.getElementById('marketing-consent'); body.marketingConsent = mkEl ? mkEl.checked : false; var bdEl = document.getElementById('birth-date-input'); if (bdEl && bdEl.value) body.birthDate = bdEl.value; var cpfEl = document.getElementById('cpf-input'); if (cpfEl && cpfEl.value) body.cpf = cpfEl.value.replace(/[^0-9]/g,'');` : ""}
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
          </div><!-- /.login-card -->
        </div><!-- /.login-form-col -->
      </div><!-- /.login-wrap -->
  `;
   res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

// ─── Página de perfilAvaliação Pós-Atendimento ────────────────────────────────────
// ─── Página de Perfil do Cliente ─────────────────────────────────────────────
async function renderPerfilPage(slug: string, res: Response, req: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
  const shopName = settings?.shopName ?? tenant.name;

  // Verificar sessão do cliente
  const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ;
  let loggedClient: { id: number; name: string; email: string; phone?: string } | null = null;
  if (clientSessionRaw) {
    loggedClient = decodeClientSession(clientSessionRaw);
  }
  if (!loggedClient) { res.redirect(`/pub/${slug}/login?redirect=perfil`); return; }

  const clientData = await db.getClientById(loggedClient.id);
  if (!clientData) { res.redirect(`/pub/${slug}/login`); return; }

  // Buscar agendamentos do cliente
  const allAppointments = await db.getClientAppointments(loggedClient.id);
  const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayStr = nowBrasilia.toISOString().slice(0, 10);
  const upcomingAppts = allAppointments.filter(a =>
    (a.date > todayStr || (a.date === todayStr && a.startTime >= nowBrasilia.toTimeString().slice(0,5))) &&
    !['cancelled','no_show','completed'].includes(a.status)
  ).slice(0, 5);
  const pastAppts = allAppointments.filter(a => a.status === 'completed').slice(0, 10);

  // Pontos de fidelidade
  const totalPoints = (clientData as any).totalPoints ?? 0;
  const loyaltyConf = await db.getLoyaltyConfig(tenant.id);
  const loyaltyActive = (loyaltyConf as any)?.isActive ?? false;
  const pointsPerVisit = (loyaltyConf as any)?.pointsPerVisit ?? 10;
  const nextRewardPoints = (loyaltyConf as any)?.rewardThreshold ?? 100;
  const progressPct = Math.min(100, Math.round((totalPoints % nextRewardPoints) / nextRewardPoints * 100));

  const saved = req.query.saved === "1";
  const error = req.query.error ? decodeURIComponent(req.query.error as string) : null;
  const tab = (req.query.tab as string) ?? "agenda";

  // Formatar data
  const fmtDate = (d: string) => { const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };
  const statusLabel: Record<string,string> = {
    scheduled: "Agendado", confirmed: "Confirmado", pending_approval: "Aguarda aprovação",
    completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu"
  };
  const statusColor: Record<string,string> = {
    scheduled: "#60A5FA", confirmed: "#4ADE80", pending_approval: "#FBBF24",
    completed: "#9CA3AF", cancelled: "#F87171", no_show: "#F87171"
  };

  const upcomingHtml = upcomingAppts.length === 0
    ? `<div style="text-align:center;padding:32px 16px;color:var(--muted)">
        <div style="font-size:40px;margin-bottom:12px">📅</div>
        <div style="font-size:14px">Nenhum agendamento futuro</div>
        <a href="/pub/${slug}/agendar" style="display:inline-block;margin-top:16px;background:${primaryColor};color:#0A0A0A;font-weight:700;padding:10px 24px;border-radius:50px;font-size:13px">Agendar agora</a>
      </div>`
    : upcomingAppts.map(a => `
      <div style="background:var(--surface2);border:1px solid ${statusColor[a.status] ?? '#334155'}33;border-left:4px solid ${statusColor[a.status] ?? primaryColor};border-radius:14px;padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-size:15px;font-weight:800">${escapeHtml((a as any).serviceName ?? "Serviço")}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">com ${escapeHtml((a as any).barberName ?? "Profissional")}</div>
          </div>
          <span style="background:${statusColor[a.status] ?? '#334155'}22;color:${statusColor[a.status] ?? '#9CA3AF'};font-size:11px;font-weight:700;padding:4px 10px;border-radius:50px">${statusLabel[a.status] ?? a.status}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:var(--muted)">
          <span>📅 ${fmtDate(a.date)}</span>
          <span>🕐 ${a.startTime.slice(0,5)}</span>
          ${(a as any).price ? `<span style="color:${primaryColor};font-weight:700">R$ ${Number((a as any).price).toFixed(2).replace('.',',')}</span>` : ''}
        </div>
      </div>`).join("")
  ;

  const historyHtml = pastAppts.length === 0
    ? `<div style="text-align:center;padding:32px 16px;color:var(--muted)">
        <div style="font-size:40px;margin-bottom:12px">✂</div>
        <div style="font-size:14px">Nenhum corte registrado ainda</div>
      </div>`
    : pastAppts.map(a => `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;opacity:0.85">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-size:15px;font-weight:800">${escapeHtml((a as any).serviceName ?? "Serviço")}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">com ${escapeHtml((a as any).barberName ?? "Profissional")}</div>
          </div>
          <span style="background:#4ADE8015;color:#4ADE80;font-size:11px;font-weight:700;padding:4px 10px;border-radius:50px">✓ Concluído</span>
        </div>
        <div style="display:flex;gap:16px;font-size:12px;color:var(--muted)">
          <span>📅 ${fmtDate(a.date)}</span>
          <span>🕐 ${a.startTime.slice(0,5)}</span>
          ${(a as any).price ? `<span style="color:${primaryColor};font-weight:700">R$ ${Number((a as any).price).toFixed(2).replace('.',',')}</span>` : ''}
        </div>
      </div>`).join("")
  ;

  const avatarHtml = (clientData as any).photoUrl
    ? `<img src="${escapeHtml((clientData as any).photoUrl)}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid ${primaryColor}" />`
    : `<div style="width:90px;height:90px;border-radius:50%;background:var(--surface2);border:3px solid ${primaryColor};display:flex;align-items:center;justify-content:center;font-size:36px">👤</div>`;

  const body = `
    <div style="max-width:520px;margin:0 auto;padding:24px 16px 48px">

      <!-- Cabeçalho -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <a href="/pub/${slug}" style="color:var(--muted);font-size:22px;line-height:1">&#8592;</a>
        <div>
          <div style="font-size:20px;font-weight:900">Meu Perfil</div>
          <div style="font-size:12px;color:var(--muted)">${escapeHtml(shopName)}</div>
        </div>
      </div>

      ${saved ? `<div style="background:#4ADE8018;border:1px solid #4ADE8044;color:#4ADE80;padding:12px 16px;border-radius:12px;margin-bottom:16px;font-size:14px">✓ Perfil atualizado com sucesso!</div>` : ""}
      ${error ? `<div style="background:#EF444418;border:1px solid #EF444444;color:#F87171;padding:12px 16px;border-radius:12px;margin-bottom:16px;font-size:14px">✗ ${escapeHtml(error)}</div>` : ""}

      <!-- Card do Avatar -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px;margin-bottom:16px;text-align:center">
        <div style="position:relative;display:inline-block;margin-bottom:12px">
          ${avatarHtml}
          <label for="avatarInput" style="position:absolute;bottom:0;right:0;width:28px;height:28px;background:${primaryColor};border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px">📷</label>
          <input id="avatarInput" type="file" accept="image/*" style="display:none" onchange="uploadAvatar(this)" />
        </div>
        <div style="font-size:18px;font-weight:900">${escapeHtml(clientData.name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Cliente desde ${new Date((clientData as any).createdAt ?? Date.now()).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
        <div id="avatarStatus" style="font-size:12px;margin-top:8px;color:var(--muted)"></div>
      </div>

      <!-- Pontos de Fidelidade -->
      ${loyaltyActive ? `
      <div style="background:linear-gradient(135deg,${primaryColor}22,${primaryColor}08);border:1px solid ${primaryColor}44;border-radius:20px;padding:20px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <div style="font-size:13px;font-weight:700;color:${primaryColor};letter-spacing:0.5px">⭐ PONTOS DE FIDELIDADE</div>
            <div style="font-size:28px;font-weight:900;margin-top:4px">${totalPoints} <span style="font-size:14px;color:var(--muted);font-weight:400">pts</span></div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--muted)">Próxima recompensa</div>
            <div style="font-size:16px;font-weight:800;color:${primaryColor}">${nextRewardPoints} pts</div>
          </div>
        </div>
        <div style="background:var(--surface2);border-radius:50px;height:8px;overflow:hidden">
          <div style="background:${primaryColor};height:100%;width:${progressPct}%;border-radius:50px;transition:width 0.5s"></div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;text-align:right">${progressPct}% para a próxima recompensa</div>
      </div>` : ""}

      <!-- Abas: Agenda / Histórico / Dados -->
      <div style="display:flex;gap:0;background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px">
        <a href="?tab=agenda" style="flex:1;text-align:center;padding:12px 4px;font-size:13px;font-weight:700;text-decoration:none;${tab==='agenda'?`background:${primaryColor};color:#0A0A0A`:'color:var(--muted)'}">
          📅 Próximos
        </a>
        <a href="?tab=historico" style="flex:1;text-align:center;padding:12px 4px;font-size:13px;font-weight:700;text-decoration:none;border-left:1px solid var(--border);${tab==='historico'?`background:${primaryColor};color:#0A0A0A`:'color:var(--muted)'}">
          ✂ Histórico
        </a>
        <a href="?tab=dados" style="flex:1;text-align:center;padding:12px 4px;font-size:13px;font-weight:700;text-decoration:none;border-left:1px solid var(--border);${tab==='dados'?`background:${primaryColor};color:#0A0A0A`:'color:var(--muted)'}">
          ✏️ Meus Dados
        </a>
      </div>

      <!-- Conteúdo da aba -->
      ${tab === 'agenda' ? `
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--muted);letter-spacing:0.5px;margin-bottom:12px">PRÓXIMOS AGENDAMENTOS (${upcomingAppts.length})</div>
          ${upcomingHtml}
        </div>` : ""}

      ${tab === 'historico' ? `
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--muted);letter-spacing:0.5px;margin-bottom:12px">HISTÓRICO DE CORTES (${pastAppts.length})</div>
          ${historyHtml}
        </div>` : ""}

      ${tab === 'dados' ? `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:24px">
          <form method="POST" action="/pub-api/perfil">
            <input type="hidden" name="slug" value="${escapeHtml(slug)}" />
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">NOME COMPLETO</label>
              <input type="text" name="name" value="${escapeHtml(clientData.name)}" required
                style="width:100%;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;outline:none;box-sizing:border-box" />
            </div>
            <div style="margin-bottom:16px">
              <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">TELEFONE / WHATSAPP</label>
              <input type="tel" name="phone" value="${escapeHtml(clientData.phone ?? "")}" placeholder="(11) 99999-9999"
                style="width:100%;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;outline:none;box-sizing:border-box" />
            </div>
            <div style="margin-bottom:24px">
              <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">E-MAIL</label>
              <input type="email" name="email" value="${escapeHtml(clientData.email ?? "")}" placeholder="seu@email.com"
                style="width:100%;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;outline:none;box-sizing:border-box" />
            </div>
            <button type="submit"
              style="width:100%;padding:14px;background:${primaryColor};color:#0A0A0A;font-size:15px;font-weight:800;border:none;border-radius:14px;cursor:pointer">
              Salvar Alterações
            </button>
          </form>
          <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
            <a href="/pub/${slug}/logout" style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;color:#F87171;font-size:14px;font-weight:600">
              <span>🚪 Sair da conta</span>
              <span style="color:var(--muted)">›</span>
            </a>
          </div>
        </div>` : ""}

    </div>

    <script>
    async function uploadAvatar(input) {
      const file = input.files[0];
      if (!file) return;
      const status = document.getElementById('avatarStatus');
      status.textContent = 'Enviando foto...';
      const reader = new FileReader();
      reader.onload = async function(e) {
        const base64 = e.target.result.split(',')[1];
        try {
          const res = await fetch('/pub-api/perfil/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: ${loggedClient!.id}, fileBase64: base64, mimeType: file.type, slug: '${escapeHtml(slug)}' })
          });
          const data = await res.json();
          if (data.url) {
            status.textContent = '✓ Foto atualizada!';
            status.style.color = '#4ADE80';
            setTimeout(() => location.reload(), 800);
          } else {
            status.textContent = 'Erro ao enviar foto.';
            status.style.color = '#F87171';
          }
        } catch { status.textContent = 'Erro ao enviar foto.'; status.style.color = '#F87171'; }
      };
      reader.readAsDataURL(file);
    }
    </script>
  `;
  res.send(publicLayout(shopName, primaryColor, body, "", settings));
}
async function renderReviewPage(slug: string, appointmentIdStr: string, res: Response, req: Request) {
  const appointmentId = parseInt(appointmentIdStr);
  if (isNaN(appointmentId)) { res.status(400).send("ID de agendamento inválido."); return; }

  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
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
        <div style="font-size:48px;margin-bottom:12px">✂</div>
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
  if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";

  // Verificar sessão do cliente
  const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ;
  let loggedClient: { id: number; name: string; email: string } | null = null;
  if (clientSessionRaw) {
    loggedClient = decodeClientSession(clientSessionRaw);
  }

  if (!loggedClient) {
    res.redirect(`/pub/${slug}/login?redirect=meus-agendamentos`);
    return;
  }

  // Buscar encomendas do cliente
  const clientOrders = await db.getProductOrdersByClient(loggedClient.id, tenant.id);
  const orderProducts = await Promise.all(clientOrders.map(async (o: any) => {
    const product = await db.getProductById(o.productId);
    return { ...o, product };
  }));

  // Buscar assinaturas ativas do cliente
  const dbConn = await db.getDb();
  let clientSubs: any[] = [];
  if (dbConn) {
    try {
      const subsRows = await dbConn.execute(sql`
        SELECT cs.id, cs."status", cs."startDate", cs."nextBillingDate",
               sp.name AS "planName", sp.price AS "planPrice", sp.description AS "planDescription"
        FROM client_subscriptions cs
        JOIN subscription_plans sp ON sp.id = cs."planId"
        WHERE cs."clientId" = ${loggedClient.id}
          AND cs."tenantId" = ${tenant.id}
          AND cs."status" IN ('active','pending')
        ORDER BY cs."startDate" DESC
      `) as any;
      clientSubs = Array.isArray(subsRows) ? (subsRows[0] ?? []) : (subsRows?.rows ?? []);
    } catch {}
  }

  // Buscar agendamentos do cliente com dados de serviço e barbeiro
  const rawAppts = await db.getClientAppointments(loggedClient.id);
  const allServices = await db.getAllServicesWithMediaAndRatings(true, tenant.id);
  const allBarbers = await db.getAllBarbers(tenant.id);
  const serviceMap = Object.fromEntries(allServices.map((s) => [s.id, s]));
  const barberMap = Object.fromEntries(allBarbers.map((b) => [b.id, b]));

  // Buscar avaliações já feitas pelo cliente para saber quais agendamentos já foram avaliados
  const clientReviews = await db.getReviewsByClient(loggedClient.id, tenant.id);
  const reviewedApptIds = new Set(clientReviews.map((r: any) => r.appointmentId).filter(Boolean));

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const upcoming = rawAppts.filter((a: any) => a.date >= today && a.status !== "cancelled");
  const past = rawAppts.filter((a: any) => a.date < today || a.status === "cancelled");

  // Banner de lembrete: agendamento nas próximas 24h
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const reminderAppt = upcoming.find((a: any) => {
    const apptDt = new Date(`${a.date}T${a.startTime}:00`);
    return apptDt >= now && apptDt <= in24h && ["scheduled", "confirmed"].includes(a.status);
  });
  const reminderBanner = reminderAppt ? (() => {
    const svc = serviceMap[(reminderAppt as any).serviceId];
    const barber = barberMap[(reminderAppt as any).barberId];
    const dateFormatted = (reminderAppt as any).date.split('-').reverse().join('/');
    return `
      <div style="background:linear-gradient(135deg,#F59E0B22,#F59E0B11);border:1.5px solid #F59E0B66;border-radius:16px;padding:18px 20px;margin-bottom:24px;display:flex;align-items:flex-start;gap:14px">
        <div style="font-size:28px;line-height:1;flex-shrink:0">⏰</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:800;color:#F59E0B;margin-bottom:4px">Lembrete: agendamento em breve!</div>
          <div style="font-size:13px;color:var(--text);margin-bottom:2px"><strong>${escapeHtml(svc?.name ?? "Serviço")}</strong> com ${barber ? escapeHtml(barber.name) : "profissional"}</div>
          <div style="font-size:12px;color:var(--muted)">📅 ${dateFormatted} às ${(reminderAppt as any).startTime}</div>
        </div>
      </div>`;
  })() : "";

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

  function apptCard(a: any, canCancel: boolean, canReschedule: boolean = false) {
    const svc = serviceMap[a.serviceId];
    const barber = barberMap[a.barberId];
    const rescheduleUrl = `/pub/${slug}/agendar?service=${a.serviceId}${a.barberId ? `&barber=${a.barberId}` : ''}`;
    const canReview = a.status === "completed" && !reviewedApptIds.has(a.id);
    const alreadyReviewed = a.status === "completed" && reviewedApptIds.has(a.id);
    const hasActions = canCancel || canReschedule || canReview;
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:12px" data-status="${a.status}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:15px;font-weight:800;margin-bottom:4px">${escapeHtml(svc?.name ?? "Serviço")}</div>
            <div style="font-size:13px;color:var(--muted)">${barber ? escapeHtml(barber.name) : "Qualquer profissional"}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            ${statusBadge(a.status)}
            ${alreadyReviewed ? `<span style="font-size:11px;color:#F59E0B">⭐ Avaliado</span>` : ""}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;font-size:13px;color:var(--muted);margin-bottom:${hasActions ? "16" : "0"}px">
          <span>📅 ${a.date.split('-').reverse().join('/')}</span>
          <span>🕐 ${a.startTime} – ${a.endTime}</span>
          ${svc ? `<span style="color:var(--primary);font-weight:700">${formatPrice(svc.price)}</span>` : ""}
        </div>
        <div style="margin-bottom:${hasActions ? "8" : "0"}px">
          <a href="/pub/${slug}/agendamento/${a.id}" style="font-size:12px;color:var(--muted);text-decoration:underline">Ver detalhes →</a>
        </div>
        ${hasActions ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
          ${canReview ? `<button onclick="openReviewModal(${a.id}, '${escapeHtml(svc?.name ?? "Serviço").replace(/'/g, "\'")}', this)" style="flex:1;min-width:100px;padding:10px;background:#F59E0B22;border:1.5px solid #F59E0B66;border-radius:10px;color:#F59E0B;font-size:13px;font-weight:700;cursor:pointer">⭐ Avaliar</button>` : ""}
          ${canReschedule ? `<a href="${rescheduleUrl}" style="flex:1;min-width:100px;display:block;padding:10px;background:var(--primary);color:#0A0A0A;font-size:13px;font-weight:800;border-radius:10px;text-align:center;text-decoration:none">📅 Reagendar</a>` : ""}
          ${canCancel ? `<button onclick="cancelAppt(${a.id}, this)" style="flex:1;min-width:100px;padding:10px;background:transparent;border:1px solid #EF444466;border-radius:10px;color:#F87171;font-size:13px;font-weight:600;cursor:pointer">Cancelar</button>` : ""}
        </div>` : ""}
      </div>`;
  }

  const upcomingHtml = upcoming.length === 0
    ? `<div style="text-align:center;padding:32px;color:var(--muted);font-size:14px">Nenhum agendamento próximo.<br><a href="/pub/${slug}/agendar" style="color:var(--primary);font-weight:700">Agendar agora</a></div>`
    : upcoming.map((a: any) => apptCard(a, ["scheduled", "confirmed"].includes(a.status), true)).join("");

  const pastHtml = past.length === 0
    ? `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">Nenhum agendamento anterior.</div>`
    : past.slice(0, 10).map((a: any) => apptCard(a, false, true)).join("");

  const body = `
    <style>
      .filter-bar { display:flex;gap:8px;margin-bottom:16px;overflow-x:auto;padding-bottom:4px; }
      .filter-btn { padding:7px 16px;border-radius:20px;font-size:13px;font-weight:700;border:1.5px solid var(--border);background:var(--surface);color:var(--muted);cursor:pointer;white-space:nowrap;transition:all 0.15s; }
      .filter-btn.active { background:var(--primary);color:#0A0A0A;border-color:var(--primary); }
      /* Modal de avaliação */
      .review-overlay { display:none;position:fixed;inset:0;background:#00000088;z-index:1000;align-items:flex-end;justify-content:center; }
      .review-overlay.open { display:flex; }
      .review-sheet { background:var(--bg);border-radius:24px 24px 0 0;padding:28px 24px 40px;width:100%;max-width:520px;animation:slideUp 0.25s ease; }
      @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
      .star-row { display:flex;gap:8px;justify-content:center;margin:20px 0; }
      .star-btn { font-size:36px;cursor:pointer;opacity:0.3;transition:opacity 0.1s,transform 0.1s; }
      .star-btn.active { opacity:1;transform:scale(1.15); }
      .review-textarea { width:100%;padding:12px 14px;background:var(--surface);border:1.5px solid var(--border);border-radius:12px;font-size:14px;color:var(--text);resize:none;font-family:inherit;box-sizing:border-box; }
      .review-textarea:focus { outline:none;border-color:var(--primary); }
    </style>

    <!-- Modal de avaliação -->
    <div class="review-overlay" id="reviewOverlay" onclick="closeReviewModal(event)">
      <div class="review-sheet" onclick="event.stopPropagation()">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="font-size:17px;font-weight:800">Avaliar serviço</div>
          <button onclick="closeReviewModal()" style="background:none;border:none;font-size:22px;color:var(--muted);cursor:pointer">×</button>
        </div>
        <div id="review-svc-name" style="font-size:13px;color:var(--muted);margin-bottom:4px"></div>
        <div class="star-row" id="star-row">
          <span class="star-btn" data-star="1" onclick="setStar(1)">★</span>
          <span class="star-btn" data-star="2" onclick="setStar(2)">★</span>
          <span class="star-btn" data-star="3" onclick="setStar(3)">★</span>
          <span class="star-btn" data-star="4" onclick="setStar(4)">★</span>
          <span class="star-btn" data-star="5" onclick="setStar(5)">★</span>
        </div>
        <textarea id="review-comment" class="review-textarea" rows="3" placeholder="Comentário opcional..."></textarea>
        <div id="review-error" style="color:#F87171;font-size:12px;margin-top:8px;display:none"></div>
        <button id="review-submit-btn" onclick="submitReview()" style="width:100%;margin-top:14px;padding:14px;background:var(--primary);color:#0A0A0A;font-size:15px;font-weight:800;border:none;border-radius:12px;cursor:pointer">Enviar avaliação</button>
      </div>
    </div>

    <div style="max-width:560px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:12px">
          <a href="/pub/${slug}" style="color:var(--muted);font-size:20px">←</a>
          <div>
            <div style="font-size:18px;font-weight:800">Meus Agendamentos</div>
            <div style="font-size:12px;color:var(--muted)">${escapeHtml(loggedClient.name)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <a href="/pub/${slug}/perfil" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px">&#128100; Perfil</a>
          <a href="/pub/${slug}/agendar" style="background:var(--primary);color:#0A0A0A;font-size:13px;font-weight:800;padding:10px 16px;border-radius:10px">+ Novo</a>
        </div>
      </div>

      ${reminderBanner}

      ${clientSubs.length > 0 ? `
      <div style="margin-bottom:28px">
        <div style="font-size:14px;font-weight:800;margin-bottom:16px;color:var(--muted);letter-spacing:1px">MINHAS ASSINATURAS</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${clientSubs.map((sub: any) => `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <span style="font-size:15px;font-weight:800;color:var(--text)">${escapeHtml(sub.planName)}</span>
                    <span style="background:${sub.status === 'active' ? '#4ADE8022' : '#F8717122'};color:${sub.status === 'active' ? '#4ADE80' : '#F87171'};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px">${sub.status === 'active' ? 'Ativa' : 'Pendente'}</span>
                  </div>
                  <div style="font-size:14px;font-weight:700;color:var(--primary)">R$ ${Number(sub.planPrice).toFixed(2).replace('.', ',')}/mês</div>
                  ${sub.planDescription ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">${escapeHtml(sub.planDescription)}</div>` : ''}
                  ${sub.nextBillingDate ? `<div style="font-size:11px;color:var(--muted);margin-top:6px">Próxima cobrança: ${new Date(sub.nextBillingDate).toLocaleDateString('pt-BR')}</div>` : ''}
                </div>
                <button
                  onclick="cancelSub(${sub.id}, '${escapeHtml(sub.planName).replace(/'/g, '')}')"
                  style="background:#F8717112;border:1px solid #F8717133;color:#F87171;font-size:12px;font-weight:700;padding:8px 14px;border-radius:10px;cursor:pointer;white-space:nowrap;flex-shrink:0">
                  Cancelar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <div style="font-size:14px;font-weight:800;margin-bottom:16px;color:var(--muted);letter-spacing:1px">PRÓXIMOS</div>
      ${upcomingHtml}

      ${past.length > 0 ? `
        <div style="display:flex;align-items:center;justify-content:space-between;margin:28px 0 12px">
          <div style="font-size:14px;font-weight:800;color:var(--muted);letter-spacing:1px">HISTÓRICO</div>
        </div>
        <div class="filter-bar">
          <button class="filter-btn active" onclick="filterHistory('all', this)">Todos</button>
          <button class="filter-btn" onclick="filterHistory('completed', this)">Concluídos</button>
          <button class="filter-btn" onclick="filterHistory('cancelled', this)">Cancelados</button>
        </div>
        <div id="history-list">${pastHtml}</div>
      ` : ""}

      ${orderProducts.length > 0 ? (() => {
        const orderStatusLabels: Record<string, { label: string; color: string; step: number }> = {
          received:  { label: "Recebido",          color: "#F59E0B", step: 1 },
          confirmed: { label: "Confirmado",         color: "#3B82F6", step: 2 },
          preparing: { label: "Em preparo",         color: "#8B5CF6", step: 3 },
          ready:     { label: "Pronto p/ retirada", color: "#10B981", step: 4 },
          delivered: { label: "Entregue",           color: "#22C55E", step: 5 },
          cancelled: { label: "Cancelado",          color: "#EF4444", step: 0 },
        };
        const steps = ["Recebido", "Confirmado", "Em preparo", "Pronto", "Entregue"];
        const orderCards = orderProducts.map((o: any) => {
          const st = orderStatusLabels[o.status] ?? { label: o.status, color: "#888", step: 0 };
          const date = new Date(o.createdAt).toLocaleDateString("pt-BR");
          const canCancel = ["received"].includes(o.status);
          const isReady = o.status === "ready";
          const isCancelled = o.status === "cancelled";
          const timelineHtml = !isCancelled ? `
            <div style="display:flex;align-items:center;gap:0;margin:12px 0 4px">
              ${steps.map((s, i) => {
                const done = st.step > i;
                const active = st.step === i + 1;
                return `<div style="display:flex;flex-direction:column;align-items:center;flex:1">
                  <div style="width:20px;height:20px;border-radius:50%;background:${done || active ? st.color : "var(--surface2)"};border:2px solid ${done || active ? st.color : "var(--border)"};display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:700">${done ? "✓" : active ? "●" : ""}</div>
                  ${i < steps.length - 1 ? `<div style="position:absolute;width:calc(20% - 20px);height:2px;background:${done ? st.color : "var(--border)"};margin-left:20px;margin-top:9px"></div>` : ""}
                </div>`;
              }).join("")}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-bottom:8px">
              ${steps.map(s => `<div style="flex:1;text-align:center">${s}</div>`).join("")}
            </div>` : "";
          // Banner de cancelamento com motivo
          const cancelBanner = isCancelled && o.cancelReason ? `
            <div style="background:#EF444410;border:1px solid #EF444430;border-radius:10px;padding:10px 12px;margin-top:10px">
              <div style="font-size:11px;font-weight:700;color:#EF4444;margin-bottom:3px">Motivo do cancelamento</div>
              <div style="font-size:13px;color:#EF4444AA">${escapeHtml(o.cancelReason)}</div>
            </div>` : "";
          // Banner de pronto para retirada
          const readyBanner = isReady ? `
            <div style="background:#10B98115;border:1.5px solid #10B98155;border-radius:10px;padding:12px 14px;margin-top:10px;display:flex;align-items:center;gap:10px">
              <div style="font-size:24px">🎉</div>
              <div>
                <div style="font-size:13px;font-weight:800;color:#10B981">Seu pedido está pronto!</div>
                <div style="font-size:12px;color:var(--muted)">Compareça à barbearia para retirar${o.estimatedDays ? " (prazo: " + o.estimatedDays + " dia(s))" : ""}.</div>
              </div>
            </div>` : "";
          return `<div style="background:var(--surface);border:1px solid ${isReady ? "#10B98155" : isCancelled ? "#EF444430" : "var(--border)"};border-radius:16px;padding:16px;margin-bottom:12px">
            <div style="display:flex;gap:12px;align-items:flex-start">
              ${o.product?.thumbnailUrl ? `<img src="${escapeHtml(o.product.thumbnailUrl)}" style="width:52px;height:52px;border-radius:10px;object-fit:cover;flex-shrink:0" />` : `<div style="width:52px;height:52px;border-radius:10px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📦</div>`}
              <div style="flex:1;min-width:0">
                <div style="font-size:15px;font-weight:800;margin-bottom:2px">${escapeHtml(o.product?.name ?? "Produto")}</div>
                <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Qtd: ${o.quantity}${o.note ? " · " + escapeHtml(o.note) : ""} · ${date}</div>
                <span style="background:${st.color}22;color:${st.color};font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px">${st.label}</span>
              </div>
            </div>
            ${timelineHtml}
            ${cancelBanner}
            ${readyBanner}
            ${canCancel ? `<button onclick="cancelOrder(${o.id}, this)" style="margin-top:10px;width:100%;padding:10px;background:transparent;border:1px solid #EF4444;color:#EF4444;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Cancelar encomenda</button>` : ""}
            ${isReady ? `<button onclick="confirmOrderReceipt(${o.id}, this)" style="margin-top:10px;width:100%;padding:12px;background:var(--primary);color:#0A0A0A;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer">✅ Confirmar Recebimento</button>` : ""}
            ${o.status === "delivered" ? `<button onclick="openProductReview(${o.id}, '${escapeHtml(o.product?.name ?? "Produto")}', ${o.productId})" style="margin-top:10px;width:100%;padding:10px;background:transparent;border:1px solid #C9A84C;color:#C9A84C;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">⭐ Avaliar produto</button>` : ""}
          </div>`;
        }).join("");
        return `
          <div style="margin:28px 0 12px;font-size:14px;font-weight:800;color:var(--muted);letter-spacing:1px">MINHAS ENCOMENDAS</div>
          ${orderCards}`;
      })() : ""}
    </div>
    <script>
      // ─── Filtro de histórico ───────────────────────────────────────────────
      function filterHistory(status, btn) {
        document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('#history-list [data-status]').forEach(function(card) {
          if (status === 'all') {
            card.style.display = '';
          } else {
            card.style.display = card.getAttribute('data-status') === status ? '' : 'none';
          }
        });
      }

      // ─── Modal de avaliação ────────────────────────────────────────────────
      var _reviewApptId = null;
      var _reviewRating = 0;
      var _reviewBtn = null;

      function openReviewModal(apptId, svcName, btn) {
        _reviewApptId = apptId;
        _reviewRating = 0;
        _reviewBtn = btn;
        document.getElementById('review-svc-name').textContent = svcName;
        document.getElementById('review-comment').value = '';
        document.getElementById('review-error').style.display = 'none';
        document.getElementById('review-submit-btn').disabled = false;
        document.getElementById('review-submit-btn').textContent = 'Enviar avaliação';
        setStar(0);
        document.getElementById('reviewOverlay').classList.add('open');
      }

      function closeReviewModal(e) {
        if (e && e.target !== document.getElementById('reviewOverlay')) return;
        document.getElementById('reviewOverlay').classList.remove('open');
      }

      function setStar(n) {
        _reviewRating = n;
        document.querySelectorAll('.star-btn').forEach(function(s) {
          s.classList.toggle('active', parseInt(s.getAttribute('data-star')) <= n);
        });
      }

      async function submitReview() {
        var errEl = document.getElementById('review-error');
        errEl.style.display = 'none';
        if (!_reviewRating) { errEl.textContent = 'Selecione uma nota de 1 a 5 estrelas.'; errEl.style.display = 'block'; return; }
        var btn = document.getElementById('review-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        try {
          var r = await fetch('/pub-api/submit-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appointmentId: _reviewApptId,
              slug: '${slug}',
              rating: _reviewRating,
              comment: document.getElementById('review-comment').value.trim()
            })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao enviar avaliação');
          document.getElementById('reviewOverlay').classList.remove('open');
          if (_reviewBtn) {
            _reviewBtn.textContent = '⭐ Avaliado';
            _reviewBtn.disabled = true;
            _reviewBtn.style.opacity = '0.6';
          }
        } catch(e) {
          errEl.textContent = e.message;
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Enviar avaliação';
        }
      }

      // ─── Cancelar encomenda ────────────────────────────────────────────────
      async function cancelOrder(id, btn) {
        if (!await pubConfirm('Deseja cancelar esta encomenda?')) return;
        btn.disabled = true; btn.textContent = 'Cancelando...';
        try {
          var r = await fetch('/pub-api/cancel-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: id, slug: '${slug}' })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao cancelar');
          window.location.reload();
        } catch(e) {
          pubAlert(e.message, 'error');
          btn.disabled = false; btn.textContent = 'Cancelar encomenda';
        }
      }

      // ─── Confirmar recebimento pelo cliente ────────────────────────────────
      async function confirmOrderReceipt(id, btn) {
        if (!await pubConfirm('Confirmar que você retirou este pedido?')) return;
        btn.disabled = true; btn.textContent = 'Confirmando...';
        try {
          var r = await fetch('/pub-api/confirm-order-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: id, slug: '${slug}' })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao confirmar');
          window.location.reload();
        } catch(e) {
          pubAlert(e.message, 'error');
          btn.disabled = false; btn.textContent = '\u2705 Confirmar Recebimento';
        }
      }

      // ─── Avaliar produto ────────────────────────────────────────────────────
      function openProductReview(orderId, productName, productId) {
        var modal = document.getElementById('productReviewModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'productReviewModal';
          modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
          var starsHtml = [1,2,3,4,5].map(function(n){ return '<span data-star="'+n+'" onclick="setPRStar('+n+')" style="font-size:36px;cursor:pointer;opacity:0.3">&#9733;</span>'; }).join('');
          modal.innerHTML = '<div style="background:var(--surface);border-radius:20px 20px 0 0;padding:24px 20px 32px;width:100%;max-width:480px">'
            + '<div style="text-align:center;margin-bottom:16px">'
            + '<div style="font-size:22px;font-weight:900;margin-bottom:4px">Avaliar Produto</div>'
            + '<div id="prName" style="font-size:14px;color:var(--muted)"></div>'
            + '</div>'
            + '<div style="display:flex;justify-content:center;gap:8px;margin:16px 0" id="prStars">' + starsHtml + '</div>'
            + '<textarea id="prComment" placeholder="Coment\u00e1rio (opcional)" style="width:100%;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;resize:none;height:80px;box-sizing:border-box"></textarea>'
            + '<button id="prSubmit" onclick="submitProductReview()" style="margin-top:12px;width:100%;padding:14px;background:var(--primary);color:#0A0A0A;font-weight:900;border-radius:12px;border:none;font-size:15px;cursor:pointer">Enviar Avalia\u00e7\u00e3o</button>'
            + '<button onclick="document.getElementById(&quot;productReviewModal&quot;).style.display=&quot;none&quot;" style="margin-top:8px;width:100%;padding:10px;background:transparent;border:none;color:var(--muted);font-size:14px;cursor:pointer">Cancelar</button>'
            + '</div>';
          document.body.appendChild(modal);
        }
        modal._orderId = orderId;
        modal._productId = productId;
        modal._rating = 0;
        document.getElementById('prName').textContent = productName;
        document.getElementById('prComment').value = '';
        document.querySelectorAll('#prStars span').forEach(function(s) { s.style.opacity = '0.3'; });
        modal.style.display = 'flex';
      }
      function setPRStar(n) {
        var modal = document.getElementById('productReviewModal');
        modal._rating = n;
        document.querySelectorAll('#prStars span').forEach(function(s) {
          s.style.opacity = parseInt(s.getAttribute('data-star')) <= n ? '1' : '0.3';
        });
      }
      async function submitProductReview() {
        var modal = document.getElementById('productReviewModal');
        if (!modal._rating) { pubAlert('Selecione uma nota de 1 a 5 estrelas', 'warning'); return; }
        var btn = document.getElementById('prSubmit');
        btn.disabled = true; btn.textContent = 'Enviando...';
        try {
          var r = await fetch('/pub-api/submit-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: '${slug}', rating: modal._rating, comment: document.getElementById('prComment').value, productId: modal._productId })
          });
          if (!r.ok) throw new Error('Erro ao enviar');
          modal.style.display = 'none';
          pubAlert('Avaliação enviada! Obrigado 🙏', 'success');
        } catch(e) {
          pubAlert(e.message, 'error');
          btn.disabled = false; btn.textContent = 'Enviar Avaliação';
        }
      }

      // ─── Cancelar agendamento ──────────────────────────────────────────────
      async function cancelAppt(id, btn) {
        if (!await pubConfirm('Deseja cancelar este agendamento?')) return;
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
          pubAlert(e.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Cancelar agendamento';
        }
      }

      async function cancelSub(id, planName) {
        if (!await pubConfirm('Deseja cancelar a assinatura do plano "' + planName + '"? Você perderá acesso aos benefícios ao final do período atual.')) return;
        try {
          var r = await fetch('/pub-api/cancel-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscriptionId: id, slug: '${slug}' })
          });
          var data = await r.json();
          if (!data.success) throw new Error(data.error || 'Erro ao cancelar assinatura');
          window.location.reload();
        } catch(e) {
          pubAlert(e.message, 'error');
        }
      }
    </script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

// ─── Página de Detalhe de Serviço ───────────────────────────────────────────
async function renderServiceDetailPage(slug: string, serviceId: number, res: Response, req: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor || "#C9A84C";
  const service = await db.getServiceById(serviceId);
  if (!service || service.tenantId !== tenant.id) { res.redirect(`/pub/${slug}`); return; }
  const media = await db.getMediaByEntity("service", serviceId);
  const sessionData = req.cookies?.[`client_session_${slug}`] ;
  const isLoggedIn = !!sessionData;
  let clientInfo: any = null;
  if (sessionData) { clientInfo = decodeClientSession(sessionData); }
  const images = media.filter(m => m.type === "image");
  const videos = media.filter(m => m.type === "video");
  const mediaHtml = images.length === 0 && videos.length === 0
    ? `<div style="width:100%;height:280px;background:var(--surface2);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:64px;margin-bottom:28px">✂</div>`
    : `<div class="gallery-carousel" id="galleryCarousel" style="margin-bottom:28px">
        <div class="gallery-track" id="galleryTrack">
          ${images.map((m, i) => `<div class="gallery-slide"><img src="${escapeHtml(m.url)}" alt="${escapeHtml(service.name)}" onclick="openLightbox(${i})" loading="lazy" /></div>`).join("")}
          ${videos.map(m => `<div class="gallery-slide"><video src="${escapeHtml(m.url)}" controls style="width:100%;height:340px;object-fit:cover;display:block"></video></div>`).join("")}
        </div>
        ${images.length > 1 ? `<button class="gallery-nav gallery-prev" onclick="galleryMove(-1)">&#8249;</button><button class="gallery-nav gallery-next" onclick="galleryMove(1)">&#8250;</button><div class="gallery-dots" id="galleryDots">${images.map((_,i) => `<div class="gallery-dot${i===0?' active':''}" onclick="galleryGoTo(${i})"></div>`).join("")}</div><div class="gallery-counter" id="galleryCounter">1 / ${images.length}</div>` : ""}
      </div>
      ${images.length > 0 ? `<div class="lightbox-overlay" id="lightboxOverlay"><span class="lightbox-close" onclick="closeLightbox()">×</span><img class="lightbox-img" id="lightboxImg" src="" alt="" /><button class="lightbox-nav lightbox-lprev" onclick="lightboxMove(-1)">&#8249;</button><button class="lightbox-nav lightbox-lnext" onclick="lightboxMove(1)">&#8250;</button></div>` : ""}`;
  const priceSection = isLoggedIn
    ? `<div style="font-size:32px;font-weight:900;color:var(--primary);margin-bottom:4px">${formatPrice(service.price)}</div>`
    : `<a href="/pub/${slug}/login" style="display:inline-flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);padding:12px 20px;border-radius:12px;font-size:14px;font-weight:700;color:var(--text)">🔒 Faça login para ver o preço</a>`;
  const bookBtn = isLoggedIn
    ? `<a href="/pub/${slug}/agendar?service=${serviceId}" style="display:block;width:100%;padding:16px;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:900;border-radius:14px;text-align:center;letter-spacing:0.5px;text-decoration:none">📅 Agendar este Serviço</a>`
    : `<a href="/pub/${slug}/login?redirect=servico/${serviceId}" style="display:block;width:100%;padding:16px;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:900;border-radius:14px;text-align:center;letter-spacing:0.5px;text-decoration:none">Entrar para Agendar</a>`;
  const body = `
    <div style="max-width:700px;margin:0 auto;padding:24px 20px 80px">
      <a href="/pub/${slug}" style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-bottom:24px;font-weight:600">
        ← Voltar
      </a>
      ${mediaHtml}
      <div style="margin-bottom:28px">
        <h1 style="font-size:28px;font-weight:900;margin-bottom:8px;font-family:var(--font-styled-family,inherit)">${escapeHtml(service.name)}</h1>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
          <span style="background:var(--surface2);border:1px solid var(--border);padding:6px 14px;border-radius:20px;font-size:13px;color:var(--muted);font-weight:600">⏱ ${formatDuration(service.durationMinutes)}</span>
        </div>
        ${priceSection}
      </div>
      ${service.description ? `<div style="margin-bottom:28px"><div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Descrição</div><p style="font-size:15px;color:var(--text);line-height:1.7">${escapeHtml(service.description)}</p></div>` : ""}
      <div style="position:fixed;bottom:0;left:0;right:0;padding:16px 20px;background:var(--bg);border-top:1px solid var(--border);z-index:100">${bookBtn}</div>
    </div>
    <script>
      var _imgs = ${JSON.stringify(images.map(m => m.url))};
      var _cur = 0;
      function galleryMove(dir) { galleryGoTo((_cur + dir + _imgs.length) % _imgs.length); }
      function galleryGoTo(i) {
        _cur = i;
        document.getElementById('galleryTrack').style.transform = 'translateX(-' + (i * 100) + '%)';
        document.querySelectorAll('.gallery-dot').forEach(function(d,idx){ d.classList.toggle('active', idx===i); });
        var c = document.getElementById('galleryCounter'); if(c) c.textContent = (i+1) + ' / ' + _imgs.length;
      }
      function openLightbox(i) { _cur=i; document.getElementById('lightboxImg').src=_imgs[i]; document.getElementById('lightboxOverlay').classList.add('open'); }
      function closeLightbox() { document.getElementById('lightboxOverlay').classList.remove('open'); }
      function lightboxMove(dir) { _cur=(_cur+dir+_imgs.length)%_imgs.length; document.getElementById('lightboxImg').src=_imgs[_cur]; }
      document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeLightbox(); if(e.key==='ArrowLeft') lightboxMove(-1); if(e.key==='ArrowRight') lightboxMove(1); });
    <\/script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

// ─── Página de Detalhe de Plano de Assinatura (Fluxo 4 etapas) ────────────────
async function renderPlanDetailPage(slug: string, planId: number, res: Response, req: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor || "#C9A84C";
  const sessionData = req.cookies?.[`client_session_${slug}`] ;
  const isLoggedIn = !!sessionData;
  let clientInfo: any = null;
  if (sessionData) { clientInfo = decodeClientSession(sessionData); }
  // Buscar plano, serviços, produtos e barbeiros
  let plan: any = null;
  let planServices: any[] = [];
  let planProducts: any[] = [];
  try {
    const dbConn = await db.getDb();
    if (dbConn) {
      const planResult = await dbConn.execute(
        sql`SELECT * FROM subscription_plans WHERE id = ${planId} AND "tenantId" = ${tenant.id} AND "isActive" = true LIMIT 1`
      ) as any;
      const plans = Array.isArray(planResult) ? planResult[0] : planResult?.rows ?? [];
      plan = plans?.[0] ?? null;
      if (plan) {
        const svcsResult = await dbConn.execute(
          sql`SELECT sps."serviceId", s.name as "serviceName", s."durationMinutes", s.price as "servicePrice"
           FROM subscription_plan_services sps
           JOIN services s ON s.id = sps."serviceId"
           WHERE sps."planId" = ${planId}`
        ) as any;
        planServices = Array.isArray(svcsResult) ? svcsResult[0] : svcsResult?.rows ?? [];
        const prdsResult = await dbConn.execute(
          sql`SELECT spp."productId", p.name as "productName", p.price as "productPrice"
           FROM subscription_plan_products spp
           JOIN products p ON p.id = spp."productId"
           WHERE spp."planId" = ${planId}`
        ) as any;
        planProducts = Array.isArray(prdsResult) ? prdsResult[0] : prdsResult?.rows ?? [];
      }
    }
  } catch (e: any) { console.error('[plan] Erro ao buscar dados do plano:', e?.message ?? String(e)); }
  if (!plan) { res.redirect(`/pub/${slug}`); return; }
  // Buscar barbeiros ativos
  const barberList = await db.getAllBarbers(tenant.id);
  const barbersJson = JSON.stringify(barberList.map((b: any) => ({
    id: b.id,
    name: b.name,
    photoUrl: b.photoUrl ?? null,
    specialties: b.specialties ?? null,
  })));
  const planServicesJson = JSON.stringify(planServices);
  const planProductsJson = JSON.stringify(planProducts);
  const planJson = JSON.stringify({
    id: plan.id,
    name: plan.name,
    description: plan.description ?? "",
    price: Number(plan.price),
    recurrences: plan.recurrences,
    maxServices: plan.maxServices ?? 999,
    maxProducts: plan.maxProducts ?? 999,
  });
  const tenantIdJson = JSON.stringify(tenant.id);
  const slugJson = JSON.stringify(slug);
  const clientJson = isLoggedIn ? JSON.stringify(clientInfo) : "null";
  // Gerar próximos 30 dias para o calendário
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calDays: { iso: string; day: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    calDays.push({ iso: d.toISOString().split("T")[0], day: d.getDate() });
  }
  const calJson = JSON.stringify(calDays);
  const firstBarberId = barberList[0]?.id ?? 1;
  const body = `
    <style>
      .plan-step { display: none; }
      .plan-step.active { display: block; }
      .plan-step-indicator { display: flex; align-items: center; gap: 0; margin-bottom: 24px; }
      .plan-step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; transition: all 0.2s; }
      .plan-step-dot.active { background: var(--primary); color: #0A0A0A; box-shadow: 0 0 0 4px var(--primary)22; }
      .plan-step-dot.done { background: #22C55E; color: #fff; }
      .plan-step-dot.pending { background: var(--surface2); color: var(--muted); }
      .plan-step-line { flex: 1; height: 2px; background: var(--border); margin: 0 4px; transition: background 0.3s; }
      .plan-step-line.done { background: #22C55E; }
      .plan-barber-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 10px; background: var(--surface); border: 2px solid var(--border); border-radius: 14px; cursor: pointer; transition: all 0.15s; }
      .plan-barber-card:hover { border-color: var(--primary); }
      .plan-barber-card.selected { border-color: var(--primary); background: var(--primary)18; }
      .plan-barber-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); }
      .plan-barber-placeholder { width: 56px; height: 56px; border-radius: 50%; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: var(--muted); border: 2px solid var(--border); }
      .plan-barber-name { font-size: 12px; font-weight: 700; text-align: center; }
      .plan-svc-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--surface); border: 2px solid var(--border); border-radius: 14px; cursor: pointer; transition: border-color 0.15s; }
      .plan-svc-item:hover { border-color: var(--primary); }
      .plan-svc-item.selected { border-color: var(--primary); background: var(--primary)10; }
      .plan-prd-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--surface); border: 2px solid var(--border); border-radius: 14px; cursor: pointer; transition: border-color 0.15s; }
      .plan-prd-item:hover { border-color: var(--primary); }
      .plan-prd-item.selected { border-color: var(--primary); background: var(--primary)10; }
      .plan-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 16px; }
      .plan-cal-header { text-align: center; font-size: 10px; font-weight: 700; color: var(--muted); padding: 4px 0 8px; text-transform: uppercase; }
      .plan-cal-cell { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
      .plan-cal-cell:hover:not(.plan-cal-past):not(.plan-cal-empty) { border-color: var(--primary); color: var(--primary); }
      .plan-cal-cell.plan-cal-selected { background: var(--primary); color: #0A0A0A; font-weight: 900; }
      .plan-cal-cell.plan-cal-past { color: var(--muted); opacity: 0.3; cursor: not-allowed; }
      .plan-cal-cell.plan-cal-empty { cursor: default; }
      .plan-slot-btn { padding: 10px 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 10px; color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; min-width: 70px; text-align: center; }
      .plan-slot-btn:hover { border-color: var(--primary); color: var(--primary); }
      .plan-slot-btn.selected { background: var(--primary); border-color: var(--primary); color: #0A0A0A; }
      .plan-pay-option { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--surface); border: 2px solid var(--border); border-radius: 14px; cursor: pointer; transition: border-color 0.15s; margin-bottom: 10px; }
      .plan-pay-option:hover { border-color: var(--primary); }
      .plan-pay-option.selected { border-color: var(--primary); background: var(--primary)10; }
      .plan-nav { display: flex; gap: 10px; margin-top: 20px; }
      .plan-btn-back { flex: 1; padding: 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer; }
      .plan-btn-next { flex: 2; padding: 14px; background: var(--primary); border: none; border-radius: 14px; color: #0A0A0A; font-size: 15px; font-weight: 800; cursor: pointer; opacity: 0.4; pointer-events: none; }
      .plan-btn-next.ready { opacity: 1; pointer-events: auto; }
      .plan-section-title { font-size: 16px; font-weight: 800; margin-bottom: 16px; }
      .plan-slots-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .plan-period-label { font-size: 11px; color: var(--muted); letter-spacing: 0.8px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
      .plan-period-line { flex: 1; height: 1px; background: var(--border); }
      .plan-slot-group { margin-top: 16px; }
      .plan-summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 8px 0; border-bottom: 1px solid var(--border); }
      .plan-summary-label { color: var(--muted); }
      .plan-summary-value { font-weight: 700; }
      .plan-appt-chip { display: flex; align-items: center; justify-content: space-between; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
      .plan-appt-chip-remove { background: none; border: none; color: var(--muted); font-size: 16px; cursor: pointer; padding: 0 4px; }
    </style>

    <div style="max-width:520px;margin:0 auto;padding:24px 20px 80px">
      <!-- Cabeçalho -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <button id="plan-back-btn" onclick="planBack()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;padding:0;line-height:1">←</button>
        <div>
          <div style="font-size:18px;font-weight:900">${escapeHtml(plan.name)}</div>
          <div style="font-size:12px;color:var(--muted)">Assinatura de Plano</div>
        </div>
        ${isLoggedIn ? `<div style="margin-left:auto;text-align:right"><div style="font-size:13px;font-weight:700">${escapeHtml(clientInfo?.name?.split(' ')[0] ?? '')}</div><a href="/pub/${slug}/logout" style="font-size:11px;color:var(--muted)">Sair</a></div>` : `<a href="/pub/${slug}/login?redirect=plano/${planId}" style="margin-left:auto;background:var(--primary);color:#0A0A0A;font-size:12px;font-weight:800;padding:8px 14px;border-radius:10px;text-decoration:none">Entrar</a>`}
      </div>

      <!-- Indicador de etapas -->
      <div class="plan-step-indicator" id="plan-step-indicator">
        <div class="plan-step-dot active" id="plan-dot-1">1</div>
        <div class="plan-step-line" id="plan-line-1"></div>
        <div class="plan-step-dot pending" id="plan-dot-2">2</div>
        <div class="plan-step-line" id="plan-line-2"></div>
        <div class="plan-step-dot pending" id="plan-dot-3">3</div>
        <div class="plan-step-line" id="plan-line-3"></div>
        <div class="plan-step-dot pending" id="plan-dot-4">4</div>
      </div>

      <!-- Etapa 1: Detalhes do Plano -->
      <div class="plan-step active" id="plan-step-1">
        <div class="plan-section-title">🏷️ Detalhes do Plano</div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px">
          <div style="font-size:22px;font-weight:900;margin-bottom:6px">${escapeHtml(plan.name)}</div>
          ${plan.description ? `<div style="font-size:13px;color:var(--muted);margin-bottom:12px;line-height:1.5">${escapeHtml(plan.description)}</div>` : ""}
          <div style="font-size:32px;font-weight:900;color:var(--primary);line-height:1">${isLoggedIn ? formatPrice(plan.price) : "???"}<span style="font-size:14px;font-weight:500;color:var(--muted)">/mês</span></div>
          <div style="margin-top:8px;font-size:13px;color:var(--muted)">${plan.recurrences} agendamento${plan.recurrences !== 1 ? "s" : ""}/mês • Cancele quando quiser</div>
        </div>
        ${planServices.length > 0 ? `<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Serviços Incluídos</div>${planServices.map((s: any) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:10px"><span style="color:var(--primary)">✂</span><span style="font-size:13px;font-weight:600">${escapeHtml(s.serviceName)}</span></div><span style="font-size:11px;color:var(--muted)">${formatDuration(s.durationMinutes)}</span></div>`).join("")}</div>` : ""}
        ${planProducts.length > 0 ? `<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Produtos Incluídos</div>${planProducts.map((p: any) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)"><span style="color:var(--primary)">🧴</span><span style="font-size:13px;font-weight:600">${escapeHtml(p.productName)}</span></div>`).join("")}</div>` : ""}
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Regras</div>
          <div style="font-size:13px;color:var(--text);line-height:1.8">
            <div>✅ ${plan.recurrences} agendamento${plan.recurrences !== 1 ? "s" : ""} por mês</div>
            ${plan.maxServices < 999 ? `<div>✅ Até ${plan.maxServices} serviço${plan.maxServices !== 1 ? "s" : ""} por agendamento</div>` : ""}
            <div>✅ Cobrança mensal recorrente</div>
            <div>✅ Cancele a qualquer momento</div>
          </div>
        </div>
        ${isLoggedIn
          ? `<div class="plan-nav"><button class="plan-btn-next ready" onclick="planGoTo(2)" style="flex:1">Próximo: Serviços →</button></div>`
          : `<a href="/pub/${slug}/login?redirect=plano/${planId}" style="display:block;width:100%;padding:16px;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:900;border-radius:14px;text-align:center;text-decoration:none;margin-top:16px">Entrar para Assinar</a>`
        }
      </div>

      <!-- Etapa 2: Serviços e Produtos -->
      <div class="plan-step" id="plan-step-2">
        <div class="plan-section-title">✂ Serviços e Produtos</div>
        <div id="plan-svc-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px"></div>
        <div id="plan-prd-list" style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px"></div>
        <div class="plan-nav">
          <button class="plan-btn-back" onclick="planGoTo(1)">← Voltar</button>
          <button class="plan-btn-next" id="plan-btn-svc-next" onclick="planGoTo(3)">Próximo: Horários →</button>
        </div>
      </div>

      <!-- Etapa 3: Profissional e Horários -->
      <div class="plan-step" id="plan-step-3">
        <div class="plan-section-title">📅 Profissional e Horários</div>
        <!-- Seleção de barbeiro -->
        <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">💈 Profissional</div>
        <div id="plan-barbers-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:10px;margin-bottom:20px"></div>
        <!-- Calendário -->
        <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">📅 Escolha as datas (${plan.recurrences}x)</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <button id="plan-cal-prev" onclick="planCalNav(-1)" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);cursor:pointer;font-size:16px">‹</button>
          <span id="plan-cal-title" style="font-size:14px;font-weight:700;color:var(--text)"></span>
          <button id="plan-cal-next" onclick="planCalNav(1)" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;color:var(--text);cursor:pointer;font-size:16px">›</button>
        </div>
        <div class="plan-cal-grid" id="plan-cal-grid"></div>
        <!-- Slots -->
        <div id="plan-slots-area" style="margin-top:8px"></div>
        <!-- Agendamentos adicionados -->
        <div id="plan-appts-list" style="margin-top:16px"></div>
        <div class="plan-nav">
          <button class="plan-btn-back" onclick="planGoTo(2)">← Voltar</button>
          <button class="plan-btn-next" id="plan-btn-sched-next" onclick="planGoTo(4)">Próximo: Pagamento →</button>
        </div>
      </div>

      <!-- Etapa 4: Pagamento e Confirmação -->
      <div class="plan-step" id="plan-step-4">
        <div class="plan-section-title">💳 Pagamento</div>
        <!-- Resumo -->
        <div id="plan-summary" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;margin-bottom:16px"></div>
        <!-- Opções de pagamento -->
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Forma de Pagamento</div>
        <div id="plan-pay-options">
          <div class="plan-pay-option selected" id="plan-pay-cash" onclick="selectPlanPay('cash')">
            <span style="font-size:20px">💵</span>
            <div><div style="font-size:14px;font-weight:700">Dinheiro</div><div style="font-size:12px;color:var(--muted)">Pagar na barbearia</div></div>
            <span id="plan-pay-cash-check" style="margin-left:auto;color:var(--primary);font-size:18px">✔</span>
          </div>
          <div class="plan-pay-option" id="plan-pay-pix" onclick="selectPlanPay('pix')">
            <span style="font-size:20px">📱</span>
            <div><div style="font-size:14px;font-weight:700">Pix</div><div style="font-size:12px;color:var(--muted)">Pagar na barbearia</div></div>
            <span id="plan-pay-pix-check" style="margin-left:auto;color:var(--primary);font-size:18px;display:none">✔</span>
          </div>
          <div class="plan-pay-option" id="plan-pay-debit" onclick="selectPlanPay('debit_card')">
            <span style="font-size:20px">💳</span>
            <div><div style="font-size:14px;font-weight:700">Cartão Débito</div><div style="font-size:12px;color:var(--muted)">Pagar na barbearia</div></div>
            <span id="plan-pay-debit-check" style="margin-left:auto;color:var(--primary);font-size:18px;display:none">✔</span>
          </div>
          <div class="plan-pay-option" id="plan-pay-credit" onclick="selectPlanPay('credit_card')">
            <span style="font-size:20px">💳</span>
            <div><div style="font-size:14px;font-weight:700">Cartão Crédito</div><div style="font-size:12px;color:var(--muted)">Renovação mensal automática</div></div>
            <span id="plan-pay-credit-check" style="margin-left:auto;color:var(--primary);font-size:18px;display:none">✔</span>
          </div>
        </div>
        <div id="plan-confirm-msg" style="margin-top:14px;font-size:13px;text-align:center"></div>
        <div class="plan-nav">
          <button class="plan-btn-back" onclick="planGoTo(3)">← Voltar</button>
          <button class="plan-btn-next ready" id="plan-btn-confirm" onclick="confirmPlanSubscription()">Confirmar Assinatura</button>
        </div>
      </div>
    </div>

    <script>
      var PLAN = ${planJson};
      var PLAN_SERVICES = ${planServicesJson};
      var PLAN_PRODUCTS = ${planProductsJson};
      var BARBERS = ${barbersJson};
      var CALENDAR = ${calJson};
      var SLUG = ${slugJson};
      var TENANT_ID = ${tenantIdJson};
      var CLIENT = ${clientJson};

      var planCurrentStep = 1;
      var planSelectedBarber = BARBERS.length > 0 ? BARBERS[0] : null;
      var planSelectedServices = [];
      var planSelectedProducts = [];
      var planSelectedAppts = []; // [{date, time}]
      var planSelectedDate = null;
      var planPayMethod = 'cash';

      // ─── Navegação entre etapas ──────────────────────────────────────────────
      function planGoTo(step) {
        document.querySelectorAll('.plan-step').forEach(function(el) { el.classList.remove('active'); });
        document.getElementById('plan-step-' + step).classList.add('active');
        for (var i = 1; i <= 4; i++) {
          var dot = document.getElementById('plan-dot-' + i);
          var line = document.getElementById('plan-line-' + i);
          if (i < step) { dot.className = 'plan-step-dot done'; dot.textContent = '✓'; }
          else if (i === step) { dot.className = 'plan-step-dot active'; dot.textContent = i; }
          else { dot.className = 'plan-step-dot pending'; dot.textContent = i; }
          if (line) { line.className = i < step ? 'plan-step-line done' : 'plan-step-line'; }
        }
        planCurrentStep = step;
        if (step === 2) renderPlanSvcList();
        if (step === 3) { renderPlanBarbers(); renderPlanCal(); }
        if (step === 4) renderPlanSummary();
        window.scrollTo(0, 0);
      }

      function planBack() {
        if (planCurrentStep === 1) { window.location.href = '/pub/' + SLUG; return; }
        planGoTo(planCurrentStep - 1);
      }

      // ─── Etapa 2: Serviços e Produtos ────────────────────────────────────────
      function renderPlanSvcList() {
        var svcEl = document.getElementById('plan-svc-list');
        var prdEl = document.getElementById('plan-prd-list');
        var maxSvc = PLAN.maxServices < 999 ? PLAN.maxServices : PLAN_SERVICES.length;
        var maxPrd = PLAN.maxProducts < 999 ? PLAN.maxProducts : PLAN_PRODUCTS.length;
        var svcHtml = '';
        if (PLAN_SERVICES.length > 0) {
          svcHtml += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
            '<span style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px">✂ Serviços</span>' +
            '<span style="font-size:12px;font-weight:700;color:var(--primary)">' + planSelectedServices.length + '/' + maxSvc + '</span>' +
          '</div>';
          PLAN_SERVICES.forEach(function(s) {
            var isSel = planSelectedServices.indexOf(s.serviceId) >= 0;
            svcHtml += '<div class="plan-svc-item' + (isSel ? ' selected' : '') + '" onclick="togglePlanSvc(' + s.serviceId + ')">' +
              '<div>' +
                '<div style="font-size:14px;font-weight:700">' + escHtml(s.serviceName) + '</div>' +
                '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + fmtDur(s.durationMinutes) + '</div>' +
              '</div>' +
              '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (isSel ? 'var(--primary)' : 'var(--border)') + ';background:' + (isSel ? 'var(--primary)' : 'transparent') + ';display:flex;align-items:center;justify-content:center;font-size:12px;color:' + (isSel ? '#0A0A0A' : 'transparent') + '">✓</div>' +
            '</div>';
          });
        }
        svcEl.innerHTML = svcHtml;
        var prdHtml = '';
        if (PLAN_PRODUCTS.length > 0) {
          prdHtml += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
            '<span style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px">🧴 Produtos</span>' +
            '<span style="font-size:12px;font-weight:700;color:var(--primary)">' + planSelectedProducts.length + '/' + maxPrd + '</span>' +
          '</div>';
          PLAN_PRODUCTS.forEach(function(p) {
            var isSel = planSelectedProducts.indexOf(p.productId) >= 0;
            prdHtml += '<div class="plan-prd-item' + (isSel ? ' selected' : '') + '" onclick="togglePlanPrd(' + p.productId + ')">' +
              '<div style="font-size:14px;font-weight:700">' + escHtml(p.productName) + '</div>' +
              '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (isSel ? 'var(--primary)' : 'var(--border)') + ';background:' + (isSel ? 'var(--primary)' : 'transparent') + ';display:flex;align-items:center;justify-content:center;font-size:12px;color:' + (isSel ? '#0A0A0A' : 'transparent') + '">✓</div>' +
            '</div>';
          });
        }
        prdEl.innerHTML = prdHtml;
        updatePlanSvcNext();
      }

      function togglePlanSvc(id) {
        var idx = planSelectedServices.indexOf(id);
        if (idx >= 0) planSelectedServices.splice(idx, 1);
        else if (planSelectedServices.length < (PLAN.maxServices || 999)) planSelectedServices.push(id);
        renderPlanSvcList();
      }

      function togglePlanPrd(id) {
        var idx = planSelectedProducts.indexOf(id);
        if (idx >= 0) planSelectedProducts.splice(idx, 1);
        else if (planSelectedProducts.length < (PLAN.maxProducts || 999)) planSelectedProducts.push(id);
        renderPlanSvcList();
      }

      function updatePlanSvcNext() {
        var btn = document.getElementById('plan-btn-svc-next');
        // Pode avançar se não há serviços no plano OU se selecionou pelo menos 1
        var ok = PLAN_SERVICES.length === 0 || planSelectedServices.length > 0;
        btn.className = ok ? 'plan-btn-next ready' : 'plan-btn-next';
      }

      // ─── Etapa 3: Barbeiros e Horários ───────────────────────────────────────
      function renderPlanBarbers() {
        var grid = document.getElementById('plan-barbers-grid');
        var html = '';
        BARBERS.forEach(function(b) {
          var initials = b.name.split(' ').map(function(w){return w[0];}).join('').substring(0,2).toUpperCase();
          var isSel = planSelectedBarber && planSelectedBarber.id === b.id;
          html += '<div class="plan-barber-card' + (isSel ? ' selected' : '') + '" onclick="selectPlanBarber(' + b.id + ')">';
          if (b.photoUrl) {
            html += '<img class="plan-barber-avatar" src="' + escHtml(b.photoUrl) + '" alt="" onerror="this.style.display=&quot;none&quot;;this.nextElementSibling.style.display=&quot;flex&quot;" />';
            html += '<div class="plan-barber-placeholder" style="display:none">' + initials + '</div>';
          } else {
            html += '<div class="plan-barber-placeholder">' + initials + '</div>';
          }
          html += '<div class="plan-barber-name">' + escHtml(b.name) + '</div>';
          html += '</div>';
        });
        grid.innerHTML = html;
      }

      function selectPlanBarber(id) {
        planSelectedBarber = BARBERS.find(function(b){return b.id===id;}) || null;
        planSelectedDate = null;
        planSelectedAppts = [];
        renderPlanBarbers();
        renderPlanCal();
        updatePlanSchedNext();
      }

      // Calendário mensal
      var planCalYear = new Date().getFullYear();
      var planCalMonth = new Date().getMonth();
      var MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      var WEEKDAY_NAMES = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

      function renderPlanCal() {
        var grid = document.getElementById('plan-cal-grid');
        var today = new Date(); today.setHours(0,0,0,0);
        // Limite: 30 dias a partir de hoje (data de assinatura)
        var maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 30);
        maxDate.setHours(0,0,0,0);
        var firstDay = new Date(planCalYear, planCalMonth, 1).getDay();
        var daysInMonth = new Date(planCalYear, planCalMonth + 1, 0).getDate();
        var html = '';
        WEEKDAY_NAMES.forEach(function(d) {
          html += '<div class="plan-cal-header">' + d + '</div>';
        });
        for (var i = 0; i < firstDay; i++) html += '<div class="plan-cal-cell plan-cal-empty"></div>';
        for (var d = 1; d <= daysInMonth; d++) {
          var dt = new Date(planCalYear, planCalMonth, d);
          dt.setHours(0,0,0,0);
          var iso = dt.toISOString().split('T')[0];
          var isPast = dt < today;
          var isFuture = dt > maxDate;
          var isDisabled = isPast || isFuture;
          var isSel = planSelectedDate === iso;
          var cls = 'plan-cal-cell' + (isDisabled ? ' plan-cal-past' : '') + (isSel ? ' plan-cal-selected' : '');
          html += '<div class="' + cls + '"' + (!isDisabled ? ' onclick="selectPlanDate(&quot;'+iso+'&quot;)"' : '') + '>' + d + '</div>';
        }
        // Cabeçalho do mês + botões de navegação
        var calTitle = document.getElementById('plan-cal-title');
        if (calTitle) calTitle.textContent = MONTH_NAMES[planCalMonth] + ' ' + planCalYear;
        // Controlar botões de navegação
        var prevBtn = document.getElementById('plan-cal-prev');
        var nextBtn = document.getElementById('plan-cal-next');
        if (prevBtn) prevBtn.disabled = (planCalYear === today.getFullYear() && planCalMonth <= today.getMonth());
        // Permitir navegar até o mês que contém a data máxima (hoje + 30 dias)
        var maxMonth = maxDate.getMonth();
        var maxYear = maxDate.getFullYear();
        if (nextBtn) nextBtn.disabled = (planCalYear > maxYear || (planCalYear === maxYear && planCalMonth >= maxMonth));
        grid.innerHTML = html;
      }

      function planCalNav(dir) {
        planCalMonth += dir;
        if (planCalMonth > 11) { planCalMonth = 0; planCalYear++; }
        if (planCalMonth < 0) { planCalMonth = 11; planCalYear--; }
        renderPlanCal();
      }

      function selectPlanDate(iso) {
        planSelectedDate = iso;
        renderPlanCal();
        loadPlanSlots();
      }

      async function loadPlanSlots() {
        var area = document.getElementById('plan-slots-area');
        if (!planSelectedDate) { area.innerHTML = ''; return; }
        var barberId = planSelectedBarber ? planSelectedBarber.id : ${firstBarberId};
        var duration = 30;
        if (planSelectedServices.length > 0) {
          var svc = PLAN_SERVICES.find(function(s){return s.serviceId===planSelectedServices[0];});
          if (svc) duration = svc.durationMinutes || 30;
        }
        area.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">Carregando horários...</div>';
        try {
          var r = await fetch('/pub-api/slots?barberId=' + barberId + '&date=' + planSelectedDate + '&duration=' + duration);
          var slots = await r.json();
          if (!slots.length) { area.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">Nenhum horário disponível.</div>'; return; }
          var manha = slots.filter(function(s){return parseInt(s.startTime)<12;});
          var tarde = slots.filter(function(s){var h=parseInt(s.startTime);return h>=12&&h<18;});
          var noite = slots.filter(function(s){return parseInt(s.startTime)>=18;});
          function slotBtn(s) {
            return '<button class="plan-slot-btn" onclick="addPlanAppt(&quot;'+s.startTime+'&quot;)">'+s.startTime+'</button>';
          }
          var html = '<div style="margin-top:8px">';
          if (manha.length) html += '<div class="plan-slot-group"><div class="plan-period-label">☀️ Manhã<div class="plan-period-line"></div></div><div class="plan-slots-row">' + manha.map(slotBtn).join('') + '</div></div>';
          if (tarde.length) html += '<div class="plan-slot-group"><div class="plan-period-label">🌤️ Tarde<div class="plan-period-line"></div></div><div class="plan-slots-row">' + tarde.map(slotBtn).join('') + '</div></div>';
          if (noite.length) html += '<div class="plan-slot-group"><div class="plan-period-label">🌙 Noite<div class="plan-period-line"></div></div><div class="plan-slots-row">' + noite.map(slotBtn).join('') + '</div></div>';
          html += '</div>';
          area.innerHTML = html;
        } catch(e) {
          area.innerHTML = '<div style="padding:16px;text-align:center;color:#F87171;font-size:13px">Erro ao carregar horários.</div>';
        }
      }

      function addPlanAppt(time) {
        if (!planSelectedDate) return;
        // Verificar se já adicionou este slot
        var exists = planSelectedAppts.find(function(a){return a.date===planSelectedDate&&a.time===time;});
        if (exists) return;
        // Verificar limite de agendamentos
        if (planSelectedAppts.length >= PLAN.recurrences) {
          pubAlert('Você já selecionou o máximo de ' + PLAN.recurrences + ' agendamento(s) para este plano.', 'warning');
          return;
        }
        planSelectedAppts.push({ date: planSelectedDate, time: time, barberId: planSelectedBarber ? planSelectedBarber.id : null });
        renderPlanAppts();
        updatePlanSchedNext();
      }

      function removePlanAppt(idx) {
        planSelectedAppts.splice(idx, 1);
        renderPlanAppts();
        updatePlanSchedNext();
      }

      function renderPlanAppts() {
        var el = document.getElementById('plan-appts-list');
        if (planSelectedAppts.length === 0) { el.innerHTML = ''; return; }
        var html = '<div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Agendamentos selecionados (' + planSelectedAppts.length + '/' + PLAN.recurrences + ')</div>';
        planSelectedAppts.forEach(function(a, i) {
          var dateFormatted = a.date.split('-').reverse().join('/');
          html += '<div class="plan-appt-chip">' +
            '<span>📅 ' + dateFormatted + ' às ' + a.time + '</span>' +
            '<button class="plan-appt-chip-remove" onclick="removePlanAppt(' + i + ')">&#x2715;</button>' +
          '</div>';
        });
        el.innerHTML = html;
      }

      function updatePlanSchedNext() {
        var btn = document.getElementById('plan-btn-sched-next');
        var ok = planSelectedAppts.length >= PLAN.recurrences;
        btn.className = ok ? 'plan-btn-next ready' : 'plan-btn-next';
      }

      // ─── Etapa 4: Pagamento ───────────────────────────────────────────────────
      function selectPlanPay(method) {
        planPayMethod = method;
        ['cash','pix','debit_card','credit_card'].forEach(function(m) {
          var el = document.getElementById('plan-pay-' + m.replace('_card','').replace('debit','debit').replace('credit','credit'));
          var check = document.getElementById('plan-pay-' + m.replace('_card','').replace('debit','debit').replace('credit','credit') + '-check');
          if (el) el.className = 'plan-pay-option' + (m === method ? ' selected' : '');
          if (check) check.style.display = m === method ? 'block' : 'none';
        });
      }

      function renderPlanSummary() {
        var el = document.getElementById('plan-summary');
        var svcNames = planSelectedServices.map(function(id) {
          var s = PLAN_SERVICES.find(function(x){return x.serviceId===id;});
          return s ? s.serviceName : '';
        }).filter(Boolean).join(', ');
        var apptCount = planSelectedAppts.length;
        var html = '<div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:12px">Resumo da Assinatura</div>';
        html += '<div class="plan-summary-row"><span class="plan-summary-label">Plano</span><span class="plan-summary-value">' + escHtml(PLAN.name) + '</span></div>';
        if (svcNames) html += '<div class="plan-summary-row"><span class="plan-summary-label">Serviços</span><span class="plan-summary-value">' + escHtml(svcNames) + '</span></div>';
        html += '<div class="plan-summary-row"><span class="plan-summary-label">Agendamentos</span><span class="plan-summary-value">' + apptCount + 'x no mês</span></div>';
        html += '<div class="plan-summary-row" style="border-bottom:none"><span class="plan-summary-label">Valor</span><span class="plan-summary-value" style="color:var(--primary);font-size:16px">R$ ' + Number(PLAN.price).toFixed(2).replace('.',',') + '</span></div>';
        el.innerHTML = html;
      }

      async function confirmPlanSubscription() {
        var btn = document.getElementById('plan-btn-confirm');
        var msg = document.getElementById('plan-confirm-msg');
        btn.disabled = true;
        btn.textContent = 'Confirmando...';
        msg.textContent = '';
        try {
          var r = await fetch('/pub-api/subscribe-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              slug: SLUG,
              planId: PLAN.id,
              barberId: planSelectedBarber ? planSelectedBarber.id : null,
              selectedServiceIds: planSelectedServices,
              selectedProductIds: planSelectedProducts,
              paymentMethod: planPayMethod,
              appointments: planSelectedAppts,
            }),
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao confirmar assinatura');
          msg.style.color = '#4ADE80';
          msg.innerHTML = '✅ Assinatura confirmada! Seus agendamentos foram criados.';
          btn.style.display = 'none';
          // Mostrar botão de ver agendamentos
          var navEl = document.querySelector('.plan-nav');
          if (navEl) {
            navEl.innerHTML = '<a href="/pub/' + SLUG + '/meus-agendamentos" style="display:block;width:100%;padding:14px;background:var(--primary);color:#0A0A0A;font-size:15px;font-weight:800;border-radius:14px;text-align:center;text-decoration:none;margin-top:8px">Ver Meus Agendamentos</a>';
          }
        } catch(e) {
          msg.style.color = '#F87171';
          msg.textContent = e.message;
          btn.disabled = false;
          btn.textContent = 'Confirmar Assinatura';
        }
      }

      // ─── Helpers ──────────────────────────────────────────────────────────────
      function escHtml(s) { var d=document.createElement('div');d.textContent=s;return d.innerHTML; }
      function fmtDur(m) { if(!m)return''; var h=Math.floor(m/60),min=m%60; return h>0?(min>0?h+'h'+min+'min':h+'h'):min+'min'; }
      function fmtPrice(p) { return 'R$ '+Number(p).toFixed(2).replace('.',','); }

      // Inicializar seleções padrão
      if (PLAN_SERVICES.length > 0) planSelectedServices = [PLAN_SERVICES[0].serviceId];
      if (PLAN_PRODUCTS.length > 0) planSelectedProducts = [PLAN_PRODUCTS[0].productId];
    <\/script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

// ─── Página de Detalhe de Produto ────────────────────────────────────────────
async function renderProductDetailPage(slug: string, productId: number, res: Response, req: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor || "#C9A84C";
  const product = await db.getProductById(productId);
  if (!product || product.tenantId !== tenant.id) { res.redirect(`/pub/${slug}`); return; }
  const media = await db.getMediaByEntity("product", productId);
  const sessionData = req.cookies?.[`client_session_${slug}`] ;
  const isLoggedIn = !!sessionData;
  let clientInfo: any = null;
  if (sessionData) { clientInfo = decodeClientSession(sessionData); }
  const images = media.filter(m => m.type === "image");
  const videos = media.filter(m => m.type === "video");
  const mediaHtml = images.length === 0 && videos.length === 0
    ? `<div style="width:100%;height:280px;background:var(--surface2);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:64px;margin-bottom:28px">🧴</div>`
    : `<div class="gallery-carousel" id="galleryCarousel" style="margin-bottom:28px">
        <div class="gallery-track" id="galleryTrack">
          ${images.map((m, i) => `<div class="gallery-slide"><img src="${escapeHtml(m.url)}" alt="${escapeHtml(product.name)}" onclick="openLightbox(${i})" loading="lazy" /></div>`).join("")}
          ${videos.map(m => `<div class="gallery-slide"><video src="${escapeHtml(m.url)}" controls style="width:100%;height:340px;object-fit:cover;display:block"></video></div>`).join("")}
        </div>
        ${images.length > 1 ? `<button class="gallery-nav gallery-prev" onclick="galleryMove(-1)">&#8249;</button><button class="gallery-nav gallery-next" onclick="galleryMove(1)">&#8250;</button><div class="gallery-dots" id="galleryDots">${images.map((_,i) => `<div class="gallery-dot${i===0?' active':''}" onclick="galleryGoTo(${i})"></div>`).join("")}</div><div class="gallery-counter" id="galleryCounter">1 / ${images.length}</div>` : ""}
      </div>
      ${images.length > 0 ? `<div class="lightbox-overlay" id="lightboxOverlay"><span class="lightbox-close" onclick="closeLightbox()">×</span><img class="lightbox-img" id="lightboxImg" src="" alt="" /><button class="lightbox-nav lightbox-lprev" onclick="lightboxMove(-1)">&#8249;</button><button class="lightbox-nav lightbox-lnext" onclick="lightboxMove(1)">&#8250;</button></div>` : ""}`;
  const inStock = product.stockQuantity == null || product.stockQuantity > 0;
  const priceSection = isLoggedIn
    ? `<div style="font-size:32px;font-weight:900;color:var(--primary);margin-bottom:4px">${formatPrice(product.price)}</div><div style="font-size:13px;color:${inStock ? "#22C55E" : "#F87171"};font-weight:700;margin-bottom:16px">${inStock ? (product.stockQuantity != null ? product.stockQuantity + " em estoque" : "Disponível") : "Sem estoque"}</div>`
    : `<a href="/pub/${slug}/login" style="display:inline-flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);padding:12px 20px;border-radius:12px;font-size:14px;font-weight:700;color:var(--text);margin-bottom:16px">🔒 Faça login para ver o preço</a>`;
  const actionBtn = isLoggedIn
    ? (inStock
        ? `<button onclick="buyProduct()" style="display:block;width:100%;padding:16px;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:900;border-radius:14px;text-align:center;letter-spacing:0.5px;border:none;cursor:pointer">🛒 Comprar</button>`
        : `<button id="btnEncomendar" onclick="openOrderModal()" style="display:block;width:100%;padding:16px;background:transparent;color:var(--primary);font-size:16px;font-weight:900;border-radius:14px;text-align:center;letter-spacing:0.5px;border:2px solid var(--primary);cursor:pointer">📦 Encomendar</button>`)
    : `<a href="/pub/${slug}/login?redirect=produto/${productId}" style="display:block;width:100%;padding:16px;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:900;border-radius:14px;text-align:center;letter-spacing:0.5px;text-decoration:none">Entrar para Comprar</a>`;
  const body = `
    <div style="max-width:700px;margin:0 auto;padding:24px 20px 80px">
      <a href="/pub/${slug}" style="display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-bottom:24px;font-weight:600">
        ← Voltar
      </a>
      ${mediaHtml}
      <div style="margin-bottom:28px">
        <h1 style="font-size:28px;font-weight:900;margin-bottom:8px;font-family:var(--font-styled-family,inherit)">${escapeHtml(product.name)}</h1>
        ${priceSection}
      </div>
      ${product.description ? `<div style="margin-bottom:28px"><div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Descrição</div><p style="font-size:15px;color:var(--text);line-height:1.7">${escapeHtml(product.description)}</p></div>` : ""}
      <div style="position:fixed;bottom:0;left:0;right:0;padding:16px 20px;background:var(--bg);border-top:1px solid var(--border);z-index:100">${actionBtn}</div>
    </div>
    <!-- Modal de Confirmação de Encomenda -->
    <div id="orderModal" style="display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);align-items:flex-end;justify-content:center">
      <div id="orderModalInner" style="background:var(--bg);border-radius:24px 24px 0 0;padding:28px 20px 40px;width:100%;max-width:520px;animation:slideUp 0.3s ease">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="font-size:20px;font-weight:900;color:var(--text)">Confirmar Encomenda</h2>
          <button onclick="closeOrderModal()" style="background:none;border:none;font-size:24px;color:var(--muted);cursor:pointer;padding:4px">✕</button>
        </div>
        <div id="orderModalContent">
          <!-- Resumo do produto -->
          <div style="display:flex;gap:14px;align-items:center;background:var(--surface);border-radius:14px;padding:14px;margin-bottom:20px">
            ${images.length > 0
              ? `<img src="${images[0].url}" style="width:60px;height:60px;border-radius:10px;object-fit:cover;flex-shrink:0" />`
              : `<div style="width:60px;height:60px;border-radius:10px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">📦</div>`
            }
            <div style="flex:1;min-width:0">
              <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px">${escapeHtml(product.name)}</div>
              <div style="font-size:15px;font-weight:700;color:var(--primary)">${Number(product.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
            </div>
          </div>
          <!-- Quantidade -->
          <div style="margin-bottom:18px">
            <label style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:10px">Quantidade</label>
            <div style="display:flex;align-items:center;gap:0;border:1px solid var(--border);border-radius:12px;overflow:hidden;width:fit-content">
              <button id="qtyMinus" onclick="changeQty(-1)" style="width:44px;height:44px;background:var(--surface);border:none;font-size:20px;color:var(--text);cursor:pointer;font-weight:700">−</button>
              <span id="qtyDisplay" style="min-width:48px;text-align:center;font-size:18px;font-weight:800;color:var(--text);padding:0 8px">1</span>
              <button id="qtyPlus" onclick="changeQty(1)" style="width:44px;height:44px;background:var(--surface);border:none;font-size:20px;color:var(--text);cursor:pointer;font-weight:700">+</button>
            </div>
          </div>
          <!-- Observação -->
          <div style="margin-bottom:24px">
            <label style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:10px">Observação (opcional)</label>
            <textarea id="orderNote" placeholder="Ex: quero a versão sem perfume, cor azul..." rows="3" style="width:100%;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;resize:none;box-sizing:border-box;font-family:inherit"></textarea>
          </div>
          <!-- Total -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:14px;background:var(--surface);border-radius:12px">
            <span style="font-size:14px;color:var(--muted);font-weight:600">Total estimado</span>
            <span id="orderTotal" style="font-size:18px;font-weight:900;color:var(--primary)">${Number(product.price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
          </div>
          <div id="orderModalMsg" style="margin-bottom:12px;font-size:13px;text-align:center;min-height:20px"></div>
          <button id="btnConfirmOrder" onclick="submitOrder()" style="display:block;width:100%;padding:16px;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:900;border-radius:14px;text-align:center;border:none;cursor:pointer">📦 Confirmar Encomenda</button>
        </div>
      </div>
    </div>
    <style>
      @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    </style>
    <script>
      var _imgs = ${JSON.stringify(images.map(m => m.url))};
      var _cur = 0;
      var _qty = 1;
      var _unitPrice = ${Number(product.price)};
      function galleryMove(dir) { galleryGoTo((_cur + dir + _imgs.length) % _imgs.length); }
      function galleryGoTo(i) {
        _cur = i;
        document.getElementById('galleryTrack').style.transform = 'translateX(-' + (i * 100) + '%)';
        document.querySelectorAll('.gallery-dot').forEach(function(d,idx){ d.classList.toggle('active', idx===i); });
        var c = document.getElementById('galleryCounter'); if(c) c.textContent = (i+1) + ' / ' + _imgs.length;
      }
      function openLightbox(i) { _cur=i; document.getElementById('lightboxImg').src=_imgs[i]; document.getElementById('lightboxOverlay').classList.add('open'); }
      function closeLightbox() { document.getElementById('lightboxOverlay').classList.remove('open'); }
      function lightboxMove(dir) { _cur=(_cur+dir+_imgs.length)%_imgs.length; document.getElementById('lightboxImg').src=_imgs[_cur]; }
      document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeLightbox(); closeOrderModal(); } if(e.key==='ArrowLeft') lightboxMove(-1); if(e.key==='ArrowRight') lightboxMove(1); });
      function buyProduct() {
        var inStock = ${JSON.stringify(inStock)};
        if (!inStock) return;
        cartAdd(${productId}, '${escapeHtml(product.name).replace(/'/g,"\\'")}', ${Number(product.price)}, ${product.stockQuantity ?? 99});
        setTimeout(function() { window.location.href = '/pub/${slug}#tab-products'; }, 600);
      }
      function openOrderModal() {
        _qty = 1;
        document.getElementById('qtyDisplay').textContent = '1';
        document.getElementById('orderNote').value = '';
        document.getElementById('orderModalMsg').textContent = '';
        document.getElementById('orderTotal').textContent = formatCurrency(_unitPrice);
        var m = document.getElementById('orderModal');
        m.style.display = 'flex';
      }
      function closeOrderModal() { document.getElementById('orderModal').style.display = 'none'; }
      function changeQty(delta) {
        _qty = Math.max(1, _qty + delta);
        document.getElementById('qtyDisplay').textContent = _qty;
        document.getElementById('orderTotal').textContent = formatCurrency(_unitPrice * _qty);
      }
      function formatCurrency(val) {
        return 'R$ ' + val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      }
      function submitOrder() {
        var note = document.getElementById('orderNote').value.trim();
        var msg = document.getElementById('orderModalMsg');
        var btn = document.getElementById('btnConfirmOrder');
        btn.disabled = true; btn.textContent = 'Enviando...';
        msg.textContent = '';
        fetch('/pub-api/order-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: ${productId}, quantity: _qty, note: note, slug: '${slug}' })
        }).then(function(r){ return r.json(); }).then(function(data) {
          if (data.success) {
            document.getElementById('orderModalContent').innerHTML = '<div style="text-align:center;padding:20px 0"><div style="font-size:56px;margin-bottom:16px">🎉</div><h2 style="font-size:22px;font-weight:900;color:var(--text);margin-bottom:12px">Encomenda Realizada!</h2><p style="font-size:15px;color:var(--muted);margin-bottom:8px">Seu pedido foi recebido com sucesso.</p><p style="font-size:14px;color:var(--muted);margin-bottom:28px">O barbeiro irá confirmar em breve.</p><a href="/pub/${slug}/meus-agendamentos" style="display:inline-block;padding:14px 28px;background:var(--primary);color:#0A0A0A;font-weight:900;border-radius:12px;text-decoration:none;font-size:15px">Ver Minhas Encomendas</a><br><br><button onclick="closeOrderModal()" style="background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;margin-top:8px">Fechar</button></div>';
          } else {
            msg.style.color = '#F87171';
            msg.textContent = '❌ ' + (data.error || 'Erro ao enviar pedido');
            btn.disabled = false; btn.textContent = '📦 Confirmar Encomenda';
          }
        }).catch(function(){ msg.style.color='#F87171'; msg.textContent='❌ Erro de conexão'; btn.disabled=false; btn.textContent='📦 Confirmar Encomenda'; });
      }
    <\/script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}

export function registerPublicRoutes(app: Express): void {
  app.use(cookieParser());
  // Rota de desenvolvimento: /pub/:slug
  app.get("/pub/:slug", async (req: Request, res: Response) => {
    const slug = req.params.slug;
    try {
      const tenant2 = await db.getTenantBySlug(slug);
      if (tenant2 && !(tenant2 as any).parentTenantId && !req.query.direct) {
        const branches2 = await db.getBranches(tenant2.id);
        if (branches2.length > 0) {
          const esc2 = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
          const settings2: any = await db.getShopSettings(tenant2.id);
          const shopName2 = esc2(settings2?.shopName || tenant2.name);
          const pc = settings2?.primaryColor || '#C9A84C';
          const logo2 = settings2?.logoUrl ? '<img src="'+esc2(settings2.logoUrl)+'" style="height:48px;border-radius:10px;margin-bottom:16px">' : '';
          const units = [
            { name: (tenant2 as any).displayName || tenant2.name, address: settings2?.address || '', slug: tenant2.slug },
            ...branches2.map((b: any) => ({ name: b.displayName || b.name, address: b.address || '', slug: b.slug }))
          ];
          const ucards = units.map((u, i) =>
            '<a href="/pub/'+esc2(u.slug)+(i === 0 ? '?direct=1' : '')+'" style="display:block;background:#1a1a1a;border:2px solid #2a2a2a;border-radius:14px;padding:20px 24px;text-decoration:none;color:#fff;margin-bottom:12px">'
            +'<div style="display:flex;align-items:center;gap:14px">'
            +'<div style="width:44px;height:44px;border-radius:10px;background:'+pc+'22;border:1px solid '+pc+'44;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🏪</div>'
            +'<div><div style="font-size:15px;font-weight:700">'+esc2(u.name)+'</div>'+(u.address?'<div style="font-size:12px;color:#888;margin-top:3px">'+esc2(u.address)+'</div>':'')+'</div>'
            +'<svg style="margin-left:auto;opacity:0.4;flex-shrink:0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
            +'</div></a>'
          ).join('');
          res.send('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+shopName2+' — Escolha a unidade</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0f0f0f;color:#fff;font-family:-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}</style></head><body><div style="max-width:480px;width:100%"><div style="text-align:center;margin-bottom:32px">'+logo2+'<div style="font-size:22px;font-weight:800;margin-bottom:8px">'+shopName2+'</div><div style="font-size:14px;color:#888">Selecione a unidade desejada</div></div>'+ucards+'<div style="text-align:center;margin-top:24px;font-size:11px;color:#444">Powered by <a href="https://usebarberpro.com" style="color:'+pc+';text-decoration:none">Barber Pro</a></div></div></body></html>');
          return;
        }
      }
    } catch(e3) {}
    await renderShopPage(slug, res, req);
  });

  app.get("/pub/:slug/agendar", async (req: Request, res: Response) => {
    await renderBookingPage(req.params.slug, res, req);
  });

  app.get("/pub/:slug/servico/:serviceId", async (req: Request, res: Response) => {
    await renderServiceDetailPage(req.params.slug, parseInt(req.params.serviceId), res, req);
  });

  app.get("/pub/:slug/produto/:productId", async (req: Request, res: Response) => {
    await renderProductDetailPage(req.params.slug, parseInt(req.params.productId), res, req);
  });

  app.get("/pub/:slug/plano/:planId", async (req: Request, res: Response) => {
    await renderPlanDetailPage(req.params.slug, parseInt(req.params.planId), res, req);
  });

  // ─── Endpoint JSON: status de abertura da barbearia ─────────────────────
  app.get("/pub-api/shop-status", async (req: Request, res: Response) => {
    try {
      const slug = req.query.slug as string;
      if (!slug) { res.status(400).json({ error: "slug obrigatorio" }); return; }
      const tenant = await db.getTenantBySlug(slug);
      if (!tenant) { res.status(404).json({ error: "nao encontrado" }); return; }
      const status = await db.getShopOpenStatus(tenant.id);
      res.json(status);
    } catch (e) {
      res.status(500).json({ error: "erro interno" });
    }
  });
  // GET /pub-api/fee-zero-promo — contador real de assinantes pagantes para a
  // promoção "Taxa 0 para os primeiros 100 assinantes" (usado na landing page)
  app.get("/pub-api/fee-zero-promo", async (_req: Request, res: Response) => {
    const TOTAL_VAGAS = 100;
    try {
      const dbConn = await db.getDb();
      if (!dbConn) { res.json({ count: 0, total: TOTAL_VAGAS, remaining: TOTAL_VAGAS }); return; }
      const rows = await dbConn.execute(sql`
        SELECT COUNT(*) as cnt FROM tenants WHERE "barberproSubscriptionStatus" = 'active'
      `) as any;
      const list = Array.isArray(rows) ? rows[0] : (rows?.rows ?? []);
      const count = Math.min(parseInt(list?.[0]?.cnt ?? "0", 10) || 0, TOTAL_VAGAS);
      res.json({ count, total: TOTAL_VAGAS, remaining: Math.max(0, TOTAL_VAGAS - count) });
    } catch (e: any) {
      console.error("[fee-zero-promo] Erro:", e.message);
      res.json({ count: 0, total: TOTAL_VAGAS, remaining: TOTAL_VAGAS });
    }
  });
  // Funções auxiliares do carrinho
  async function createOrdersAndDeductStock(orderItems: any[], tenantId: number, clientId: number, paymentMethod: string, dbRef: typeof db) {
    for (const oi of orderItems) {
      const note = paymentMethod === "pickup" ? "Pagamento na retirada" : paymentMethod === "credit" ? "Cartão de Crédito" : "Pix";
      await dbRef.createProductOrder({ tenantId, clientId, productId: oi.product.id, quantity: oi.qty, note, status: "confirmed" as any });
      if (oi.product.stockQuantity != null && oi.product.stockQuantity > 0) {
        const newStock = Math.max(0, oi.product.stockQuantity - oi.qty);
        await dbRef.updateProduct(oi.product.id, { stockQuantity: newStock });
        console.log(`[cart] Estoque "${oi.product.name}": ${oi.product.stockQuantity} → ${newStock}`);
      }
    }
  }

  async function notifyBarbers(tenantId: number, clientName: string, orderItems: any[], total: number, paymentMethod: string, dbRef: typeof db) {
    try {
      const allBarbers = await dbRef.getAllBarbers(tenantId);
      const itemsList = orderItems.map(oi => `${oi.qty}x ${oi.product.name}`).join(", ");
      const totalFmt = "R$ " + total.toFixed(2).replace(".", ",");
      const payLabel = paymentMethod === "pickup" ? "Retirada" : paymentMethod === "credit" ? "Cartão" : "Pix";
      for (const barber of allBarbers.slice(0, 3)) {
        const pushToken = await dbRef.getBarberPushToken(barber.id);
        if (pushToken) {
          await dbRef.sendExpoPushNotification(pushToken, "🛒 Nova compra — Separar produto!",
            `${clientName || "Cliente"} comprou: ${itemsList} — ${totalFmt} (${payLabel}) ⚡ Pronto para separar`,
            { type: "product_order" });
        }
      }
    } catch (e: any) { console.error("[cart] notifyBarbers:", e.message); }
  }

  // POST /pub-api/cart-checkout — Checkout do carrinho (múltiplos produtos)
  app.post("/pub-api/cart-checkout", async (req: Request, res: Response) => {
    try {
      const { items, slug, paymentMethod } = req.body;
      if (!items?.length || !slug) { res.status(400).json({ error: "Dados incompletos" }); return; }

      const sessionData = req.cookies?.[`client_session_${slug}`] ;
      if (!sessionData) { res.status(401).json({ error: "Não autenticado" }); return; }
      let clientInfo: any;
      clientInfo = decodeClientSession(sessionData);
      if (!clientInfo) { res.status(401).json({ error: "Sessão inválida" }); return; }

      const tenant = await db.getTenantBySlug(slug);
      if (!tenant) { res.status(404).json({ error: "Barbearia não encontrada" }); return; }

      // Calcular total e validar produtos
      let total = 0;
      const orderItems: any[] = [];
      for (const item of items) {
        const product = await db.getProductById(parseInt(item.id));
        if (!product) continue;
        const qty = Math.max(1, parseInt(item.qty) || 1);
        total += Number(product.price) * qty;
        orderItems.push({ product, qty, unitPrice: Number(product.price) });
      }
      if (orderItems.length === 0) { res.status(400).json({ error: "Nenhum produto válido" }); return; }

      // Buscar subconta Asaas do tenant
      const dbConn2 = await db.getDb();
      let subApiKey: string | undefined;
      if (dbConn2) {
        const tenantRow = await dbConn2.execute(sql`SELECT "asaasApiKey" FROM tenants WHERE id = ${tenant.id} LIMIT 1`) as any;
        const td = Array.isArray(tenantRow) ? tenantRow[0]?.[0] : tenantRow?.rows?.[0];
        subApiKey = td?.asaasApiKey || undefined;
      }

      // Pagamentos online via Asaas
      if ((paymentMethod === "pix" || paymentMethod === "credit") && asaasEnabled) {
        if (!subApiKey) {
          res.json({ success: false, error: "Pagamentos online não configurados para esta barbearia. Use 'Pagar na retirada'." });
          return;
        }
        try {
          const customerId = await getOrCreateAsaasCustomer({
            name: clientInfo.name || "Cliente",
            mobilePhone: clientInfo.phone ? clientInfo.phone.replace(/\D/g, "") : undefined,
            externalReference: String(clientInfo.id),
          }, subApiKey);
          const description = orderItems.map(oi => `${oi.qty}x ${oi.product.name}`).join(", ");
          const billingType = paymentMethod === "credit" ? "CREDIT_CARD" : "PIX";
          const charge = await createAsaasCharge({
            customer: customerId,
            billingType,
            value: total,
            dueDate: asaasDefaultDueDate(),
            description: "Pedido — " + description,
          }, subApiKey);

          // Criar pedidos e abater estoque após geração da cobrança
          await createOrdersAndDeductStock(orderItems, tenant.id, clientInfo.id, paymentMethod, db);
          await notifyBarbers(tenant.id, clientInfo.name, orderItems, total, paymentMethod, db);

          if (paymentMethod === "pix") {
            res.json({ success: true, pixQrCode: charge.pixQrCode ?? null, pixCopyCola: charge.pixCopyCola ?? null, total });
          } else {
            // Cartão: retornar link de pagamento do Asaas
            res.json({ success: true, invoiceUrl: charge.invoiceUrl ?? null, total });
          }
          return;
        } catch (asaasErr: any) {
          console.error("[cart-checkout] Asaas error:", asaasErr.message);
          res.json({ success: false, error: "Erro ao gerar cobrança: " + asaasErr.message });
          return;
        }
      }

      if (paymentMethod === "pix" || paymentMethod === "credit") {
        res.json({ success: false, error: "Pagamentos online não disponíveis. Escolha 'Pagar na retirada'." });
        return;
      }

      // Retirada: criar pedidos e abater estoque
      await createOrdersAndDeductStock(orderItems, tenant.id, clientInfo.id, paymentMethod, db);
      await notifyBarbers(tenant.id, clientInfo.name, orderItems, total, paymentMethod, db);

      res.json({ success: true, total });
    } catch (e: any) {
      console.error("[cart-checkout]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/order-product — Encomenda de produto individual (sem estoque)
  app.post("/pub-api/order-product", async (req: Request, res: Response) => {
    try {
      const { productId, quantity, slug } = req.body;
      if (!productId || !quantity || !slug) { res.status(400).json({ error: "Dados incompletos" }); return; }
      const sessionData = req.cookies?.[`client_session_${slug}`] ;
      if (!sessionData) { res.status(401).json({ error: "Não autenticado" }); return; }
      let clientInfo: any;
      clientInfo = decodeClientSession(sessionData);
      if (!clientInfo) { res.status(401).json({ error: "Sessão inválida" }); return; }
      const product = await db.getProductById(parseInt(productId));
      if (!product) { res.status(404).json({ error: "Produto não encontrado" }); return; }
      const tenant = await db.getTenantBySlug(slug);
      if (!tenant) { res.status(404).json({ error: "Barbearia não encontrada" }); return; }
      // Salvar encomenda no banco de dados
      const { note } = req.body;
      await db.createProductOrder({
        tenantId: tenant.id,
        clientId: clientInfo.id,
        productId: parseInt(productId),
        quantity: parseInt(quantity),
        note: note || undefined,
      });
      // Notificar barbeiros sobre o pedido via push notification
      const allBarbers = await db.getAllBarbers(tenant.id);
      for (const barber of allBarbers.slice(0, 3)) {
        try {
          const pushToken = await db.getBarberPushToken(barber.id);
          if (pushToken) {
            await db.sendExpoPushNotification(
              pushToken,
              "📦 Nova Encomenda — Sem estoque",
              `${clientInfo.name} encomendou ${quantity}x ${product.name}`,
              { type: "product_order", productId, quantity, clientId: clientInfo.id }
            );
          }
        } catch {}
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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
      const valid = await bcrypt.compare(password, account.passwordHash);
      if (!valid) { res.status(401).json({ error: "Email ou senha incorretos" }); return; }
      const client = await db.getClientById(account.clientId);
      if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
      const sessionData = encodeClientSession({ id: client.id, name: client.name, email: client.email });
      const slug = req.body.slug as string;
      res.cookie(`client_session_${slug}`, sessionData, { httpOnly: true, secure: CLIENT_COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.json({ id: client.id, name: client.name, email: client.email });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/register  { name, email, password, phone, slug }
  app.post("/pub-api/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password, phone, slug, lgpdConsent, birthDate, cpf } = req.body;
      if (!name || !email || !password || !phone) { res.status(400).json({ error: "Todos os campos são obrigatórios" }); return; }
      if (password.length < 6) { res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" }); return; }
      const existing = await db.getClientAccountByEmail(email);
      if (existing) { res.status(409).json({ error: "Email já cadastrado. Faça login." }); return; }
      const passwordHash = await bcrypt.hash(password, 10);
      // Obter tenantId via slug para associar o cliente à barbearia correta
      const tenantForReg = slug ? await db.getTenantBySlug(slug) : null;
      const clientId = await db.createClient({ name, email, phone, cpf: cpf ?? null, isActive: true, tenantId: tenantForReg?.id ?? null, birthDate: birthDate ?? null } as any);
      await db.createClientAccount({ clientId, email, passwordHash });
      // Salvar consentimento LGPD se fornecido
      if (lgpdConsent && tenantForReg) {
        await db.saveClientConsent({
          clientId,
          tenantId: tenantForReg.id,
          ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? undefined,
          userAgent: req.headers["user-agent"]?.substring(0, 500) ?? undefined,
        });
      }
      const sessionData = encodeClientSession({ id: clientId, name, email });
      res.cookie(`client_session_${slug}`, sessionData, { httpOnly: true, secure: CLIENT_COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
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
      // Verificar se o endTime ultrapassa o horário de fechamento (pending_approval)
      const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      const dayOfWeek = new Date(date + "T12:00:00").getDay();
      const wh = await db.getWorkingHoursForDay(barberId, dayOfWeek);
      let exceedsClosing = false;
      let overtimeMins = 0;
      let closingHHMM = "";
      if (wh) {
        const closeMin = toMin(wh.endTime);
        const endMin = toMin(endTime);
        if (endMin > closeMin) { exceedsClosing = true; overtimeMins = endMin - closeMin; closingHHMM = wh.endTime; }
      }
      const finalStatus = exceedsClosing ? "pending_approval" : "confirmed";
      const apptId = await db.createAppointment({ clientId, barberId, serviceId, date, startTime, endTime, status: finalStatus } as any);
      // Buscar dados para notificações
      const client = await db.getClientById(clientId);
      const service = await db.getServiceById(serviceId);
      const barberData = await db.getBarberById(barberId);
      // Notificar barbeiro via push
      const pushToken = await db.getBarberPushToken(barberId);
      if (pushToken) {
        const notifTitle = exceedsClosing ? "⚠️ Agendamento aguarda sua aprovação" : "📅 Novo agendamento online";
        const extraStr = exceedsClosing ? (() => { const h = Math.floor(overtimeMins/60); const m = overtimeMins%60; return h > 0 ? `${h}h${m > 0 ? m+"min" : ""}` : `${m}min`; })() : "";
        const notifBody = exceedsClosing
          ? `${client?.name ?? "Cliente"} quer agendar ${service?.name ?? "Serviço"} às ${startTime.substring(0,5)} (término às ${endTime.substring(0,5)}, ${extraStr} após o fechamento às ${closingHHMM.substring(0,5)}). Abra a agenda para aprovar.`
          : `${client?.name ?? "Cliente"} agendou ${service?.name ?? "Serviço"} para ${date} às ${startTime}`;
        await db.sendExpoPushNotification(
          pushToken,
          notifTitle,
          notifBody,
          { appointmentId: apptId, screen: "agenda", source: "web" },
          { channelId: "online-booking", badge: 1 }
        );
      }
      // Buscar dados comuns para e-mails
      const tenant2 = slug ? await db.getTenantBySlug(slug) : null;
      const settings2 = await db.getShopSettings();
      const shopName2 = settings2?.shopName ?? tenant2?.name ?? "Barbearia";
      const shopLogoUrl2 = (settings2 as any)?.logoUrl ?? (tenant2 as any)?.logoUrl ?? null;
      const shopPhone2 = (settings2 as any)?.phone ?? (tenant2 as any)?.phone ?? null;
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
          shopLogoUrl: shopLogoUrl2,
          shopPhone: shopPhone2,
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
      // Notificar super_admin quando agendamento precisa de aprovação (excede horário de fechamento)
      if (exceedsClosing) {
        try {
          const tenantForNotif = slug ? await db.getTenantBySlug(slug) : null;
          const allBarbers = await db.getAllBarbers(tenantForNotif?.id ?? null);
          const admins = (allBarbers as any[]).filter((b: any) => b.role === "super_admin" && b.id !== barberId);
          for (const admin of admins.slice(0, 3)) {
            const adminToken = await db.getBarberPushToken(admin.id);
            if (adminToken) {
              const extraStr = (() => { const h = Math.floor(overtimeMins/60); const m = overtimeMins%60; return h > 0 ? `${h}h${m > 0 ? m+"min" : ""}` : `${m}min`; })();
              await db.sendExpoPushNotification(
                adminToken,
                "⚠️ Agendamento aguarda aprovação",
                `${client?.name ?? "Cliente"} quer agendar com ${barberData?.name ?? "barbeiro"} às ${startTime.substring(0,5)} (${extraStr} após fechamento). Abra a agenda para aprovar.`,
                { appointmentId: apptId, screen: "agenda", type: "pending_approval" },
                { channelId: "online-booking", badge: 1 }
              );
            }
          }
        } catch {}
      }
      res.json({ id: apptId, success: true, requiresApproval: exceedsClosing });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /pub-api/oauth-start — inicia o fluxo OAuth Google para clientes públicos
  app.get("/pub-api/oauth-start", (req: Request, res: Response) => {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
    if (!GOOGLE_CLIENT_ID) {
      return res.redirect(`/pub/${req.query.slug ?? ""}/login?error=google_not_configured`);
    }
    const slug = req.query.slug as string;
    const redirect = (req.query.redirect as string) ?? "";
    const service = (req.query.service as string) ?? "";
    const date = (req.query.date as string) ?? "";
    const barber = (req.query.barber as string) ?? "";
    const start = (req.query.start as string) ?? "";
    const end = (req.query.end as string) ?? "";

    const reqHost = req.headers["x-forwarded-host"] as string || req.headers.host || "localhost:3000";
    const reqProto = (req.headers["x-forwarded-proto"] as string || req.protocol || "http").split(",")[0].trim();
    const apiBaseUrl = process.env.PUBLIC_BASE_URL
      ?? process.env.EXPO_PUBLIC_API_BASE_URL
      ?? (reqHost.includes("localhost") ? `http://${reqHost}` : `${reqProto}://${reqHost}`);

    const callbackUrl = `${apiBaseUrl}/pub-api/oauth-callback`;

    // Codificar contexto no state para recuperar após o callback
    const stateData = Buffer.from(JSON.stringify({ slug, redirect, service, date, barber, start, end })).toString("base64url");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", stateData);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    res.redirect(url.toString());
  });

  // GET /pub-api/oauth-callback — processa o retorno do OAuth e cria sessão de cliente público
  app.get("/pub-api/oauth-callback", async (req: Request, res: Response) => {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state) { res.status(400).send("Parâmetros inválidos"); return; }

    // Decodificar contexto do state
    let slug = "", redirect = "", service = "", date = "", barber = "", start = "", end = "";
    try {
      const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
      slug = parsed.slug ?? ""; redirect = parsed.redirect ?? "";
      service = parsed.service ?? ""; date = parsed.date ?? "";
      barber = parsed.barber ?? ""; start = parsed.start ?? ""; end = parsed.end ?? "";
    } catch {
      // state inválido
    }

    try {
      const reqHost = req.headers["x-forwarded-host"] as string || req.headers.host || "localhost:3000";
      const reqProto = (req.headers["x-forwarded-proto"] as string || req.protocol || "http").split(",")[0].trim();
      const apiBaseUrl = process.env.PUBLIC_BASE_URL
        ?? process.env.EXPO_PUBLIC_API_BASE_URL
        ?? (reqHost.includes("localhost") ? `http://${reqHost}` : `${reqProto}://${reqHost}`);
      const callbackUrl = `${apiBaseUrl}/pub-api/oauth-callback`;

      // Trocar code por access_token diretamente com o Google
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        }).toString(),
      });
      const tokenData = await tokenRes.json() as any;
      if (!tokenData.access_token) throw new Error("Token não retornado: " + JSON.stringify(tokenData));

      // Buscar informações do usuário
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userRes.json() as any;
      if (!userInfo.email) { res.status(400).send("E-mail não disponível na conta Google."); return; }

      // Buscar ou criar cliente público para o tenant
      let clientId: number | null = null;
      let clientName = userInfo.name ?? userInfo.email.split("@")[0];
      if (slug) {
        const tenant = await db.getTenantBySlug(slug);
        if (tenant) {
          const allClients = await db.getAllClients(tenant.id);
          const existing = allClients.find((c: any) => c.email === userInfo.email);
          if (existing) {
            clientId = existing.id;
            clientName = existing.name;
          } else {
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
      const sessionCookie = encodeClientSession(sessionData);
      const cookieKey = slug ? `client_session_${slug}` : "client_session";
      res.cookie(cookieKey, sessionCookie, { httpOnly: true, secure: CLIENT_COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });

      // Redirecionar de volta
      const qs = `?service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}`;
      const target = redirect ? `/pub/${slug}/${redirect}${qs}` : `/pub/${slug}`;
      res.redirect(target);
    } catch (e: any) {
      console.error("[OAuth Público] Erro:", e);
      if (slug) {
        res.redirect(`/pub/${slug}/login?error=google_failed`);
      } else {
        res.status(500).send("Erro ao processar login com Google. Tente novamente.");
      }
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

  // GET /pub/:slug/forgot-password — Solicitar recuperação de senha
  app.get("/pub/:slug/forgot-password", async (req: Request, res: Response) => {
    const { slug } = req.params;
    const tenant = await db.getTenantBySlug(slug);
    if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
    const settings = await db.getShopSettingsByTenantId(tenant.id);
    const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
    const sent = req.query.sent === "1";
    const error = req.query.error === "1";
    const step = (req.query.step as string) || "email";
    const emailParam = (req.query.email as string) || "";
    const esc = escapeHtml;
    const body = `
      <div style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:24px">
        <div style="width:100%;max-width:400px">
          <div style="text-align:center;margin-bottom:28px">
            <a href="/pub/${slug}" style="font-size:13px;color:var(--muted);text-decoration:none">← Voltar à página da barbearia</a>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:32px">
            <h2 style="font-size:22px;font-weight:800;margin-bottom:8px">${step === "code" ? "Verificar Código" : step === "newPassword" ? "Nova Senha" : "Recuperar Senha"}</h2>
            <p style="font-size:14px;color:var(--muted);margin-bottom:24px;line-height:1.6">${step === "code" ? `Código enviado para <strong>${esc(emailParam)}</strong>. Verifique sua caixa de entrada.` : step === "newPassword" ? "Crie uma nova senha para sua conta." : "Informe seu e-mail para receber o código de recuperação."}</p>
            ${error ? `<div style="background:#F871711A;border:1px solid #F87171;border-radius:10px;padding:12px;margin-bottom:20px;font-size:13px;color:#F87171">${step === "code" ? "Código inválido ou expirado." : "E-mail não encontrado."}</div>` : ""}
            ${sent && step === "email" ? `<div style="background:#22C55E1A;border:1px solid #22C55E;border-radius:10px;padding:12px;margin-bottom:20px;font-size:13px;color:#22C55E">Código enviado! Verifique sua caixa de entrada.</div>` : ""}
            <form method="POST" action="/pub-api/forgot-password">
              <input type="hidden" name="slug" value="${slug}" />
              ${step === "email" ? `
                <div style="margin-bottom:16px">
                  <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">E-MAIL</label>
                  <input type="email" name="email" required placeholder="seu@email.com" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
                </div>
                <button type="submit" style="width:100%;background:var(--primary);color:#0A0A0A;font-size:15px;font-weight:800;padding:14px;border-radius:12px;border:none;cursor:pointer">ENVIAR CÓDIGO</button>
              ` : step === "code" ? `
                <input type="hidden" name="email" value="${esc(emailParam)}" />
                <input type="hidden" name="step" value="code" />
                <div style="margin-bottom:16px">
                  <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">CÓDIGO DE 6 DÍGITOS</label>
                  <input type="text" name="token" required maxlength="6" placeholder="000000" style="width:100%;padding:16px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:28px;font-weight:700;text-align:center;letter-spacing:8px" />
                </div>
                <button type="submit" style="width:100%;background:var(--primary);color:#0A0A0A;font-size:15px;font-weight:800;padding:14px;border-radius:12px;border:none;cursor:pointer">VERIFICAR</button>
                <div style="text-align:center;margin-top:14px">
                  <a href="/pub/${slug}/forgot-password" style="font-size:13px;color:var(--muted);text-decoration:underline">Reenviar código</a>
                </div>
              ` : `
                <input type="hidden" name="email" value="${esc(emailParam)}" />
                <input type="hidden" name="token" value="${esc(req.query.token as string || "")}" />
                <input type="hidden" name="step" value="newPassword" />
                <div style="margin-bottom:16px">
                  <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">NOVA SENHA</label>
                  <div style="position:relative">
                    <input type="password" id="new-password-input" name="newPassword" required minlength="6" placeholder="Mínimo 6 caracteres" style="width:100%;padding:12px 44px 12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
                    <button type="button" onclick="(function(){var i=document.getElementById('new-password-input');var b=this;if(i.type==='password'){i.type='text';b.innerHTML='&#128065;&#65038;'}else{i.type='password';b.innerHTML='&#128065;'}}).call(this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:4px;line-height:1">&#128065;</button>
                  </div>
                </div>
                <div style="margin-bottom:20px">
                  <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">CONFIRMAR SENHA</label>
                  <div style="position:relative">
                    <input type="password" id="confirm-password-input" name="confirmPassword" required minlength="6" placeholder="Repita a senha" style="width:100%;padding:12px 44px 12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
                    <button type="button" onclick="(function(){var i=document.getElementById('confirm-password-input');var b=this;if(i.type==='password'){i.type='text';b.innerHTML='&#128065;&#65038;'}else{i.type='password';b.innerHTML='&#128065;'}}).call(this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:4px;line-height:1">&#128065;</button>
                  </div>
                </div>
                <button type="submit" style="width:100%;background:var(--primary);color:#0A0A0A;font-size:15px;font-weight:800;padding:14px;border-radius:12px;border:none;cursor:pointer">REDEFINIR SENHA</button>
              `}
            </form>
          </div>
          <div style="text-align:center;margin-top:20px;font-size:13px;color:var(--muted)">
            <a href="/pub/${slug}/login" style="color:var(--primary);font-weight:700">Voltar ao login</a>
          </div>
        </div>
      </div>
    `;
    res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
  });

  // POST /pub-api/forgot-password
  app.post("/pub-api/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email, slug, step, token, newPassword, confirmPassword } = req.body;
      if (!slug) { res.status(400).send("Slug obrigatório"); return; }
      if (step === "code") {
        // Verificar código
        const valid = await db.validatePasswordResetToken(email, token);
        if (!valid) { res.redirect(`/pub/${slug}/forgot-password?step=code&email=${encodeURIComponent(email)}&error=1`); return; }
        res.redirect(`/pub/${slug}/forgot-password?step=newPassword&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`);
      } else if (step === "newPassword") {
        // Redefinir senha
        if (!newPassword || newPassword.length < 6) { res.redirect(`/pub/${slug}/forgot-password?step=newPassword&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&error=1`); return; }
        if (newPassword !== confirmPassword) { res.redirect(`/pub/${slug}/forgot-password?step=newPassword&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&error=1`); return; }
        const consumed = await db.consumePasswordResetToken(email, token);
        if (!consumed) { res.redirect(`/pub/${slug}/forgot-password?step=code&email=${encodeURIComponent(email)}&error=1`); return; }
        const account = await db.getClientAccountByEmail(email);
        if (!account) { res.redirect(`/pub/${slug}/forgot-password?error=1`); return; }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.updateClientAccount(account.id, { passwordHash });
        res.redirect(`/pub/${slug}/login?reset=1`);
      } else {
        // Enviar código por e-mail
        const account = await db.getClientAccountByEmail(email);
        if (!account) { res.redirect(`/pub/${slug}/forgot-password?sent=1`); return; } // por segurança
        const resetToken = await db.createPasswordResetToken(email);
        const baseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
        await sendPasswordResetEmail({ toEmail: email, token: resetToken, baseUrl });
        res.redirect(`/pub/${slug}/forgot-password?step=code&email=${encodeURIComponent(email)}&sent=1`);
      }
    } catch (e: any) {
      res.status(500).send("Erro interno: " + e.message);
    }
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

  // POST /pub-api/cancel-subscription — Cliente cancela sua assinatura
  app.post("/pub-api/cancel-subscription", async (req: Request, res: Response) => {
    try {
      const { subscriptionId, slug } = req.body;
      if (!subscriptionId || !slug) { res.status(400).json({ error: "Dados obrigatórios ausentes" }); return; }
      const clientSessionRaw = req.cookies?.[`client_session_${slug}`];
      if (!clientSessionRaw) { res.status(401).json({ error: "Não autenticado" }); return; }
      let loggedClient: { id: number; name: string } | null = null;
      loggedClient = decodeClientSession(clientSessionRaw);
      if (!loggedClient) { res.status(401).json({ error: "Sessão inválida" }); return; }
      const tenant = await db.getTenantBySlug(slug);
      if (!tenant) { res.status(404).json({ error: "Barbearia não encontrada" }); return; }
      // Verificar que a assinatura pertence ao cliente
      const dbConn = await db.getDb();
      if (!dbConn) { res.status(500).json({ error: "Erro de banco de dados" }); return; }
      const subRows = await dbConn.execute(sql`
        SELECT id, status, "asaasSubscriptionId" FROM client_subscriptions
        WHERE id = ${subscriptionId} AND "clientId" = ${loggedClient.id} AND "tenantId" = ${tenant.id}
        LIMIT 1
      `) as any;
      const sub = Array.isArray(subRows) ? subRows[0]?.[0] : subRows?.rows?.[0];
      if (!sub) { res.status(404).json({ error: "Assinatura não encontrada" }); return; }
      if (sub.status === "cancelled") { res.status(400).json({ error: "Assinatura já cancelada" }); return; }
      // Cancelar no Asaas se tiver ID
      if (sub.asaasSubscriptionId) {
        try {
          const tenantSettings = await db.getShopSettings(tenant.id) as any;
          const subApiKey = tenantSettings?.asaasApiKey;
          if (subApiKey) {
            const asaasBase = process.env.ASAAS_SANDBOX === "true"
              ? "https://sandbox.asaas.com/api/v3"
              : "https://api.asaas.com/api/v3";
            await fetch(`${asaasBase}/subscriptions/${sub.asaasSubscriptionId}`, {
              method: "DELETE",
              headers: { "access_token": subApiKey },
            });
          }
        } catch (asaasErr: any) {
          console.error("[cancel-subscription] Asaas error:", asaasErr.message);
        }
      }
      // Atualizar status no banco
      await dbConn.execute(sql`
        UPDATE client_subscriptions SET status = 'cancelled', "updatedAt" = NOW()
        WHERE id = ${subscriptionId}
      `);
      console.log(`[cancel-subscription] Cliente ${loggedClient.name} cancelou assinatura #${subscriptionId}`);
      res.json({ success: true });
    } catch (e: any) {
      console.error("[cancel-subscription]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/cancel-appointment
  app.post("/pub-api/cancel-appointment", async (req: Request, res: Response) => {
    try {
      const { appointmentId, slug } = req.body;
      if (!appointmentId) { res.status(400).json({ error: "appointmentId é obrigatório" }); return; }
      // Verificar sessão do cliente
      const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ;
      if (!clientSessionRaw) { res.status(401).json({ error: "Não autenticado" }); return; }
      let loggedClient: { id: number } | null = null;
      loggedClient = decodeClientSession(clientSessionRaw);
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

  // POST /pub-api/confirm-order-receipt — Cliente confirma recebimento (ready -> delivered)
  app.post("/pub-api/confirm-order-receipt", async (req: Request, res: Response) => {
    try {
      const { orderId, slug } = req.body;
      if (!orderId) { res.status(400).json({ error: "orderId é obrigatório" }); return; }
      const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ;
      if (!clientSessionRaw) { res.status(401).json({ error: "Não autenticado" }); return; }
      let loggedClient: { id: number } | null = null;
      loggedClient = decodeClientSession(clientSessionRaw);
      if (!loggedClient) { res.status(401).json({ error: "Sessão inválida" }); return; }
      const order = await db.getProductOrderById(parseInt(orderId));
      if (!order) { res.status(404).json({ error: "Encomenda não encontrada" }); return; }
      if (order.clientId !== loggedClient.id) { res.status(403).json({ error: "Acesso negado" }); return; }
      if (order.status !== "ready") { res.status(400).json({ error: "Encomenda não está pronta para retirada" }); return; }
      // Marcar como entregue sem registrar pagamento (barbeiro já registrou no app)
      await db.updateProductOrderStatus(parseInt(orderId), "delivered");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/cancel-order — Cancelar encomenda pelo cliente
  app.post("/pub-api/cancel-order", async (req: Request, res: Response) => {
    try {
      const { orderId, slug } = req.body;
      if (!orderId) { res.status(400).json({ error: "orderId é obrigatório" }); return; }
      const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ;
      if (!clientSessionRaw) { res.status(401).json({ error: "Não autenticado" }); return; }
      let loggedClient: { id: number } | null = null;
      loggedClient = decodeClientSession(clientSessionRaw);
      if (!loggedClient) { res.status(401).json({ error: "Sessão inválida" }); return; }
      const order = await db.getProductOrderById(parseInt(orderId));
      if (!order) { res.status(404).json({ error: "Encomenda não encontrada" }); return; }
      if (order.clientId !== loggedClient.id) { res.status(403).json({ error: "Acesso negado" }); return; }
      if (order.status !== "received") { res.status(400).json({ error: "Encomenda não pode ser cancelada neste status" }); return; }
      await db.updateProductOrderStatus(parseInt(orderId), "cancelled");
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Perfil do Cliente ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // GET /pub/:slug/perfil — Página de perfil do cliente
  app.get("/pub/:slug/perfil", async (req: Request, res: Response) => {
    await renderPerfilPage(req.params.slug, res, req);
  });

  // POST /pub-api/perfil — Salvar alterações do perfil do cliente
  app.post("/pub-api/perfil", async (req: Request, res: Response) => {
    try {
      const { slug, name, phone, email } = req.body;
      if (!slug || !name) { res.redirect(`/pub/${slug}/perfil?error=${encodeURIComponent("Nome é obrigatório")}`); return; }
      const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ;
      if (!clientSessionRaw) { res.redirect(`/pub/${slug}/login?redirect=perfil`); return; }
      let loggedClient: { id: number; name: string; email: string } | null = null;
      loggedClient = decodeClientSession(clientSessionRaw);
      if (!loggedClient) { res.redirect(`/pub/${slug}/login?redirect=perfil`); return; }
      // Atualizar dados do cliente no banco
      await db.updateClient(loggedClient.id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
      });
      // Atualizar cookie de sessão com o novo nome
      const updatedSession = { ...loggedClient, name: name.trim(), email: email?.trim() || loggedClient.email };
      const sessionValue = encodeClientSession(updatedSession);
      res.cookie(`client_session_${slug}`, sessionValue, { httpOnly: true, secure: CLIENT_COOKIE_SECURE, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.redirect(`/pub/${slug}/perfil?saved=1`);
    } catch (e: any) {
      const { slug } = req.body;
      res.redirect(`/pub/${slug ?? ""}/perfil?error=${encodeURIComponent(e.message)}`);
    }
  });

  // POST /pub-api/perfil/avatar — Upload de foto de perfil do cliente
  app.post("/pub-api/perfil/avatar", async (req: Request, res: Response) => {
    try {
      const { clientId, fileBase64, mimeType } = req.body;
      if (!clientId || !fileBase64 || !mimeType) { res.status(400).json({ error: "Dados incompletos" }); return; }
      const { storagePut } = await import("./storage");
      const PHOTO_MIMES: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
      const mt = String(mimeType).toLowerCase().trim();
      const ext = PHOTO_MIMES[mt];
      if (!ext) { res.status(400).json({ error: "Tipo de imagem não permitido" }); return; }
      const buffer = Buffer.from(fileBase64, "base64");
      if (buffer.length > 5 * 1024 * 1024) { res.status(400).json({ error: "Imagem excede o limite de 5MB" }); return; }
      if (buffer.length < 50) { res.status(400).json({ error: "Imagem inválida" }); return; }
      const key = `barber-pro/clients/photo-${Number(clientId)}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, mimeType);
      await db.updateClient(Number(clientId), { photoUrl: url });
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── Marketplace Público ──────────────────────────────────────────────────
  // GET /marketplace — Página de descoberta de barbearias
  app.get("/marketplace", async (req: Request, res: Response) => {
    const search = (req.query.q as string) || "";
    const tenantsList = await db.getMarketplaceTenants(search || undefined);
    const cards = tenantsList.map((t: any) => `
      <a href="/pub/${t.slug}" style="text-decoration:none;color:inherit;display:block">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:box-shadow 0.2s" onmouseover="this.style.boxShadow='0 4px 24px rgba(0,0,0,0.15)'" onmouseout="this.style.boxShadow='none'">
          <div style="height:140px;background:${t.fotoCapa ? `url('${t.fotoCapa}') center/cover no-repeat` : 'linear-gradient(135deg,#1e2022,#2d3035)'};position:relative">
            ${t.logoUrl ? `<img src="${t.logoUrl}" style="position:absolute;bottom:-24px;left:16px;width:48px;height:48px;border-radius:50%;border:3px solid var(--surface);object-fit:cover" />` : `<div style="position:absolute;bottom:-24px;left:16px;width:48px;height:48px;border-radius:50%;border:3px solid var(--surface);background:#333;display:flex;align-items:center;justify-content:center;font-size:20px">✂</div>`}
          </div>
          <div style="padding:32px 16px 16px">
            <div style="font-size:16px;font-weight:800;margin-bottom:4px">${t.name}</div>
            ${t.city ? `<div style="font-size:13px;color:var(--muted);margin-bottom:8px">📍 ${t.city}${t.state ? `, ${t.state}` : ""}</div>` : ""}
            ${t.descricao ? `<div style="font-size:13px;color:var(--muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${t.descricao}</div>` : ""}
            <div style="margin-top:12px;display:inline-block;background:var(--primary);color:#0A0A0A;font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px">Agendar →</div>
          </div>
        </div>
      </a>
    `).join("");
    const body = `
      <div style="max-width:1100px;margin:0 auto;padding:32px 20px">
        <div style="text-align:center;margin-bottom:40px">
          <h1 style="font-size:32px;font-weight:900;margin-bottom:8px">✂ Encontre sua Barbearia</h1>
          <p style="font-size:16px;color:var(--muted)">Descubra as melhores barbearias e salões da sua região</p>
        </div>
        <form method="GET" action="/marketplace" style="margin-bottom:40px;display:flex;gap:12px;max-width:600px;margin-left:auto;margin-right:auto">
          <input type="text" name="q" value="${search}" placeholder="Buscar por nome, cidade ou serviço..." style="flex:1;padding:14px 18px;background:var(--surface);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:15px" />
          <button type="submit" style="background:var(--primary);color:#0A0A0A;font-weight:800;padding:14px 24px;border-radius:12px;border:none;cursor:pointer;font-size:15px">Buscar</button>
        </form>
        ${tenantsList.length === 0
          ? `<div style="text-align:center;padding:60px 20px;color:var(--muted)">
              <div style="font-size:48px;margin-bottom:16px">🔍</div>
              <div style="font-size:18px;font-weight:700;margin-bottom:8px">Nenhuma barbearia encontrada</div>
              <div style="font-size:14px">${search ? `Nenhum resultado para "${search}". Tente outro termo.` : "Ainda não há barbearias cadastradas no marketplace."}</div>
            </div>`
          : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px">${cards}</div>`
        }
      </div>
    `;
    // Usar um layout genérico sem tenant
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marketplace — Barber Pro</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1011;color:#ECEDEE;min-height:100vh}:root{--surface:#1e2022;--border:#334155;--muted:#9BA1A6;--primary:#C9A84C;--text:#ECEDEE;--bg:#0f1011}nav{background:#1e2022;border-bottom:1px solid #334155;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}<a{color:inherit}</style></head><body><nav><span style="font-size:18px;font-weight:900">✂ Barber Pro</span><a href="/marketplace" style="font-size:13px;color:#9BA1A6">Marketplace</a></nav>${body}</body></html>`;
    res.send(html);
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

      // Obter tenantId via slug (se fornecido) ou via barbeiro do agendamento
      let reviewTenantId = 0;
      if (slug) {
        const tenant = await db.getTenantBySlug(slug);
        if (tenant) reviewTenantId = tenant.id;
      }
      if (!reviewTenantId) {
        const barber = await db.getBarberById(appt.barberId);
        if (barber?.tenantId) reviewTenantId = barber.tenantId;
      }

      await db.createReview({
        tenantId: reviewTenantId,
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


  // POST /pub-api/asaas-pix — Criar cobrança Pix via Asaas
  app.post("/pub-api/asaas-pix", async (req: Request, res: Response) => {
    try {
      const { slug, appointmentId, amount, clientName, clientEmail, clientPhone, clientCpf, description } = req.body;
      if (!slug || !amount) { res.status(400).json({ error: "slug e amount são obrigatórios" }); return; }
      if (!asaasEnabled) { res.status(503).json({ error: "Pagamento online não configurado. Configure ASAAS_API_KEY." }); return; }
      // Verificar sessão do cliente
      const sessionData = req.cookies?.[`client_session_${slug}`] ;
      let clientInfo: any = null;
      if (sessionData) {
        try { clientInfo = JSON.parse(Buffer.from(sessionData, "base64").toString()); } catch {}
      }
      const clientId = clientInfo?.id ?? 0;
      // Buscar asaasApiKey da subconta do tenant
      let subApiKey: string | undefined;
      const tenantForPix = await db.getTenantBySlug(slug);
      if (tenantForPix) {
        const dbConn = await db.getDb();
        if (dbConn) {
          const tenantRow = await dbConn.execute(sql`SELECT "asaasApiKey" FROM tenants WHERE id = ${tenantForPix.id} LIMIT 1`);
          const tenantData = (tenantRow as any)?.rows?.[0];
          subApiKey = tenantData?.asaasApiKey || undefined;
        }
      }
      // Criar/recuperar cliente no Asaas (na subconta se configurada)
      const asaasCustomerId = await getOrCreateAsaasCustomer({
        name: clientName || clientInfo?.name || "Cliente",
        email: clientEmail || clientInfo?.email,
        mobilePhone: clientPhone || clientInfo?.phone,
        cpfCnpj: clientCpf,
        externalReference: clientId ? String(clientId) : undefined,
      }, subApiKey);
      // Criar cobrança Pix (na subconta se configurada)
      const charge = await createAsaasCharge({
        customer: asaasCustomerId,
        billingType: "PIX",
        value: Number(amount),
        dueDate: asaasDefaultDueDate(),
        description: description || "Agendamento Barber Pro",
        externalReference: appointmentId ? String(appointmentId) : undefined,
      }, subApiKey);
      // Salvar no banco
      const dbConn = await db.getDb();
      if (dbConn && clientId) {
        const tenant = await db.getTenantBySlug(slug);
        if (tenant) {
          await dbConn.execute(sql`
            INSERT INTO online_payments ("tenantId", "clientId", "chargeType", "referenceId", "asaasPaymentId", "asaasCustomerId", "billingType", amount, status, "invoiceUrl", "pixQrCode", "pixCopyCola", "dueDate")
            VALUES (${tenant.id}, ${clientId}, 'appointment', ${appointmentId ?? null}, ${charge.id}, ${asaasCustomerId}, 'PIX', ${Number(amount)}, 'pending', ${charge.invoiceUrl ?? null}, ${charge.pixQrCode ?? null}, ${charge.pixCopyCola ?? null}, ${charge.dueDate})
          `);
        }
      }
      res.json({
        ok: true,
        paymentId: charge.id,
        pixQrCode: charge.pixQrCode,
        pixCopyCola: charge.pixCopyCola,
        invoiceUrl: charge.invoiceUrl,
        value: charge.value,
        dueDate: charge.dueDate,
      });
    } catch (e: any) {
      console.error("[Asaas Pix]", e?.response?.data || e.message);
      res.status(500).json({ error: e?.response?.data?.errors?.[0]?.description || e.message });
    }
  });

  // POST /pub-api/asaas-card — Criar cobrança por cartão de crédito via Asaas
  app.post("/pub-api/asaas-card", async (req: Request, res: Response) => {
    try {
      const { slug, appointmentId, amount, clientName, clientEmail, clientPhone, clientCpf, description,
              cardHolderName, cardNumber, cardExpMonth, cardExpYear, cardCvv,
              holderName, holderCpfCnpj, holderPostalCode, holderAddressNumber, holderPhone } = req.body;
      if (!slug || !amount || !cardNumber) { res.status(400).json({ error: "Dados incompletos" }); return; }
      if (!asaasEnabled) { res.status(503).json({ error: "Pagamento online não configurado." }); return; }
      const sessionData = req.cookies?.[`client_session_${slug}`] ;
      let clientInfo: any = null;
      if (sessionData) {
        try { clientInfo = JSON.parse(Buffer.from(sessionData, "base64").toString()); } catch {}
      }
      const clientId = clientInfo?.id ?? 0;
      // Buscar asaasApiKey da subconta do tenant
      let subApiKeyCard: string | undefined;
      const tenantForCard = await db.getTenantBySlug(slug);
      if (tenantForCard) {
        const dbConn = await db.getDb();
        if (dbConn) {
          const tenantRow = await dbConn.execute(sql`SELECT "asaasApiKey" FROM tenants WHERE id = ${tenantForCard.id} LIMIT 1`);
          const tenantData = (tenantRow as any)?.rows?.[0];
          subApiKeyCard = tenantData?.asaasApiKey || undefined;
        }
      }
      const asaasCustomerId = await getOrCreateAsaasCustomer({
        name: clientName || clientInfo?.name || "Cliente",
        email: clientEmail || clientInfo?.email,
        mobilePhone: clientPhone || clientInfo?.phone,
        cpfCnpj: clientCpf,
        externalReference: clientId ? String(clientId) : undefined,
      }, subApiKeyCard);
      // Criar cobrança com cartão de crédito (na subconta se configurada)
      const charge = await createAsaasCharge({
        customer: asaasCustomerId,
        billingType: "CREDIT_CARD",
        value: Number(amount),
        dueDate: asaasDefaultDueDate(),
        description: description || "Agendamento Barber Pro",
        externalReference: appointmentId ? String(appointmentId) : undefined,
        creditCard: {
          holderName: cardHolderName,
          number: cardNumber.replace(/\s/g, ""),
          expiryMonth: cardExpMonth,
          expiryYear: cardExpYear,
          ccv: cardCvv,
        },
        creditCardHolderInfo: {
          name: holderName || cardHolderName,
          email: clientEmail || clientInfo?.email || "cliente@barberpro.com",
          cpfCnpj: holderCpfCnpj || clientCpf,
          postalCode: holderPostalCode,
          addressNumber: holderAddressNumber,
          phone: holderPhone || clientPhone || clientInfo?.phone,
        },
      }, subApiKeyCard);
      const dbConn = await db.getDb();
      if (dbConn && clientId) {
        const tenant = await db.getTenantBySlug(slug);
        if (tenant) {
          await dbConn.execute(sql`
            INSERT INTO online_payments ("tenantId", "clientId", "chargeType", "referenceId", "asaasPaymentId", "asaasCustomerId", "billingType", amount, status, "invoiceUrl", "dueDate")
            VALUES (${tenant.id}, ${clientId}, 'appointment', ${appointmentId ?? null}, ${charge.id}, ${asaasCustomerId}, 'CREDIT_CARD', ${Number(amount)}, ${charge.status === 'CONFIRMED' ? 'paid' : 'pending'}, ${charge.invoiceUrl ?? null}, ${charge.dueDate})
          `);
        }
      }
      if (charge.status === "CONFIRMED" || charge.status === "RECEIVED") {
        if (appointmentId) {
          await db.updateAppointment(Number(appointmentId), { status: "confirmed" } as any);
        }
      }
      res.json({ ok: true, paymentId: charge.id, status: charge.status, invoiceUrl: charge.invoiceUrl });
    } catch (e: any) {
      console.error("[Asaas Card]", e?.response?.data || e.message);
      const errMsg = e?.response?.data?.errors?.[0]?.description || e.message;
      res.status(500).json({ error: errMsg });
    }
  });

  // GET /pub-api/asaas-payment-status/:paymentId — Verificar status de pagamento Asaas
  app.get("/pub-api/asaas-payment-status/:paymentId", async (req: Request, res: Response) => {
    try {
      const { paymentId } = req.params;
      if (!asaasEnabled) { res.status(503).json({ error: "Asaas não configurado" }); return; }
      const paymentData = await getAsaasPaymentStatus(paymentId);
      const status = paymentData.status;
      const paid = status === "RECEIVED" || status === "CONFIRMED";
      // Se pago, atualizar banco
      if (paid) {
        const dbConn = await db.getDb();
        if (dbConn) {
          await dbConn.execute(sql`UPDATE online_payments SET status = 'paid', "paidAt" = NOW() WHERE "asaasPaymentId" = ${paymentId} AND status = 'pending'`);
          // Atualizar agendamento se existir
          const pmtRows = await dbConn.execute(sql`SELECT "referenceId", "chargeType" FROM online_payments WHERE "asaasPaymentId" = ${paymentId} LIMIT 1`) as any;
          const pmtArr = Array.isArray(pmtRows) ? pmtRows[0] : pmtRows?.rows ?? [];
          const pmt = pmtArr?.[0];
          if (pmt?.referenceId && pmt?.chargeType === "appointment") {
            await db.updateAppointment(pmt.referenceId, { status: "confirmed" } as any);
          }
        }
      }
      res.json({ ok: true, status, paid });
    } catch (e: any) {
      console.error("[Asaas Status]", e?.response?.data || e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/subscribe-plan — Criar assinatura de plano via página pública
  app.post("/pub-api/subscribe-plan", async (req: Request, res: Response) => {
    try {
      const { slug, planId, barberId, selectedServiceIds, selectedProductIds, paymentMethod, appointments } = req.body;
      if (!slug || !planId) { res.status(400).json({ error: "slug e planId são obrigatórios" }); return; }
      // Verificar sessão do cliente
      const sessionData = req.cookies?.[`client_session_${slug}`] ;
      if (!sessionData) { res.status(401).json({ error: "Faça login para assinar um plano" }); return; }
      let clientInfo: any = null;
      try { clientInfo = JSON.parse(Buffer.from(sessionData, "base64").toString()); } catch {}
      if (!clientInfo?.id) { res.status(401).json({ error: "Sessão inválida" }); return; }
      const tenant = await db.getTenantBySlug(slug);
      if (!tenant) { res.status(404).json({ error: "Barbearia não encontrada" }); return; }
      // Buscar plano
      const dbConn = await db.getDb();
      if (!dbConn) { res.status(500).json({ error: "Erro de banco de dados" }); return; }
      const planResult = await dbConn.execute(sql`SELECT * FROM subscription_plans WHERE id = ${planId} AND "tenantId" = ${tenant.id} AND "isActive" = true LIMIT 1`) as any;
      const plans = Array.isArray(planResult) ? planResult[0] : planResult?.rows ?? [];
      const plan = plans?.[0];
      if (!plan) { res.status(404).json({ error: "Plano não encontrado" }); return; }
      // Criar assinatura diretamente
      const now = new Date();
      const cycleStart = now.toISOString().split("T")[0];
      const cycleEndDate = new Date(now);
      cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
      const cycleEnd = cycleEndDate.toISOString().split("T")[0];
      const svcIds = Array.isArray(selectedServiceIds) ? selectedServiceIds : [];
      const prdIds = Array.isArray(selectedProductIds) ? selectedProductIds : [];
      const appts = Array.isArray(appointments) ? appointments : [];
      const barberIdVal = barberId ? parseInt(barberId) : null;
      const payMethod = paymentMethod || "cash";
      // Inserir assinatura
      const subResult = await dbConn.execute(sql`
        INSERT INTO client_subscriptions
          ("tenantId", "planId", "clientId", "barberId", "selectedServiceIds", "selectedProductIds",
           status, "paymentMethod", price, "cycleStart", "cycleEnd", "autoRenew")
        VALUES (
          ${tenant.id}, ${planId}, ${clientInfo.id}, ${barberIdVal},
          ${JSON.stringify(svcIds)}, ${JSON.stringify(prdIds)},
          'active', ${payMethod}, ${Number(plan.price)},
          ${cycleStart}, ${cycleEnd}, false
        )
        RETURNING id
      `) as any;
      const subRows = Array.isArray(subResult) ? subResult[0] : subResult?.rows ?? subResult;
      const subscriptionId = subRows?.[0]?.id ?? subRows?.id;
      // Inserir agendamentos
      const primaryServiceId = svcIds[0] ?? 0;
      let serviceDurationMinutes = 30;
      if (primaryServiceId > 0) {
        try {
          const svcResult = await dbConn.execute(sql`SELECT durationMinutes FROM services WHERE id = ${primaryServiceId} LIMIT 1`) as any;
          const svcRows = Array.isArray(svcResult) ? svcResult[0] : svcResult?.rows ?? [];
          if (svcRows?.[0]?.durationMinutes) serviceDurationMinutes = svcRows[0].durationMinutes;
        } catch {}
      }
      const addMin = (t: string, mins: number): string => {
        const [h, m] = t.split(":").map(Number);
        const total = h * 60 + m + mins;
        return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "00")}:00`;
      }
      const appointmentIds: number[] = [];
      for (let i = 0; i < appts.length; i++) {
        const appt = appts[i];
        const apptBarberId = appt.barberId ?? barberIdVal;
        const startTime = appt.time.includes(":") && appt.time.split(":").length === 2 ? appt.time + ":00" : appt.time;
        const endTime = addMin(appt.time, serviceDurationMinutes);
        const apptResult = await dbConn.execute(sql`
          INSERT INTO appointments ("clientId", "barberId", "serviceId", date, "startTime", "endTime", status)
          VALUES (${clientInfo.id}, ${apptBarberId}, ${primaryServiceId}, ${appt.date}, ${startTime}, ${endTime}, 'confirmed')
          RETURNING id
        `) as any;
        const apptRows = Array.isArray(apptResult) ? apptResult[0] : apptResult?.rows ?? apptResult;
        const apptId = apptRows?.[0]?.id ?? apptRows?.id;
        if (apptId && subscriptionId) {
          await dbConn.execute(sql`
            INSERT INTO subscription_appointments ("subscriptionId", "appointmentId", "tenantId", "recurrenceIndex")
            VALUES (${subscriptionId}, ${apptId}, ${tenant.id}, ${i + 1})
          `);
          appointmentIds.push(apptId);
        }
      }
      res.json({ ok: true, subscriptionId, appointmentIds });
    } catch (e: any) {
      console.error("[Subscribe Plan]", e);
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

  // ─── Página de Detalhe do Agendamento ──────────────────────────────────────
  app.get("/pub/:slug/agendamento/:id", async (req: Request, res: Response) => {
    const { slug, id } = req.params;
    const tenant = await db.getTenantBySlug(slug);
    if (!tenant) { res.status(404).send(notFoundPage(slug)); return; }
    const settings = await db.getShopSettingsByTenantId(tenant.id);
    const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
    const shopName = settings?.shopName ?? tenant.name;
    const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ;
    let loggedClient: { id: number; name: string; email: string; phone?: string } | null = null;
    if (clientSessionRaw) {
      loggedClient = decodeClientSession(clientSessionRaw);
    }
    if (!loggedClient) { res.redirect(`/pub/${slug}/login?redirect=agendamento/${id}`); return; }
    const apptId = parseInt(id);
    if (isNaN(apptId)) { res.status(400).send("ID inválido."); return; }
    const appt = await db.getAppointmentById(apptId);
    if (!appt || appt.clientId !== loggedClient.id) { res.status(404).send("Agendamento não encontrado."); return; }
    const svc = appt.serviceId ? await db.getServiceById(appt.serviceId) : null;
    const barber = appt.barberId ? await db.getBarberById(appt.barberId) : null;
    const review = await db.getReviewByAppointmentId(apptId);
    const waNumber = (settings as any)?.whatsappNumber ?? "";
    const fmtD = (d: string) => { const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };
    const statusLabel: Record<string,string> = { scheduled: "Agendado", confirmed: "Confirmado", pending_approval: "Aguarda aprovação", in_progress: "Em andamento", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };
    const statusColor: Record<string,string> = { scheduled: "#60A5FA", confirmed: "#4ADE80", pending_approval: "#FBBF24", in_progress: "#F59E0B", completed: "#9CA3AF", cancelled: "#F87171", no_show: "#F87171" };
    const statusIcon: Record<string,string> = { scheduled: "📋", confirmed: "✅", pending_approval: "⏳", in_progress: "✂", completed: "🎉", cancelled: "❌", no_show: "😔" };
    const statusFlow = ["scheduled", "confirmed", "in_progress", "completed"];
    const currentIdx = statusFlow.indexOf(appt.status);
    const isCancelled = appt.status === "cancelled" || appt.status === "no_show";
    const price = svc?.price ? `R$ ${Number(svc.price).toFixed(2).replace(".", ",")}` : "";
    const waMsg = encodeURIComponent(`Olá! Segue meu comprovante:\n\n✂ *Serviço:* ${svc?.name ?? "Serviço"}\n👤 *Profissional:* ${barber?.name ?? "Profissional"}\n📅 *Data:* ${fmtD(appt.date)}\n🕐 *Horário:* ${appt.startTime.slice(0,5)}${price ? `\n💰 *Valor:* ${price}` : ""}\n\n🏪 ${escapeHtml(shopName)}`);
    const waShareLink = waNumber ? `https://wa.me/55${waNumber.replace(/\D/g,"")}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;
    const barberPhotoHtml = barber?.photoUrl
      ? `<img src="${escapeHtml(barber.photoUrl)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid ${primaryColor}" />`
      : `<div style="width:48px;height:48px;border-radius:50%;background:var(--surface2);border:2px solid ${primaryColor};display:flex;align-items:center;justify-content:center;font-size:20px">✂</div>`;
    const body = `
      <div style="max-width:520px;margin:0 auto;padding:24px 16px 48px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <a href="/pub/${slug}/meus-agendamentos" style="color:var(--muted);font-size:22px;line-height:1">&#8592;</a>
          <div><div style="font-size:20px;font-weight:900">Detalhe do Agendamento</div><div style="font-size:12px;color:var(--muted)">${escapeHtml(shopName)}</div></div>
        </div>
        <div style="background:${statusColor[appt.status] ?? "#334155"}18;border:1px solid ${statusColor[appt.status] ?? "#334155"}44;border-radius:20px;padding:20px;margin-bottom:16px;text-align:center">
          <div style="font-size:40px;margin-bottom:8px">${statusIcon[appt.status] ?? "📋"}</div>
          <div style="font-size:18px;font-weight:900;color:${statusColor[appt.status] ?? "var(--text)"};margin-bottom:4px">${statusLabel[appt.status] ?? appt.status}</div>
          ${appt.cancelReason ? `<div style="font-size:13px;color:var(--muted);margin-top:8px">Motivo: ${escapeHtml(appt.cancelReason)}</div>` : ""}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:16px">DETALHES DO SERVIÇO</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div><div style="font-size:18px;font-weight:900">${escapeHtml(svc?.name ?? "Serviço")}</div>${svc?.durationMinutes ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">⏱ ${svc.durationMinutes} min</div>` : ""}</div>
            ${svc?.price ? `<div style="font-size:22px;font-weight:900;color:${primaryColor}">R$ ${Number(svc.price).toFixed(2).replace(".",",")}</div>` : ""}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="background:var(--surface2);border-radius:12px;padding:12px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">📅 DATA</div><div style="font-size:15px;font-weight:800">${fmtD(appt.date)}</div></div>
            <div style="background:var(--surface2);border-radius:12px;padding:12px"><div style="font-size:11px;color:var(--muted);margin-bottom:4px">🕐 HORÁRIO</div><div style="font-size:15px;font-weight:800">${appt.startTime.slice(0,5)} – ${appt.endTime?.slice(0,5) ?? ""}</div></div>
          </div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:16px">PROFISSIONAL</div>
          <div style="display:flex;align-items:center;gap:12px">${barberPhotoHtml}<div><div style="font-size:16px;font-weight:800">${escapeHtml(barber?.name ?? "Profissional")}</div>${barber?.specialties ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${escapeHtml(barber.specialties)}</div>` : ""}</div></div>
        </div>
        ${!isCancelled ? `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:16px">PROGRESSO</div>
          <div style="display:flex;align-items:center">
            ${statusFlow.map((s, i) => {
              const done = i <= currentIdx;
              const isCur = i === currentIdx;
              const ic: Record<string,string> = { scheduled: "📋", confirmed: "✅", in_progress: "✂", completed: "🎉" };
              const lb: Record<string,string> = { scheduled: "Agendado", confirmed: "Confirmado", in_progress: "Em andamento", completed: "Concluído" };
              return `<div style="display:flex;flex-direction:column;align-items:center;flex:1"><div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;background:${done ? primaryColor : "var(--surface2)"};border:2px solid ${done ? primaryColor : "var(--border)"};margin-bottom:6px${isCur ? `;box-shadow:0 0 0 4px ${primaryColor}33` : ""}">${done ? ic[s] : "○"}</div><div style="font-size:10px;color:${done ? "var(--text)" : "var(--muted)"};font-weight:${isCur ? "800" : "400"};text-align:center">${lb[s]}</div></div>${i < statusFlow.length - 1 ? `<div style="flex:1;height:2px;background:${i < currentIdx ? primaryColor : "var(--border)"};margin-bottom:20px"></div>` : ""}`;
            }).join("")}
          </div>
        </div>` : ""}
        ${appt.notes ? `<div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px;margin-bottom:16px"><div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">📝 OBSERVAÇÕES</div><div style="font-size:14px">${escapeHtml(appt.notes)}</div></div>` : ""}
        ${appt.status === "completed" ? `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:20px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:12px">⭐ AVALIAÇÃO</div>
          ${review ? `<div style="display:flex;gap:4px;margin-bottom:8px">${Array.from({length:5}).map((_,i) => `<span style="font-size:24px;color:${i < (review.rating ?? 0) ? "#FBBF24" : "var(--border)"}">${i < (review.rating ?? 0) ? "★" : "☆"}</span>`).join("")}</div>${review.comment ? `<div style="font-size:14px;color:var(--muted);font-style:italic">"${escapeHtml(review.comment)}"</div>` : ""}` : `<a href="/pub/${slug}/avaliar/${apptId}" style="display:inline-block;background:${primaryColor};color:#0A0A0A;font-weight:800;padding:12px 24px;border-radius:50px;text-decoration:none;font-size:14px">⭐ Avaliar este atendimento</a>`}
        </div>` : ""}
        <div style="display:flex;flex-direction:column;gap:12px">
          <a href="${waShareLink}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:10px;background:#25D366;color:#fff;font-weight:800;padding:16px;border-radius:16px;text-decoration:none;font-size:15px">📲 Compartilhar comprovante no WhatsApp</a>
          ${isCancelled || appt.status === "completed" ? `<a href="/pub/${slug}/agendar?service=${appt.serviceId ?? ""}&barber=${appt.barberId ?? ""}" style="display:flex;align-items:center;justify-content:center;gap:10px;background:${primaryColor};color:#0A0A0A;font-weight:800;padding:16px;border-radius:16px;text-decoration:none;font-size:15px">📅 Reagendar</a>` : ""}
          ${!isCancelled && appt.status !== "completed" && appt.status !== "in_progress" ? `<button onclick="cancelAppt(${apptId})" style="display:flex;align-items:center;justify-content:center;gap:10px;background:transparent;color:#F87171;border:1px solid #F87171;font-weight:700;padding:14px;border-radius:16px;font-size:14px;cursor:pointer;width:100%">❌ Cancelar agendamento</button>` : ""}
        </div>
        <div style="text-align:center;margin-top:24px;font-size:11px;color:var(--muted)">Agendamento #${apptId} · Criado em ${new Date(appt.createdAt).toLocaleDateString("pt-BR")}</div>
      </div>
      <script>
        async function cancelAppt(id) {
          if (!await pubConfirm("Tem certeza que deseja cancelar este agendamento?")) return;
          const r = await fetch("/pub-api/cancel-appointment", { method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include", body: JSON.stringify({appointmentId: id, slug: "${slug}"}) });
          if (r.ok) { location.href = "/pub/${slug}/meus-agendamentos"; }
          else { const e = await r.json(); pubAlert("Erro: " + (e.error || "Não foi possível cancelar"), 'error'); }
        }
      </script>
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
    // Só aplica se for domínio de produção (barberpro.com.br), não em dev/proxy
    if (isSystemDomain) return next(); // não aplica subdomínio em dev/proxy
    if (parts.length < 3) return next(); // não é subdomínio
    const slug = parts[0];
    // Ignora slugs de sistema
    if (["www", "api", "app", "admin", "superadmin"].includes(slug)) return next();
    // Só aplica se for subdomínio de barberpro.com.br
    const isBarberProSubdomain = host.endsWith(".barberpro.com.br");
    if (!isBarberProSubdomain) return next();

    if (req.path === "/" || req.path === "") {
      await renderShopPage(slug, res);
    } else if (req.path === "/agendar") {
      await renderBookingPage(slug, res, req);
    } else {
      next();
    }
  });

  // ─── Política de Privacidade (obrigatório para Play Store / App Store) ──────
  app.get("/privacidade", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Política de Privacidade — Barber Pro</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0A0A0A;color:#E5E5E5;line-height:1.7;padding:24px 16px 64px}
  .container{max-width:760px;margin:0 auto}
  h1{font-size:28px;font-weight:800;color:#C9A84C;margin-bottom:8px}
  .updated{font-size:13px;color:#666;margin-bottom:40px}
  h2{font-size:18px;font-weight:700;color:#C9A84C;margin:32px 0 12px}
  p,li{font-size:15px;color:#CCCCCC;margin-bottom:10px}
  ul{padding-left:20px}
  a{color:#C9A84C}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:32px}
  .logo-text{font-size:22px;font-weight:900;color:#C9A84C;letter-spacing:4px}
  hr{border:none;border-top:1px solid #2A2A2A;margin:32px 0}
</style>
</head>
<body>
<div class="container">
  <div class="logo">
    <div class="logo-text">BARBER PRO</div>
  </div>
  <h1>Política de Privacidade</h1>
  <p class="updated">Última atualização: 15 de julho de 2026</p>

  <p>A <strong>Barber Pro</strong> (&ldquo;nós&rdquo;, &ldquo;nosso&rdquo;) opera o aplicativo móvel Barber Pro e o site usebarberpro.com. Esta política descreve como coletamos, usamos e protegemos suas informações.</p>

  <h2>1. Informações que Coletamos</h2>
  <ul>
    <li><strong>Dados de conta:</strong> nome, e-mail, telefone e foto de perfil fornecidos no cadastro.</li>
    <li><strong>Dados de uso:</strong> agendamentos, serviços realizados, histórico de compras e avaliações.</li>
    <li><strong>Dados do dispositivo:</strong> token de notificação push (apenas com sua autorização), modelo do dispositivo e versão do sistema operacional.</li>
    <li><strong>Dados de pagamento:</strong> processados pelo Asaas — não armazenamos dados de cartão de crédito.</li>
  </ul>

  <h2>2. Como Usamos suas Informações</h2>
  <ul>
    <li>Criar e gerenciar sua conta e agendamentos.</li>
    <li>Enviar lembretes de agendamento por WhatsApp, e-mail ou notificação push.</li>
    <li>Processar pagamentos e emitir cobranças.</li>
    <li>Melhorar a experiência do aplicativo e resolver problemas técnicos.</li>
    <li>Cumprir obrigações legais.</li>
  </ul>

  <h2>3. Compartilhamento de Dados</h2>
  <p>Não vendemos suas informações pessoais. Compartilhamos dados apenas com:</p>
  <ul>
    <li><strong>Barbearias parceiras:</strong> para gerenciar seus agendamentos.</li>
    <li><strong>Asaas:</strong> processadora de pagamentos, para cobranças e assinaturas.</li>
    <li><strong>Google:</strong> para autenticação via Google Sign-In (opcional) e, para barbeiros que optarem por conectar sua conta, para sincronização com a Google Agenda (veja a seção 5).</li>
    <li><strong>Autoridades:</strong> quando exigido por lei ou ordem judicial.</li>
  </ul>

  <h2>4. Armazenamento e Segurança</h2>
  <p>Seus dados são armazenados em servidores seguros nos Estados Unidos (Railway). Utilizamos HTTPS para todas as comunicações e senhas são armazenadas com hash bcrypt.</p>

  <h2>5. Integração com Google Agenda</h2>
  <p>O Barber Pro oferece uma integração <strong>opcional</strong> com a Google Agenda, disponível para barbeiros que desejarem conectar sua conta Google. Esta seção detalha especificamente como tratamos os dados acessados por meio dessa integração.</p>
  <p><strong>Dados acessados:</strong> ao conectar sua conta Google, o Barber Pro acessa sua Google Agenda de duas formas: (i) sincronização automática e contínua — criamos, editamos e excluímos eventos em um calendário dedicado, chamado "Barber Pro", criado automaticamente na sua Conta Google no momento da conexão; e (ii) importação pontual, sob demanda — se você optar por usar a função "Importar agendamentos existentes", o app lê, uma única vez quando você aciona essa função, os eventos do seu calendário pessoal (principal) dos próximos 60 dias, para identificar horários já comprometidos antes de usar o Barber Pro. Não acessamos, listamos nem modificamos nenhum outro dado da sua Conta Google além do descrito aqui (contatos, e-mails, arquivos e outros dados não são acessados).</p>
  <p><strong>Como esses dados são usados:</strong> exclusivamente para (i) refletir automaticamente, no calendário dedicado, os agendamentos criados, editados ou cancelados dentro do Barber Pro; e (ii), quando solicitado por você, identificar horários já ocupados na sua agenda pessoal para evitar conflitos de agendamento.</p>
  <p><strong>Compartilhamento:</strong> os dados acessados por meio dessa integração não são compartilhados, vendidos, alugados ou transferidos a nenhum terceiro, sob nenhuma circunstância, nem utilizados para treinar modelos de inteligência artificial.</p>
  <p><strong>Proteção:</strong> o token de acesso à sua Conta Google é armazenado de forma criptografada (AES-256) em nosso banco de dados, nunca em texto legível.</p>
  <p><strong>Retenção e exclusão:</strong> o token é mantido enquanto a integração estiver ativa. Você pode desconectar sua Conta Google a qualquer momento pela tela de Integrações — isso remove imediata e permanentemente o token armazenado. Eventos já criados no calendário dedicado não são apagados automaticamente ao desconectar; podem ser removidos manualmente, direto na sua Google Agenda.</p>

  <h2>6. Notificações Push</h2>
  <p>Enviamos notificações push apenas com sua autorização explícita. Você pode revogar essa permissão nas configurações do seu dispositivo a qualquer momento.</p>

  <h2>7. Seus Direitos (LGPD)</h2>
  <p>Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:</p>
  <ul>
    <li>Acessar, corrigir ou excluir seus dados pessoais.</li>
    <li>Revogar consentimentos concedidos.</li>
    <li>Solicitar portabilidade dos seus dados.</li>
    <li>Ser informado sobre o uso dos seus dados.</li>
  </ul>
  <p>Para exercer esses direitos, entre em contato pelo e-mail: <a href="mailto:contato@usebarberpro.com">contato@usebarberpro.com</a></p>

  <h2>8. Retenção de Dados</h2>
  <p>Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento da conta, dados pessoais são excluídos em até 90 dias, exceto onde a lei exigir retenção por mais tempo.</p>

  <h2>9. Cookies e Tecnologias Similares</h2>
  <p>Utilizamos cookies de sessão para manter você autenticado. Não utilizamos cookies de rastreamento ou publicidade.</p>

  <h2>10. Menores de Idade</h2>
  <p>O Barber Pro não é destinado a menores de 13 anos. Não coletamos intencionalmente dados de crianças.</p>

  <h2>11. Alterações nesta Política</h2>
  <p>Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas por e-mail ou dentro do aplicativo.</p>

  <h2>12. Contato</h2>
  <p>Dúvidas sobre esta política: <a href="mailto:contato@usebarberpro.com">contato@usebarberpro.com</a></p>
  <p>Site: <a href="https://usebarberpro.com">usebarberpro.com</a></p>

  <hr />
  <p style="font-size:13px;color:#555;text-align:center">Barber Pro &copy; 2026 &mdash; Todos os direitos reservados</p>
</div>
</body>
</html>`);
  });
}
