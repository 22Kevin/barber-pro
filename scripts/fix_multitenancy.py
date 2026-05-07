#!/usr/bin/env python3
"""
Aplica todas as correções de multi-tenancy e migração pg→mysql2 de uma vez.
"""
import re, sys

def fix_file(path, transforms):
    with open(path, 'r') as f:
        content = f.read()
    original = content
    for find, replace in transforms:
        if isinstance(find, str):
            content = content.replace(find, replace)
        else:
            content = re.sub(find, replace, content)
    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f"  ✓ {path}")
    else:
        print(f"  ~ {path} (no changes)")
    return content

print("=== 1. Migrando server/db.ts: pg → mysql2 ===")
fix_file('/home/ubuntu/barber_app/server/db.ts', [
    # 1. Trocar imports
    (
        'import { and, count, desc, eq, gte, inArray, like, lte, notInArray, sql } from "drizzle-orm";\nimport { drizzle } from "drizzle-orm/node-postgres";\nimport { Pool } from "pg";\n\n// Re-export sql tagged template for use in other modules\nexport { sql as sqlRaw };',
        'import { and, count, desc, eq, gte, inArray, like, lte, notInArray, sql } from "drizzle-orm";\nimport { drizzle } from "drizzle-orm/mysql2";\nimport { createPool, type Pool as MySqlPool } from "mysql2/promise";\n\n// Re-export sql tagged template for use in other modules\nexport { sql as sqlRaw };'
    ),
    # 2. Trocar resetPool + Pool + getDb
    (
        '''// Reconexão automática: limpa o pool se houver erro de conexão SSL/timeout
function resetPool() {
  if (_pool) {
    _pool.end().catch(() => {});
    _pool = null;
    _db = null;
  }
}

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        // keepAlive mantém conexões TCP ativas e evita erros SSL intermitentes
        // quando o Railway recicla conexões ociosas
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        ssl: { rejectUnauthorized: false },
      });
      // Reconexão automática em erros de conexão SSL/timeout
      _pool.on('error', (err: Error) => {
        console.warn('[Database] Pool error, will reconnect on next request:', err.message);
        resetPool();
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}''',
        '''let _db: ReturnType<typeof drizzle> | null = null;
let _pool: MySqlPool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: { rejectUnauthorized: false },
      });
      _db = drizzle(_pool as any);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}'''
    ),
    # 3. Trocar withTenant + runWithTenant (RLS PostgreSQL) por runWithTenant simples
    (
        '''/**
 * Executa uma função com o tenant_id configurado na sessão PostgreSQL.
 * Isso ativa as políticas RLS para isolar dados entre tenants.
 * 
 * @param tenantId - ID do tenant atual (null = sem restrição, para superadmin)
 * @param fn - Função a ser executada com o tenant configurado
 */
export async function withTenant<T>(
  tenantId: number | null | undefined,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  if (!_pool) await getDb();
  if (!_pool || !_db) throw new Error("Database not available");

  const client = await _pool.connect();
  try {
    const tenantDb = drizzle(client as any);
    // SET LOCAL requer uma transação ativa para persistir entre queries
    await client.query('BEGIN');
    if (tenantId != null) {
      // Usar role não-superuser para que RLS seja aplicado
      await client.query('SET LOCAL ROLE barber_app');
      await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await client.query(`SET LOCAL app.is_superadmin = 'false'`);
    } else {
      // Superadmin: sem restrição de tenant
      await client.query(`SET LOCAL app.tenant_id = ''`);
      await client.query(`SET LOCAL app.is_superadmin = 'true'`);
    }
    try {
      const result = await fn(tenantDb);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

/**
 * Helper que executa uma query com RLS ativado quando tenantId é fornecido.
 * Substitui o padrão: const db = await getDb(); if (tenantId != null) { ... }
 * 
 * Uso: return runWithTenant(tenantId, (db) => db.select().from(table)...)
 */
export async function runWithTenant<T>(
  tenantId: number | null | undefined,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  if (tenantId != null) {
    return withTenant(tenantId, fn);
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return fn(db);
}''',
        '''/**
 * Executa uma função com o banco MySQL/TiDB.
 * O isolamento multi-tenant é feito via WHERE tenantId nas queries.
 * Este helper existe apenas para compatibilidade com o código existente.
 */
export async function runWithTenant<T>(
  _tenantId: number | null | undefined,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return fn(db);
}'''
    ),
    # 4. Substituir .returning({ id: X.id }) por .$returningId()
    (re.compile(r'\.returning\(\{\s*id:\s*\w+\.id\s*\}\)'), '.$returningId()'),
    # 5. Substituir onConflictDoUpdate por onDuplicateKeyUpdate
    (
        'await db.insert(users).values(values).onConflictDoUpdate({\n      target: users.openId,\n      set: updateSet,\n    });',
        'await db.insert(users).values(values).onDuplicateKeyUpdate({\n      set: updateSet,\n    });'
    ),
    # 6. Corrigir [...new Set(expr)] → Array.from(new Set(expr))
    (re.compile(r'\[\.\.\.(new Set\([^)]+\))\]'), r'Array.from(\1)'),
])

