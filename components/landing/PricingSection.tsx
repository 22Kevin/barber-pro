"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const PLANS = [
  {
    key: "solo",
    label: "Solo",
    desc: "Para o barbeiro autônomo",
    badge: "👤 1 barbeiro",
    badgeGold: false,
    monthly: 49.90,
    annual: 478.80,
    highlight: false,
    href: "/admin/setup?plano=solo",
    included: [
      "Agendamento online 24h",
      "Pagamento Pix e cartão",
      "Programa de fidelidade",
      "App mobile",
      "Lembretes automáticos",
      "Dashboard financeiro básico",
      "Despesas e controle de lucros",
      "Relatórios simplificados",
      "Página pública da barbearia",
    ],
    locked: [
      "Múltiplos barbeiros",
      "Produtos e estoque",
      "Encomendas e cupons",
      "Relatórios completos + CSV",
      "Planos de assinatura p/ clientes",
    ],
  },
  {
    key: "team",
    label: "Equipe",
    desc: "Para barbearias com equipe",
    badge: "👥 Até 3 barbeiros",
    badgeGold: true,
    monthly: 99.90,
    annual: 958.80,
    highlight: true,
    href: "/admin/setup?plano=team",
    included: [
      "Até 3 barbeiros",
      "Agendamento online 24h",
      "Pagamento Pix e cartão",
      "Programa de fidelidade",
      "App mobile",
      "Lembretes automáticos",
      "Dashboard financeiro completo",
      "Despesas e controle de lucros",
      "Relatórios completos + CSV",
      "Página pública da barbearia",
      "Produtos e estoque",
      "Fornecedores",
      "Encomendas",
      "Planos de assinatura p/ clientes",
      "Cupons e promoções",
    ],
    locked: [
      "Comissões por barbeiro",
      "Radar de Leads",
      "Suporte prioritário",
    ],
  },
  {
    key: "studio",
    label: "Estúdio",
    desc: "Para grandes barbearias",
    badge: "👥 Ilimitado",
    badgeGold: false,
    monthly: 169.90,
    annual: 1630.80,
    highlight: false,
    href: "/admin/setup?plano=studio",
    included: [
      "Barbeiros ilimitados",
      "Comissões automáticas",
      "Radar de Leads",
      "Suporte prioritário",
      "Agendamento online 24h",
      "Pagamento Pix e cartão",
      "Programa de fidelidade",
      "App mobile",
      "Lembretes automáticos",
      "Dashboard financeiro completo",
      "Despesas e controle de lucros",
      "Relatórios completos + CSV",
      "Página pública da barbearia",
      "Produtos e estoque",
      "Fornecedores",
      "Encomendas",
      "Planos de assinatura p/ clientes",
      "Cupons e promoções",
    ],
    locked: [],
  },
] as const;

function fmt(n: number) {
  return "R$\u00a0" + n.toFixed(2).replace(".", ",");
}

