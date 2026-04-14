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

function publicLayout(shopName: string, primaryColor: string, body: string, extraHead = "", settings?: any): string {
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
      --bg: #0A0A0A;
      --surface: #141414;
      --surface2: #1E1E1E;
      --border: #2A2A2A;
      --text: #F0EEE8;
      --muted: #888880;
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

    /* Seções */
    .section { padding: 48px 24px; max-width: 900px; margin: 0 auto; }
    .section-title { font-size: 20px; font-weight: 800; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; font-family: var(--font-styled-family, inherit); }
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
    .tab-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    @media (max-width: 480px) { .tab-cards-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
    .tab-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; transition: border-color 0.2s, transform 0.15s; cursor: pointer; }
    .tab-card:hover { border-color: var(--primary); transform: translateY(-2px); }
    .tab-card-thumb { width: 100%; height: 160px; object-fit: cover; background: var(--surface2); }
    .tab-card-thumb-placeholder { width: 100%; height: 160px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 36px; }
    .tab-card-body { padding: 14px; }
    .tab-card-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
    .tab-card-desc { font-size: 12px; color: var(--muted); margin-bottom: 10px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .tab-card-meta { display: flex; align-items: center; justify-content: space-between; }
    .tab-card-price { font-size: 17px; font-weight: 900; color: var(--primary); }
    .tab-card-duration { font-size: 11px; color: var(--muted); }
    .tab-card-rating { font-size: 11px; color: #FBBF24; margin-top: 5px; }
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
    .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .info-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
    .info-label { font-size: 11px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px; }
    .info-value { font-size: 15px; font-weight: 600; }

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
    .cta-unlock-banner { background: linear-gradient(135deg, #1a1200 0%, #1a1a00 50%, #0f0f0f 100%); border: 1px solid var(--primary); border-radius: 20px; padding: 24px 28px; margin: 0 24px 8px; max-width: 900px; margin-left: auto; margin-right: auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
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
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}

// ─── Página principal da barbearia ───────────────────────────────────────────
async function renderShopPage(slug: string, res: Response, req?: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) {
    res.status(404).send(`<!DOCTYPE html><html><body style="background:#0A0A0A;color:#F0EEE8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><h1 style="font-size:48px;margin-bottom:8px">404</h1><p style="color:#888">Barbearia não encontrada.</p><p style="margin-top:16px"><a href="https://barberpro.com.br" style="color:#C9A84C">Barber Pro</a></p></div></body></html>`);
    return;
  }

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
  const isLoggedIn = !!loggedClient;

  // Galeria
  const galleryUrls: string[] = settings?.galleryUrls
    ? JSON.parse(settings.galleryUrls).filter(Boolean)
    : [];

  // Avaliações recentes (máx 6) — filtradas por tenant para isolamento
  const allReviewsRaw: Array<{ id: number; clientId: number; serviceId: number; rating: number; comment: string | null; createdAt: Date }> = [];
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
  const clientIds = [...new Set(recentReviews.map((r) => r.clientId))];
  const clientMap: Record<number, string> = {};
  for (const cid of clientIds) {
    const c = await db.getClientById(cid);
    if (c) clientMap[cid] = c.name;
  }

  // ── Buscar Produtos de Venda ─────────────────────────────────────────────
  const productList = await db.getAllProductsWithMedia(true, tenant.id);
  const saleProducts = productList.filter((p: any) => p.productType === 'sale' || !p.productType);

  // ── Helper: preço com lock para visitantes ───────────────────────────────
  const priceHtml = (price: string | number) => isLoggedIn
    ? `<span class="tab-card-price">${formatPrice(price)}</span>`
    : `<a href="/pub/${slug}/login?redirect=" class="price-locked">🔒 Ver preço</a>`;

  // ── Seção: Cards de Serviços (para o painel de abas) ─────────────────────
  const servicesTabHtml = serviceList.length === 0
    ? `<div class="empty">Nenhum serviço cadastrado ainda.</div>`
    : serviceList.map((s) => `
      <a href="/pub/${slug}/agendar" class="tab-card" style="text-decoration:none;color:inherit">
        ${s.thumbnailUrl
          ? `<img class="tab-card-thumb" src="${escapeHtml(s.thumbnailUrl)}" alt="${escapeHtml(s.name)}" loading="lazy" />`
          : `<div class="tab-card-thumb-placeholder">✂️</div>`
        }
        <div class="tab-card-body">
          <div class="tab-card-name">${escapeHtml(s.name)}</div>
          ${s.description ? `<div class="tab-card-desc">${escapeHtml(s.description)}</div>` : ""}
          ${s.avgRating ? `<div class="tab-card-rating">★ ${s.avgRating} (${s.reviewCount})</div>` : ""}
          <div class="tab-card-meta">
            ${priceHtml(s.price)}
            <span class="tab-card-duration">${formatDuration(s.durationMinutes)}</span>
          </div>
        </div>
      </a>
    `).join("");

  // ── Seção: Cards de Produtos (para o painel de abas) ─────────────────────
  const productsTabHtml = saleProducts.length === 0
    ? `<div class="empty">Nenhum produto disponível.</div>`
    : saleProducts.map((p: any) => `
      <div class="tab-card">
        ${p.thumbnailUrl
          ? `<img class="tab-card-thumb" src="${escapeHtml(p.thumbnailUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
          : `<div class="tab-card-thumb-placeholder">🧴</div>`
        }
        <div class="tab-card-body">
          <div class="tab-card-name">${escapeHtml(p.name)}</div>
          ${p.description ? `<div class="tab-card-desc">${escapeHtml(p.description)}</div>` : ""}
          <div class="tab-card-meta">
            ${priceHtml(p.price)}
            ${p.stockQuantity != null ? `<span class="tab-card-duration">${p.stockQuantity} em estoque</span>` : ""}
          </div>
        </div>
      </div>
    `).join("");

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

  // ── Seção: Planos de Assinatura ────────────────────────────────────────────
  let subscriptionPlansHtml = "";
  let planServicesData: Record<number, any[]> = {};
  try {
    const dbConn = await db.getDb();
    if (dbConn) {
      const tenantIdVal = tenant.id;
      const plansResult = await dbConn.execute(
        sql`SELECT * FROM subscription_plans WHERE tenantId = ${tenantIdVal} AND isActive = 1 ORDER BY price ASC`
      ) as any;
      const plans = Array.isArray(plansResult) ? plansResult[0] : plansResult?.rows ?? [];
      if (plans && plans.length > 0) {
        // Buscar serviços de cada plano
        for (const plan of plans) {
          const planIdVal = plan.id;
          const svcsResult = await dbConn.execute(
            sql`SELECT sps.serviceId, s.name as serviceName, s.price as servicePrice
             FROM subscription_plan_services sps
             JOIN services s ON s.id = sps.serviceId
             WHERE sps.planId = ${planIdVal}`
          ) as any;
          const svcs = Array.isArray(svcsResult) ? svcsResult[0] : svcsResult?.rows ?? [];
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
                  ${isLoggedIn ? `<button
                    onclick="openPlanModal(${plan.id}, '${escapeHtml(plan.name)}', ${plan.price}, ${plan.maxServices}, ${plan.maxProducts}, ${plan.recurrences}, '${servicesJson}')"
                    style="width:100%;padding:10px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;background:${isPopular ? `var(--primary)` : `transparent`};color:${isPopular ? `#0A0A0A` : `var(--primary)`};border:2px solid var(--primary);letter-spacing:0.3px">
                    ASSINAR PLANO
                  </button>` : `<a href="/pub/${slug}/login" style="display:block;width:100%;padding:10px;border-radius:10px;font-size:13px;font-weight:800;text-align:center;background:transparent;color:var(--primary);border:2px solid var(--primary);letter-spacing:0.3px;text-decoration:none">ENTRAR PARA ASSINAR</a>`}
                </div>
              </div>
            </div>
          `;
        }).join("");
        subscriptionPlansHtml = `
          <div style="margin-bottom:16px">
            <p style="color:var(--muted);font-size:14px;margin:0">Assine um plano e garanta seus horários todo mês com desconto.</p>
          </div>
          <div class="tab-cards-grid">${planCards}</div>
          <!-- Modal de Assinatura -->
          <div class="plan-modal-overlay" id="planModalOverlay" onclick="if(event.target===this)closePlanModal()">
            <div class="plan-modal">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div>
                  <div class="plan-modal-title" id="planModalTitle"></div>
                  <div class="plan-modal-sub" id="planModalSub"></div>
                </div>
                <button onclick="closePlanModal()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer">×</button>
              </div>
              <div id="planModalServices"></div>
              <button class="plan-modal-confirm" id="planModalConfirm"
                style="background:${primaryColor};color:#0A0A0A;border:none"
                onclick="confirmPlanSubscription()">
                Continuar para Agendamento
              </button>
            </div>
          </div>
          <script>
            var _planData = {};
            function openPlanModal(planId, name, price, maxSvc, maxPrd, recurrences, servicesJson) {
              _planData = { planId, name, price, maxSvc, maxPrd, recurrences, selectedServices: [] };
              try { _planData.services = JSON.parse(servicesJson.replace(/&quot;/g,'"').replace(/&#39;/g,"'")); } catch(e) { _planData.services = []; }
              document.getElementById('planModalTitle').textContent = name;
              document.getElementById('planModalSub').textContent = 'R$ ' + price.toFixed(2).replace('.',',') + '/mês · ' + recurrences + ' agendamento' + (recurrences !== 1 ? 's' : '') + ' por mês';
              var svcHtml = '';
              if (_planData.services.length > 0) {
                svcHtml += '<div class="plan-modal-section">Escolha ' + (maxSvc >= 999 ? 'todos os' : maxSvc) + ' serviço' + (maxSvc !== 1 ? 's' : '') + ' do plano:</div>';
                _planData.services.forEach(function(s) {
                  svcHtml += '<div class="plan-service-item" id="svc_' + s.id + '" onclick="togglePlanService(' + s.id + ')">' +
                    '<div class="plan-service-check" id="svcCheck_' + s.id + '"></div>' +
                    '<div style="flex:1"><div style="font-size:14px;font-weight:600">' + s.name + '</div>' +
                    '<div style="font-size:12px;color:var(--muted)">R$ ' + Number(s.price).toFixed(2).replace('.',',') + '</div></div></div>';
                });
              }
              document.getElementById('planModalServices').innerHTML = svcHtml;
              document.getElementById('planModalOverlay').classList.add('open');
            }
            function closePlanModal() {
              document.getElementById('planModalOverlay').classList.remove('open');
            }
            function togglePlanService(id) {
              var idx = _planData.selectedServices.indexOf(id);
              if (idx >= 0) {
                _planData.selectedServices.splice(idx, 1);
                document.getElementById('svc_' + id).classList.remove('selected');
                document.getElementById('svcCheck_' + id).textContent = '';
              } else {
                if (_planData.maxSvc < 999 && _planData.selectedServices.length >= _planData.maxSvc) {
                  alert('Você pode escolher no máximo ' + _planData.maxSvc + ' serviço' + (_planData.maxSvc !== 1 ? 's' : '') + '.');
                  return;
                }
                _planData.selectedServices.push(id);
                document.getElementById('svc_' + id).classList.add('selected');
                document.getElementById('svcCheck_' + id).textContent = '✓';
              }
            }
            function confirmPlanSubscription() {
              if (_planData.services.length > 0 && _planData.selectedServices.length === 0) {
                alert('Selecione pelo menos um serviço para continuar.');
                return;
              }
              var url = '/pub/${slug}/agendar?planId=' + _planData.planId + '&selectedServices=' + _planData.selectedServices.join(',');
              window.location.href = url;
            }
          <\/script>
        `;
      }
    }
  } catch (e) { /* planos opcionais */ }

  // Seção Como Funciona
  const howItWorksHtml = `
    <div class="section how-it-works">
      <div class="section-title">Como Funciona</div>
      <div class="steps-grid">
        <div class="step-card">
          <div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">1</div>
          <div class="step-icon">✂️</div>
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

    ${galleryHtml}

    <!-- Painel de Abas: Serviços / Produtos / Assinaturas / Como Funciona -->
    <div class="tabs-section">
      <div class="tabs-header">
        <button class="tab-btn active" onclick="switchTab('services',this)">✂️ Serviços</button>
        ${saleProducts.length > 0 ? `<button class="tab-btn" onclick="switchTab('products',this)">🧴 Produtos</button>` : ""}
        ${subscriptionPlansHtml ? `<button class="tab-btn" onclick="switchTab('plans',this)">🏷️ Assinaturas</button>` : ""}
        <button class="tab-btn" onclick="switchTab('how',this)">ℹ️ Como Funciona</button>
      </div>

      <!-- Aba: Serviços -->
      <div class="tab-panel active" id="tab-services">
        ${!isLoggedIn ? `<div class="cta-unlock-banner" style="margin:0 0 20px">
          <div class="cta-unlock-content"><div class="cta-unlock-icon">🔒</div><div><div class="cta-unlock-title">Faça login para ver os preços</div><div class="cta-unlock-sub">Crie uma conta gratuita e acesse todos os valores.</div></div></div>
          <a href="/pub/${slug}/login" class="cta-unlock-btn">Entrar / Cadastrar</a>
        </div>` : ""}
        <div class="tab-cards-grid">${servicesTabHtml}</div>
      </div>

      <!-- Aba: Produtos -->
      ${saleProducts.length > 0 ? `<div class="tab-panel" id="tab-products">
        ${!isLoggedIn ? `<div class="cta-unlock-banner" style="margin:0 0 20px">
          <div class="cta-unlock-content"><div class="cta-unlock-icon">🔒</div><div><div class="cta-unlock-title">Faça login para ver os preços</div><div class="cta-unlock-sub">Crie uma conta gratuita e acesse todos os valores.</div></div></div>
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
            <div class="step-card"><div class="step-number" style="background:${primaryColor}22;color:${primaryColor}">1</div><div class="step-icon">✂️</div><div class="step-title">Escolha o Serviço</div><div class="step-desc">Selecione o corte ou tratamento que deseja.</div></div>
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
            <div style="position:relative">
              <input type="password" id="password-input" required placeholder="${isLogin ? "Sua senha" : "Mínimo 6 caracteres"}" style="width:100%;padding:12px 44px 12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;box-sizing:border-box" />
              <button type="button" id="toggle-password" onclick="(function(){var i=document.getElementById('password-input');var b=document.getElementById('toggle-password');if(i.type==='password'){i.type='text';b.innerHTML='&#128065;&#65038;'}else{i.type='password';b.innerHTML='&#128065;'}})()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:4px;line-height:1">&#128065;</button>
            </div>
          </div>
          ${!isLogin ? `<div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">TELEFONE</label>
            <input type="tel" id="phone-input" required placeholder="(11) 99999-9999" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" oninput="(function(e){var d=e.target.value.replace(/\\D/g,'').slice(0,11);if(d.length<=2)e.target.value=d.length?'('+d:'';else if(d.length<=6)e.target.value='('+d.slice(0,2)+') '+d.slice(2);else if(d.length<=10)e.target.value='('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);else e.target.value='('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7)})(event)" />
          </div>` : ""}
          ${!isLogin ? `<div style="margin-bottom:24px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">DATA DE NASCIMENTO <span style="color:var(--muted);font-weight:400">(opcional — usamos para enviar um cupom no seu aniversário 🎂)</span></label>
            <input type="date" id="birth-date-input" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>` : ""}
          ${!isLogin ? `<div style="margin-bottom:20px;padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:12px">
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
              <input type="checkbox" id="lgpd-consent" required style="margin-top:2px;width:16px;height:16px;accent-color:var(--primary);flex-shrink:0" />
              <span style="font-size:12px;color:var(--muted);line-height:1.5">Autorizo o compartilhamento do meu contato com esta barbearia para suporte e agendamentos, conforme a <a href="https://barberpro.com.br/privacidade" target="_blank" style="color:var(--primary)">Pol&iacute;tica de Privacidade</a>.</span>
            </label>
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
        ${!isLogin ? `body.name = document.getElementById('name-input').value; body.phone = document.getElementById('phone-input').value; body.lgpdConsent = true; var bdEl = document.getElementById('birth-date-input'); if (bdEl && bdEl.value) body.birthDate = bdEl.value;` : ""}
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
// ─── Página de Perfil do Cliente ─────────────────────────────────────────────
async function renderPerfilPage(slug: string, res: Response, req: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";

  // Verificar sessão do cliente
  const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ?? req.cookies?.["client_session"];
  let loggedClient: { id: number; name: string; email: string; phone?: string } | null = null;
  if (clientSessionRaw) {
    try { loggedClient = JSON.parse(Buffer.from(clientSessionRaw, "base64").toString()); } catch {}
  }
  if (!loggedClient) {
    res.redirect(`/pub/${slug}/login?redirect=perfil`);
    return;
  }

  // Buscar dados atuais do cliente no banco
  const clientData = await db.getClientById(loggedClient.id);
  if (!clientData) { res.redirect(`/pub/${slug}/login`); return; }

  const saved = req.query.saved === "1";
  const error = req.query.error ? decodeURIComponent(req.query.error as string) : null;

  const body = `
    <div style="max-width:480px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
        <a href="/pub/${slug}" style="color:var(--muted);font-size:20px">&#8592;</a>
        <div>
          <div style="font-size:18px;font-weight:800">Meu Perfil</div>
          <div style="font-size:12px;color:var(--muted)">${escapeHtml(settings?.shopName ?? tenant.name)}</div>
        </div>
      </div>

      ${saved ? `<div style="background:#4ADE8022;border:1px solid #4ADE8044;color:#4ADE80;padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">&#10003; Perfil atualizado com sucesso!</div>` : ""}
      ${error ? `<div style="background:#EF444422;border:1px solid #EF444444;color:#F87171;padding:12px 16px;border-radius:12px;margin-bottom:20px;font-size:14px">&#10007; ${escapeHtml(error)}</div>` : ""}

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px">
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:80px;height:80px;border-radius:50%;background:var(--surface2);border:3px solid var(--primary);display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 12px">&#128100;</div>
          <div style="font-size:16px;font-weight:800">${escapeHtml(clientData.name)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Cliente desde ${new Date((clientData as any).createdAt ?? Date.now()).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
        </div>

        <form method="POST" action="/pub-api/perfil">
          <input type="hidden" name="slug" value="${escapeHtml(slug)}" />
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">NOME COMPLETO</label>
            <input type="text" name="name" value="${escapeHtml(clientData.name)}" required
              style="width:100%;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;outline:none" />
          </div>
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">TELEFONE / WHATSAPP</label>
            <input type="tel" name="phone" value="${escapeHtml(clientData.phone ?? "")}" placeholder="(11) 99999-9999"
              style="width:100%;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;outline:none" />
          </div>
          <div style="margin-bottom:24px">
            <label style="display:block;font-size:12px;font-weight:700;color:var(--muted);letter-spacing:1px;margin-bottom:8px">E-MAIL</label>
            <input type="email" name="email" value="${escapeHtml(clientData.email ?? "")}" placeholder="seu@email.com"
              style="width:100%;padding:12px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:14px;outline:none" />
          </div>
          <button type="submit"
            style="width:100%;padding:14px;background:var(--primary);color:#0A0A0A;font-size:15px;font-weight:800;border:none;border-radius:14px;cursor:pointer">
            Salvar Alteracoes
          </button>
        </form>

        <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
          <a href="/pub/${slug}/meus-agendamentos" style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;color:var(--text);font-size:14px;font-weight:600">
            <span>&#128197; Meus Agendamentos</span>
            <span style="color:var(--muted)">&#8250;</span>
          </a>
          <a href="/pub/${slug}/logout" style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;color:#F87171;font-size:14px;font-weight:600;border-top:1px solid var(--border)">
            <span>&#128682; Sair da conta</span>
            <span style="color:var(--muted)">&#8250;</span>
          </a>
        </div>
      </div>
    </div>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body, "", settings));
}
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
        <div style="display:flex;gap:8px">
          <a href="/pub/${slug}/perfil" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px">&#128100; Perfil</a>
          <a href="/pub/${slug}/agendar" style="background:var(--primary);color:#0A0A0A;font-size:13px;font-weight:800;padding:10px 16px;border-radius:10px">+ Novo</a>
        </div>
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
    await renderShopPage(req.params.slug, res, req);
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
      const { name, email, password, phone, slug, lgpdConsent, birthDate } = req.body;
      if (!name || !email || !password || !phone) { res.status(400).json({ error: "Todos os campos são obrigatórios" }); return; }
      if (password.length < 6) { res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" }); return; }
      const existing = await db.getClientAccountByEmail(email);
      if (existing) { res.status(409).json({ error: "Email já cadastrado. Faça login." }); return; }
      let bcrypt: any;
      try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
      const passwordHash = bcrypt ? await bcrypt.hash(password, 10) : password;
      // Obter tenantId via slug para associar o cliente à barbearia correta
      const tenantForReg = slug ? await db.getTenantBySlug(slug) : null;
      const clientId = await db.createClient({ name, email, phone, isActive: true, tenantId: tenantForReg?.id ?? null, birthDate: birthDate ?? null } as any);
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

  // GET /pub/:slug/forgot-password — Solicitar recuperação de senha
  app.get("/pub/:slug/forgot-password", async (req: Request, res: Response) => {
    const { slug } = req.params;
    const tenant = await db.getTenantBySlug(slug);
    if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }
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
        let bcrypt: any;
        try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
        const passwordHash = bcrypt ? await bcrypt.hash(newPassword, 10) : newPassword;
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

  // ─── Perfil do Cliente ─────────────────────────────────────────────────────
  // GET /pub/:slug/perfil — Página de perfil do cliente
  app.get("/pub/:slug/perfil", async (req: Request, res: Response) => {
    await renderPerfilPage(req.params.slug, res, req);
  });

  // POST /pub-api/perfil — Salvar alterações do perfil do cliente
  app.post("/pub-api/perfil", async (req: Request, res: Response) => {
    try {
      const { slug, name, phone, email } = req.body;
      if (!slug || !name) { res.redirect(`/pub/${slug}/perfil?error=${encodeURIComponent("Nome é obrigatório")}`); return; }
      const clientSessionRaw = req.cookies?.[`client_session_${slug}`] ?? req.cookies?.["client_session"];
      if (!clientSessionRaw) { res.redirect(`/pub/${slug}/login?redirect=perfil`); return; }
      let loggedClient: { id: number; name: string; email: string } | null = null;
      try { loggedClient = JSON.parse(Buffer.from(clientSessionRaw, "base64").toString()); } catch {}
      if (!loggedClient) { res.redirect(`/pub/${slug}/login?redirect=perfil`); return; }
      // Atualizar dados do cliente no banco
      await db.updateClient(loggedClient.id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
      });
      // Atualizar cookie de sessão com o novo nome
      const updatedSession = { ...loggedClient, name: name.trim(), email: email?.trim() || loggedClient.email };
      const sessionValue = Buffer.from(JSON.stringify(updatedSession)).toString("base64");
      res.cookie(`client_session_${slug}`, sessionValue, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.redirect(`/pub/${slug}/perfil?saved=1`);
    } catch (e: any) {
      const { slug } = req.body;
      res.redirect(`/pub/${slug ?? ""}/perfil?error=${encodeURIComponent(e.message)}`);
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
            ${t.logoUrl ? `<img src="${t.logoUrl}" style="position:absolute;bottom:-24px;left:16px;width:48px;height:48px;border-radius:50%;border:3px solid var(--surface);object-fit:cover" />` : `<div style="position:absolute;bottom:-24px;left:16px;width:48px;height:48px;border-radius:50%;border:3px solid var(--surface);background:#333;display:flex;align-items:center;justify-content:center;font-size:20px">✂️</div>`}
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
          <h1 style="font-size:32px;font-weight:900;margin-bottom:8px">✂️ Encontre sua Barbearia</h1>
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
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Marketplace — Barber Pro</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1011;color:#ECEDEE;min-height:100vh}:root{--surface:#1e2022;--border:#334155;--muted:#9BA1A6;--primary:#C9A84C;--text:#ECEDEE;--bg:#0f1011}nav{background:#1e2022;border-bottom:1px solid #334155;padding:16px 24px;display:flex;align-items:center;justify-content:space-between}<a{color:inherit}</style></head><body><nav><span style="font-size:18px;font-weight:900">✂️ Barber Pro</span><a href="/marketplace" style="font-size:13px;color:#9BA1A6">Marketplace</a></nav>${body}</body></html>`;
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
}