print("\n=== 2. Corrigindo funções de comissão no server/db.ts ===")
with open('/home/ubuntu/barber_app/server/db.ts', 'r') as f:
    content = f.read()

# Corrigir listCommissionConfigs para filtrar por tenantId
old_listConfigs = '''export async function listCommissionConfigs(tenantId?: number | null) {
  return runWithTenant(tenantId, async (db) => {
    // With RLS active, barbers table is already filtered by tenant
    const [configs, barberList] = await Promise.all([
      db.select().from(commissionConfigs),
      db.select().from(barbers).where(eq(barbers.isActive, true)),
    ]);
    return barberList.map((b) => ({
      ...b,
      commissionRate: parseFloat(configs.find((c) => c.barberId === b.id)?.defaultRate ?? "50"),
      hasConfig: configs.some((c) => c.barberId === b.id),
    }));
  }).catch(() => [] as (typeof barbers.$inferSelect & { commissionRate: number; hasConfig: boolean })[]);
}'''

new_listConfigs = '''export async function listCommissionConfigs(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as (typeof barbers.$inferSelect & { commissionRate: number; hasConfig: boolean })[];
  try {
    const barberConditions: any[] = [eq(barbers.isActive, true)];
    if (tenantId != null) barberConditions.push(eq(barbers.tenantId, tenantId));
    const [configs, barberList] = await Promise.all([
      db.select().from(commissionConfigs),
      db.select().from(barbers).where(and(...barberConditions)),
    ]);
    return barberList.map((b) => ({
      ...b,
      commissionRate: parseFloat(configs.find((c) => c.barberId === b.id)?.defaultRate ?? "50"),
      hasConfig: configs.some((c) => c.barberId === b.id),
    }));
  } catch {
    return [] as (typeof barbers.$inferSelect & { commissionRate: number; hasConfig: boolean })[];
  }
}'''

content = content.replace(old_listConfigs, new_listConfigs)

# Corrigir listCommissionEntries para filtrar por tenantId
old_listEntries = '''export async function listCommissionEntries(input: {
  barberId?: number;
  startDate: string;
  endDate: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    gte(commissionEntries.date, input.startDate),
    lte(commissionEntries.date, input.endDate),
  ];
  if (input.barberId) conditions.push(eq(commissionEntries.barberId, input.barberId));
  const entries = await db.select().from(commissionEntries)
    .where(and(...conditions))
    .orderBy(desc(commissionEntries.date));
  const barberList = await db.select().from(barbers);
  return entries.map((e) => ({
    ...e,
    barberName: barberList.find((b) => b.id === e.barberId)?.name ?? "—",
    grossValue: parseFloat(e.grossValue),
    commissionRate: parseFloat(e.commissionRate),
    commissionValue: parseFloat(e.commissionValue),
  }));
}'''

