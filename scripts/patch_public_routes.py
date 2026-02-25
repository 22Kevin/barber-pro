"""
Substitui a função renderBookingPage no public-routes.ts com o fluxo completo de agendamento,
adiciona renderLoginPage e os endpoints REST /pub-api/*.
"""
import re

with open('/home/ubuntu/barber_app/server/public-routes.ts', 'r') as f:
    content = f.read()

# ─── Nova renderBookingPage ───────────────────────────────────────────────────
new_booking_fn = r"""// ─── Página de agendamento ────────────────────────────────────────────────────
async function renderBookingPage(slug: string, res: Response, req?: Request) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const barberList = await db.getAllBarbers(tenant.id);
  const serviceList = await db.getAllServicesWithMediaAndRatings(true);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";

  // Verificar se o cliente está logado via cookie de sessão
  const clientSessionRaw = req?.cookies?.[`client_session_${slug}`] ?? req?.cookies?.["client_session"];
  let loggedClient: { id: number; name: string; email: string } | null = null;
  if (clientSessionRaw) {
    try { loggedClient = JSON.parse(Buffer.from(clientSessionRaw, "base64").toString()); } catch {}
  }

  const servicesOptions = serviceList.map((s) =>
    `<option value="${s.id}" data-duration="${s.durationMinutes}">${escapeHtml(s.name)} — ${formatPrice(s.price)} (${formatDuration(s.durationMinutes)})</option>`
  ).join("");
  const barbersOptions = barberList.map((b) =>
    `<option value="${b.id}">${escapeHtml(b.name)}</option>`
  ).join("");
  const firstBarberId = barberList[0]?.id ?? 1;

  const loginSection = loggedClient
    ? `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between">
        <div><div style="font-size:13px;font-weight:700">${escapeHtml(loggedClient.name)}</div><div style="font-size:11px;color:var(--muted)">${escapeHtml(loggedClient.email)}</div></div>
        <a href="/pub/${slug}/logout" style="font-size:12px;color:var(--muted)">Sair</a>
       </div>`
    : `<div style="background:var(--primary-dim);border:1px solid var(--primary)44;border-radius:12px;padding:14px;margin-bottom:20px;font-size:13px;color:var(--muted)">
        💡 <a href="/pub/${slug}/login?redirect=agendar" style="color:var(--primary);font-weight:700">Faça login</a> ou <a href="/pub/${slug}/cadastro?redirect=agendar" style="color:var(--primary);font-weight:700">crie uma conta</a> para confirmar o agendamento.
       </div>`;

  const loggedClientJson = loggedClient ? JSON.stringify(loggedClient) : "null";

  const body = `
    <div style="max-width:480px;margin:0 auto;padding:32px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">
        <a href="/pub/${slug}" style="color:var(--muted);font-size:20px">←</a>
        <div>
          <div style="font-size:18px;font-weight:800">${escapeHtml(settings?.shopName ?? tenant.name)}</div>
          <div style="font-size:12px;color:var(--muted)">Agendamento Online</div>
        </div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px">
        <h2 style="font-size:18px;font-weight:800;margin-bottom:24px">Escolha seu horário</h2>
        <div style="margin-bottom:18px">
          <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">SERVIÇO</label>
          <select id="service-select" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px">
            <option value="">Selecione um serviço</option>
            ${servicesOptions}
          </select>
        </div>
        <div style="margin-bottom:18px">
          <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">PROFISSIONAL</label>
          <select id="barber-select" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px">
            <option value="">Qualquer profissional</option>
            ${barbersOptions}
          </select>
        </div>
        <div style="margin-bottom:18px">
          <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">DATA</label>
          <input type="date" id="date-input" min="${new Date().toISOString().split("T")[0]}"
            style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
        </div>
        <div id="slots-area" style="margin-bottom:20px">
          <div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">
            Selecione um serviço e uma data para ver os horários disponíveis.
          </div>
        </div>
        ${loginSection}
        <button id="confirm-btn" disabled
          style="width:100%;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:800;padding:16px;border-radius:14px;text-align:center;opacity:0.5;border:none;cursor:not-allowed">
          Confirmar Agendamento
        </button>
        <div id="success-msg" style="display:none;margin-top:16px;background:#22C55E22;border:1px solid #22C55E44;border-radius:12px;padding:16px;text-align:center;font-size:14px;color:#4ADE80"></div>
        <div id="error-msg" style="display:none;margin-top:16px;background:#EF444422;border:1px solid #EF444444;border-radius:12px;padding:14px;text-align:center;font-size:13px;color:#F87171"></div>
      </div>
    </div>
    <script>
      var SLUG = '${slug}';
      var LOGGED_CLIENT = ${loggedClientJson};
      var FIRST_BARBER = '${firstBarberId}';
      var serviceSelect = document.getElementById('service-select');
      var barberSelect = document.getElementById('barber-select');
      var dateInput = document.getElementById('date-input');
      var slotsArea = document.getElementById('slots-area');
      var confirmBtn = document.getElementById('confirm-btn');
      var successMsg = document.getElementById('success-msg');
      var errorMsg = document.getElementById('error-msg');
      var selectedSlot = null;

      function getSelectedDuration() {
        var opt = serviceSelect.options[serviceSelect.selectedIndex];
        return opt ? parseInt(opt.dataset.duration || '30') : 30;
      }

      async function loadSlots() {
        selectedSlot = null;
        updateConfirmBtn();
        if (!serviceSelect.value || !dateInput.value) {
          slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Selecione um serviço e uma data para ver os horários disponíveis.</div>';
          return;
        }
        slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Carregando horários...</div>';
        var barberId = barberSelect.value || FIRST_BARBER;
        var duration = getSelectedDuration();
        try {
          var r = await fetch('/pub-api/slots?barberId=' + barberId + '&date=' + dateInput.value + '&duration=' + duration);
          var slots = await r.json();
          if (!slots.length) {
            slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:var(--muted);font-size:13px">Nenhum horário disponível nesta data.</div>';
            return;
          }
          var html = '<div style="font-size:12px;color:var(--muted);margin-bottom:10px;letter-spacing:1px">HORÁRIOS DISPONÍVEIS</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
          slots.forEach(function(s) {
            html += '<button onclick="selectSlot(\'' + s.startTime + '\',\'' + s.endTime + '\',this)" style="padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;font-weight:600;cursor:pointer">' + s.startTime + '</button>';
          });
          html += '</div>';
          slotsArea.innerHTML = html;
        } catch(e) {
          slotsArea.innerHTML = '<div style="background:var(--surface2);border-radius:12px;padding:16px;text-align:center;color:#F87171;font-size:13px">Erro ao carregar horários.</div>';
        }
      }

      function selectSlot(start, end, btn) {
        selectedSlot = { startTime: start, endTime: end };
        document.querySelectorAll('#slots-area button').forEach(function(b) {
          b.style.background = 'var(--surface2)';
          b.style.borderColor = 'var(--border)';
          b.style.color = 'var(--text)';
        });
        btn.style.background = 'var(--primary)';
        btn.style.borderColor = 'var(--primary)';
        btn.style.color = '#0A0A0A';
        updateConfirmBtn();
      }

      function updateConfirmBtn() {
        var ready = selectedSlot && serviceSelect.value && LOGGED_CLIENT;
        if (selectedSlot && serviceSelect.value && !LOGGED_CLIENT) {
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          confirmBtn.style.cursor = 'pointer';
          confirmBtn.textContent = 'Faça login para confirmar';
          confirmBtn.onclick = function() {
            window.location.href = '/pub/' + SLUG + '/login?redirect=agendar&service=' + serviceSelect.value + '&date=' + dateInput.value + '&barber=' + barberSelect.value + '&start=' + selectedSlot.startTime + '&end=' + selectedSlot.endTime;
          };
        } else if (ready) {
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          confirmBtn.style.cursor = 'pointer';
          confirmBtn.textContent = 'Confirmar Agendamento';
          confirmBtn.onclick = confirmBooking;
        } else {
          confirmBtn.disabled = true;
          confirmBtn.style.opacity = '0.5';
          confirmBtn.style.cursor = 'not-allowed';
          confirmBtn.textContent = 'Confirmar Agendamento';
          confirmBtn.onclick = null;
        }
      }

      async function confirmBooking() {
        if (!LOGGED_CLIENT || !selectedSlot || !serviceSelect.value) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirmando...';
        errorMsg.style.display = 'none';
        var barberId = barberSelect.value || FIRST_BARBER;
        try {
          var r = await fetch('/pub-api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: SLUG,
              clientId: LOGGED_CLIENT.id,
              barberId: parseInt(barberId),
              serviceId: parseInt(serviceSelect.value),
              date: dateInput.value,
              startTime: selectedSlot.startTime,
              endTime: selectedSlot.endTime,
            })
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro ao confirmar agendamento');
          successMsg.innerHTML = '✅ Agendamento confirmado!<br><strong>' + dateInput.value + ' às ' + selectedSlot.startTime + '</strong><br><br><a href="/pub/' + SLUG + '" style="color:var(--primary)">← Voltar para a página da barbearia</a>';
          successMsg.style.display = 'block';
          confirmBtn.style.display = 'none';
        } catch(e) {
          errorMsg.textContent = e.message;
          errorMsg.style.display = 'block';
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirmar Agendamento';
        }
      }

      serviceSelect.addEventListener('change', loadSlots);
      barberSelect.addEventListener('change', loadSlots);
      dateInput.addEventListener('change', loadSlots);

      // Pré-preencher campos via query string
      var params = new URLSearchParams(window.location.search);
      if (params.get('service')) serviceSelect.value = params.get('service');
      if (params.get('date')) dateInput.value = params.get('date');
      if (params.get('barber')) barberSelect.value = params.get('barber');
      if (params.get('service') && params.get('date')) loadSlots().then(function() {
        var startParam = params.get('start');
        var endParam = params.get('end');
        if (startParam && endParam) {
          setTimeout(function() {
            var btn = document.querySelector('#slots-area button[style*="' + startParam + '"]');
            if (!btn) {
              document.querySelectorAll('#slots-area button').forEach(function(b) {
                if (b.textContent.trim() === startParam) selectSlot(startParam, endParam, b);
              });
            }
          }, 500);
        }
      });
    </script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body));
}

// ─── Página de login/cadastro do cliente ─────────────────────────────────────
async function renderLoginPage(slug: string, res: Response, req: Request, mode: "login" | "cadastro" = "login") {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada."); return; }
  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const primaryColor = (settings as any)?.primaryColor ?? "#C9A84C";
  const redirect = (req.query.redirect as string) ?? "";
  const service = (req.query.service as string) ?? "";
  const date = (req.query.date as string) ?? "";
  const barber = (req.query.barber as string) ?? "";
  const start = (req.query.start as string) ?? "";
  const end = (req.query.end as string) ?? "";
  const isLogin = mode === "login";
  const queryStr = `redirect=${redirect}&service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}`;
  const body = `
    <div style="max-width:400px;margin:0 auto;padding:48px 24px">
      <div style="text-align:center;margin-bottom:32px">
        ${settings?.logoUrl ? `<img src="${escapeHtml(settings.logoUrl)}" style="width:72px;height:72px;border-radius:18px;object-fit:cover;margin:0 auto 16px;border:2px solid var(--primary)" />` : `<div style="font-size:48px;margin-bottom:16px">💈</div>`}
        <div style="font-size:20px;font-weight:800">${escapeHtml(settings?.shopName ?? tenant.name)}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">${isLogin ? "Faça login para agendar" : "Crie sua conta gratuita"}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px">
        <form id="auth-form">
          ${!isLogin ? `<div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">NOME COMPLETO</label>
            <input type="text" id="name-input" required placeholder="Seu nome" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>` : ""}
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">EMAIL</label>
            <input type="email" id="email-input" required placeholder="seu@email.com" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>
          <div style="margin-bottom:${!isLogin ? "16" : "24"}px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">SENHA</label>
            <input type="password" id="password-input" required placeholder="${isLogin ? "Sua senha" : "Mínimo 6 caracteres"}" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>
          ${!isLogin ? `<div style="margin-bottom:24px">
            <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:6px">TELEFONE</label>
            <input type="tel" id="phone-input" required placeholder="(11) 99999-9999" style="width:100%;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px" />
          </div>` : ""}
          <button type="submit" id="submit-btn" style="width:100%;background:var(--primary);color:#0A0A0A;font-size:16px;font-weight:800;padding:16px;border-radius:14px;border:none;cursor:pointer">
            ${isLogin ? "Entrar" : "Criar Conta"}
          </button>
          <div id="auth-error" style="display:none;margin-top:12px;color:#F87171;font-size:13px;text-align:center"></div>
        </form>
        <div style="text-align:center;margin-top:20px;font-size:13px;color:var(--muted)">
          ${isLogin
            ? `Não tem conta? <a href="/pub/${slug}/cadastro?${queryStr}" style="color:var(--primary);font-weight:700">Criar conta gratuita</a>`
            : `Já tem conta? <a href="/pub/${slug}/login?${queryStr}" style="color:var(--primary);font-weight:700">Fazer login</a>`
          }
        </div>
      </div>
    </div>
    <script>
      document.getElementById('auth-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        var btn = document.getElementById('submit-btn');
        var errEl = document.getElementById('auth-error');
        btn.disabled = true;
        btn.textContent = 'Aguarde...';
        errEl.style.display = 'none';
        var body = {
          email: document.getElementById('email-input').value,
          password: document.getElementById('password-input').value,
          slug: '${slug}'
        };
        ${!isLogin ? `body.name = document.getElementById('name-input').value; body.phone = document.getElementById('phone-input').value;` : ""}
        try {
          var r = await fetch('/pub-api/${isLogin ? "login" : "register"}', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          var data = await r.json();
          if (!r.ok) throw new Error(data.error || 'Erro de autenticação');
          var qs = '?service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}';
          window.location.href = '/pub/${slug}/' + ('${redirect}' || '') + qs;
        } catch(e) {
          errEl.textContent = e.message;
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = '${isLogin ? "Entrar" : "Criar Conta"}';
        }
      });
    </script>
  `;
  res.send(publicLayout(settings?.shopName ?? tenant.name, primaryColor, body));
}

"""

