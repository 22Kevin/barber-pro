"use client";
import { useState } from "react";
import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
};

export function HeroSection() {
  const [videoActive, setVideoActive] = useState(false);

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,168,76,0.12) 0%, transparent 65%)",
      }}
    >


      <div className="lp-hero-inner">
      {/* Badge */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(201,168,76,0.1)",
          border: "1px solid rgba(201,168,76,0.25)",
          borderRadius: 100, padding: "6px 16px",
          marginBottom: 28,
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#C9A84C",
          boxShadow: "0 0 8px rgba(201,168,76,0.8)",
          display: "inline-block",
        }} />
        <span style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
          Mais de 500 barbearias já usam
        </span>
      </motion.div>

      {/* Heading */}
      <motion.h1
        id="hero-heading"
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.6, delay: 0.2 }}
        className="lp-hero-title"
        style={{ margin: "0 auto 20px" }}
      >
        Sua barbearia fatura{" "}
        <span style={{
          background: "linear-gradient(135deg, #C9A84C, #F0C060)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          todo mês,
        </span>
        <br />
        mesmo quando está fechada.
      </motion.h1>

      {/* Subheading */}
      <motion.p
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.6, delay: 0.32 }}
        className="lp-hero-sub"
      >
        O Barber Pro automatiza agendamentos, cria planos de assinatura recorrente e
        entrega relatórios financeiros em tempo real — para você focar no que importa:
        a tesoura.
      </motion.p>

      {/* CTAs */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.55, delay: 0.44 }}
        className="lp-hero-ctas"
        style={{ marginBottom: 64 }}
      >
        <a
          href="#pricing"
          style={{
            background: "linear-gradient(135deg, #C9A84C, #A07830)",
            color: "#050505",
            fontWeight: 800,
            fontSize: 16,
            padding: "14px 32px",
            borderRadius: 12,
            textDecoration: "none",
            boxShadow: "0 0 40px rgba(201,168,76,0.3), 0 4px 16px rgba(0,0,0,0.4)",
            transition: "transform 0.15s, box-shadow 0.15s",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 60px rgba(201,168,76,0.45), 0 8px 24px rgba(0,0,0,0.5)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 40px rgba(201,168,76,0.3), 0 4px 16px rgba(0,0,0,0.4)"; }}
        >
          Começar 14 dias grátis
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="#050505" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <a
          href="#features"
          style={{
            background: "transparent",
            color: "#888880",
            fontWeight: 600,
            fontSize: 15,
            padding: "14px 28px",
            borderRadius: 12,
            textDecoration: "none",
            border: "1px solid rgba(255,255,255,0.1)",
            transition: "color 0.2s, border-color 0.2s",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#F0EEE8"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#888880"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        >
          Ver como funciona
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </motion.div>

      {/* Video placeholder */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.7, delay: 0.56 }}
        className="lp-hero-video"
        style={{
          maxWidth: 860,
          borderRadius: 20,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.06)",
          position: "relative",
          background: "#0A0A0A",
          aspectRatio: "16/9",
          height: "auto",
          display: "block",
        }}
      >
        {!videoActive ? (
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              background: "linear-gradient(135deg, #0D0D0D 0%, #111008 100%)",
            }}
            onClick={() => setVideoActive(true)}
          >
            {/* Grid lines decorative */}
            <div style={{
              position: "absolute", inset: 0, opacity: 0.04,
              backgroundImage: "linear-gradient(rgba(201,168,76,1) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,1) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }} />
            {/* Play button */}
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(201,168,76,0.15)",
              border: "2px solid rgba(201,168,76,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.2s, background 0.2s",
              boxShadow: "0 0 40px rgba(201,168,76,0.2)",
              zIndex: 1,
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.1)"; (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.25)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.15)"; }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M10 7l14 7-14 7V7z" fill="#C9A84C" />
              </svg>
            </div>
            <p style={{ color: "#888880", fontSize: 14, marginTop: 16, zIndex: 1, letterSpacing: 0.3 }}>
              Assista ao tour completo — 2 min
            </p>
          </div>
        ) : (
          <iframe
            src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
            title="Barber Pro — Tour completo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          />
        )}
      </motion.div>

      {/* Social proof numbers */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.55, delay: 0.7 }}
        className="lp-hero-stats"
        style={{
          marginTop: 56, paddingTop: 40,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          width: "100%", maxWidth: 700,
        }}
      >
        {[
          { value: "500+", label: "Barbearias ativas" },
          { value: "R$ 2M+", label: "Faturados pelos clientes" },
          { value: "98%", label: "Taxa de retenção" },
        ].map((stat) => (
          <div key={stat.label} style={{ textAlign: "center" }}>
            <div style={{ color: "#C9A84C", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, letterSpacing: -1 }}>
              {stat.value}
            </div>
            <div style={{ color: "#888880", fontSize: 13, marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </motion.div>
      </div>
    </section>
  );
}
