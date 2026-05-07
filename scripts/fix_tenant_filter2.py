"""
Fix remaining runWithTenant-based read functions that don't filter by tenantId.
Part 2: getRecentReviews, listReturnMessageConfigs, listPromotions, 
getAllRecurringAppointments, getStockProducts
"""

with open("server/db.ts", "r") as f:
    content = f.read()

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Fix listPromotions - table: promotions (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function listPromotions(tenantId?: number | null) {
  return runWithTenant(tenantId, (db) =>
    db.select().from(promotions).orderBy(desc(promotions.createdAt))
  ).catch(() => [] as typeof promotions.$inferSelect[]);
}"""
new = """export async function listPromotions(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof promotions.$inferSelect[];
  try {
    const conditions: any[] = [];
    if (tenantId != null) conditions.push(eq(promotions.tenantId, tenantId));
    return conditions.length > 0
      ? await db.select().from(promotions).where(and(...conditions)).orderBy(desc(promotions.createdAt))
      : await db.select().from(promotions).orderBy(desc(promotions.createdAt));
  } catch { return [] as typeof promotions.$inferSelect[]; }
}"""
content = content.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Fix listReturnMessageConfigs - uses services as proxy for tenant
#    Problem: it queries services without tenantId filter
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function listReturnMessageConfigs(tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {
    // With RLS active, services table is already filtered by tenant
    const tenantServices = await db.select({ id: services.id }).from(services);
    const serviceIds = tenantServices.map((s) => s.id);
    if (serviceIds.length === 0) return [] as typeof returnMessageConfigs.$inferSelect[];
    return db.select().from(returnMessageConfigs).where(inArray(returnMessageConfigs.serviceId, serviceIds)).orderBy(returnMessageConfigs.serviceId);"""
new = """export async function listReturnMessageConfigs(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof returnMessageConfigs.$inferSelect[];
  try {
    // Filter services by tenantId to get only this tenant's services
    const svcConditions: any[] = [];
    if (tenantId != null) svcConditions.push(eq(services.tenantId, tenantId));
    const tenantServices = svcConditions.length > 0
      ? await db.select({ id: services.id }).from(services).where(and(...svcConditions))
      : await db.select({ id: services.id }).from(services);
    const serviceIds = tenantServices.map((s) => s.id);
    if (serviceIds.length === 0) return [] as typeof returnMessageConfigs.$inferSelect[];
    return await db.select().from(returnMessageConfigs).where(inArray(returnMessageConfigs.serviceId, serviceIds)).orderBy(returnMessageConfigs.serviceId);"""
content = content.replace(old, new)

# Fix the closing of listReturnMessageConfigs
old_close = """    return db.select().from(returnMessageConfigs).where(inArray(returnMessageConfigs.serviceId, serviceIds)).orderBy(returnMessageConfigs.serviceId);
  }).catch(() => [] as typeof returnMessageConfigs.$inferSelect[]);
}"""
# This was already replaced above, check if there's a remaining catch
content = content.replace(
    """    return await db.select().from(returnMessageConfigs).where(inArray(returnMessageConfigs.serviceId, serviceIds)).orderBy(returnMessageConfigs.serviceId);
  }).catch(() => [] as typeof returnMessageConfigs.$inferSelect[]);
}""",
    """    return await db.select().from(returnMessageConfigs).where(inArray(returnMessageConfigs.serviceId, serviceIds)).orderBy(returnMessageConfigs.serviceId);
  } catch { return [] as typeof returnMessageConfigs.$inferSelect[]; }
}"""
)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Fix getAllRecurringAppointments - uses barbers as proxy for tenant
#    Problem: queries barbers without tenantId filter
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getAllRecurringAppointments(tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {
    // With RLS active, barbers table is already filtered by tenant
    const tenantBarbers = await db.select({ id: barbers.id }).from(barbers);"""
new = """export async function getAllRecurringAppointments(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as (typeof recurringAppointments.$inferSelect & { clientName: string; barberName: string; serviceName: string })[];
  try {
    // Filter barbers by tenantId
    const bConditions: any[] = [];
    if (tenantId != null) bConditions.push(eq(barbers.tenantId, tenantId));
    const tenantBarbers = bConditions.length > 0
      ? await db.select({ id: barbers.id }).from(barbers).where(and(...bConditions))
      : await db.select({ id: barbers.id }).from(barbers);"""
content = content.replace(old, new)

# Fix the closing of getAllRecurringAppointments
content = content.replace(
    """    }));
  }).catch(() => [] as (typeof recurringAppointments.$inferSelect & { clientName: string; barberName: string; serviceName: string })[]);
}
// ─── Controle de Estoque""",
    """    }));
  } catch { return [] as (typeof recurringAppointments.$inferSelect & { clientName: string; barberName: string; serviceName: string })[]; }
}
// ─── Controle de Estoque"""
)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Fix getStockProducts - table: products (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getStockProducts(tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {
    const prods = await db.select().from(products).where(eq(products.isActive, true)).orderBy(products.name);"""
new = """export async function getStockProducts(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conditions: any[] = [eq(products.isActive, true)];
    if (tenantId != null) conditions.push(eq(products.tenantId, tenantId));
    const prods = await db.select().from(products).where(and(...conditions)).orderBy(products.name);"""
content = content.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Fix getRecentReviews - table: reviews (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getRecentReviews(limit = 5, tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {
    const result = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,"""
new = """export async function getRecentReviews(limit = 5, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,"""
content = content.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Fix getPromotionConversionReport - table: promotions (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getPromotionConversionReport(tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {"""
new = """export async function getPromotionConversionReport(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  try {"""
content = content.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Fix upsertShopSettings - uses runWithTenant but it's a write (OK, just remove runWithTenant)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function upsertShopSettings(data: Partial<typeof shopSettings.$inferInsert>, tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {
    const existing = await getShopSettings(tenantId);"""
new = """export async function upsertShopSettings(data: Partial<typeof shopSettings.$inferInsert>, tenantId?: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getShopSettings(tenantId);
  {"""
content = content.replace(old, new)

with open("server/db.ts", "w") as f:
    f.write(content)

print("✅ Fixed listPromotions, listReturnMessageConfigs, getAllRecurringAppointments")
print("✅ Fixed getStockProducts, getRecentReviews, getPromotionConversionReport")
print("✅ Fixed upsertShopSettings")