# ─── Novas rotas REST ─────────────────────────────────────────────────────────
new_routes = r"""
  // ─── API REST pública (usada pelo JavaScript das páginas HTML) ─────────────
  // GET /pub-api/slots?barberId=1&date=2026-03-01&duration=30
  app.get("/pub-api/slots", async (req: Request, res: Response) => {
    try {
      const barberId = parseInt(req.query.barberId as string);
      const date = req.query.date as string;
      const duration = parseInt(req.query.duration as string) || 30;
      if (!barberId || !date) { res.status(400).json({ error: "barberId e date são obrigatórios" }); return; }
      const slots = await db.getAvailableSlots(barberId, date, duration);
      res.json(slots);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/login  { email, password, slug }
  app.post("/pub-api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) { res.status(400).json({ error: "Email e senha são obrigatórios" }); return; }
      const account = await db.getClientAccountByEmail(email);
      if (!account) { res.status(401).json({ error: "Email ou senha incorretos" }); return; }
      let bcrypt: any;
      try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
      const valid = bcrypt ? await bcrypt.compare(password, account.passwordHash) : password === account.passwordHash;
      if (!valid) { res.status(401).json({ error: "Email ou senha incorretos" }); return; }
      const client = await db.getClientById(account.clientId);
      if (!client) { res.status(404).json({ error: "Cliente não encontrado" }); return; }
      const sessionData = Buffer.from(JSON.stringify({ id: client.id, name: client.name, email: client.email })).toString("base64");
      const slug = req.body.slug as string;
      res.cookie(`client_session_${slug}`, sessionData, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.cookie("client_session", sessionData, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.json({ id: client.id, name: client.name, email: client.email });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/register  { name, email, password, phone, slug }
  app.post("/pub-api/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password, phone, slug } = req.body;
      if (!name || !email || !password || !phone) { res.status(400).json({ error: "Todos os campos são obrigatórios" }); return; }
      if (password.length < 6) { res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" }); return; }
      const existing = await db.getClientAccountByEmail(email);
      if (existing) { res.status(409).json({ error: "Email já cadastrado. Faça login." }); return; }
      let bcrypt: any;
      try { bcrypt = require("bcryptjs"); } catch { bcrypt = null; }
      const passwordHash = bcrypt ? await bcrypt.hash(password, 10) : password;
      const clientId = await db.createClient({ name, email, phone, isActive: true });
      await db.createClientAccount({ clientId, email, passwordHash });
      const client = await db.getClientById(clientId);
      const sessionData = Buffer.from(JSON.stringify({ id: clientId, name, email })).toString("base64");
      res.cookie(`client_session_${slug}`, sessionData, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.cookie("client_session", sessionData, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      res.json({ id: clientId, name, email });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /pub-api/book  { slug, clientId, barberId, serviceId, date, startTime, endTime }
  app.post("/pub-api/book", async (req: Request, res: Response) => {
    try {
      const { slug, clientId, barberId, serviceId, date, startTime, endTime } = req.body;
      if (!clientId || !barberId || !serviceId || !date || !startTime || !endTime) {
        res.status(400).json({ error: "Dados incompletos para o agendamento" }); return;
      }
      const available = await db.checkSlotAvailability(barberId, date, startTime, endTime);
      if (!available) { res.status(409).json({ error: "Horário não disponível. Por favor, escolha outro horário." }); return; }
      const apptId = await db.createAppointment({ clientId, barberId, serviceId, date, startTime, endTime, status: "confirmed" } as any);
      // Notificar barbeiro via push
      const pushToken = await db.getBarberPushToken(barberId);
      if (pushToken) {
        const client = await db.getClientById(clientId);
        const service = await db.getServiceById(serviceId);
        await db.sendExpoPushNotification(pushToken, "📅 Novo agendamento online", `${client?.name ?? "Cliente"} agendou ${service?.name ?? "Serviço"} para ${date} às ${startTime}`, { appointmentId: apptId, screen: "agenda" });
      }
      res.json({ id: apptId, success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /pub/:slug/login
  app.get("/pub/:slug/login", async (req: Request, res: Response) => {
    await renderLoginPage(req.params.slug, res, req, "login");
  });

  // GET /pub/:slug/cadastro
  app.get("/pub/:slug/cadastro", async (req: Request, res: Response) => {
    await renderLoginPage(req.params.slug, res, req, "cadastro");
  });

  // GET /pub/:slug/logout
  app.get("/pub/:slug/logout", (req: Request, res: Response) => {
    const slug = req.params.slug;
    res.clearCookie(`client_session_${slug}`);
    res.clearCookie("client_session");
    res.redirect(`/pub/${slug}`);
  });

"""

