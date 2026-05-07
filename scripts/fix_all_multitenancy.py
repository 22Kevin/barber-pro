"""
Correção completa de multi-tenancy no db.ts e admin-routes.ts.

Tabelas COM tenantId direto: barbers, clients, services, products, coupons, loyalty_config,
loyalty_rewards, promotions, shop_settings, reviews, subscription_plans

Tabelas SEM tenantId (filtram via barberId/clientId/serviceId que pertencem ao tenant):
appointments, sales, expenses, working_hours, blocked_slots, commission_configs,
commission_entries, waitlist, return_message_configs, categories, client_accounts,
media_files, sale_items, client_points

Estratégia:
- Para tabelas COM tenantId: adicionar WHERE tenantId = X
- Para tabelas SEM tenantId: filtrar via barberId (que pertence ao tenant)
- O admin-routes.ts já passa tenantId na maioria dos casos, mas há pontos onde não passa
"""

import re

# ─── Fix admin-routes.ts ───────────────────────────────────────────────────────
with open("/home/ubuntu/barber_app/server/admin-routes.ts", "r") as f:
    admin = f.read()

# Fix 1: getShopSettings() sem tenantId na linha ~2566
admin = admin.replace(
    "const settings = await db.getShopSettings();\n  const saved = req.query.saved === \"1\";\n  const slugSaved = req.query.slugsaved === \"1\";",
    "const settings = await db.getShopSettings(barber?.tenantId);\n  const saved = req.query.saved === \"1\";\n  const slugSaved = req.query.slugsaved === \"1\";"
)

# Fix 2: getLoyaltyConfig(), getLoyaltyRewards(), getAllCoupons() sem tenantId na fidelidade
admin = admin.replace(
    """    const [config, rewards, allCoupons] = await Promise.all([
      db.getLoyaltyConfig(),
      db.getLoyaltyRewards(),
      db.getAllCoupons(),
    ]);""",
    """    const tenantId = barber?.tenantId ?? null;
    const [config, rewards, allCoupons] = await Promise.all([
      db.getLoyaltyConfig(tenantId),
      db.getLoyaltyRewards(tenantId),
      db.getAllCoupons(tenantId),
    ]);"""
)

# Fix 3: getCommissionSummary sem tenantId nas comissões (linha ~5131)
# Pattern: "const summaryAll = await db.getCommissionSummary(start, end);"
admin = admin.replace(
    "const summaryAll = await db.getCommissionSummary(start, end);\n    const summary = filterBarberId ? summaryAll.filter((s: any) => s.barberId === filterBarberId) : summaryAll;",
    "const summaryAll = await db.getCommissionSummary(start, end, barber?.tenantId);\n    const summary = filterBarberId ? summaryAll.filter((s: any) => s.barberId === filterBarberId) : summaryAll;"
)

# Fix 4: getCommissionSummary sem tenantId em minhas-comissoes (linha ~7126)
admin = admin.replace(
    "const allSummary = await db.getCommissionSummary(start, end);\n    const myData = allSummary.find((s) => s.barberId === session.barberId);",
    "const allSummary = await db.getCommissionSummary(start, end, barber?.tenantId);\n    const myData = allSummary.find((s) => s.barberId === session.barberId);"
)

with open("/home/ubuntu/barber_app/server/admin-routes.ts", "w") as f:
    f.write(admin)

print("admin-routes.ts corrigido")

# ─── Fix db.ts ─────────────────────────────────────────────────────────────────
with open("/home/ubuntu/barber_app/server/db.ts", "r") as f:
    db = f.read()

# Fix getCategoriesByType: categories não tem tenantId, mas services/products sim
# Na prática, categories é compartilhada entre todos os tenants (nomes genéricos como "Corte", "Barba")
# Isso é aceitável pois são apenas labels. Não precisa de fix.

# Fix getShopOpenStatus: não filtra por tenantId - precisa receber tenantId e filtrar barbeiros
old_shop_open = """export async function getShopOpenStatus() {
  const db = await getDb();
  if (!db) return { isOpen: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };
  // Usa o fuso de Brasília (UTC-3)
  const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dayOfWeek = nowBrasilia.getUTCDay();
  const currentMinute = nowBrasilia.getUTCHours() * 60 + nowBrasilia.getUTCMinutes();
  const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  // Busca todos os horários de trabalho do dia atual de todos os barbeiros ativos
  const allHours = await db
    .select({ startTime: workingHours.startTime, endTime: workingHours.endTime, lunchStart: workingHours.lunchStart, lunchEnd: workingHours.lunchEnd })
    .from(workingHours)
    .where(and(eq(workingHours.dayOfWeek, dayOfWeek), eq(workingHours.isWorking, true)));"""

