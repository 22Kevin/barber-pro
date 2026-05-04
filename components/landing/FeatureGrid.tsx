"use client";
import { motion } from "framer-motion";

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="3" stroke="#C9A84C" strokeWidth="1.8" />
        <path d="M3 9h18M8 2v4M16 2v4" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 14h2M12 14h2M8 17.5h2M12 17.5h2M16 14h.5" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "Agenda Inteligente",
    problem: "Chega de conflito de horário",
    description: "Bloqueio automático de conflitos, reagendamento em 1 toque e notificações para o cliente — sem você precisar gerenciar nada.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="#C9A84C" strokeWidth="1.8" />
        <path d="M12 6v6l4 2" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 16s1 2 4 2 4-2 4-2" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "Assinatura Recorrente",
    problem: "Receita garantida todo mês",
    description: "Crie planos mensais, o cliente assina no app e a cobrança acontece automaticamente. Dinheiro na conta antes de abrir a porta.",
    highlight: true,
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 21h18" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "Financeiro em Tempo Real",
    problem: "Você sabe exatamente quanto entrou",
    description: "Caixa diário, faturamento semanal e mensal com gráficos claros. Sem planilha, sem calculadora, sem surpresa no fechamento.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 10h8M8 13.5h5" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: "WhatsApp Automático",
    problem: "Lembretes sem você digitar nada",
    description: "Confirmação de agendamento, lembrete 24h antes e mensagem pós-atendimento — tudo enviado automaticamente via WhatsApp.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#C9A84C" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    ),
    title: "Fidelidade que Retém",
    problem: "O cliente volta por conta própria",
    description: "Programa de pontos configurável: defina a regra, o app calcula e o cliente acompanha o saldo. Retenção no piloto automático.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="4" stroke="#C9A84C" strokeWidth="1.8" />
        <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M16 11l2 2 4-4" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Comissões Transparentes",
    problem: "Sem discussão no fechamento",
    description: "Cada barbeiro vê em tempo real quanto ganhou no dia, na semana e no mês. Relatório automático, sem conta manual.",
  },
];

export function FeatureGrid() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      style={{
        padding: "100px 24px",
        background: "#050505",
        position: "relative",
      }}
    >
      {/* Section header */}
      <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 64px" }}>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}
        >
          Funcionalidades
        </motion.p>
        <motion.h2
          id="features-heading"
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
          Seis problemas resolvidos{" "}
          <span style={{ color: "#888880", fontWeight: 400 }}>antes do meio-dia</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ color: "#888880", fontSize: 16, lineHeight: 1.6 }}
        >
          Cada funcionalidade foi construída para eliminar um problema real que custa dinheiro ou tempo ao barbeiro.
        </motion.p>
      </div>

      {/* Grid */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {features.map((feature, i) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            style={{
              background: feature.highlight ? "rgba(201,168,76,0.05)" : "#0A0A0A",
              border: feature.highlight
                ? "1px solid rgba(201,168,76,0.25)"
                : "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: "28px 28px 32px",
              position: "relative",
              overflow: "hidden",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "default",
            }}
            whileHover={{
              y: -4,
              boxShadow: feature.highlight
                ? "0 16px 48px rgba(201,168,76,0.15)"
                : "0 16px 48px rgba(0,0,0,0.4)",
            }}
          >
            {feature.highlight && (
              <div style={{
                position: "absolute", top: 16, right: 16,
                background: "rgba(201,168,76,0.15)",
                border: "1px solid rgba(201,168,76,0.3)",
                borderRadius: 100,
                padding: "3px 10px",
                fontSize: 11, fontWeight: 700, color: "#C9A84C", letterSpacing: 0.5,
              }}>
                DESTAQUE
              </div>
            )}
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "rgba(201,168,76,0.08)",
              border: "1px solid rgba(201,168,76,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              {feature.icon}
            </div>
            <p style={{ color: "#C9A84C", fontSize: 12, fontWeight: 600, letterSpacing: 0.5, marginBottom: 6 }}>
              {feature.problem}
            </p>
            <h3 style={{ color: "#F0EEE8", fontSize: 18, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 }}>
              {feature.title}
            </h3>
            <p style={{ color: "#888880", fontSize: 14, lineHeight: 1.65 }}>
              {feature.description}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
