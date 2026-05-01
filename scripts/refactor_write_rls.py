#!/usr/bin/env python3
"""
Refatora as funções de escrita do db.ts para usar runWithTenant() onde tenantId está disponível.
"""

with open('server/db.ts', 'r') as f:
    content = f.read()

replacements = []

# ─── createBarber ─────────────────────────────────────────────────────────────
replacements.append((
    'export async function createBarber(data: InsertBarber) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const result = await db.insert(barbers).values(data).returning({ id: barbers.id });\n'
    '  return result[0].id;\n'
    '}',
    'export async function createBarber(data: InsertBarber) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const result = await db.insert(barbers).values(data).returning({ id: barbers.id });\n'
    '    return result[0].id;\n'
    '  });\n'
    '}'
))

# ─── createClient ─────────────────────────────────────────────────────────────
replacements.append((
    'export async function createClient(data: InsertClient) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const result = await db.insert(clients).values(data).returning({ id: clients.id });\n'
    '  return result[0].id;\n'
    '}',
    'export async function createClient(data: InsertClient) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const result = await db.insert(clients).values(data).returning({ id: clients.id });\n'
    '    return result[0].id;\n'
    '  });\n'
    '}'
))

# ─── createService ─────────────────────────────────────────────────────────────
replacements.append((
    'export async function createService(data: InsertService) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const result = await db.insert(services).values(data).returning({ id: services.id });\n'
    '  return result[0].id;\n'
    '}',
    'export async function createService(data: InsertService) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const result = await db.insert(services).values(data).returning({ id: services.id });\n'
    '    return result[0].id;\n'
    '  });\n'
    '}'
))

# ─── createProduct ─────────────────────────────────────────────────────────────
replacements.append((
    'export async function createProduct(data: InsertProduct) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const result = await db.insert(products).values(data).returning({ id: products.id });\n'
    '  return result[0].id;\n'
    '}',
    'export async function createProduct(data: InsertProduct) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const result = await db.insert(products).values(data).returning({ id: products.id });\n'
    '    return result[0].id;\n'
    '  });\n'
    '}'
))

# ─── createCoupon ─────────────────────────────────────────────────────────────
replacements.append((
    'export async function createCoupon(data: { code: string; description?: string; discountType: "percent" | "fixed"; discountValue: string; minOrderValue?: string; maxUses?: number; validFrom?: string; validUntil?: string; tenantId?: number | null }) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const result = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() }).returning({ id: coupons.id });\n'
    '  return result[0].id;\n'
    '}',
    'export async function createCoupon(data: { code: string; description?: string; discountType: "percent" | "fixed"; discountValue: string; minOrderValue?: string; maxUses?: number; validFrom?: string; validUntil?: string; tenantId?: number | null }) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const result = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() }).returning({ id: coupons.id });\n'
    '    return result[0].id;\n'
    '  });\n'
    '}'
))

# ─── upsertLoyaltyConfig ──────────────────────────────────────────────────────
replacements.append((
    'export async function upsertLoyaltyConfig(data: { isActive: boolean; pointsPerService: number; pointsPerReal: string; pointsExpireMonths: number; tenantId?: number | null }) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const existing = await getLoyaltyConfig(data.tenantId);\n'
    '  if (existing) {\n'
    '    await db.update(loyaltyConfig).set(data).where(eq(loyaltyConfig.id, existing.id));\n'
    '  } else {\n'
    '    await db.insert(loyaltyConfig).values(data).returning({ id: loyaltyConfig.id });\n'
    '  }\n'
    '}',
    'export async function upsertLoyaltyConfig(data: { isActive: boolean; pointsPerService: number; pointsPerReal: string; pointsExpireMonths: number; tenantId?: number | null }) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const existing = await getLoyaltyConfig(data.tenantId);\n'
    '    if (existing) {\n'
    '      await db.update(loyaltyConfig).set(data).where(eq(loyaltyConfig.id, existing.id));\n'
    '    } else {\n'
    '      await db.insert(loyaltyConfig).values(data).returning({ id: loyaltyConfig.id });\n'
    '    }\n'
    '  });\n'
    '}'
))

