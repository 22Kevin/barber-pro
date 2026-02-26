"""
Patch: adiciona página pública de avaliação /pub/:slug/avaliar/:appointmentId
e agendador de e-mail de avaliação no endpoint /pub-api/book.
"""

with open('/home/ubuntu/barber_app/server/public-routes.ts', 'r') as f:
    content = f.read()

# ── 1. Adicionar import de sendReviewRequestEmail ────────────────────────────
if 'sendReviewRequestEmail' not in content:
    content = content.replace(
        'import { sendBookingConfirmationEmail, sendBarberNotificationEmail }',
        'import { sendBookingConfirmationEmail, sendBarberNotificationEmail, sendReviewRequestEmail }'
    )

# ── 2. Adicionar função renderReviewPage antes de registerPublicRoutes ────────
review_page_fn = '''
async function renderReviewPage(slug: string, appointmentId: number, preRating: number, req: Request, res: Response) {
  const tenant = await db.getTenantBySlug(slug);
  if (!tenant) { res.status(404).send("Barbearia não encontrada"); return; }

  const settings = await db.getShopSettingsByTenantId(tenant.id);
  const shopName = settings?.name ?? tenant.name;
  const primaryColor = settings?.primaryColor ?? "#D4AF37";

  // Buscar agendamento
  const { db: drizzleDb } = await getDb();
  const { appointments, barbers, services, clients } = await import("../drizzle/schema.js");
  const { eq } = await import("drizzle-orm");

  const apptRows = await drizzleDb
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  const appt = apptRows[0];
  if (!appt) { res.status(404).send("Agendamento não encontrado"); return; }

  const barberRows = await drizzleDb.select().from(barbers).where(eq(barbers.id, appt.barberId)).limit(1);
  const serviceRows = await drizzleDb.select().from(services).where(eq(services.id, appt.serviceId)).limit(1);
  const barberName = barberRows[0]?.name ?? "Profissional";
  const serviceName = serviceRows[0]?.name ?? "Serviço";

  // Verificar se já avaliou
  const alreadyReviewed = appt.status === "reviewed";

  const submitted = req.query.submitted === "1";

  const body = submitted || alreadyReviewed ? `
    <div style="text-align:center;padding:60px 20px">
      <div style="font-size:64px;margin-bottom:16px">⭐</div>
      <h2 style="color:${primaryColor};font-size:24px;margin-bottom:12px">Obrigado pela avaliação!</h2>
      <p style="color:var(--muted);font-size:16px">Sua opinião nos ajuda a melhorar cada vez mais.</p>
      <a href="/pub/${slug}" style="display:inline-block;margin-top:24px;background:${primaryColor};color:#0A0A0A;font-weight:700;padding:12px 28px;border-radius:50px;text-decoration:none;font-size:14px">Voltar para a barbearia</a>
    </div>
  ` : `
    <div style="max-width:480px;margin:0 auto;padding:40px 20px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-size:48px;margin-bottom:8px">✂️</div>
        <h1 style="font-size:22px;color:var(--text);margin-bottom:4px">${esc(shopName)}</h1>
        <p style="color:var(--muted);font-size:14px">Avalie seu atendimento</p>
      </div>
      <div style="background:var(--surface2);border-radius:16px;padding:20px;margin-bottom:28px;text-align:center">
        <div style="font-size:14px;color:var(--muted);margin-bottom:4px">Serviço</div>
        <div style="font-size:18px;font-weight:700;color:var(--text)">${esc(serviceName)}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">com ${esc(barberName)}</div>
      </div>
      <form method="POST" action="/pub/${slug}/avaliar/${appointmentId}">
        <div style="text-align:center;margin-bottom:28px">
          <p style="font-size:15px;color:var(--text);margin-bottom:16px;font-weight:600">Qual nota você dá?</p>
          <div id="stars" style="display:flex;justify-content:center;gap:8px">
            ${[1,2,3,4,5].map(n => `
              <label style="cursor:pointer">
                <input type="radio" name="rating" value="${n}" style="display:none" ${preRating === n ? "checked" : ""} required />
                <span class="star" data-value="${n}" style="font-size:44px;color:${preRating >= n ? primaryColor : "#ccc"};transition:color 0.15s;user-select:none">★</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div style="margin-bottom:20px">
          <label style="display:block;font-size:14px;color:var(--muted);margin-bottom:8px">Comentário (opcional)</label>
          <textarea name="comment" rows="4" placeholder="Conte como foi sua experiência..." style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 16px;font-size:14px;color:var(--text);resize:vertical;outline:none"></textarea>
        </div>
        <button type="submit" style="width:100%;background:${primaryColor};color:#0A0A0A;font-weight:700;font-size:16px;padding:16px;border:none;border-radius:12px;cursor:pointer">
          Enviar Avaliação
        </button>
      </form>
      <script>
        const stars = document.querySelectorAll('.star');
        stars.forEach(star => {
          star.addEventListener('mouseenter', () => {
            const val = parseInt(star.dataset.value);
            stars.forEach(s => s.style.color = parseInt(s.dataset.value) <= val ? '${primaryColor}' : '#ccc');
          });
          star.addEventListener('mouseleave', () => {
            const checked = document.querySelector('input[name=rating]:checked');
            const val = checked ? parseInt(checked.value) : 0;
            stars.forEach(s => s.style.color = parseInt(s.dataset.value) <= val ? '${primaryColor}' : '#ccc');
          });
          star.addEventListener('click', () => {
            const val = parseInt(star.dataset.value);
            document.querySelector('input[name=rating][value="'+val+'"]').checked = true;
            stars.forEach(s => s.style.color = parseInt(s.dataset.value) <= val ? '${primaryColor}' : '#ccc');
          });
        });
      </script>
    </div>
  `;

  res.send(publicLayout(shopName, primaryColor, body));
}

'''

