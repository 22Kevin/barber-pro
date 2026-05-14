import { describe, it, expect } from "vitest";

describe("Asaas credentials", () => {
  it("ASAAS_API_KEY deve estar definida", () => {
    const key = process.env.ASAAS_API_KEY;
    expect(key, "ASAAS_API_KEY não está definida").toBeDefined();
    expect(key!.length, "ASAAS_API_KEY está vazia").toBeGreaterThan(0);
  });

  it("ASAAS_API_KEY deve ter formato válido (começa com $aact_)", () => {
    const key = process.env.ASAAS_API_KEY;
    if (!key) return; // skip se não definida (coberta pelo teste anterior)
    expect(key).toMatch(/^\$aact_/);
  });

  it("deve conseguir autenticar na API do Asaas", async () => {
    const key = process.env.ASAAS_API_KEY;
    if (!key) return;

    // Detectar ambiente: sandbox ou produção
    const isSandbox = key.includes("YTU5YTE0M2M2N2I4MTliNzk0YTI5N") || 
                      key.startsWith("$aact_YTU5");
    const baseUrl = isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/api/v3";

    const res = await fetch(`${baseUrl}/myAccount`, {
      headers: {
        "access_token": key,
        "Content-Type": "application/json",
      },
    });

    expect(res.status, `API retornou ${res.status} — verifique se a chave é válida`).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty("name");
  });
});