# ─── createLoyaltyReward ──────────────────────────────────────────────────────
replacements.append((
    'export async function createLoyaltyReward(data: { name: string; description?: string; pointsRequired: number; rewardType: "free_service" | "discount_percent" | "discount_fixed" | "free_product"; rewardValue?: string; tenantId?: number | null }) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const result = await db.insert(loyaltyRewards).values(data).returning({ id: loyaltyRewards.id });\n'
    '  return result[0].id;\n'
    '}',
    'export async function createLoyaltyReward(data: { name: string; description?: string; pointsRequired: number; rewardType: "free_service" | "discount_percent" | "discount_fixed" | "free_product"; rewardValue?: string; tenantId?: number | null }) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const result = await db.insert(loyaltyRewards).values(data).returning({ id: loyaltyRewards.id });\n'
    '    return result[0].id;\n'
    '  });\n'
    '}'
))

# ─── upsertShopSettings ───────────────────────────────────────────────────────
replacements.append((
    'export async function upsertShopSettings(data: Partial<typeof shopSettings.$inferInsert>, tenantId?: number | null) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const existing = await getShopSettings(tenantId);\n'
    '  if (existing) {\n'
    '    await db.update(shopSettings).set(data).where(eq(shopSettings.id, existing.id));\n'
    '  } else {\n'
    '    await db.insert(shopSettings).values({ shopName: "Barber Pro", ...data, ...(tenantId != null ? { tenantId } : {}) }).returning({ id: shopSettings.id });\n'
    '  }\n'
    '}',
    'export async function upsertShopSettings(data: Partial<typeof shopSettings.$inferInsert>, tenantId?: number | null) {\n'
    '  return runWithTenant(tenantId, async (db) => {\n'
    '    const existing = await getShopSettings(tenantId);\n'
    '    if (existing) {\n'
    '      await db.update(shopSettings).set(data).where(eq(shopSettings.id, existing.id));\n'
    '    } else {\n'
    '      await db.insert(shopSettings).values({ shopName: "Barber Pro", ...data, ...(tenantId != null ? { tenantId } : {}) }).returning({ id: shopSettings.id });\n'
    '    }\n'
    '  });\n'
    '}'
))

# ─── createReview ─────────────────────────────────────────────────────────────
replacements.append((
    'export async function createReview(data: { tenantId: number; clientId: number; serviceId?: number | null; appointmentId?: number | null; productId?: number | null; orderId?: number | null; rating: number; comment?: string }) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const result = await db.insert(reviews).values(data).returning({ id: reviews.id });\n'
    '  return result[0].id;\n'
    '}',
    'export async function createReview(data: { tenantId: number; clientId: number; serviceId?: number | null; appointmentId?: number | null; productId?: number | null; orderId?: number | null; rating: number; comment?: string }) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const result = await db.insert(reviews).values(data).returning({ id: reviews.id });\n'
    '    return result[0].id;\n'
    '  });\n'
    '}'
))

# ─── createPromotion ──────────────────────────────────────────────────────────
replacements.append((
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  await db.insert(promotions).values({ ...input, sentAt: new Date() }).returning({ id: promotions.id });\n'
    '  return { success: true, recipientCount: input.recipientCount };\n'
    '}',
    '  return runWithTenant(input.tenantId, async (db) => {\n'
    '    await db.insert(promotions).values({ ...input, sentAt: new Date() }).returning({ id: promotions.id });\n'
    '    return { success: true, recipientCount: input.recipientCount };\n'
    '  });\n'
    '}'
))

# ─── createExpense ─────────────────────────────────────────────────────────────
replacements.append((
    'export async function createExpense(data: InsertExpense) {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  const result = await db.insert(expenses).values(data).returning({ id: expenses.id });\n'
    '  return result[0].id;\n'
    '}',
    'export async function createExpense(data: InsertExpense) {\n'
    '  return runWithTenant(data.tenantId, async (db) => {\n'
    '    const result = await db.insert(expenses).values(data).returning({ id: expenses.id });\n'
    '    return result[0].id;\n'
    '  });\n'
    '}'
))