# Inserir antes de registerPublicRoutes
reg_idx = content.find('export function registerPublicRoutes(')
content = content[:reg_idx] + review_page_fn + content[reg_idx:]

# ── 3. Adicionar rotas GET e POST /pub/:slug/avaliar/:id ─────────────────────
review_routes = '''
  // ─── Avaliação pós-atendimento ────────────────────────────────────────────
  app.get("/pub/:slug/avaliar/:id", async (req: Request, res: Response) => {
    const { slug, id } = req.params;
    const preRating = req.query.rating ? parseInt(req.query.rating as string) : 0;
    await renderReviewPage(slug, parseInt(id), preRating, req, res);
  });

  app.post("/pub/:slug/avaliar/:id", async (req: Request, res: Response) => {
    const { slug, id } = req.params;
    const { rating, comment } = req.body;
    const appointmentId = parseInt(id);

    try {
      const tenant = await db.getTenantBySlug(slug);
      if (!tenant) { res.status(404).send("Barbearia não encontrada"); return; }

      const { db: drizzleDb } = await getDb();
      const { appointments, barbers, services, clients, client_accounts } = await import("../drizzle/schema.js");
      const { eq } = await import("drizzle-orm");

      const apptRows = await drizzleDb.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
      const appt = apptRows[0];
      if (!appt) { res.status(404).send("Agendamento não encontrado"); return; }

      // Criar review
      const { db: dbModule } = await import("./db.js");
      // Inserir review via drizzle diretamente
      const { reviews } = await import("../drizzle/schema.js");
      await drizzleDb.insert(reviews).values({
        clientId: appt.clientId,
        serviceId: appt.serviceId,
        appointmentId,
        rating: parseInt(rating),
        comment: comment || null,
      }).onDuplicateKeyUpdate({ set: { rating: parseInt(rating), comment: comment || null } });

      // Marcar agendamento como avaliado
      await drizzleDb.update(appointments).set({ status: "reviewed" }).where(eq(appointments.id, appointmentId));

      res.redirect(`/pub/${slug}/avaliar/${appointmentId}?submitted=1`);
    } catch (err) {
      console.error("[review] Erro ao salvar avaliação:", err);
      res.redirect(`/pub/${slug}/avaliar/${appointmentId}?submitted=1`);
    }
  });

'''

# Inserir antes do último app.get de /pub/:slug/meus-agendamentos ou antes do fechamento
close_marker = '  // ─── Meus Agendamentos'
if close_marker in content:
    content = content.replace(close_marker, review_routes + close_marker, 1)
else:
    # Inserir antes do fechamento do registerPublicRoutes
    close_fn = '\n}\n'
    last_close = content.rfind(close_fn)
    content = content[:last_close] + review_routes + content[last_close:]

# ── 4. Adicionar agendamento de e-mail de avaliação no /pub-api/book ─────────
# Após o envio do e-mail de confirmação ao cliente, agendar e-mail de avaliação
review_email_code = '''
      // Agendar e-mail de avaliação (2h após o horário do atendimento)
      try {
        const [h, m] = startTime.split(":").map(Number);
        const apptDate = new Date(`${date}T${startTime.padEnd(8, ":00")}`);
        apptDate.setHours(apptDate.getHours() + 2);
        const delayMs = apptDate.getTime() - Date.now();
        if (delayMs > 0 && clientEmail) {
          setTimeout(async () => {
            try {
              await sendReviewRequestEmail({
                clientEmail,
                clientName: client.name,
                shopName: settings?.name ?? tenant.name,
                shopSlug: slug,
                serviceName: service.name,
                barberName: barber.name,
                appointmentId: apptId,
                baseUrl: process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get("host")}`,
              });
            } catch (e) { console.error("[review-email]", e); }
          }, delayMs);
        }
      } catch (e) { /* silencioso */ }
'''

# Inserir após o bloco de sendBookingConfirmationEmail
marker = 'await sendBookingConfirmationEmail({'
idx = content.find(marker)
if idx != -1:
    # Encontrar o fim do bloco (próximo });)
    end_block = content.find('});', idx) + 3
    # Encontrar o próximo bloco de notificação ao barbeiro
    next_block = content.find('// Notificar barbeiro', end_block)
    if next_block == -1:
        next_block = end_block + 1
    content = content[:end_block] + '\n' + review_email_code + content[end_block:]

with open('/home/ubuntu/barber_app/server/public-routes.ts', 'w') as f:
    f.write(content)

print("OK: Página de avaliação e agendador de e-mail adicionados")
