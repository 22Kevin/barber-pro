"use client";
import { motion } from "framer-motion";

const benefits = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="#C9A84C" strokeWidth="1.8"/>
        <path d="M8 12l3 3 5-5" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Dinheiro na conta na hora",
    description: "Pix confirmado em segundos. Cartão aprovado na hora. O pagamento cai direto na sua conta Asaas — sem esperar D+2, sem intermediário segurando seu dinheiro.",
    highlight: true,
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="3" stroke="#C9A84C" strokeWidth="1.8"/>
        <path d="M2 10h20" stroke="#C9A84C" strokeWidth="1.8"/>
        <path d="M6 15h4M14 15h4" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: "Seus clientes pagam como quiserem",
    description: "Pix, cartão de crédito, débito ou boleto — o cliente escolhe na hora de agendar. Você não precisa ter maquininha, não precisa dar troco, não precisa cobrar.",
    highlight: false,
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="#C9A84C" strokeWidth="1.8" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Zero inadimplência nas assinaturas",
    description: "A cobrança dos planos mensais é automática. Se o cartão recusar, o sistema tenta de novo e notifica o cliente. Você não precisa ficar atrás de ninguém.",
    highlight: false,
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 21h18" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: "Tudo registrado automaticamente",
    description: "Cada pagamento vira uma linha no seu financeiro. Sem anotação no caderno, sem conferir o extrato manual. O relatório fecha sozinho.",
    highlight: false,
  },
];

const steps = [
  { num: "1", title: "Cliente acessa sua página", desc: "Entra no link da sua barbearia pelo celular, vê os serviços e escolhe o que quer." },
  { num: "2", title: "Escolhe como pagar", desc: "Pix, cartão de crédito, débito ou boleto. A tela de pagamento aparece direto no celular dele." },
  { num: "3", title: "Pagamento confirmado", desc: "Em segundos, você recebe a notificação no painel e o agendamento é confirmado automaticamente." },
  { num: "4", title: "Dinheiro na sua conta", desc: "O valor cai direto na sua conta Asaas, sem intermediário segurando." },
];

export function PaymentsSection() {
  return (
    <section id="pagamentos" aria-labelledby="pagamentos-heading" style={{ background: "#050505", position: "relative", overflow: "hidden" }}>
      {/* Subtle background glow */}
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(0,158,227,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div className="lp-section">
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 64px" }}>
          <motion.p
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}
          >
            Pagamentos Online
          </motion.p>
          <motion.h2
            id="pagamentos-heading"
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            style={{ color: "#F0EEE8", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, lineHeight: 1.15, letterSpacing: -1, marginBottom: 20 }}
          >
            Sem maquininha.{" "}
            <br />
            <span style={{ background: "linear-gradient(135deg, #C9A84C, #F0C060)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Sem cobrar cliente.
            </span>{" "}
            Sem esperar.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            style={{ color: "#888880", fontSize: 17, lineHeight: 1.7 }}
          >
            Integrado com o <strong style={{ color: "#C8C4BC" }}>Asaas</strong> — a plataforma financeira mais completa do Brasil —
            o Barber Pro transforma sua página em uma máquina de receber dinheiro 24 horas por dia.
          </motion.p>
        </div>

        {/* Benefits grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 64 }}>
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.09 }}
              style={{
                background: b.highlight ? "rgba(201,168,76,.05)" : "#0A0A0A",
                border: b.highlight ? "1px solid rgba(201,168,76,.25)" : "1px solid rgba(255,255,255,.06)",
                borderRadius: 16, padding: "24px",
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(201,168,76,.08)", border: "1px solid rgba(201,168,76,.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                {b.icon}
              </div>
              <h3 style={{ color: "#F0EEE8", fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{b.title}</h3>
              <p style={{ color: "#888880", fontSize: 14, lineHeight: 1.65 }}>{b.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Flow */}
        <motion.div
          initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,.06)", borderRadius: 20, padding: "40px 32px" }}
        >
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Como funciona</div>
            <h3 style={{ color: "#F0EEE8", fontSize: 22, fontWeight: 700 }}>Do celular do cliente para a sua conta em segundos</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 0, position: "relative" }}>
            {steps.map((s, i) => (
              <div key={s.num} style={{ textAlign: "center", padding: "0 16px", position: "relative" }}>
                {i < steps.length - 1 && (
                  <div style={{ position: "absolute", right: 0, top: 20, color: "rgba(201,168,76,.3)", fontSize: 20, display: "flex", alignItems: "center" }}>→</div>
                )}
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #C9A84C, #A07830)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", color: "#050505", fontSize: 15, fontWeight: 900 }}>
                  {s.num}
                </div>
                <div style={{ color: "#F0EEE8", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
                <div style={{ color: "#888880", fontSize: 13, lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
          {/* Asaas badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ width: 32, height: 32, background: "#009EE3", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>A</div>
            <p style={{ color: "#888880", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
              Processado pelo <strong style={{ color: "#C8C4BC" }}>Asaas</strong> — plataforma regulamentada pelo Banco Central, com split de pagamento automático e subconta criada para sua barbearia em minutos.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