# Find and replace renderBookingPage section
start_marker = '// ─── Página de agendamento ──'
end_marker = '// ─── Registro das rotas ──'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"ERROR: Markers not found start={start_idx} end={end_idx}")
    exit(1)

# Replace the booking function section
content = content[:start_idx] + new_booking_fn + content[end_idx:]

# Add cookie-parser import
if "cookie-parser" not in content and "cookieParser" not in content:
    content = content.replace(
        'import type { Express, Request, Response } from "express";',
        'import type { Express, Request, Response } from "express";\nimport cookieParser from "cookie-parser";'
    )

# Add new REST routes before the subdomain middleware
subdomain_marker = '  // Roteamento por subdomínio'
subdomain_idx = content.find(subdomain_marker)
if subdomain_idx == -1:
    # Try alternative
    subdomain_marker = '  app.get("/pub/:slug/agendar"'
    subdomain_idx = content.find(subdomain_marker)

if subdomain_idx != -1:
    content = content[:subdomain_idx] + new_routes + content[subdomain_idx:]
else:
    print("WARNING: Could not find subdomain marker, appending routes at end")

# Add cookie-parser middleware in registerPublicRoutes
content = content.replace(
    'export function registerPublicRoutes(app: Express): void {\n  // Rota de desenvolvimento',
    'export function registerPublicRoutes(app: Express): void {\n  app.use(cookieParser());\n  // Rota de desenvolvimento'
)

# Update the /pub/:slug/agendar route to pass req
content = content.replace(
    'app.get("/pub/:slug/agendar", async (req: Request, res: Response) => {\n    await renderBookingPage(req.params.slug, res);\n  });',
    'app.get("/pub/:slug/agendar", async (req: Request, res: Response) => {\n    await renderBookingPage(req.params.slug, res, req);\n  });'
)

# Update subdomain middleware to pass req to renderBookingPage
content = content.replace(
    '} else if (req.path === "/agendar") {\n      await renderBookingPage(slug, res);\n    }',
    '} else if (req.path === "/agendar") {\n      await renderBookingPage(slug, res, req);\n    }'
)

with open('/home/ubuntu/barber_app/server/public-routes.ts', 'w') as f:
    f.write(content)

print("Done! File updated successfully.")
print(f"New file size: {len(content)} chars")
