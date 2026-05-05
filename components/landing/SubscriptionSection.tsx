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
      style={{ background: "#030303" }}
    >
      <div className="lp-section">
      {/* Section header */}
      <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 64px" }}>
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
      <div className="lp-steps" style={{ marginBottom: 56 }}>
        {steps.map((step, i) => (
          <>
            <motion.div
              key={step.number}
              className="lp-step-card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <span className="lp-step-num">{step.number}</span>
              <div className="lp-step-icon">{step.icon}</div>
              <h3 className="lp-step-title">{step.title}</h3>
              <p className="lp-step-desc">{step.description}</p>
              <span className="lp-step-tag">{step.detail}</span>
            </motion.div>
            {i < steps.length - 1 && (
              <div className="lp-step-arrow" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M4 14h20M18 8l6 6-6 6" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5" />
                </svg>
              </div>
            )}
          </>
        ))}
      </div>

      {/* Impact counter */}
      <motion.div
        className="lp-revenue-box"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <p className="lp-revenue-label">Uma barbearia com apenas 20 assinantes tem</p>
        <div className="lp-revenue-num">
          R$ {revenue.toLocaleString("pt-BR")}
        </div>
        <p className="lp-revenue-sub">garantidos por mês</p>
        <p className="lp-revenue-note">
          20 assinantes × R$ 120/mês — antes mesmo de abrir a porta.{" "}
          <span className="lp-revenue-highlight">Isso é receita previsível, não sorte.</span>
        </p>
      </motion.div>
      </div>
    </section>
  );
}
