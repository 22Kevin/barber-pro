#!/usr/bin/env python3
"""
Patch admin-routes.ts:
1. Substitui a coluna "Notas" por "Ações" com botões de status
2. Adiciona endpoint POST /admin-api/appointment-status
"""

import re

path = "/home/ubuntu/barber_app/server/admin-routes.ts"
with open(path, "r") as f:
    content = f.read()

# 1. Substituir a tabela de agendamentos na renderAgenda (segunda ocorrência)
old_table = '''          : `<table>
              <thead><tr><th>Horário</th><th>Cliente</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th>Notas</th></tr></thead>
              <tbody>
                ${appointments.map((a: any) => `
                  <tr>
                    <td><strong>${a.startTime?.substring(0, 5) ?? "—"}</strong> – ${a.endTime?.substring(0, 5) ?? "—"}</td>
                    <td>${esc(clientMap[a.clientId] ?? "—")}</td>
                    <td>${esc(serviceMap[a.serviceId] ?? "—")}</td>
                    <td>${esc(barberMap[a.barberId] ?? "—")}</td>
                    <td>${statusBadge(a.status)}</td>
                    <td style="color:var(--muted);font-size:12px">${esc(a.notes ?? "")}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>`'''

new_table = '''          : `<table>
              <thead><tr><th>Horário</th><th>Cliente</th><th>Serviço</th><th>Barbeiro</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                ${appointments.map((a: any) => `
                  <tr id="row-${a.id}">
                    <td><strong>${a.startTime?.substring(0, 5) ?? "—"}</strong> – ${a.endTime?.substring(0, 5) ?? "—"}</td>
                    <td>${esc(clientMap[a.clientId] ?? "—")}</td>
                    <td>${esc(serviceMap[a.serviceId] ?? "—")}</td>
                    <td>${esc(barberMap[a.barberId] ?? "—")}</td>
                    <td id="status-${a.id}">${statusBadge(a.status)}</td>
                    <td style="white-space:nowrap">
                      ${a.status === "scheduled" ? `<button onclick="updateStatus(${a.id},'confirmed')" style="background:#C9A84C;color:#000;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-right:4px">Confirmar</button>` : ""}
                      ${a.status === "confirmed" || a.status === "scheduled" ? `<button onclick="updateStatus(${a.id},'in_progress')" style="background:#3B82F6;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-right:4px">Iniciar</button>` : ""}
                      ${a.status === "in_progress" || a.status === "confirmed" ? `<button onclick="updateStatus(${a.id},'completed')" style="background:#22C55E;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-right:4px">Concluir</button>` : ""}
                      ${a.status !== "cancelled" && a.status !== "completed" ? `<button onclick="updateStatus(${a.id},'cancelled')" style="background:#EF4444;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;margin-right:4px">Cancelar</button>` : ""}
                      ${a.status === "confirmed" || a.status === "scheduled" ? `<button onclick="updateStatus(${a.id},'no_show')" style="background:var(--surface);color:var(--muted);border:1px solid var(--border);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">Não veio</button>` : ""}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <script>
              async function updateStatus(id, status) {
                const labels = {confirmed:"Confirmado",in_progress:"Em andamento",completed:"Concluído",cancelled:"Cancelado",no_show:"Não compareceu",scheduled:"Agendado"};
                const colors = {scheduled:"badge-warning",confirmed:"badge-gold",in_progress:"badge-gold",completed:"badge-success",cancelled:"badge-error",no_show:"badge-muted"};
                try {
                  const r = await fetch("/admin-api/appointment-status", {
                    method: "POST",
                    headers: {"Content-Type":"application/json"},
                    body: JSON.stringify({id, status})
                  });
                  if (!r.ok) { const e = await r.json(); alert("Erro: " + e.error); return; }
                  const cell = document.getElementById("status-" + id);
                  if (cell) cell.innerHTML = "<span class=\\"badge " + (colors[status]||"badge-muted") + "\\">" + (labels[status]||status) + "</span>";
                  setTimeout(() => location.reload(), 800);
                } catch(e) { alert("Erro ao atualizar status"); }
              }
            </script>`'''

if old_table in content:
    content = content.replace(old_table, new_table, 1)
    print("✅ Tabela de agendamentos atualizada com botões de ação")
else:
    print("❌ Tabela antiga não encontrada — verificar manualmente")

# 2. Adicionar endpoint /admin-api/appointment-status antes do fechamento de registerAdminRoutes
endpoint_code = '''
  // API REST: atualizar status de agendamento
  app.post("/admin-api/appointment-status", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const { id, status } = req.body as { id: number; status: string };
      const validStatuses = ["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
      if (!id || !validStatuses.includes(status)) {
        res.status(400).json({ error: "Parâmetros inválidos" });
        return;
      }
      await db.updateAppointmentStatus(id, status);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
'''

# Inserir antes do fechamento da função registerAdminRoutes
closing = '''  // Rotas protegidas
  app.get("/admin", requireAdminAuth, (req, res) => renderDashboard(req, res));'''

if closing in content:
    content = content.replace(closing, endpoint_code + closing, 1)
    print("✅ Endpoint /admin-api/appointment-status adicionado")
else:
    print("❌ Ponto de inserção do endpoint não encontrado")

with open(path, "w") as f:
    f.write(content)

print("✅ Patch aplicado com sucesso")
