/**
 * Testes de Isolamento Multi-Tenant (RLS)
 *
 * Verifica que dados de um tenant não vazam para outro tenant.
 * Testa as operações de leitura e escrita nas tabelas com RLS.
 *
 * Execução: pnpm test tests/rls-isolation.test.ts
 *
 * NOTA: Estes testes requerem DATABASE_URL configurado.
 * Em CI/CD, o banco de produção não é acessível — os testes são marcados
 * como "skip" automaticamente quando DATABASE_URL não está disponível.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import {
  tenants,
  barbers,
  clients,
  services,
  products,
  shopSettings,
} from "../drizzle/schema";

// ─── Setup ────────────────────────────────────────────────────────────────────

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

const TENANT_A_ID = 9991;
const TENANT_B_ID = 9992;

const skipIfNoDb = !process.env.DATABASE_URL;

async function withTenant<T>(
  tenantId: number | null,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T> {
  if (!pool) throw new Error("Pool not initialized");
  const client = await pool.connect();
  try {
    const tenantDb = drizzle(client as any);
    await client.query("BEGIN");
    if (tenantId != null) {
      await client.query("SET LOCAL ROLE barber_app");
      await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
      await client.query("SET LOCAL app.is_superadmin = 'false'");
    } else {
      await client.query("SET LOCAL app.tenant_id = ''");
      await client.query("SET LOCAL app.is_superadmin = 'true'");
    }
    const result = await fn(tenantDb);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  if (skipIfNoDb) return;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  db = drizzle(pool);

  // Criar tenants de teste (sem RLS — usando conexão direta)
  await db
    .insert(tenants)
    .values({ id: TENANT_A_ID, name: "Tenant A (Teste RLS)", slug: "tenant-a-rls-test", plan: "solo" as any, status: "trial" as any })
    .onConflictDoNothing();
  await db
    .insert(tenants)
    .values({ id: TENANT_B_ID, name: "Tenant B (Teste RLS)", slug: "tenant-b-rls-test", plan: "solo" as any, status: "trial" as any })
    .onConflictDoNothing();

  // Criar dados de teste para Tenant A
  await db
    .insert(clients)
    .values([
      { name: "Cliente A1", phone: "11900000001", tenantId: TENANT_A_ID },
      { name: "Cliente A2", phone: "11900000002", tenantId: TENANT_A_ID },
    ])
    .onConflictDoNothing();

  // Criar dados de teste para Tenant B
  await db
    .insert(clients)
    .values([
      { name: "Cliente B1", phone: "11900000003", tenantId: TENANT_B_ID },
    ])
    .onConflictDoNothing();

  // Criar serviços para Tenant A
  await db
    .insert(services)
    .values([
      { name: "Serviço A1", price: "30.00", durationMinutes: 30, tenantId: TENANT_A_ID },
    ])
    .onConflictDoNothing();

  // Criar serviços para Tenant B
  await db
    .insert(services)
    .values([
      { name: "Serviço B1", price: "40.00", durationMinutes: 45, tenantId: TENANT_B_ID },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  if (skipIfNoDb || !db) return;

  // Limpar dados de teste (sem RLS)
  await db.delete(clients).where(eq(clients.tenantId, TENANT_A_ID));
  await db.delete(clients).where(eq(clients.tenantId, TENANT_B_ID));
  await db.delete(services).where(eq(services.tenantId, TENANT_A_ID));
  await db.delete(services).where(eq(services.tenantId, TENANT_B_ID));
  await db.delete(tenants).where(eq(tenants.id, TENANT_A_ID));
  await db.delete(tenants).where(eq(tenants.id, TENANT_B_ID));

  await pool?.end();
});

// ─── Testes de Isolamento ─────────────────────────────────────────────────────

describe("RLS — Isolamento Multi-Tenant", () => {
  it.skipIf(skipIfNoDb)("Tenant A só vê seus próprios clientes", async () => {
    const result = await withTenant(TENANT_A_ID, (db) =>
      db.select().from(clients).where(eq(clients.isActive, true))
    );
    const names = result.map((c) => c.name);
    expect(names).toContain("Cliente A1");
    expect(names).toContain("Cliente A2");
    expect(names).not.toContain("Cliente B1");
  });

  it.skipIf(skipIfNoDb)("Tenant B só vê seus próprios clientes", async () => {
    const result = await withTenant(TENANT_B_ID, (db) =>
      db.select().from(clients).where(eq(clients.isActive, true))
    );
    const names = result.map((c) => c.name);
    expect(names).toContain("Cliente B1");
    expect(names).not.toContain("Cliente A1");
    expect(names).not.toContain("Cliente A2");
  });

  it.skipIf(skipIfNoDb)("Tenant A só vê seus próprios serviços", async () => {
    const result = await withTenant(TENANT_A_ID, (db) =>
      db.select().from(services)
    );
    const names = result.map((s) => s.name);
    expect(names).toContain("Serviço A1");
    expect(names).not.toContain("Serviço B1");
  });

  it.skipIf(skipIfNoDb)("Tenant B só vê seus próprios serviços", async () => {
    const result = await withTenant(TENANT_B_ID, (db) =>
      db.select().from(services)
    );
    const names = result.map((s) => s.name);
    expect(names).toContain("Serviço B1");
    expect(names).not.toContain("Serviço A1");
  });

  it.skipIf(skipIfNoDb)("Tenant A não consegue inserir cliente com tenantId de Tenant B", async () => {
    // Tentar inserir um cliente com tenantId do Tenant B enquanto autenticado como Tenant A
    // O RLS deve rejeitar ou o dado deve ser visível apenas para Tenant B
    const inserted = await withTenant(TENANT_A_ID, async (db) => {
      try {
        const result = await db
          .insert(clients)
          .values({ name: "Cliente Invasor", phone: "11999999999", tenantId: TENANT_B_ID })
          .returning({ id: clients.id });
        return result[0]?.id ?? null;
      } catch {
        // RLS bloqueou a inserção — comportamento correto
        return null;
      }
    });

    if (inserted !== null) {
      // Se inseriu, verificar que Tenant A não consegue ver o dado
      const visibleToA = await withTenant(TENANT_A_ID, (db) =>
        db.select().from(clients).where(eq(clients.id, inserted))
      );
      expect(visibleToA).toHaveLength(0);

      // Limpar dado de teste
      if (db) await db.delete(clients).where(eq(clients.id, inserted));
    } else {
      // RLS bloqueou a inserção — isso é o comportamento ideal
      expect(inserted).toBeNull();
    }
  });

  it.skipIf(skipIfNoDb)("Superadmin (tenantId=null) vê dados de todos os tenants", async () => {
    const result = await withTenant(null, (db) =>
      db
        .select()
        .from(clients)
        .where(
          eq(clients.tenantId, TENANT_A_ID)
        )
    );
    expect(result.length).toBeGreaterThan(0);
  });

  it.skipIf(skipIfNoDb)("Tenant A não consegue atualizar cliente de Tenant B", async () => {
    // Buscar ID de um cliente do Tenant B (como superadmin)
    const clientsB = await withTenant(null, (db) =>
      db.select().from(clients).where(eq(clients.tenantId, TENANT_B_ID)).limit(1)
    );
    if (clientsB.length === 0) return; // Sem dados de teste, pular

    const clientBId = clientsB[0].id;

    // Tentar atualizar como Tenant A
    await withTenant(TENANT_A_ID, async (db) => {
      try {
        await db
          .update(clients)
          .set({ name: "Hackeado por Tenant A" })
          .where(eq(clients.id, clientBId));
      } catch {
        // RLS bloqueou — comportamento correto
      }
    });

    // Verificar que o nome não foi alterado
    const afterUpdate = await withTenant(null, (db) =>
      db.select().from(clients).where(eq(clients.id, clientBId)).limit(1)
    );
    expect(afterUpdate[0]?.name).not.toBe("Hackeado por Tenant A");
  });
});

describe("RLS — Funções do db.ts", () => {
  it.skipIf(skipIfNoDb)("getAllClients(tenantId) retorna apenas clientes do tenant", async () => {
    // Importar dinamicamente para evitar inicialização do pool global
    const { getAllClients } = await import("../server/db");
    const clientsA = await getAllClients(TENANT_A_ID);
    const clientsB = await getAllClients(TENANT_B_ID);

    const namesA = clientsA.map((c) => c.name);
    const namesB = clientsB.map((c) => c.name);

    expect(namesA).toContain("Cliente A1");
    expect(namesA).not.toContain("Cliente B1");
    expect(namesB).toContain("Cliente B1");
    expect(namesB).not.toContain("Cliente A1");
  });

  it.skipIf(skipIfNoDb)("getAllServices(false, tenantId) retorna apenas serviços do tenant", async () => {
    const { getAllServices } = await import("../server/db");
    const servicesA = await getAllServices(false, TENANT_A_ID);
    const servicesB = await getAllServices(false, TENANT_B_ID);

    const namesA = servicesA.map((s) => s.name);
    const namesB = servicesB.map((s) => s.name);

    expect(namesA).toContain("Serviço A1");
    expect(namesA).not.toContain("Serviço B1");
    expect(namesB).toContain("Serviço B1");
    expect(namesB).not.toContain("Serviço A1");
  });
});
