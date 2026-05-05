"use client";
import { useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { SubscriptionSection } from "@/components/landing/SubscriptionSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { Footer } from "@/components/landing/Footer";

const LANDING_CSS = `
  /* ─── Reset ─────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; font-size: 16px; }
  body {
    background: #050505;
    color: #F0EEE8;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
    width: 100%;
  }
  img { max-width: 100%; height: auto; display: block; }

  /* ─── Scrollbar ──────────────────────────────────── */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #050505; }
  ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 3px; }
  ::selection { background: rgba(201,168,76,0.25); color: #F0EEE8; }

  /* ─── Anchor offset for fixed navbar ────────────── */
  [id] { scroll-margin-top: 80px; }

  /* ─── Navbar ─────────────────────────────────────── */
  .lp-nav-desktop { display: flex !important; }
  .lp-nav-mobile-btn { display: none !important; }

  /* ─── Hero ───────────────────────────────────────── */
  .lp-hero-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 140px 24px 80px;
    max-width: 900px;
    margin: 0 auto;
  }
  .lp-hero-title {
    font-size: clamp(2.4rem, 6vw, 4.5rem);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    margin-bottom: 24px;
  }
  .lp-hero-sub {
    font-size: clamp(1rem, 2vw, 1.2rem);
    color: #888880;
    line-height: 1.7;
    max-width: 560px;
    margin-bottom: 40px;
  }
  .lp-hero-ctas {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    width: 100%;
  }
  .lp-hero-cta-primary {
    background: linear-gradient(135deg, #C9A84C, #A07830);
    color: #050505;
    font-weight: 700;
    font-size: 1rem;
    padding: 15px 32px;
    border-radius: 10px;
    text-decoration: none;
    white-space: nowrap;
    box-shadow: 0 0 32px rgba(201,168,76,0.3);
    transition: opacity 0.2s, transform 0.15s;
  }
  .lp-hero-cta-primary:hover { opacity: 0.9; transform: translateY(-2px); }
  .lp-hero-cta-secondary {
    background: rgba(255,255,255,0.05);
    color: #F0EEE8;
    font-weight: 600;
    font-size: 1rem;
    padding: 15px 28px;
    border-radius: 10px;
    text-decoration: none;
    border: 1px solid rgba(255,255,255,0.1);
    white-space: nowrap;
    transition: background 0.2s;
  }
  .lp-hero-cta-secondary:hover { background: rgba(255,255,255,0.09); }
  .lp-hero-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 32px;
    justify-content: center;
    margin-top: 64px;
  }
  .lp-hero-stat { text-align: center; }
  .lp-hero-stat-num { font-size: 2rem; font-weight: 800; color: #C9A84C; }
  .lp-hero-stat-label { font-size: 0.8rem; color: #555550; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
  .lp-hero-video {
    width: 100%;
    max-width: 760px;
    margin: 56px auto 0;
    aspect-ratio: 16 / 9;
    background: #0F0F0F;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.07);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
    overflow: hidden;
  }

  /* ─── Section wrapper ────────────────────────────── */
  .lp-section {
    padding: 96px 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .lp-section-label {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #C9A84C;
    margin-bottom: 16px;
    text-align: center;
  }
  .lp-section-title {
    font-size: clamp(1.8rem, 4vw, 3rem);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.02em;
    text-align: center;
    margin-bottom: 16px;
  }
  .lp-section-sub {
    font-size: 1.05rem;
    color: #888880;
    line-height: 1.7;
    text-align: center;
    max-width: 560px;
    margin: 0 auto 64px;
  }

  /* ─── Feature Grid ───────────────────────────────── */
  .lp-feature-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .lp-feature-card {
    background: #0F0F0F;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    padding: 28px;
    transition: border-color 0.25s, box-shadow 0.25s;
    position: relative;
    overflow: hidden;
  }
  .lp-feature-card:hover {
    border-color: rgba(201,168,76,0.25);
    box-shadow: 0 0 40px rgba(201,168,76,0.07);
  }
  .lp-feature-icon {
    width: 44px; height: 44px;
    background: rgba(201,168,76,0.1);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }
  .lp-feature-problem {
    font-size: 0.75rem; font-weight: 600;
    color: #C9A84C; text-transform: uppercase;
    letter-spacing: 0.08em; margin-bottom: 8px;
  }
  .lp-feature-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 10px; }
  .lp-feature-desc { font-size: 0.9rem; color: #888880; line-height: 1.6; }
  .lp-feature-badge {
    position: absolute; top: 16px; right: 16px;
    background: rgba(201,168,76,0.15);
    color: #C9A84C; font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 20px;
    border: 1px solid rgba(201,168,76,0.25);
  }

  /* ─── Subscription Steps ─────────────────────────── */
  .lp-steps {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 56px;
  }
  .lp-step-card {
    background: #0F0F0F;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    padding: 28px;
    position: relative;
  }
  .lp-step-num {
    position: absolute; top: 20px; right: 20px;
    font-size: 2.5rem; font-weight: 900;
    color: rgba(201,168,76,0.08); line-height: 1;
  }
  .lp-step-icon {
    width: 44px; height: 44px;
    background: rgba(201,168,76,0.1);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }
  .lp-step-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
  .lp-step-desc { font-size: 0.9rem; color: #888880; line-height: 1.6; margin-bottom: 12px; }
  .lp-step-tag {
    display: inline-block;
    background: rgba(201,168,76,0.08);
    border: 1px solid rgba(201,168,76,0.2);
    color: #C9A84C; font-size: 0.78rem; font-weight: 600;
    padding: 5px 12px; border-radius: 6px;
  }
  .lp-step-arrow {
    display: none;
    color: rgba(201,168,76,0.4);
    font-size: 1.5rem;
    align-self: center;
    flex-shrink: 0;
  }
  .lp-revenue-box {
    background: linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03));
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 20px;
    padding: 40px 32px;
    text-align: center;
  }
  .lp-revenue-label { font-size: 0.85rem; color: #888880; margin-bottom: 12px; }
  .lp-revenue-num { font-size: clamp(2.5rem, 6vw, 4rem); font-weight: 900; color: #C9A84C; line-height: 1; margin-bottom: 8px; }
  .lp-revenue-sub { font-size: 1.1rem; font-weight: 600; margin-bottom: 16px; }
  .lp-revenue-note { font-size: 0.85rem; color: #888880; line-height: 1.6; }
  .lp-revenue-highlight { color: #C9A84C; font-style: italic; }

  /* ─── Testimonials ───────────────────────────────── */
  .lp-testimonials-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .lp-testimonial-card {
    background: #0F0F0F;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    padding: 28px;
  }
  .lp-testimonial-stars { color: #C9A84C; font-size: 0.9rem; margin-bottom: 16px; letter-spacing: 2px; }
  .lp-testimonial-text { font-size: 0.95rem; color: #C8C4BC; line-height: 1.7; margin-bottom: 20px; font-style: italic; }
  .lp-testimonial-author { display: flex; align-items: center; gap: 12px; }
  .lp-testimonial-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(135deg, #C9A84C, #8B6914);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.85rem; color: #050505; flex-shrink: 0;
  }
  .lp-testimonial-name { font-size: 0.9rem; font-weight: 600; }
  .lp-testimonial-role { font-size: 0.78rem; color: #555550; margin-top: 2px; }

  /* ─── Pricing ────────────────────────────────────── */
  .lp-pricing-card {
    background: #0F0F0F;
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 24px;
    padding: 48px 40px;
    max-width: 520px;
    margin: 0 auto;
    box-shadow: 0 0 80px rgba(201,168,76,0.07);
  }
  .lp-pricing-badge {
    display: inline-block;
    background: rgba(201,168,76,0.1);
    color: #C9A84C; font-size: 0.7rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 6px 14px; border-radius: 20px;
    border: 1px solid rgba(201,168,76,0.2);
    margin-bottom: 24px;
  }
  .lp-pricing-price-old { font-size: 1rem; color: #555550; text-decoration: line-through; margin-bottom: 4px; }
  .lp-pricing-price { font-size: clamp(2.5rem, 6vw, 3.5rem); font-weight: 900; color: #C9A84C; line-height: 1; margin-bottom: 4px; }
  .lp-pricing-price-note { font-size: 0.85rem; color: #888880; margin-bottom: 32px; }
  .lp-pricing-features { list-style: none; margin-bottom: 36px; }
  .lp-pricing-feature {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 0.9rem; color: #C8C4BC;
  }
  .lp-pricing-feature:last-child { border-bottom: none; }
  .lp-pricing-check { color: #C9A84C; flex-shrink: 0; margin-top: 1px; }
  .lp-pricing-cta {
    display: block; width: 100%;
    background: linear-gradient(135deg, #C9A84C, #A07830);
    color: #050505; font-weight: 700; font-size: 1.05rem;
    padding: 16px; border-radius: 12px;
    text-decoration: none; text-align: center;
    box-shadow: 0 0 40px rgba(201,168,76,0.3);
    transition: opacity 0.2s, transform 0.15s;
    margin-bottom: 16px;
  }
  .lp-pricing-cta:hover { opacity: 0.9; transform: translateY(-2px); }
  .lp-pricing-footnote { font-size: 0.78rem; color: #555550; text-align: center; line-height: 1.6; }
  .lp-pricing-pwa {
    margin-top: 24px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 16px 20px;
    font-size: 0.85rem; color: #888880; line-height: 1.6;
  }
  .lp-pwa-hint {
    max-width: 520px;
    margin: 32px auto 0;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 20px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
  }

  /* ─── Footer ─────────────────────────────────────── */
  .lp-footer-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 64px 24px 40px;
  }
  .lp-footer-top {
    display: flex;
    flex-direction: column;
    gap: 40px;
    margin-bottom: 48px;
  }
  .lp-footer-links {
    display: flex;
    flex-wrap: wrap;
    gap: 40px;
  }
  .lp-footer-bottom {
    padding-top: 24px;
    border-top: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  /* ─── Tablet (≥ 640px) ───────────────────────────── */
  @media (min-width: 640px) {
    .lp-feature-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .lp-footer-bottom {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  /* ─── Desktop (≥ 900px) ──────────────────────────── */
  @media (min-width: 900px) {
    .lp-nav-desktop { display: flex !important; }
    .lp-nav-mobile-btn { display: none !important; }

    .lp-feature-grid {
      grid-template-columns: repeat(3, 1fr);
    }
    .lp-steps {
      flex-direction: row;
      align-items: stretch;
    }
    .lp-step-card {
      flex: 1;
    }
    .lp-step-arrow {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 0 4px;
    }
    .lp-footer-top {
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-start;
    }
  }

  /* ─── Mobile only (< 640px) ──────────────────────── */
  @media (max-width: 639px) {
    .lp-nav-desktop { display: none !important; }
    .lp-nav-mobile-btn { display: flex !important; }

    .lp-hero-inner { padding: 100px 20px 64px; }
    .lp-section { padding: 72px 20px; }
    .lp-pricing-card { padding: 32px 24px; }
  }

  /* ─── Tablet only (640–899px) ────────────────────── */
  @media (min-width: 640px) and (max-width: 899px) {
    .lp-nav-desktop { display: none !important; }
    .lp-nav-mobile-btn { display: flex !important; }
  }
`;

export default function LandingWeb() {
  useEffect(() => {
    const styleId = "barber-pro-landing-css";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = LANDING_CSS;
      document.head.appendChild(style);
    }

    document.title = "Barber Pro — Sistema Completo de Gestão para Barbearias";
    const setMeta = (name: string, content: string, prop = false) => {
      const attr = prop ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    setMeta("description", "Barber Pro: agenda inteligente, programa de assinatura recorrente, financeiro em tempo real e WhatsApp automático para barbearias. 14 dias grátis, sem cartão.");
    setMeta("keywords", "sistema barbearia, software barbearia, agenda barbearia, gestão barbearia, assinatura barbearia");
    setMeta("og:title", "Barber Pro — Sua barbearia fatura todo mês, mesmo quando está fechada", true);
    setMeta("og:description", "Agenda inteligente, assinatura recorrente e financeiro em tempo real. 14 dias grátis.", true);
    setMeta("og:type", "website", true);
    setMeta("twitter:card", "summary_large_image");

    const ldId = "barber-pro-jsonld";
    if (!document.getElementById(ldId)) {
      const script = document.createElement("script");
      script.id = ldId;
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Barber Pro",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web, iOS, Android",
        "description": "Sistema completo de gestão para barbearias com agendamento, assinatura recorrente e financeiro em tempo real.",
        "offers": {
          "@type": "Offer",
          "price": "97",
          "priceCurrency": "BRL",
          "description": "14 dias grátis, depois R$ 97/mês"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "5",
          "reviewCount": "500"
        }
      });
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById("barber-pro-landing-css")?.remove();
      document.getElementById("barber-pro-jsonld")?.remove();
    };
  }, []);

  return (
    <div style={{ background: "#050505", minHeight: "100vh", overflowX: "hidden" }}>
      <Navbar />
      <main>
        <HeroSection />
        <FeatureGrid />
        <SubscriptionSection />
        <TestimonialsSection />
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
}