function useCountdown(targetDate: Date) {
  const [diff, setDiff] = useState(Math.max(0, targetDate.getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDiff(Math.max(0, targetDate.getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, expired: diff === 0 };
}

function TimerUnit({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      background: "#0A0A0A",
      border: "1px solid rgba(201,168,76,0.25)",
      borderRadius: 8,
      padding: "5px 8px",
      textAlign: "center",
      minWidth: 44,
    }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: "#C9A84C", display: "block", lineHeight: 1 }}>
        {String(value).padStart(2, "0")}
      </span>
      <span style={{ fontSize: 9, color: "#6A5A2A", marginTop: 2, display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </span>
    </div>
  );
}

function Dot() {
  return <span style={{ color: "#C9A84C", fontSize: 18, opacity: 0.4, fontWeight: 500 }}>:</span>;
}

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  // Timer: 30 dias a partir do primeiro render (substituir pela data real de lançamento)
  const deadline = useRef(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const { d, h, m, s, expired } = useCountdown(deadline.current);

  return (
    <section
      id="precos"
      aria-labelledby="pricing-heading"
      style={{ background: "#0A0A0A", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}
          >
            Planos
          </motion.p>
          <motion.h2
            id="pricing-heading"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: "clamp(28px,5vw,40px)", fontWeight: 800, color: "#F0EEE8", marginBottom: 12 }}
          >
            Planos que cabem no seu bolso
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            style={{ fontSize: 16, color: "#666", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}
          >
            Comece grátis por 14 dias. Sem cartão de crédito. Cancele quando quiser.
          </motion.p>
        </div>

        {/* Banner de lançamento */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            background: "#120D00",
            border: "1px solid rgba(201,168,76,0.35)",
            borderRadius: 14,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap" as const,
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>🚀</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#F0EEE8" }}>
                Oferta de lançamento — 2 meses grátis no plano anual
              </div>
              <div style={{ fontSize: 12, color: "#8A7A4A", marginTop: 2 }}>
                Somente nos primeiros 30 dias após o lançamento oficial
              </div>
            </div>
          </div>
          {expired ? (
            <span style={{ fontSize: 13, color: "#C9A84C", fontWeight: 600 }}>Oferta encerrada</span>
          ) : (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <TimerUnit value={d} label="dias" />
              <Dot />
              <TimerUnit value={h} label="horas" />
              <Dot />
              <TimerUnit value={m} label="min" />
              <Dot />
              <TimerUnit value={s} label="seg" />
            </div>
          )}
        </motion.div>

        {/* Toggle mensal/anual */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 40 }}>
          <span style={{ fontSize: 14, fontWeight: annual ? 400 : 600, color: annual ? "#666" : "#F0EEE8", transition: "all .2s" }}>
            Mensal
          </span>
          <div
            role="switch"
            aria-checked={annual}
            tabIndex={0}
            onClick={() => setAnnual(a => !a)}
            onKeyDown={(e) => e.key === "Enter" || e.key === " " ? setAnnual(a => !a) : null}
            style={{
              position: "relative",
              width: 52,
              height: 28,
              background: annual ? "rgba(201,168,76,0.12)" : "#1A1A1A",
              border: `1px solid ${annual ? "rgba(201,168,76,0.5)" : "#2A2A2A"}`,
              borderRadius: 99,
              cursor: "pointer",
              transition: "all .2s",
            }}
          >
            <div style={{
              position: "absolute",
              top: 4,
              left: 4,
              width: 18,
              height: 18,
              background: annual ? "#C9A84C" : "#3A3A3A",
              borderRadius: "50%",
              transform: annual ? "translateX(24px)" : "translateX(0)",
              transition: "all .2s",
            }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: annual ? 600 : 400, color: annual ? "#F0EEE8" : "#666", transition: "all .2s" }}>
            Anual
          </span>
          {annual && (
            <span style={{
              background: "rgba(34,197,94,.12)",
              color: "#4ADE80",
              border: "1px solid rgba(34,197,94,.2)",
              fontSize: 12,
              fontWeight: 500,
              padding: "3px 12px",
              borderRadius: 99,
            }}>
              2 meses grátis
            </span>
          )}
        </div>

        {/* Grid de planos */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          maxWidth: 1000,
          margin: "0 auto 40px",
        }}>
          {PLANS.map((plan, i) => {
            const monthlyPrice = annual ? plan.annual / 12 : plan.monthly;
            const savings = Math.round(plan.monthly * 12 - plan.annual);

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{
                  background: plan.highlight ? "#120E00" : "#111",
                  border: plan.highlight ? "2px solid rgba(201,168,76,0.45)" : "1px solid #222",
                  borderRadius: 16,
                  padding: "28px 24px",
                  position: "relative" as const,
                }}
              >
                {/* Badge "Mais popular" */}
                {plan.highlight && (
                  <div style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#C9A84C",
                    color: "#0A0A0A",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 14px",
                    borderRadius: 99,
                    whiteSpace: "nowrap",
                  }}>
                    ⭐ Mais popular
                  </div>
                )}

                {/* Nome e descrição */}
                <div style={{ fontSize: 16, fontWeight: 700, color: "#F0EEE8", marginBottom: 4 }}>{plan.label}</div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 14 }}>{plan.desc}</div>

                {/* Badge de barbeiros */}
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: plan.badgeGold ? "rgba(201,168,76,0.08)" : "#1A1A1A",
                  border: `1px solid ${plan.badgeGold ? "rgba(201,168,76,0.2)" : "#2A2A2A"}`,
                  borderRadius: 99,
                  padding: "4px 12px",
                  fontSize: 12,
                  color: plan.badgeGold ? "#C9A84C" : "#888",
                  marginBottom: 16,
                }}>
                  {plan.badge}
                </div>

                {/* Preço */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                  {annual && (
                    <span style={{ fontSize: 13, color: "#444", textDecoration: "line-through" }}>
                      {fmt(plan.monthly)}
                    </span>
                  )}
                  <span style={{ fontSize: 28, fontWeight: 700, color: plan.highlight ? "#C9A84C" : "#F0EEE8" }}>
                    {fmt(monthlyPrice)}
                  </span>
                  <span style={{ fontSize: 12, color: "#555" }}>/mês</span>
                </div>

                {/* Economia anual */}
                <div style={{ fontSize: 11, color: "#4ADE80", minHeight: 16, marginBottom: 18 }}>
                  {annual
                    ? `${fmt(plan.annual)}/ano — economize R$\u00a0${savings}`
                    : ""}
                </div>

                {/* CTA */}
                <a
                  href={plan.href}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: 11,
                    borderRadius: 10,
                    background: plan.highlight ? "#C9A84C" : "#1A1A1A",
                    border: plan.highlight ? "none" : "1px solid #2A2A2A",
                    color: plan.highlight ? "#0A0A0A" : "#C9A84C",
                    fontSize: 13,
                    fontWeight: plan.highlight ? 700 : 600,
                    textDecoration: "none",
                    marginBottom: 20,
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = plan.highlight ? "#B8973B" : "#222";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = plan.highlight ? "#C9A84C" : "#1A1A1A";
                  }}
                >
                  Testar 14 dias grátis ↗
                </a>

                <hr style={{ border: "none", borderTop: `1px solid ${plan.highlight ? "rgba(201,168,76,0.12)" : "#1A1A1A"}`, marginBottom: 14 }} />

                {/* Features incluídas */}
                {plan.included.length > 0 && (
                  <>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: plan.highlight ? "rgba(201,168,76,0.4)" : "#444",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 10,
                    }}>
                      {plan.key === "studio" ? "Tudo do Equipe, mais" : "Incluso"}
                    </div>
                    {plan.included.map((f) => (
                      <div key={f} style={{ fontSize: 12, color: "#CCC", padding: "3px 0", display: "flex", gap: 7 }}>
                        <span style={{ color: "#C9A84C" }}>✓</span> {f}
                      </div>
                    ))}
                  </>
                )}

                {/* Features bloqueadas */}
                {plan.locked.length > 0 && (
                  <>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: plan.highlight ? "rgba(201,168,76,0.4)" : "#444",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      margin: "12px 0 8px",
                    }}>
                      Bloqueado
                    </div>
                    {plan.locked.map((f) => (
                      <div key={f} style={{ fontSize: 12, color: "#333", padding: "3px 0", display: "flex", gap: 7 }}>
                        🔒 {f}
                      </div>
                    ))}
                  </>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Linha de confiança */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            flexWrap: "wrap" as const,
            paddingTop: 28,
            borderTop: "1px solid #1A1A1A",
          }}
        >
          {[
            "📅 14 dias grátis",
            "💳 Sem cartão no trial",
            "🔒 Pagamento seguro via Asaas",
            "↩ Cancele quando quiser",
          ].map((item) => (
            <span key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}>
              {item}
            </span>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
