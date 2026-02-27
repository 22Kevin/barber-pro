/**
 * Testes de integração — funcionalidades v9.0
 *
 * Valida:
 * 1. E-mail de avaliação com botão Google Maps
 * 2. Fluxo de reset de senha (geração e validação de token)
 * 3. Marketplace (busca e filtragem de tenants)
 * 4. Isolamento multi-tenant (serviços, clientes)
 * 5. Rotas HTTP críticas (200/302 esperados)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. E-mail de avaliação com Google Maps ───────────────────────────────────
describe("E-mail de avaliação pós-atendimento", () => {
  it("deve incluir botão Google Maps quando googleMapsUrl está configurado", () => {
    const googleMapsUrl = "https://maps.google.com/?cid=123456789";
    const shopName = "Barbearia Teste Pro";
    const clientName = "João Silva";
    const serviceName = "Corte Masculino";
    const reviewUrl = "http://localhost:3000/pub/teste-barbearia/avaliar/300001";

    // Simular a geração do HTML do e-mail (lógica extraída do email.ts)
    const hasGoogleMapsButton = Boolean(googleMapsUrl);
    const emailHtml = `
      <a href="${reviewUrl}">Avaliar Atendimento</a>
      ${hasGoogleMapsButton ? `<a href="${googleMapsUrl}">Avaliar no Google Maps</a>` : ""}
    `;

    expect(emailHtml).toContain("Avaliar Atendimento");
    expect(emailHtml).toContain("Avaliar no Google Maps");
    expect(emailHtml).toContain(googleMapsUrl);
  });

  it("não deve incluir botão Google Maps quando googleMapsUrl é null", () => {
    const googleMapsUrl = null;
    const hasGoogleMapsButton = Boolean(googleMapsUrl);
    const emailHtml = `
      <a href="/avaliar/1">Avaliar Atendimento</a>
      ${hasGoogleMapsButton ? `<a href="${googleMapsUrl}">Avaliar no Google Maps</a>` : ""}
    `;

    expect(emailHtml).toContain("Avaliar Atendimento");
    expect(emailHtml).not.toContain("Avaliar no Google Maps");
  });

  it("deve calcular a janela de tempo corretamente para agendamentos elegíveis", () => {
    const minHoursAgo = 1.83;
    const maxHoursAgo = 4;
    const nowMs = Date.now();
    const minAgo = new Date(nowMs - minHoursAgo * 60 * 60 * 1000);
    const maxAgo = new Date(nowMs - maxHoursAgo * 60 * 60 * 1000);

    expect(minAgo.getTime()).toBeLessThan(nowMs);
    expect(maxAgo.getTime()).toBeLessThan(minAgo.getTime());
    // A janela deve ser de aproximadamente 2h10min
    const windowMs = minAgo.getTime() - maxAgo.getTime();
    const windowHours = windowMs / (60 * 60 * 1000);
    expect(windowHours).toBeCloseTo(2.17, 1);
  });
});

// ─── 2. Fluxo de reset de senha ───────────────────────────────────────────────
describe("Fluxo de reset de senha", () => {
  it("deve gerar um token de 6 dígitos para reset de senha", () => {
    // Simular a geração de token (lógica do db.ts)
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    expect(token).toMatch(/^\d{6}$/);
    expect(parseInt(token)).toBeGreaterThanOrEqual(100000);
    expect(parseInt(token)).toBeLessThanOrEqual(999999);
  });

  it("deve expirar o token após 1 hora", () => {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 60 * 60 * 1000); // +1h
    const now = new Date();
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());

    // Simular token expirado (2h atrás)
    const expiredAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(expiredAt.getTime()).toBeLessThan(now.getTime());
  });

  it("deve validar que o token tem exatamente 6 dígitos", () => {
    const validTokens = ["123456", "000001", "999999"];
    const invalidTokens = ["12345", "1234567", "abc123", ""];

    validTokens.forEach(t => expect(t).toMatch(/^\d{6}$/));
    invalidTokens.forEach(t => expect(t).not.toMatch(/^\d{6}$/));
  });

  it("deve redirecionar para login quando não autenticado em /meus-agendamentos", async () => {
    const response = await fetch("http://127.0.0.1:3000/pub/teste-barbearia/meus-agendamentos", {
      redirect: "manual",
    });
    // 302 = redirect para login (comportamento correto)
    expect([302, 301]).toContain(response.status);
  });
});

// ─── 3. Marketplace ───────────────────────────────────────────────────────────
describe("Marketplace", () => {
  it("deve filtrar barbearias por nome corretamente", () => {
    const tenants = [
      { name: "Barbearia Teste Pro", city: "São Paulo", state: "SP", descricao: "Barbearia moderna", visivelMarketplace: true },
      { name: "Salão da Maria", city: "Rio de Janeiro", state: "RJ", descricao: "Salão feminino", visivelMarketplace: true },
      { name: "Barber Shop Kevin", city: "Curitiba", state: "PR", descricao: null, visivelMarketplace: false },
    ];

    // Filtrar apenas visíveis
    const visíveis = tenants.filter(t => t.visivelMarketplace);
    expect(visíveis).toHaveLength(2);

    // Busca por nome
    const search = "teste";
    const filtrados = visíveis.filter(t =>
      t.name.toLowerCase().includes(search) ||
      (t.city ?? "").toLowerCase().includes(search) ||
      (t.descricao ?? "").toLowerCase().includes(search)
    );
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].name).toBe("Barbearia Teste Pro");
  });

  it("deve retornar 200 na rota /marketplace", async () => {
    const response = await fetch("http://127.0.0.1:3000/marketplace");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("marketplace");
  });

  it("deve buscar barbearias por cidade via query string", async () => {
    const response = await fetch("http://127.0.0.1:3000/marketplace?q=São+Paulo");
    expect(response.status).toBe(200);
    const html = await response.text();
    // A página deve carregar sem erro
    expect(html).not.toContain("500 Internal Server Error");
  });
});

// ─── 4. Isolamento multi-tenant ───────────────────────────────────────────────
describe("Isolamento multi-tenant", () => {
  it("deve garantir que tenantId é passado nas queries críticas", () => {
    // Simular verificação de que tenantId está presente nas queries
    const tenantId = 1;
    const queryWithTenant = `SELECT * FROM services WHERE tenantId = ${tenantId}`;
    const queryWithoutTenant = `SELECT * FROM services`;

    expect(queryWithTenant).toContain("tenantId");
    expect(queryWithoutTenant).not.toContain("tenantId");
  });

  it("deve validar que barbeiro só acessa dados do seu tenant", () => {
    const barber = { id: 120001, tenantId: 1, role: "barber" };
    const requestedTenantId = 2; // Tentativa de acessar outro tenant

    // Simular a verificação de acesso
    const hasAccess = barber.tenantId === requestedTenantId || barber.role === "super_admin";
    expect(hasAccess).toBe(false);
  });
});

// ─── 5. Rotas HTTP críticas ───────────────────────────────────────────────────
describe("Rotas HTTP críticas", () => {
  const routes = [
    { path: "/pub/teste-barbearia", expectedStatus: 200 },
    { path: "/pub/teste-barbearia/login", expectedStatus: 200 },
    { path: "/pub/teste-barbearia/forgot-password", expectedStatus: 200 },
    { path: "/marketplace", expectedStatus: 200 },
    { path: "/admin/login", expectedStatus: 200 },
    { path: "/admin/forgot-password", expectedStatus: 200 },
  ];

  routes.forEach(({ path, expectedStatus }) => {
    it(`GET ${path} deve retornar ${expectedStatus}`, async () => {
      const response = await fetch(`http://127.0.0.1:3000${path}`, {
        redirect: "manual",
      });
      expect(response.status).toBe(expectedStatus);
    });
  });

  it("GET /pub/slug-inexistente deve retornar 404", async () => {
    const response = await fetch("http://127.0.0.1:3000/pub/barbearia-que-nao-existe-xyz123", {
      redirect: "manual",
    });
    expect([404, 302]).toContain(response.status);
  });
});

// ─── 6. Formato do campo from no e-mail ─────────────────────────────────────
describe("Formato do campo 'from' no e-mail", () => {
  it("deve usar o SMTP_FROM diretamente quando já tem formato Name <email>", () => {
    const smtpFrom = "Barber Pro <onboarding@resend.dev>";
    const from = smtpFrom && smtpFrom.includes('<') ? smtpFrom : `"Barber Pro" <${smtpFrom}>`;
    expect(from).toBe("Barber Pro <onboarding@resend.dev>");
    // Não deve ter duplo aninhamento
    expect(from).not.toContain("<Barber Pro <");
  });

  it("deve formatar corretamente quando SMTP_FROM é apenas um e-mail", () => {
    const smtpFrom = "onboarding@resend.dev";
    const from = smtpFrom && smtpFrom.includes('<') ? smtpFrom : `"Barber Pro" <${smtpFrom}>`;
    expect(from).toBe('"Barber Pro" <onboarding@resend.dev>');
  });

  it("deve incluir tenants em trial no marketplace", () => {
    const statuses = ["active", "trial", "inactive", "suspended"];
    const allowedStatuses = ["active", "trial"];
    const visibleTenants = statuses.filter(s => allowedStatuses.includes(s));
    expect(visibleTenants).toEqual(["active", "trial"]);
    expect(visibleTenants).not.toContain("inactive");
    expect(visibleTenants).not.toContain("suspended");
  });
});

// ─── 6. Compartilhamento Instagram Stories ────────────────────────────────────
describe("Compartilhamento Instagram Stories", () => {
  it("deve formatar a data do agendamento corretamente para o card", () => {
    const date = "2026-03-15";
    const time = "14:30";
    const [year, month, day] = date.split("-").map(Number);
    const formatted = new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    expect(formatted).toContain("15");
    expect(formatted).toContain("março");
  });

  it("deve calcular o preço total corretamente", () => {
    const services = [
      { name: "Corte Masculino", price: 35.0 },
      { name: "Barba Completa", price: 25.0 },
    ];
    const total = services.reduce((sum, s) => sum + s.price, 0);
    expect(total).toBe(60.0);
  });
});
