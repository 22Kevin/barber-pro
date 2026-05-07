/**
 * Testes de Isolamento Multi-Tenant
 *
 * Verifica que dados de um tenant não vazam para outro tenant.
 * Testa as operações de leitura e escrita nas tabelas com tenantId.
 *
 * Execução: pnpm test tests/rls-isolation.test.ts
 *
 * NOTA: Estes testes requerem DATABASE_URL configurado.
 * Em CI/CD, o banco de produção não é acessível — os testes são marcados
 * como "skip" automaticamente quando DATABASE_URL não está disponível.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
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

let pool: ReturnType<typeof createPool> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

const TENANT_A_ID = 9991;
const TENANT_B_ID = 9992;

const skipIfNoDb = !process.env.DATABASE_URL;

beforeAll(async () => {
  if (skipIfNoDb) return;

  pool = createPool(process.env.DATABASE_URL!);
  db = drizzle(pool as any);

  // Criar tenants de teste
  await db
    .insert(tenants)
    .values({ id: TENANT_A_ID, name: "Tenant A (Teste)", slug: "tenant-a-test", plan: "solo" as any, status: "trial" as any })
    .onDuplicateKeyUpdate({ set: { name: "Tenant A (Teste)" } });
  await db
    .insert(tenants)
    .values({ id: TENANT_B_ID, name: "Tenant B (Teste)", slug: "tenant-b-test", plan: "solo" as any, status: "trial" as any })
    .onDuplicateKeyUpdate({ set: { name: "Tenant B (Teste)" } });

  // Criar dados de teste para Tenant A
  await db
    .insert(clients)
    .values([
      { name: "Cliente A1", phone: "11900000001", tenantId: TENANT_A_ID },
      { name: "Cliente A2", phone: "11900000002", tenantId: TENANT_A_ID },
    ])
    .onDuplicateKeyUpdate({ set: { name: "Cliente A1" } });

  // Criar dados de teste para Tenant B
  await db
    .insert(clients)
    .values([
      { name: "Cliente B1", phone: "11900000003", tenantId: TENANT_B_ID },
    ])
    .onDuplicateKeyUpdate({ set: { name: "Cliente B1" } });

  // Criar serviços para Tenant A
  await db
    .insert(services)
    .values([
      { name: "Serviço A1", price: "30.00", durationMinutes: 30, tenantId: TENANT_A_ID },
    ])
    .onDuplicateKeyUpdate({ set: { name: "Serviço A1" } });

  // Criar serviços para Tenant B
  await db
    .insert(services)
    .values([
      { name: "Serviço B1", price: "40.00", durationMinutes: 45, tenantId: TENANT_B_ID },
    ])
    .onDuplicateKeyUpdate({ set: { name: "Serviço B1" } });
});

afterAll(async () => {
  if (skipIfNoDb || !db) return;

  // Limpar dados de teste
  await db.delete(clients).where(eq(clients.tenantId, TENANT_A_ID));
  await db.delete(clients).where(eq(clients.tenantId, TENANT_B_ID));
  await db.delete(services).where(eq(services.tenantId, TENANT_A_ID));
  await db.delete(services).where(eq(services.tenantId, TENANT_B_ID));
  await db.delete(tenants).where(eq(tenants.id, TENANT_A_ID));
  await db.delete(tenants).where(eq(tenants.id, TENANT_B_ID));

  await (pool as any)?.end();
});

// ─── Testes de Isolamento ─────────────────────────────────────────────────────

describe("Isolamento Multi-Tenant", () => {
  it.skipIf(skipIfNoDb)("getAllClients(tenantId) retorna apenas clientes do tenant A", async () => {
    const { getAllClients } = await import("../server/db");
    const clientsA = await getAllClients(TENANT_A_ID);
    const namesA = clientsA.map((c) => c.name);
    expect(namesA).toContain("Cliente A1");
    expect(namesA).toContain("Cliente A2");
    expect(namesA).not.toContain("Cliente B1");
  });

  it.skipIf(skipIfNoDb)("getAllClients(tenantId) retorna apenas clientes do tenant B", async () => {
    const { getAllClients } = await import("../server/db");
    const clientsB = await getAllClients(TENANT_B_ID);
    const namesB = clientsB.map((c) => c.name);
    expect(namesB).toContain("Cliente B1");
    expect(namesB).not.toContain("Cliente A1");
    expect(namesB).not.toContain("Cliente A2");
  });

  it.skipIf(skipIfNoDb)("getAllServices(false, tenantId) retorna apenas serviços do tenant A", async () => {
    const { getAllServices } = await import("../server/db");
    const servicesA = await getAllServices(false, TENANT_A_ID);
    const namesA = servicesA.map((s) => s.name);
    expect(namesA).toContain("Serviço A1");
    expect(namesA).not.toContain("Serviço B1");
  });

  it.skipIf(skipIfNoDb)("getAllServices(false, tenantId) retorna apenas serviços do tenant B", async () => {
    const { getAllServices } = await import("../server/db");
    const servicesB = await getAllServices(false, TENANT_B_ID);
    const namesB = servicesB.map((s) => s.name);
    expect(namesB).toContain("Serviço B1");
    expect(namesB).not.toContain("Serviço A1");
  });
});
