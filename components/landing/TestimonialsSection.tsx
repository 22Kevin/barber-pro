"use client";
import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Ricardo Alves",
    role: "Proprietário — Barbearia Corte & Arte",
    city: "São Paulo, SP",
    avatar: "RA",
    avatarColor: "#1A3A2A",
    stars: 5,
    text: "Antes eu perdia pelo menos 3 clientes por semana por conflito de horário. Hoje o sistema bloqueia tudo automaticamente. E o programa de assinatura? Tenho 28 assinantes — são R$ 3.360 garantidos todo mês antes de eu abrir a porta.",
  },
  {
    name: "Marcos Ferreira",
    role: "Barbeiro — Studio MF",
    city: "Belo Horizonte, MG",
    avatar: "MF",
    avatarColor: "#1A1A3A",
    stars: 5,
    text: "O WhatsApp automático mudou tudo. Antes eu ficava lembrando cliente manualmente. Agora o sistema manda confirmação, lembrete 24h antes e ainda pede avaliação depois. Minha taxa de no-show caiu de 30% para menos de 5%.",
  },
  {
    name: "Felipe Souza",
    role: "Sócio — Barber House Premium",
    city: "Curitiba, PR",
    avatar: "FS",
    avatarColor: "#3A1A1A",
    stars: 5,
    text: "O relatório financeiro em tempo real foi o que mais me impressionou. Antes eu não sabia quanto tinha faturado no dia sem fazer conta no papel. Agora abro o app e vejo tudo: faturamento, comissões por barbeiro, produtos vendidos. Profissional de verdade.",
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#C9A84C">
          <path d="M7 1l1.545 3.13 3.455.502-2.5 2.437.59 3.44L7 8.885 3.91 10.51l.59-3.44L2 4.632l3.455-.502L7 1z" />
        </svg>
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      style={{
        padding: "100px 24px",
        background: "#050505",
        position: "relative",
      }}
    >
      {/* Section header */}
      <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto 64px" }}>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}
        >
          Depoimentos
        </motion.p>
        <motion.h2
          id="testimonials-heading"
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
          }}
        >
          Quem usa, não volta{" "}
          <span style={{ color: "#888880", fontWeight: 400 }}>para o papel</span>
        </motion.h2>
      </div>

      {/* Cards */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {testimonials.map((t, i) => (
          <motion.blockquote
            key={t.name}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: i * 0.1 }}
            style={{
              background: "#0A0A0A",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16,
              padding: "28px",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <Stars count={t.stars} />
            <p style={{
              color: "#C8C4BC",
              fontSize: 15,
              lineHeight: 1.7,
              fontStyle: "normal",
              flex: 1,
            }}>
              "{t.text}"
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: t.avatarColor,
                border: "1px solid rgba(201,168,76,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#C9A84C",
                flexShrink: 0,
              }}>
                {t.avatar}
              </div>
              <div>
                <div style={{ color: "#F0EEE8", fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                <div style={{ color: "#888880", fontSize: 12, marginTop: 2 }}>{t.role}</div>
                <div style={{ color: "#555550", fontSize: 11, marginTop: 1 }}>{t.city}</div>
              </div>
            </div>
          </motion.blockquote>
        ))}
      </div>
    </section>
  );
}
