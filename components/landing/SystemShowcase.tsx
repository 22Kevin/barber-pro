"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const tabs = [
  { id: "agenda", label: "Agenda", icon: "📅" },
  { id: "financeiro", label: "Financeiro", icon: "💰" },
  { id: "pagamentos", label: "Pagamentos Online", icon: "💳" },
  { id: "assinaturas", label: "Planos de Assinatura", icon: "⭐" },
  { id: "pagina", label: "Página da Barbearia", icon: "🌐" },
];

function AgendaMockup() {
  return (
    <div style={{ background: "#0A0A0A", borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0A0A0A", padding: "10px 14px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#F0EEE8", fontSize: 14, fontWeight: 700 }}>Agenda</div>
          <div style={{ color: "#555", fontSize: 10, marginTop: 1 }}>22/05/2026 · 12 agendamentos</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ background: "rgba(201,168,76,.15)", border: "1px solid rgba(201,168,76,.3)", borderRadius: 6, padding: "4px 10px", color: "#C9A84C", fontSize: 10, fontWeight: 700 }}>Linha do tempo</div>
          <div style={{ background: "#C9A84C", borderRadius: 6, padding: "4px 10px", color: "#0A0A0A", fontSize: 10, fontWeight: 700 }}>+ Agendar</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: 14 }}>
        {[
          { barber: "João Silva", apts: [
            { time: "08:00", client: "Matheus Lima", svc: "Corte Simples · 30min", price: "R$ 30", status: "done", color: "#22C55E" },
            { time: "09:00", client: "Rafael Mendes", svc: "Corte + Barba · 60min", price: "R$ 55", status: "confirmed", color: "#60A5FA" },
            { time: "10:30", client: "Lucas Carvalho", svc: "Corte Social · 30min", price: "R$ 35", status: "progress", color: "#FCD34D" },
          ]},
          { barber: "Carlos Rocha", apts: [
            { time: "09:00", client: "André Batista", svc: "Corte + Barba · 60min", price: "R$ 55", status: "done", color: "#22C55E" },
            { time: "11:00", client: "Bruno Ferreira", svc: "Degradê · 45min", price: "R$ 40", status: "progress", color: "#FCD34D" },
            { time: "15:00", client: "Paulo Henrique", svc: "Corte Social · 30min", price: "R$ 35", status: "scheduled", color: "#C4B5FD" },
          ]},
          { barber: "Pedro Alves", apts: [
            { time: "10:00", client: "Felipe Nunes", svc: "Corte Simples · 30min", price: "R$ 30", status: "done", color: "#22C55E" },
            { time: "14:00", client: "Gabriel Souza", svc: "Degradê · 45min", price: "R$ 45", status: "scheduled", color: "#C4B5FD" },
          ]},
        ].map((col) => (
          <div key={col.barber} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(201,168,76,.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#C9A84C", fontSize: 10, fontWeight: 700 }}>
                {col.barber.split(" ").map(w => w[0]).join("")}
              </div>
              <div style={{ color: "#F0EEE8", fontSize: 11, fontWeight: 700 }}>{col.barber}</div>
            </div>
            {col.apts.map((a) => (
              <div key={a.time} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "stretch" }}>
                <div style={{ color: "#555", fontSize: 9, minWidth: 36, paddingTop: 3 }}>{a.time}</div>
                <div style={{ width: 2, background: "#1e1e1e", position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: a.color, position: "absolute", left: -2, top: 4 }} />
                </div>
                <div style={{ flex: 1, borderRadius: 6, padding: "5px 8px", background: `${a.color}0a`, borderLeft: `2px solid ${a.color}` }}>
                  <div style={{ color: "#F0EEE8", fontSize: 10, fontWeight: 700 }}>{a.client}</div>
                  <div style={{ color: "#555", fontSize: 9, marginTop: 1 }}>{a.svc}</div>
                  <div style={{ color: "#C9A84C", fontSize: 9, fontWeight: 700, marginTop: 2 }}>{a.price}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceiroMockup() {
  return (
    <div style={{ background: "#0A0A0A", borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0A0A0A", padding: "10px 14px", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#F0EEE8", fontSize: 14, fontWeight: 700 }}>Financeiro</div>
          <div style={{ color: "#555", fontSize: 10, marginTop: 1 }}>maio 2026</div>
        </div>
        <div style={{ background: "#1a1a1a", border: "1px solid #252525", borderRadius: 6, padding: "4px 10px", color: "#888", fontSize: 10 }}>Exportar CSV</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          {[
            { val: "R$ 12.480", label: "Receita total", color: "#22C55E", trend: "+18% vs abril" },
            { val: "R$ 2.150", label: "Despesas", color: "#EF4444", trend: "+5% vs abril" },
            { val: "R$ 10.330", label: "Lucro líquido", color: "#C9A84C", trend: "margem 82%" },
            { val: "R$ 94", label: "Ticket médio", color: "#F0EEE8", trend: "132 vendas" },
          ].map((m) => (
            <div key={m.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.val}</div>
              <div style={{ color: "#555", fontSize: 9, marginTop: 2 }}>{m.label}</div>
              <div style={{ color: "#22C55E", fontSize: 9, marginTop: 3 }}>{m.trend}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
          <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: 12 }}>
            <div style={{ color: "#555", fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Transações recentes</div>
            {[
              { name: "Corte + Barba — Rafael Mendes", meta: "Pix · João Silva", val: "+R$ 55,00", pos: true },
              { name: "Degradê — Gabriel Souza", meta: "Crédito · Carlos Rocha", val: "+R$ 45,00", pos: true },
              { name: "Corte Social — Online (Asaas)", meta: "Pagamento online · Lucas", val: "+R$ 35,00", pos: true },
              { name: "Assinatura Plano Ouro — Bruno F.", meta: "Asaas · recorrente", val: "+R$ 250,00", pos: true },
              { name: "Aluguel da loja — maio", meta: "Despesa · 01/05/2026", val: "−R$ 1.200,00", pos: false },
            ].map((t) => (
              <div key={t.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                <div>
                  <div style={{ color: "#F0EEE8", fontSize: 10, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ color: "#555", fontSize: 9, marginTop: 1 }}>{t.meta}</div>
                </div>
                <div style={{ color: t.pos ? "#22C55E" : "#EF4444", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", marginLeft: 8 }}>{t.val}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: 12 }}>
            <div style={{ color: "#555", fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Por forma de pagamento</div>
            {[
              { label: "Pix", val: "R$ 5.840", pct: 100, color: "#32BCAD" },
              { label: "Dinheiro", val: "R$ 3.120", pct: 53, color: "#22C55E" },
              { label: "Crédito", val: "R$ 2.100", pct: 36, color: "#7C3AED" },
              { label: "Online (Asaas)", val: "R$ 600", pct: 10, color: "#009EE3" },
            ].map((p) => (
              <div key={p.label} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "#888", fontSize: 10 }}>{p.label}</span>
                  <span style={{ color: "#C9A84C", fontSize: 10, fontWeight: 700 }}>{p.val}</span>
                </div>
                <div style={{ background: "#1a1a1a", borderRadius: 3, height: 5 }}>
                  <div style={{ background: p.color, width: `${p.pct}%`, height: "100%", borderRadius: 3 }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1a1a1a" }}>
              <div style={{ color: "#555", fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 5 }}>Meta do mês</div>
              <div style={{ background: "#1a1a1a", borderRadius: 5, height: 7, overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(90deg,#C9A84C,#A07830)", width: "74%", height: "100%", borderRadius: 5 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ color: "#555", fontSize: 9 }}>Meta: R$ 16.800</span>
                <span style={{ color: "#C9A84C", fontSize: 9, fontWeight: 700 }}>74% atingido</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PagamentosMockup() {
  return (
    <div style={{ background: "#0A0A0A", borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0A0A0A", padding: "10px 14px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ color: "#F0EEE8", fontSize: 14, fontWeight: 700 }}>Pagamentos Online</div>
        <div style={{ color: "#555", fontSize: 10, marginTop: 1 }}>Integração Asaas — subconta vinculada</div>
      </div>
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[
              { val: "R$ 4.800", label: "Recebido online", color: "#22C55E" },
              { val: "47", label: "Transações", color: "#C9A84C" },
            ].map(m => (
              <div key={m.label} style={{ flex: 1, background: "#111", border: "1px solid #1e1e1e", borderRadius: 9, padding: "10px 12px" }}>
                <div style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.val}</div>
                <div style={{ color: "#555", fontSize: 9, marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#111", border: "1px solid rgba(0,158,227,.2)", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, background: "#009EE3", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 900 }}>A</div>
              <div>
                <div style={{ color: "#F0EEE8", fontSize: 12, fontWeight: 700 }}>Asaas</div>
                <div style={{ color: "#555", fontSize: 10 }}>Subconta vinculada automaticamente</div>
              </div>
              <div style={{ marginLeft: "auto", background: "rgba(74,222,128,.12)", color: "#4ADE80", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>Ativo</div>
            </div>
            {[
              { icon: "💳", label: "Cartão de crédito/débito", ok: true },
              { icon: "⚡", label: "Pix instantâneo", ok: true },
              { icon: "📄", label: "Boleto bancário", ok: true },
              { icon: "🔄", label: "Cobrança recorrente", ok: true },
            ].map(f => (
              <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #1a1a1a" }}>
                <span style={{ fontSize: 12 }}>{f.icon}</span>
                <span style={{ color: "#888", fontSize: 10, flex: 1 }}>{f.label}</span>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(74,222,128,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l2 2 3-3" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ color: "#555", fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Últimos pagamentos online</div>
            {[
              { name: "Carlos Silva", svc: "Corte + Barba", val: "R$ 55,00", method: "Pix", status: "Pago", color: "#22C55E" },
              { name: "Bruno Fernandes", svc: "Assinatura Ouro", val: "R$ 250,00", method: "Cartão", status: "Pago", color: "#22C55E" },
              { name: "Diego Martins", svc: "Degradê", val: "R$ 40,00", method: "Pix", status: "Pago", color: "#22C55E" },
              { name: "Rafael Costa", svc: "Assinatura Prata", val: "R$ 150,00", method: "Boleto", status: "Aguardando", color: "#FCD34D" },
            ].map(p => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                <div>
                  <div style={{ color: "#F0EEE8", fontSize: 10, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ color: "#555", fontSize: 9, marginTop: 1 }}>{p.svc} · {p.method}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#C9A84C", fontSize: 10, fontWeight: 700 }}>{p.val}</div>
                  <div style={{ color: p.color, fontSize: 9, marginTop: 1 }}>{p.status}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(201,168,76,.06)", border: "1px solid rgba(201,168,76,.2)", borderRadius: 10, padding: 12 }}>
            <div style={{ color: "#C9A84C", fontSize: 10, fontWeight: 700, marginBottom: 6 }}>💡 Como funciona</div>
            <p style={{ color: "#888", fontSize: 10, lineHeight: 1.6, margin: 0 }}>
              Seu cliente acessa a página da barbearia, escolhe o serviço e paga com Pix, cartão ou boleto. O dinheiro cai direto na sua conta Asaas — sem intermediário, sem espera.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssinaturasMockup() {
  return (
    <div style={{ background: "#0A0A0A", borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0A0A0A", padding: "10px 14px", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#F0EEE8", fontSize: 14, fontWeight: 700 }}>Planos de Assinatura</div>
          <div style={{ color: "#555", fontSize: 10, marginTop: 1 }}>4 planos ativos · 47 assinantes · R$ 4.230/mês garantidos</div>
        </div>
        <div style={{ background: "#C9A84C", borderRadius: 6, padding: "4px 10px", color: "#0A0A0A", fontSize: 10, fontWeight: 700 }}>+ Novo plano</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { val: "47", label: "Assinantes ativos", color: "#22C55E" },
            { val: "R$ 4.230", label: "Receita mensal garantida", color: "#C9A84C" },
            { val: "R$ 89", label: "Ticket médio/assinante", color: "#F0EEE8" },
          ].map(m => (
            <div key={m.label} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 9, padding: "10px 12px" }}>
              <div style={{ color: m.color, fontSize: 16, fontWeight: 800 }}>{m.val}</div>
              <div style={{ color: "#555", fontSize: 9, marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { name: "Plano Platina", price: "R$ 300", rec: 6, subs: 1, svcs: "Barba, Alisamento, Corte+Barba+Sobrancelha, Pintura", highlight: false },
            { name: "Plano Bronze", price: "R$ 100", rec: 2, subs: 0, svcs: "Barba, Corte + Barba + Sobrancelha", highlight: false },
            { name: "Plano Prata", price: "R$ 150", rec: 2, subs: 0, svcs: "Barba, Corte+Barba+Sobrancelha, Pintura", highlight: false },
            { name: "Plano Ouro", price: "R$ 250", rec: 4, subs: 3, svcs: "Alisamento, Barba, Corte+Barba+Sobrancelha, Pintura", highlight: true },
          ].map(p => (
            <div key={p.name} style={{ background: "#111", border: `1px solid ${p.highlight ? "rgba(201,168,76,.35)" : "#1e1e1e"}`, borderRadius: 10, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                <div style={{ color: "#F0EEE8", fontSize: 11, fontWeight: 700 }}>{p.name}</div>
                <div style={{ background: "rgba(74,222,128,.12)", color: "#4ADE80", fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 5 }}>Ativo</div>
              </div>
              <div style={{ color: "#C9A84C", fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{p.price}<span style={{ color: "#555", fontSize: 9, fontWeight: 400 }}>/mês</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", background: "#1A1A1A", borderRadius: 6, padding: 6, marginBottom: 6, gap: 2 }}>
                <div style={{ textAlign: "center" }}><div style={{ color: "#F0EEE8", fontSize: 12, fontWeight: 700 }}>{p.rec}</div><div style={{ color: "#555", fontSize: 7 }}>Recorr.</div></div>
                <div style={{ textAlign: "center", borderLeft: "1px solid #2E2E2E", borderRight: "1px solid #2E2E2E" }}><div style={{ color: "#F0EEE8", fontSize: 12, fontWeight: 700 }}>4</div><div style={{ color: "#555", fontSize: 7 }}>Serviços</div></div>
                <div style={{ textAlign: "center" }}><div style={{ color: p.subs > 0 ? "#4ADE80" : "#F87171", fontSize: 12, fontWeight: 700 }}>{p.subs}</div><div style={{ color: "#555", fontSize: 7 }}>Assin.</div></div>
              </div>
              <div style={{ color: "#888", fontSize: 8, marginBottom: 8, lineHeight: 1.4 }}>{p.svcs}</div>
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ flex: 1, background: "#1A1A1A", border: "1px solid #2E2E2E", borderRadius: 6, padding: "4px 0", textAlign: "center", color: "#888", fontSize: 8 }}>Editar</div>
                <div style={{ flex: 1, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.2)", borderRadius: 6, padding: "4px 0", textAlign: "center", color: "#F87171", fontSize: 8 }}>Desativar</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaginaMockup() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#0A0A0A", borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e" }}>
        <div style={{ background: "#0A0A0A", padding: "10px 14px", borderBottom: "1px solid #1a1a1a" }}>
          <div style={{ color: "#F0EEE8", fontSize: 13, fontWeight: 700 }}>Editor de Aparência</div>
          <div style={{ color: "#555", fontSize: 10, marginTop: 1 }}>Personalize cores, tipografia e fotos</div>
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ color: "#555", fontSize: 8, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 5 }}>Cor principal</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {["#C9A84C","#E63946","#2196F3","#4CAF50","#9C27B0","#FF5722","#00BCD4","#FF9800","#607D8B","#000","#fff"].map((c, i) => (
              <div key={c} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: i === 4 ? "2px solid #fff" : c === "#fff" ? "1px solid #333" : "none", cursor: "pointer" }} />
            ))}
          </div>
          <div style={{ color: "#555", fontSize: 8, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 5 }}>Estilo de texto</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
            {[
              { label: "Moderno", style: {}, active: true },
              { label: "Clássico", style: { fontFamily: "Georgia, serif" }, active: false },
              { label: "Bold", style: { fontWeight: 900 }, active: false },
              { label: "Elegante", style: { fontStyle: "italic" }, active: false },
              { label: "Minimal", style: { fontWeight: 200, letterSpacing: ".05em" }, active: false },
              { label: "Urbano", style: { fontWeight: 900, textTransform: "uppercase" as const, fontSize: 9 }, active: false },
            ].map(s => (
              <div key={s.label} style={{ background: s.active ? "rgba(201,168,76,.08)" : "#1A1A1A", border: `1px solid ${s.active ? "#C9A84C" : "#2E2E2E"}`, borderRadius: 6, padding: "5px", textAlign: "center", cursor: "pointer" }}>
                <div style={{ color: s.active ? "#C9A84C" : "#F2F0EA", fontSize: 10, ...s.style }}>Barber</div>
                <div style={{ color: "#555", fontSize: 7, marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ color: "#555", fontSize: 8, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 5 }}>Logo e banner</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 10 }}>
            {["Logo", "Banner"].map(l => (
              <div key={l} style={{ background: "#1A1A1A", border: "1px dashed #2E2E2E", borderRadius: 7, padding: 9, textAlign: "center" }}>
                <div style={{ color: "#555", fontSize: 16 }}>+</div>
                <div style={{ color: "#555", fontSize: 8, marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "#C9A84C", borderRadius: 7, padding: "8px", textAlign: "center", color: "#0A0A0A", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Salvar aparência</div>
        </div>
      </div>
      <div style={{ background: "#1a1a2e", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(155,48,255,.2)", position: "relative" }}>
        <div style={{ position: "absolute", top: 7, right: 7, zIndex: 10, background: "rgba(201,168,76,.12)", border: "1px solid rgba(201,168,76,.25)", borderRadius: 5, padding: "2px 8px" }}>
          <span style={{ color: "#C9A84C", fontSize: 8, fontWeight: 700, letterSpacing: ".06em" }}>PRÉVIA AO VIVO</span>
        </div>
        <div style={{ background: "rgba(10,10,10,.93)", padding: "0 12px", height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(155,48,255,.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#0d0d1e", border: "2px solid #9C27B0", display: "flex", alignItems: "center", justifyContent: "center", color: "#9C27B0", fontSize: 10, fontWeight: 900 }}>M</div>
            <span style={{ color: "#F0EEE8", fontSize: 11, fontWeight: 700 }}>Mogiana</span>
          </div>
          <div style={{ background: "#9C27B0", color: "rgba(10,10,10,.9)", fontSize: 9, fontWeight: 800, border: "none", borderRadius: 50, padding: "4px 11px" }}>Entrar</div>
        </div>
        <div style={{ background: "#1a1a2e", padding: "16px 12px 12px", textAlign: "center", borderBottom: "1px solid rgba(155,48,255,.1)" }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: "#0d0d1e", border: "2px solid #9C27B0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", color: "#9C27B0", fontSize: 18, fontWeight: 900 }}>M</div>
          <div style={{ color: "#F0EEE8", fontSize: 15, fontWeight: 900 }}>Mogiana</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(20,20,20,.8)", border: "1px solid rgba(155,48,255,.2)", borderRadius: 50, padding: "3px 9px", margin: "5px 0" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#EF4444" }} />
            <span style={{ color: "#F0EEE8", fontSize: 9, opacity: .8 }}>Fechado · abre às 09:00</span>
          </div>
          <div style={{ color: "#F0EEE8", fontSize: 9, opacity: .6, marginBottom: 9 }}>Rua Fernando Faleiros Lima 28, Mogiana</div>
          <div style={{ background: "#9C27B0", color: "rgba(10,10,10,.9)", fontSize: 10, fontWeight: 800, border: "none", borderRadius: 50, padding: "8px 22px", display: "inline-block" }}>Agendar Horário</div>
        </div>
        <div style={{ display: "flex", background: "rgba(10,10,10,.5)", borderBottom: "1px solid rgba(155,48,255,.15)" }}>
          {["Serviços","Produtos","Assinaturas","Como funciona"].map((t, i) => (
            <div key={t} style={{ flex: 1, padding: "7px 0", textAlign: "center", fontSize: 8, fontWeight: 800, color: i === 0 ? "#F0EEE8" : "#888880", borderBottom: i === 0 ? "2px solid #9C27B0" : "2px solid transparent" }}>{t}</div>
          ))}
        </div>
        <div style={{ padding: "10px 10px 6px" }}>
          <div style={{ color: "#F0EEE8", fontSize: 10, fontWeight: 700, marginBottom: 7 }}>Serviços</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
            {[
              { name: "Corte+Barba+Sobrancelha", dur: "60 min" },
              { name: "Barba", dur: "30 min" },
              { name: "Pintura de cabelo", dur: "90 min" },
            ].map(s => (
              <div key={s.name} style={{ background: "rgb(26,32,53)", border: "1px solid rgba(155,48,255,.15)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ height: 40, background: "linear-gradient(135deg,#1e1e3e,#2a1a3a)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9C27B0", fontSize: 16 }}>✂</div>
                <div style={{ padding: 6 }}>
                  <div style={{ color: "#F0EEE8", fontSize: 8, fontWeight: 700 }}>{s.name}</div>
                  <div style={{ color: "#888880", fontSize: 7, margin: "2px 0", filter: "blur(3px)" }}>R$ ••,00</div>
                  <div style={{ color: "#888880", fontSize: 7 }}>⏱ {s.dur}</div>
                  <div style={{ background: "#9C27B0", color: "rgba(10,10,10,.9)", fontSize: 7, fontWeight: 800, border: "none", borderRadius: 4, padding: "3px 0", width: "100%", marginTop: 4, textAlign: "center" }}>🔓 Entrar para ver</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "6px", borderTop: "1px solid rgba(155,48,255,.1)" }}>
          <span style={{ color: "#555", fontSize: 8 }}>Powered by </span>
          <span style={{ color: "#9C27B0", fontSize: 8, fontWeight: 800 }}>Barber Pro</span>
        </div>
      </div>
    </div>
  );
}

export function SystemShowcase() {
  const [active, setActive] = useState("agenda");

  const screens: Record<string, React.ReactNode> = {
    agenda: <AgendaMockup />,
    financeiro: <FinanceiroMockup />,
    pagamentos: <PagamentosMockup />,
    assinaturas: <AssinaturasMockup />,
    pagina: <PaginaMockup />,
  };

  return (
    <section id="sistema" aria-labelledby="sistema-heading" style={{ background: "#030303" }}>
      <div className="lp-section">
        <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto 48px" }}>
          <motion.p
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ color: "#C9A84C", fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}
          >
            O Sistema
          </motion.p>
          <motion.h2
            id="sistema-heading"
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            style={{ color: "#F0EEE8", fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, lineHeight: 1.15, letterSpacing: -1, marginBottom: 16 }}
          >
            Veja o sistema{" "}
            <span style={{ color: "#888880", fontWeight: 400 }}>por dentro</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            style={{ color: "#888880", fontSize: 16, lineHeight: 1.65 }}
          >
            Tudo que você precisa para gerir sua barbearia em um só lugar — bonito, rápido e feito para o dia a dia do barbeiro.
          </motion.p>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 }}
          style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              style={{
                background: active === tab.id ? "rgba(201,168,76,.12)" : "transparent",
                border: `1px solid ${active === tab.id ? "rgba(201,168,76,.35)" : "rgba(255,255,255,.08)"}`,
                color: active === tab.id ? "#C9A84C" : "#888880",
                borderRadius: 100,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all .2s",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Screen */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {screens[active]}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