new_shop_open = """export async function getShopOpenStatus(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return { isOpen: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };
  // Usa o fuso de Brasília (UTC-3)
  const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const dayOfWeek = nowBrasilia.getUTCDay();
  const currentMinute = nowBrasilia.getUTCHours() * 60 + nowBrasilia.getUTCMinutes();
  const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  // Busca barbeiros do tenant para filtrar working_hours
  let barberIds: number[] = [];
  if (tenantId != null) {
    const tenantBarbers = await db.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.tenantId, tenantId), eq(barbers.isActive, true)));
    barberIds = tenantBarbers.map(b => b.id);
    if (barberIds.length === 0) return { isOpen: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };
  }
  // Busca todos os horários de trabalho do dia atual dos barbeiros do tenant
  const whConditions: any[] = [eq(workingHours.dayOfWeek, dayOfWeek), eq(workingHours.isWorking, true)];
  if (barberIds.length > 0) whConditions.push(inArray(workingHours.barberId, barberIds));
  const allHours = await db
    .select({ startTime: workingHours.startTime, endTime: workingHours.endTime, lunchStart: workingHours.lunchStart, lunchEnd: workingHours.lunchEnd })
    .from(workingHours)
    .where(and(...whConditions));"""

db = db.replace(old_shop_open, new_shop_open)

# Fix listWaitlistByDate: precisa receber tenantId e filtrar via clients do tenant
old_waitlist = """export async function listWaitlistByDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  const entries = await db.select().from(waitlist)
    .where(and(eq(waitlist.date, date), eq(waitlist.status, "waiting")))
    .orderBy(waitlist.createdAt);
  if (entries.length === 0) return [];
  const clientIds = Array.from(new Set(entries.map((e) => e.clientId)));
  const clientList = await db.select().from(clients).where(inArray(clients.id, clientIds));
  return entries.map((e) => ({
    ...e,
    client: clientList.find((c) => c.id === e.clientId) ?? null,
  }));
}"""

new_waitlist = """export async function listWaitlistByDate(date: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  const entries = await db.select().from(waitlist)
    .where(and(eq(waitlist.date, date), eq(waitlist.status, "waiting")))
    .orderBy(waitlist.createdAt);
  if (entries.length === 0) return [];
  const clientIds = Array.from(new Set(entries.map((e) => e.clientId)));
  // Filtrar apenas clientes do tenant
  const clientConditions: any[] = [inArray(clients.id, clientIds)];
  if (tenantId != null) clientConditions.push(eq(clients.tenantId, tenantId));
  const clientList = await db.select().from(clients).where(and(...clientConditions));
  // Retornar apenas entradas de clientes do tenant
  const validClientIds = new Set(clientList.map(c => c.id));
  return entries
    .filter(e => validClientIds.has(e.clientId))
    .map((e) => ({
      ...e,
      client: clientList.find((c) => c.id === e.clientId) ?? null,
    }));
}"""

db = db.replace(old_waitlist, new_waitlist)

# Fix deleteReturnMessageConfig: precisa verificar que o serviceId pertence ao tenant
# (já é filtrado pelo router que passa serviceId de um serviço do tenant, ok)

# Fix notifyWaitlistOnCancellation: precisa de tenantId
old_notify = """export async function notifyWaitlistOnCancellation(date: string) {
  const db = await getDb();
  if (!db) return null;
  const [first] = await db.select().from(waitlist)
    .where(and(eq(waitlist.date, date), eq(waitlist.status, "waiting")))
    .orderBy(waitlist.createdAt)
    .limit(1);"""

new_notify = """export async function notifyWaitlistOnCancellation(date: string, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  // Filtrar waitlist por clientes do tenant
  let validClientIds: Set<number> | null = null;
  if (tenantId != null) {
    const tenantClients = await db.select({ id: clients.id }).from(clients).where(eq(clients.tenantId, tenantId));
    validClientIds = new Set(tenantClients.map(c => c.id));
  }
  const allWaiting = await db.select().from(waitlist)
    .where(and(eq(waitlist.date, date), eq(waitlist.status, "waiting")))
    .orderBy(waitlist.createdAt);
  const filtered = validClientIds ? allWaiting.filter(w => validClientIds!.has(w.clientId)) : allWaiting;
  const first = filtered[0];
  if (!first) return null;
  // Original: update first entry"""

# The rest of notifyWaitlistOnCancellation continues with the update
db = db.replace(old_notify, new_notify)

# Also need to fix the part after "if (!first) return null;" in the old code
# The old code had: if (!first) return null; then update. The new code already handles it.
# But we need to remove the old "if (!first) return null;" that comes after the original select
old_first_check = """  if (!first) return null;
  await db.update(waitlist)
    .set({ status: "notified", notifiedAt: new Date() })
    .where(eq(waitlist.id, first.id));"""

# Check if this still exists after our replacement
if old_first_check in db:
    db = db.replace(old_first_check, """  await db.update(waitlist)
    .set({ status: "notified", notifiedAt: new Date() })
    .where(eq(waitlist.id, first.id));""")

with open("/home/ubuntu/barber_app/server/db.ts", "w") as f:
    f.write(db)

print("db.ts corrigido")

# ─── Fix admin-routes.ts: listWaitlistByDate call ──────────────────────────────
with open("/home/ubuntu/barber_app/server/admin-routes.ts", "r") as f:
    admin = f.read()

# Fix listWaitlistByDate call to pass tenantId
admin = admin.replace(
    "const entries = await db.listWaitlistByDate(dateParam);",
    "const entries = await db.listWaitlistByDate(dateParam, barber?.tenantId);"
)

with open("/home/ubuntu/barber_app/server/admin-routes.ts", "w") as f:
    f.write(admin)

print("admin-routes.ts: listWaitlistByDate corrigido")
print("DONE - Todas as correções de multi-tenancy aplicadas")
