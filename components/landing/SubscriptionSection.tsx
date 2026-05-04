"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="4" width="20" height="20" rx="4" stroke="#C9A84C" strokeWidth="1.8" />
        <path d="M9 14h10M9 10h6M9 18h8" stroke="#C9A84C" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
    title: "Você cria o plano",
    description: "Defina o nome, o preço mensal e quais serviços estão incluídos. Leva menos de 2 minutos.",
    detail: "Ex: Plano Corte + Barba — R$ 120/mês",
  },
  {
    number: "02",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="6" width="20" height="16" rx="3" stroke="#C9A84C" strokeWidth="1.8" />
        <path d="M4 11h20" stroke="#C9A84C" strokeWidth="1.6" />
        <path d="M8 16h4M8 19h6" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="17.5" r="2.5" stroke="#C9A84C" strokeWidth="1.5" />
        <path d="M19 17.5l.8.8 1.7-1.7" stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    title: "O cliente assina",
    description: "Seu cliente vê o plano no app, escolhe e paga com cartão, Pix ou boleto — sem você precisar cobrar.",
    detail: "Pagamento via Mercado Pago ou Asaas",
  },
  {
    number: "03",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 4C8.477 4 4 8.477 4 14s4.477 10 10 10 10-4.477 10-10S19.523 4 14 4z" stroke="#C9A84C" strokeWidth="1.8" />
        <path d="M10 14l3 3 6-6" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Cobrança automática",
    description: "Todo mês, na data certa, o sistema cobra o cliente automaticamente. Você acorda com dinheiro já na conta.",
    detail: "Notificação no seu painel em tempo real",
  },
];

function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

export function SubscriptionSection() {
  const [counterStarted, setCounterStarted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const revenue = useCountUp(2400, 1800, counterStarted);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCounterStarted(true); },
      { threshold: 0.4 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="subscription"
      ref={sectionRef}
      aria-labelledby="subscription-heading"
      style={{
        padding: "100px 24px",
        background: "#080808",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background accent */}
      <div style={{
        position: "absolute",
        bottom: 0, left: "50%",
        transform: "translateX(-50%)",
        width: "min(800px, 100vw)",
        height: 400,
        background: "radial-gradient(ellipse at 50% 100%, rgba(201,168,76,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Section header */}
      <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 72px" }}>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}
        >
          Programa de Assinatura
        </motion.p>
        <motion.h2
          id="subscription-heading"
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
          Receita que entra todo mês.{" "}
          <span style={{
            background: "linear-gradient(135deg, #C9A84C, #F0C060)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            Automaticamente.
          </span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ color: "#888880", fontSize: 16, lineHeight: 1.65 }}
        >
          Pare de depender apenas do movimento diário. Com o programa de assinatura,
          você tem uma base de receita previsível — todo mês, sem esforço.
        </motion.p>
      </div>

      {/* Steps diagram */}
      <div style={{ maxWidth: 1000, margin: "0 auto 64px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 0,
            flexWrap: "wrap",
          }}
          className="subscription-steps"
        >
          {steps.map((step, i) => (
            <div key={step.number} style={{ display: "flex", alignItems: "flex-start", flex: "1 1 260px", minWidth: 220 }}>
              {/* Step card */}
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.15 }}
                style={{
                  flex: 1,
                  background: "#0D0D0D",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: "28px 24px 32px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Number watermark */}
                <div style={{
                  position: "absolute", top: 16, right: 20,
                  fontSize: 56, fontWeight: 900, color: "rgba(201,168,76,0.06)",
                  lineHeight: 1, letterSpacing: -2, userSelect: "none",
                }}>
                  {step.number}
                </div>

                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: "rgba(201,168,76,0.08)",
                  border: "1px solid rgba(201,168,76,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}>
                  {step.icon}
                </div>

                <h3 style={{ color: "#F0EEE8", fontSize: 18, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 }}>
                  {step.title}
                </h3>
                <p style={{ color: "#888880", fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>
                  {step.description}
                </p>
                <div style={{
                  background: "rgba(201,168,76,0.07)",
                  border: "1px solid rgba(201,168,76,0.15)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12, color: "#C9A84C", fontWeight: 600,
                }}>
                  {step.detail}
                </div>
              </motion.div>

              {/* Arrow connector (hidden after last step) */}
              {i < steps.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  whileInView={{ opacity: 1, scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.15 + 0.3 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 8px",
                    marginTop: 52,
                    flexShrink: 0,
                  }}
                  className="step-arrow-h"
                >
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M6 16h20M20 10l6 6-6 6" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
                  </svg>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Impact counter */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.03) 100%)",
          border: "1px solid rgba(201,168,76,0.2)",
          borderRadius: 20,
          padding: "40px 40px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.1) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />
        <p style={{ color: "#888880", fontSize: 15, marginBottom: 12 }}>
          Uma barbearia com apenas
        </p>
        <div style={{
          fontSize: "clamp(48px, 8vw, 80px)",
          fontWeight: 900,
          letterSpacing: -3,
          lineHeight: 1,
          marginBottom: 8,
          background: "linear-gradient(135deg, #C9A84C, #F0C060)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          R$ {revenue.toLocaleString("pt-BR")}
        </div>
        <p style={{ color: "#F0EEE8", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          garantidos por mês
        </p>
        <p style={{ color: "#888880", fontSize: 14, lineHeight: 1.6 }}>
          20 assinantes × R$ 120/mês — antes mesmo de abrir a porta.
          <br />
          <span style={{ color: "#C9A84C" }}>Isso é receita previsível, não sorte.</span>
        </p>
      </motion.div>
    </section>
  );
}