# ─── createShopSettingsForTenant ──────────────────────────────────────────────
replacements.append((
    'export async function createShopSettingsForTenant(tenantId: number, data: {\n'
    '  shopName: string;\n'
    '  phone?: string;\n'
    '  cnpj?: string;\n'
    '  instagram?: string;\n'
    '  cep?: string;\n'
    '  address?: string;\n'
    '  addressNumber?: string;\n'
    '  addressComplement?: string;\n'
    '}): Promise<void> {\n'
    '  const db = await getDb();\n'
    '  if (!db) throw new Error("Database not available");\n'
    '  await db.insert(shopSettings).values({\n'
    '    tenantId,\n'
    '    shopName: data.shopName,\n'
    '    phone: data.phone,\n'
    '    cnpj: data.cnpj,\n'
    '    instagram: data.instagram,\n'
    '    cep: data.cep,\n'
    '    address: data.address,\n'
    '    addressNumber: data.addressNumber,\n'
    '    addressComplement: data.addressComplement,\n'
    '  }).returning({ id: shopSettings.id });\n'
    '}',
    'export async function createShopSettingsForTenant(tenantId: number, data: {\n'
    '  shopName: string;\n'
    '  phone?: string;\n'
    '  cnpj?: string;\n'
    '  instagram?: string;\n'
    '  cep?: string;\n'
    '  address?: string;\n'
    '  addressNumber?: string;\n'
    '  addressComplement?: string;\n'
    '}): Promise<void> {\n'
    '  await runWithTenant(tenantId, async (db) => {\n'
    '    await db.insert(shopSettings).values({\n'
    '      tenantId,\n'
    '      shopName: data.shopName,\n'
    '      phone: data.phone,\n'
    '      cnpj: data.cnpj,\n'
    '      instagram: data.instagram,\n'
    '      cep: data.cep,\n'
    '      address: data.address,\n'
    '      addressNumber: data.addressNumber,\n'
    '      addressComplement: data.addressComplement,\n'
    '    }).returning({ id: shopSettings.id });\n'
    '  });\n'
    '}'
))

# ─── upsertOrbitLead ──────────────────────────────────────────────────────────
replacements.append((
    'export async function upsertOrbitLead(clientId: number, tenantId: number, source: "link" | "geo"): Promise<void> {\n'
    '  const db = await getDb();\n'
    '  if (!db) return;\n'
    '  try {\n'
    '    // Verificar se já existe um lead não convertido para este par cliente/tenant\n'
    '    const existing = await db\n'
    '      .select({ id: orbitLeads.id })\n'
    '      .from(orbitLeads)\n'
    '      .where(and(eq(orbitLeads.clientId, clientId), eq(orbitLeads.tenantId, tenantId)))\n'
    '      .limit(1);\n'
    '    if (existing.length === 0) {\n'
    '      await db.insert(orbitLeads).values({ clientId, tenantId, source, loginAt: new Date() }).returning({ id: orbitLeads.id });\n'
    '    }\n'
    '    // Se já existe, não atualiza (preserva o loginAt original)\n'
    '  } catch (err) {\n'
    '    console.error("[orbitLead] upsertOrbitLead error:", err);\n'
    '  }\n'
    '}',
    'export async function upsertOrbitLead(clientId: number, tenantId: number, source: "link" | "geo"): Promise<void> {\n'
    '  try {\n'
    '    await runWithTenant(tenantId, async (db) => {\n'
    '      // Verificar se já existe um lead não convertido para este par cliente/tenant\n'
    '      const existing = await db\n'
    '        .select({ id: orbitLeads.id })\n'
    '        .from(orbitLeads)\n'
    '        .where(and(eq(orbitLeads.clientId, clientId), eq(orbitLeads.tenantId, tenantId)))\n'
    '        .limit(1);\n'
    '      if (existing.length === 0) {\n'
    '        await db.insert(orbitLeads).values({ clientId, tenantId, source, loginAt: new Date() }).returning({ id: orbitLeads.id });\n'
    '      }\n'
    '      // Se já existe, não atualiza (preserva o loginAt original)\n'
    '    });\n'
    '  } catch (err) {\n'
    '    console.error("[orbitLead] upsertOrbitLead error:", err);\n'
    '  }\n'
    '}'
))

# Apply all replacements
applied = 0
not_found = []
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        applied += 1
    else:
        # Try to find a partial match for debugging
        first_line = old.split('\n')[0]
        not_found.append(first_line[:80])

with open('server/db.ts', 'w') as f:
    f.write(content)

print(f"Applied: {applied}/{len(replacements)}")
if not_found:
    print("NOT FOUND:")
    for nf in not_found:
        print(f"  - {nf}")