new_listEntries = '''export async function listCommissionEntries(input: {
  barberId?: number;
  startDate: string;
  endDate: string;
  tenantId?: number | null;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    gte(commissionEntries.date, input.startDate),
    lte(commissionEntries.date, input.endDate),
  ];
  if (input.barberId) conditions.push(eq(commissionEntries.barberId, input.barberId));
  const entries = await db.select().from(commissionEntries)
    .where(and(...conditions))
    .orderBy(desc(commissionEntries.date));
  // Filtrar barbeiros pelo tenantId para evitar vazamento de dados
  const barberConditions: any[] = [];
  if (input.tenantId != null) barberConditions.push(eq(barbers.tenantId, input.tenantId));
  const barberList = barberConditions.length > 0
    ? await db.select().from(barbers).where(and(...barberConditions))
    : await db.select().from(barbers);
  const barberIds = new Set(barberList.map((b) => b.id));
  const filteredEntries = input.tenantId != null
    ? entries.filter((e) => barberIds.has(e.barberId))
    : entries;
  return filteredEntries.map((e) => ({
    ...e,
    barberName: barberList.find((b) => b.id === e.barberId)?.name ?? "—",
    grossValue: parseFloat(e.grossValue),
    commissionRate: parseFloat(e.commissionRate),
    commissionValue: parseFloat(e.commissionValue),
  }));
}'''

content = content.replace(old_listEntries, new_listEntries)

# Corrigir getCommissionSummary para filtrar por tenantId
old_summary = 'export async function getCommissionSummary(startDate: string, endDate: string) {\n  const db = await getDb();\n  if (!db) return [];\n  const entries = await db.select().from(commissionEntries)\n    .where(and(gte(commissionEntries.date, startDate), lte(commissionEntries.date, endDate)));\n  const barberList = await db.select().from(barbers).where(eq(barbers.isActive, true));\n  const configs = await db.select().from(commissionConfigs);'

new_summary = 'export async function getCommissionSummary(startDate: string, endDate: string, tenantId?: number | null) {\n  const db = await getDb();\n  if (!db) return [];\n  const entries = await db.select().from(commissionEntries)\n    .where(and(gte(commissionEntries.date, startDate), lte(commissionEntries.date, endDate)));\n  const barberConditions: any[] = [eq(barbers.isActive, true)];\n  if (tenantId != null) barberConditions.push(eq(barbers.tenantId, tenantId));\n  const barberList = await db.select().from(barbers).where(and(...barberConditions));\n  const configs = await db.select().from(commissionConfigs);'

content = content.replace(old_summary, new_summary)

# Corrigir getAllBarbers para filtrar por tenantId via WHERE (não RLS)
old_getAllBarbers = '''export async function getAllBarbers(tenantId?: number | null) {
  return runWithTenant(tenantId, (db) =>
    db.select().from(barbers).where(eq(barbers.isActive, true)).orderBy(barbers.name)
  ).catch(() => [] as typeof barbers.$inferSelect[]);
}
export async function getAllBarbersIncludingInactive(tenantId?: number | null) {
  return runWithTenant(tenantId, (db) =>
    db.select().from(barbers).orderBy(barbers.name)
  ).catch(() => [] as typeof barbers.$inferSelect[]);
}'''

new_getAllBarbers = '''export async function getAllBarbers(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof barbers.$inferSelect[];
  const conditions: any[] = [eq(barbers.isActive, true)];
  if (tenantId != null) conditions.push(eq(barbers.tenantId, tenantId));
  return db.select().from(barbers).where(and(...conditions)).orderBy(barbers.name).catch(() => [] as typeof barbers.$inferSelect[]);
}
export async function getAllBarbersIncludingInactive(tenantId?: number | null) {
  const db = await getDb();
  if (!db) return [] as typeof barbers.$inferSelect[];
  const conditions: any[] = [];
  if (tenantId != null) conditions.push(eq(barbers.tenantId, tenantId));
  const query = conditions.length > 0
    ? db.select().from(barbers).where(and(...conditions)).orderBy(barbers.name)
    : db.select().from(barbers).orderBy(barbers.name);
  return query.catch(() => [] as typeof barbers.$inferSelect[]);
}'''

