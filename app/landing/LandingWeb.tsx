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
  /* Reset & base */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; font-size: 16px; }
  body {
    background: #050505;
    color: #F0EEE8;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #050505; }
  ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 3px; }

  /* Desktop nav visible, mobile btn hidden */
  .landing-desktop-nav { display: flex !important; }
  .landing-mobile-menu-btn { display: none !important; }

  /* Mobile */
  @media (max-width: 768px) {
    .landing-desktop-nav { display: none !important; }
    .landing-mobile-menu-btn { display: flex !important; }

    /* Subscription steps: vertical on mobile */
    .subscription-steps {
      flex-direction: column !important;
      align-items: stretch !important;
    }
    .step-arrow-h {
      display: none !important;
    }
  }

  /* Smooth anchor offset for fixed navbar */
  [id] { scroll-margin-top: 80px; }

  /* Selection */
  ::selection { background: rgba(201,168,76,0.25); color: #F0EEE8; }
`;

export default function LandingWeb() {
  useEffect(() => {
    // Inject global CSS once
    const styleId = "barber-pro-landing-css";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = LANDING_CSS;
      document.head.appendChild(style);
    }

    // Update meta tags for SEO
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
    setMeta("twitter:title", "Barber Pro — Sistema Completo de Gestão para Barbearias");

    // JSON-LD structured data
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
          "priceValidUntil": "2026-12-31",
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
      // Cleanup on unmount
      document.getElementById("barber-pro-landing-css")?.remove();
      document.getElementById("barber-pro-jsonld")?.remove();
    };
  }, []);

  return (
    <div style={{ background: "#050505", minHeight: "100vh" }}>
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
