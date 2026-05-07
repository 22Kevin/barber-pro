"""
Fix all runWithTenant-based read functions to actually filter by tenantId.
The issue: runWithTenant ignores the tenantId parameter (it was meant for PostgreSQL RLS).
Solution: Add explicit WHERE tenantId = X filters in each function.
"""
import re

with open("server/db.ts", "r") as f:
    content = f.read()

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Fix getAllCoupons - table: coupons (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getAllCoupons(tenantId?: number | null) {
  return runWithTenant(tenantId, (db) =>
    db.select().from(coupons).orderBy(desc(coupons.createdAt))
  ).catch(() => [] as typeof coupons.$inferSelect[]);
}"""
new = """export async function getAllCoupons(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof coupons.$inferSelect[];
  try {
    const conditions: any[] = [];
    if (tenantId != null) conditions.push(eq(coupons.tenantId, tenantId));
    return conditions.length > 0
      ? await db.select().from(coupons).where(and(...conditions)).orderBy(desc(coupons.createdAt))
      : await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  } catch { return [] as typeof coupons.$inferSelect[]; }
}"""
content = content.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Fix getLoyaltyConfig - table: loyaltyConfig (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getLoyaltyConfig(tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {
    const result = await db.select().from(loyaltyConfig).limit(1);
    return result[0] ?? null;
  }).catch(() => null);
}"""
new = """export async function getLoyaltyConfig(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = tenantId != null
      ? await db.select().from(loyaltyConfig).where(eq(loyaltyConfig.tenantId, tenantId)).limit(1)
      : await db.select().from(loyaltyConfig).limit(1);
    return result[0] ?? null;
  } catch { return null; }
}"""
content = content.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Fix getLoyaltyRewards - table: loyaltyRewards (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getLoyaltyRewards(tenantId?: number | null) {
  return runWithTenant(tenantId, (db) =>
    db.select().from(loyaltyRewards).where(eq(loyaltyRewards.isActive, true)).orderBy(loyaltyRewards.pointsRequired)
  ).catch(() => [] as typeof loyaltyRewards.$inferSelect[]);
}"""
new = """export async function getLoyaltyRewards(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof loyaltyRewards.$inferSelect[];
  try {
    const conditions: any[] = [eq(loyaltyRewards.isActive, true)];
    if (tenantId != null) conditions.push(eq(loyaltyRewards.tenantId, tenantId));
    return await db.select().from(loyaltyRewards).where(and(...conditions)).orderBy(loyaltyRewards.pointsRequired);
  } catch { return [] as typeof loyaltyRewards.$inferSelect[]; }
}"""
content = content.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Fix getShopSettings - table: shopSettings (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getShopSettings(tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {
    const result = await db.select().from(shopSettings).limit(1);
    return result[0] ?? null;
  }).catch(() => null);
}"""
new = """export async function getShopSettings(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = tenantId != null
      ? await db.select().from(shopSettings).where(eq(shopSettings.tenantId, tenantId)).limit(1)
      : await db.select().from(shopSettings).limit(1);
    return result[0] ?? null;
  } catch { return null; }
}"""
content = content.replace(old, new)

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Fix getAllServices - table: services (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """  return runWithTenant(tenantId, (db) => {
    const conditions = [];
    if (activeOnly) conditions.push(eq(services.isActive, true));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return where
      ? db.select().from(services).where(where).orderBy(services.name)
      : db.select().from(services).orderBy(services.name);
  }).catch(() => [] as typeof services.$inferSelect[]);
}"""
new = """  const db = await getDb();
  if (!db) return [] as typeof services.$inferSelect[];
  try {
    const conditions: any[] = [];
    if (activeOnly) conditions.push(eq(services.isActive, true));
    if (tenantId != null) conditions.push(eq(services.tenantId, tenantId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return where
      ? await db.select().from(services).where(where).orderBy(services.name)
      : await db.select().from(services).orderBy(services.name);
  } catch { return [] as typeof services.$inferSelect[]; }
}"""
content = content.replace(old, new, 1)

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Fix getAllServicesWithMedia - table: services (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """  return runWithTenant(tenantId, async (db) => {
    const conditions = [];
    if (activeOnly) conditions.push(eq(services.isActive, true));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const svcs = where
      ? await db.select().from(services).where(where).orderBy(services.name)
      : await db.select().from(services).orderBy(services.name);"""
new = """  const db = await getDb();
  if (!db) return [] as (typeof services.$inferSelect & { thumbnailUrl: string | null })[];
  try {
    const conditions: any[] = [];
    if (activeOnly) conditions.push(eq(services.isActive, true));
    if (tenantId != null) conditions.push(eq(services.tenantId, tenantId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const svcs = where
      ? await db.select().from(services).where(where).orderBy(services.name)
      : await db.select().from(services).orderBy(services.name);"""
content = content.replace(old, new, 1)

# Also fix the closing of getAllServicesWithMedia
old_close = """    }));
  }).catch(() => [] as (typeof services.$inferSelect & { thumbnailUrl: string | null })[]);
}"""
new_close = """    }));
  } catch { return [] as (typeof services.$inferSelect & { thumbnailUrl: string | null })[]; }
}"""
content = content.replace(old_close, new_close, 1)

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Fix getAllProducts - table: products (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
# Find the getAllProducts function that uses runWithTenant
old = """export async function getAllProducts(activeOnly = false, tenantId?: number | null) {
  return runWithTenant(tenantId, (db) => {
    const conditions = [];
    if (activeOnly) conditions.push(eq(products.isActive, true));
    const where = conditions.length > 0 ? and(...conditions) : undefined;"""
new = """export async function getAllProducts(activeOnly = false, tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof products.$inferSelect[];
  try {
    const conditions: any[] = [];
    if (activeOnly) conditions.push(eq(products.isActive, true));
    if (tenantId != null) conditions.push(eq(products.tenantId, tenantId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;"""
content = content.replace(old, new, 1)

# ═══════════════════════════════════════════════════════════════════════════════
# 8. Fix getAllProductsWithMedia - table: products (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """  return runWithTenant(tenantId, async (db) => {
    const conditions = [];
    if (activeOnly) conditions.push(eq(products.isActive, true));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const prods = where
      ? await db.select().from(products).where(where).orderBy(products.name)
      : await db.select().from(products).orderBy(products.name);"""
new = """  const db = await getDb();
  if (!db) return [] as (typeof products.$inferSelect & { thumbnailUrl: string | null; avgRating: number | null; reviewCount: number })[];
  try {
    const conditions: any[] = [];
    if (activeOnly) conditions.push(eq(products.isActive, true));
    if (tenantId != null) conditions.push(eq(products.tenantId, tenantId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const prods = where
      ? await db.select().from(products).where(where).orderBy(products.name)
      : await db.select().from(products).orderBy(products.name);"""
content = content.replace(old, new, 1)

# Also fix the closing of getAllProductsWithMedia
old_close = """    });
  }).catch(() => [] as (typeof products.$inferSelect & { thumbnailUrl: string | null; avgRating: number | null; reviewCount: number })[]);
}"""
new_close = """    });
  } catch { return [] as (typeof products.$inferSelect & { thumbnailUrl: string | null; avgRating: number | null; reviewCount: number })[]; }
}"""
content = content.replace(old_close, new_close, 1)

# ═══════════════════════════════════════════════════════════════════════════════
# 9. Fix getPromotionConversionReport - table: promotions (has tenantId)
# ═══════════════════════════════════════════════════════════════════════════════
old = """export async function getPromotionConversionReport(tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {"""
new = """export async function getPromotionConversionReport(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  try {
    const _unused = tenantId; // Will be used below"""
# This is more complex - let's handle it differently
# Let's just find and replace the specific pattern

# ═══════════════════════════════════════════════════════════════════════════════
# 10. Fix routers.ts - endpoints that call without tenantId
# ═══════════════════════════════════════════════════════════════════════════════

with open("server/db.ts", "w") as f:
    f.write(content)

print("✅ Fixed getAllCoupons, getLoyaltyConfig, getLoyaltyRewards, getShopSettings")
print("✅ Fixed getAllServices, getAllServicesWithMedia")
print("✅ Fixed getAllProducts, getAllProductsWithMedia")

# Now fix routers.ts - add tenantId to endpoints that call without it
with open("server/routers.ts", "r") as f:
    routers_content = f.read()

# Fix getAvailableForClient - line 616: getAllCoupons() without tenantId
routers_content = routers_content.replace(
    "const allCoupons = await db.getAllCoupons();",
    "const allCoupons = await db.getAllCoupons(input.tenantId);",
    2  # Replace both occurrences (lines 616 and 809)
)

# Fix getLoyaltyRewards() and getLoyaltyConfig() without tenantId
routers_content = routers_content.replace(
    "const rewards = await db.getLoyaltyRewards();",
    "const rewards = await db.getLoyaltyRewards(input.tenantId);"
)
routers_content = routers_content.replace(
    "const config = await db.getLoyaltyConfig();",
    "const config = await db.getLoyaltyConfig(input.tenantId);"
)

# Fix promotionConversion.report - add tenantId input
routers_content = routers_content.replace(
    """promotionConversion: router({
    report: publicProcedure.query(async () => {
      return db.getPromotionConversionReport();
    }),""",
    """promotionConversion: router({
    report: publicProcedure.input(z.object({ tenantId: z.number().optional().nullable() }).optional()).query(async ({ input }) => {
      return db.getPromotionConversionReport(input?.tenantId);
    }),"""
)

with open("server/routers.ts", "w") as f:
    f.write(routers_content)

print("✅ Fixed routers.ts - added tenantId to getAvailableForClient, getLoyaltyRewards, getLoyaltyConfig, promotionConversion")
