"use client";
import { motion } from "framer-motion";

const benefits = [
  "Agenda inteligente com bloqueio de conflitos",
  "Programa de assinatura recorrente",
  "Financeiro e relatórios em tempo real",
  "WhatsApp automático para clientes",
  "Programa de fidelidade configurável",
  "Comissões por barbeiro",
  "Controle de estoque",
  "Suporte via chat com IA",
  "PWA — instala como app em 10 segundos",
  "Sem contrato. Cancele quando quiser.",
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      style={{
        padding: "100px 24px 120px",
        background: "#080808",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top glow */}
      <div style={{
        position: "absolute",
        top: 0, left: "50%",
        transform: "translateX(-50%)",
        width: "min(700px, 100vw)",
        height: 300,
        background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.1) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 64px" }}>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}
        >
          Oferta
        </motion.p>
        <motion.h2
          id="pricing-heading"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          style={{
            color: "#F0EEE8",
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -1,
            marginBottom: 16,
          }}
        >
          14 dias grátis.{" "}
          <span style={{ color: "#888880", fontWeight: 400 }}>Sem cartão.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ color: "#888880", fontSize: 16, lineHeight: 1.65 }}
        >
          Instale como PWA em 10 segundos, configure sua barbearia em minutos e
          comece a usar hoje mesmo — sem burocracia.
        </motion.p>
      </div>

      {/* Pricing card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.15 }}
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "linear-gradient(160deg, rgba(201,168,76,0.07) 0%, rgba(10,10,10,1) 60%)",
          border: "1px solid rgba(201,168,76,0.25)",
          borderRadius: 24,
          padding: "40px 40px 48px",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.08)",
        }}
      >
        {/* Corner glow */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 200, height: 200,
          background: "radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(201,168,76,0.12)",
          border: "1px solid rgba(201,168,76,0.3)",
          borderRadius: 100, padding: "5px 14px",
          marginBottom: 24,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1l1.545 3.13 3.455.502-2.5 2.437.59 3.44L7 8.885 3.91 10.51l.59-3.44L2 4.632l3.455-.502L7 1z" fill="#C9A84C" />
          </svg>
          <span style={{ color: "#C9A84C", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
            PLANO COMPLETO — TUDO INCLUSO
          </span>
        </div>

        {/* Price */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: "#888880", fontSize: 14, textDecoration: "line-through" }}>R$ 197/mês</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: "clamp(52px, 10vw, 72px)",
            fontWeight: 900,
            letterSpacing: -3,
            lineHeight: 1,
            background: "linear-gradient(135deg, #C9A84C, #F0C060)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            R$ 97
          </span>
          <span style={{ color: "#888880", fontSize: 16, paddingBottom: 10 }}>/mês</span>
        </div>
        <p style={{ color: "#888880", fontSize: 13, marginBottom: 32 }}>
          Primeiros 14 dias gratuitos. Sem cartão de crédito.
        </p>

        {/* Benefits */}
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 36px", display: "flex", flexDirection: "column", gap: 12 }}>
          {benefits.map((b) => (
            <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "rgba(201,168,76,0.12)",
                border: "1px solid rgba(201,168,76,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginTop: 1,
              }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ color: "#C8C4BC", fontSize: 14, lineHeight: 1.5 }}>{b}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <a
          href="/admin/setup"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "linear-gradient(135deg, #C9A84C, #A07830)",
            color: "#050505",
            fontWeight: 800,
            fontSize: 17,
            padding: "16px 32px",
            borderRadius: 14,
            textDecoration: "none",
            boxShadow: "0 0 48px rgba(201,168,76,0.35), 0 4px 20px rgba(0,0,0,0.4)",
            transition: "transform 0.15s, box-shadow 0.15s",
            width: "100%",
            textAlign: "center",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 64px rgba(201,168,76,0.5), 0 8px 28px rgba(0,0,0,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 48px rgba(201,168,76,0.35), 0 4px 20px rgba(0,0,0,0.4)"; }}
        >
          Criar minha conta agora
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9h12M11 5l4 4-4 4" stroke="#050505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <p style={{ color: "#555550", fontSize: 12, textAlign: "center", marginTop: 16 }}>
          Instalação instantânea · PWA-Ready · Sem contrato
        </p>
      </motion.div>

      {/* PWA install hint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.4 }}
        style={{
          maxWidth: 520,
          margin: "32px auto 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "16px 24px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="2" width="14" height="16" rx="3" stroke="#888880" strokeWidth="1.5" />
          <path d="M7 15h6" stroke="#888880" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 5v6M7 8l3 3 3-3" stroke="#888880" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p style={{ color: "#888880", fontSize: 13, margin: 0 }}>
          <strong style={{ color: "#C8C4BC" }}>PWA-Ready:</strong> Instale como app no celular diretamente pelo navegador — sem App Store, sem Play Store.
        </p>
      </motion.div>
    </section>
  );
}
