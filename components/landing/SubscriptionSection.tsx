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
    title: "Você monta o plano em 2 minutos",
    description: "Dá o nome, escolhe os serviços incluídos e define o preço. O sistema calcula o desconto ideal automaticamente.",
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
    title: "O cliente assina pelo celular",
    description: "Acessa a página da sua barbearia, escolhe o plano e paga com Pix, cartão ou boleto — tudo pelo celular, sem você precisar cobrar.",
    detail: "Pagamento 100% online via Asaas",
  },
  {
    number: "03",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 4C8.477 4 4 8.477 4 14s4.477 10 10 10 10-4.477 10-10S19.523 4 14 4z" stroke="#C9A84C" strokeWidth="1.8" />
        <path d="M10 14l3 3 6-6" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Dinheiro na conta. Todo mês. Automático.",
    description: "Na data certa, o sistema cobra o cliente sem você precisar fazer nada. Você acorda com a receita já garantida.",
    detail: "Notificação em tempo real no painel",
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

const proofPoints = [
  { icon: "📅", text: "Corte garantido todo mês, sem o cliente precisar lembrar" },
  { icon: "📲", text: "Cliente agenda pelo celular, você só aparece e trabalha" },
  { icon: "💸", text: "Receita previsível mesmo em semanas paradas" },
  { icon: "🔄", text: "Cobrança automática — zero inadimplência manual" },
  { icon: "📊", text: "Acompanhe quantos assinantes e quanto entra por mês" },
  { icon: "❌", text: "Sem contrato. O cliente cancela quando quiser" },
];

export function SubscriptionSection() {
  const [counterStarted, setCounterStarted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const revenue = useCountUp(4200, 1800, counterStarted);
  const subs = useCountUp(35, 1600, counterStarted);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCounterStarted(true); },
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="subscription" ref={sectionRef} aria-labelledby="subscription-heading" style={{ background: "#030303" }}>
      <div className="lp-section">

        {/* Headline */}
        <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 64px" }}>
          <motion.p
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}
          >
            Programa de Assinatura
          </motion.p>
          <motion.h2
            id="subscription-heading"
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            style={{ color: "#F0EEE8", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, lineHeight: 1.15, letterSpacing: -1, marginBottom: 20 }}
          >
            Pare de acordar sem saber{" "}
            <span style={{ background: "linear-gradient(135deg, #C9A84C, #F0C060)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              quanto vai entrar.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            style={{ color: "#888880", fontSize: 17, lineHeight: 1.7 }}
          >
            Com o programa de assinatura do Barber Pro, você transforma clientes avulsos em receita garantida.{" "}
            <strong style={{ color: "#C8C4BC" }}>O dinheiro cai na conta antes de você abrir a porta.</strong>
          </motion.p>
        </div>

        {/* Steps */}
        <div className="lp-steps" style={{ marginBottom: 64 }}>
          {steps.map((step, i) => (
            <>
              <motion.div
                key={step.number}
                className="lp-step-card"
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
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
          initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ marginBottom: 56 }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 48, marginBottom: 24 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#888880", fontSize: 13, marginBottom: 8 }}>Com apenas</div>
              <div style={{ color: "#F0EEE8", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, letterSpacing: -2, lineHeight: 1 }}>
                {subs}
              </div>
              <div style={{ color: "#888880", fontSize: 14, marginTop: 4 }}>assinantes</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", color: "#C9A84C", fontSize: 32 }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#888880", fontSize: 13, marginBottom: 8 }}>você garante</div>
              <div style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", fontWeight: 900, letterSpacing: -3, lineHeight: 1, background: "linear-gradient(135deg, #C9A84C, #F0C060)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                R$ {revenue.toLocaleString("pt-BR")}
              </div>
              <div style={{ color: "#888880", fontSize: 14, marginTop: 4 }}>todo mês, no automático</div>
            </div>
          </div>
          <p style={{ color: "#555550", fontSize: 13, lineHeight: 1.6, maxWidth: 520, margin: "0 auto" }}>
            35 assinantes × R$ 120/mês — antes mesmo de atender o primeiro cliente do dia.{" "}
            <span style={{ color: "#C9A84C", fontStyle: "italic" }}>Isso é receita previsível, não sorte.</span>
          </p>
        </motion.div>

        {/* Proof points grid */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}
        >
          {proofPoints.map((p, i) => (
            <motion.div
              key={p.text}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#0A0A0A", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12, padding: "14px 16px" }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{p.icon}</span>
              <span style={{ color: "#C8C4BC", fontSize: 14, lineHeight: 1.5 }}>{p.text}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