content = content.replace(old_getAllBarbers, new_getAllBarbers)

with open('/home/ubuntu/barber_app/server/db.ts', 'w') as f:
    f.write(content)
print("  ✓ server/db.ts (commission + barber functions)")

print("\n=== 3. Corrigindo imports no server/email.ts ===")
fix_file('/home/ubuntu/barber_app/server/email.ts', [
    ('import nodemailer from "nodemailer";', 'import * as nodemailer from "nodemailer";'),
])

print("\n=== 4. Corrigindo imports no server/routers.ts ===")
fix_file('/home/ubuntu/barber_app/server/routers.ts', [
    ('import crypto from "crypto";', 'import * as crypto from "crypto";'),
    ('import QRCode from "qrcode";', 'import * as QRCode from "qrcode";'),
    ('import PDFDocument from "pdfkit";', 'import * as PDFDocument from "pdfkit";'),
    ('import bcrypt from "bcryptjs";', 'import * as bcrypt from "bcryptjs";'),
    # Adicionar tenantId no endpoint commissions.listEntries
    (
        '''    listEntries: publicProcedure
      .input(z.object({
        barberId: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
      }))
      .query(async ({ input }) => {
        return db.listCommissionEntries(input);
      }),
    summary: publicProcedure
      .input(z.object({ startDate: z.string(), endDate: z.string() }))
      .query(async ({ input }) => {
        return db.getCommissionSummary(input.startDate, input.endDate);
      }),''',
        '''    listEntries: publicProcedure
      .input(z.object({
        barberId: z.number().optional(),
        startDate: z.string(),
        endDate: z.string(),
        tenantId: z.number().optional().nullable(),
      }))
      .query(async ({ input }) => {
        return db.listCommissionEntries(input);
      }),
    summary: publicProcedure
      .input(z.object({ startDate: z.string(), endDate: z.string(), tenantId: z.number().optional().nullable() }))
      .query(async ({ input }) => {
        return db.getCommissionSummary(input.startDate, input.endDate, input.tenantId);
      }),'''
    ),
])

print("\n=== 5. Corrigindo commissions.tsx para passar tenantId ===")
fix_file('/home/ubuntu/barber_app/app/admin/(tabs)/commissions.tsx', [
    (
        '  const summaryQuery = trpc.commissions.summary.useQuery({ startDate, endDate });',
        '  const summaryQuery = trpc.commissions.summary.useQuery({ startDate, endDate, tenantId });'
    ),
])

print("\n=== 6. Migrando drizzle/schema.ts: pg-core → mysql-core ===")
with open('/home/ubuntu/barber_app/drizzle/schema.ts', 'r') as f:
    schema = f.read()

# Trocar imports
schema = schema.replace(
    'import { pgTable, serial, text, integer, boolean, timestamp, numeric, jsonb, pgEnum } from "drizzle-orm/pg-core";',
    'import { mysqlTable as pgTable, serial, text, int as integer, boolean, timestamp, decimal as numeric, json as jsonb, mysqlEnum as pgEnum } from "drizzle-orm/mysql-core";'
)

# Se o import for diferente, tentar variações
if 'drizzle-orm/pg-core' in schema:
    schema = re.sub(
        r'from "drizzle-orm/pg-core"',
        'from "drizzle-orm/mysql-core"',
        schema
    )
    # Trocar pgTable por mysqlTable
    schema = schema.replace('pgTable(', 'mysqlTable(')
    schema = schema.replace('import { pgTable', 'import { mysqlTable as pgTable')
    # Trocar pgEnum por mysqlEnum
    schema = schema.replace('pgEnum(', 'mysqlEnum(')
    schema = schema.replace('import { pgEnum', 'import { mysqlEnum as pgEnum')

with open('/home/ubuntu/barber_app/drizzle/schema.ts', 'w') as f:
    f.write(schema)
print("  ✓ drizzle/schema.ts")

print("\n=== Concluído! ===")
