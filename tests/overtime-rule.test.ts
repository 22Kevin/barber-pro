import { describe, it, expect } from "vitest";

// ─── Helpers copiados do db.ts ────────────────────────────────────────────────
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * Simula a lógica de getAvailableSlots com a regra de último slot.
 * lastAllowedStart = endMin - 30
 */
function simulateSlots(startTime: string, endTime: string, durationMinutes: number): { startTime: string; endTime: string }[] {
  const startMin = toMin(startTime);
  const endMin = toMin(endTime);
  const lastAllowedStart = endMin - 30;
  const slots: { startTime: string; endTime: string }[] = [];
  let cursor = startMin;
  while (cursor <= lastAllowedStart) {
    const slotEnd = cursor + durationMinutes;
    slots.push({ startTime: fromMin(cursor), endTime: fromMin(slotEnd) });
    cursor += 15;
  }
  return slots;
}

/**
 * Simula a lógica de detecção de overtime no routers.ts.
 */
function checkOvertime(endTime: string, closingTime: string): { exceedsClosingTime: boolean; overtimeMinutes: number } {
  const closeMin = toMin(closingTime);
  const endMin = toMin(endTime);
  if (endMin > closeMin) {
    return { exceedsClosingTime: true, overtimeMinutes: endMin - closeMin };
  }
  return { exceedsClosingTime: false, overtimeMinutes: 0 };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("Regra de último slot (30 min antes do fechamento)", () => {
  it("Barbearia fecha às 20:00 — último slot de início deve ser às 19:30", () => {
    const slots = simulateSlots("08:00", "20:00", 30);
    const lastSlot = slots[slots.length - 1];
    expect(lastSlot.startTime).toBe("19:30");
  });

  it("Barbearia fecha às 18:00 — último slot de início deve ser às 17:30", () => {
    const slots = simulateSlots("09:00", "18:00", 30);
    const lastSlot = slots[slots.length - 1];
    expect(lastSlot.startTime).toBe("17:30");
  });

  it("Serviço de 60 min — último slot às 19:30 termina às 20:30 (overtime)", () => {
    const slots = simulateSlots("08:00", "20:00", 60);
    const lastSlot = slots[slots.length - 1];
    expect(lastSlot.startTime).toBe("19:30");
    expect(lastSlot.endTime).toBe("20:30");
    // Confirma que esse slot ultrapassa o fechamento
    const { exceedsClosingTime, overtimeMinutes } = checkOvertime(lastSlot.endTime, "20:00");
    expect(exceedsClosingTime).toBe(true);
    expect(overtimeMinutes).toBe(30);
  });

  it("Serviço de 30 min às 19:30 — NÃO ultrapassa fechamento às 20:00", () => {
    const { exceedsClosingTime } = checkOvertime("20:00", "20:00");
    expect(exceedsClosingTime).toBe(false);
  });

  it("Serviço de 2h às 19:30 — ultrapassa em 90 min (fechamento 20:00, término 21:30)", () => {
    const { exceedsClosingTime, overtimeMinutes } = checkOvertime("21:30", "20:00");
    expect(exceedsClosingTime).toBe(true);
    expect(overtimeMinutes).toBe(90);
  });

  it("Slots gerados não devem ter início depois de lastAllowedStart", () => {
    const slots = simulateSlots("08:00", "20:00", 30);
    const lastAllowedStart = toMin("19:30");
    for (const slot of slots) {
      expect(toMin(slot.startTime)).toBeLessThanOrEqual(lastAllowedStart);
    }
  });

  it("Nenhum slot deve ser gerado se a janela for menor que 30 min", () => {
    // Abre às 19:45, fecha às 20:00 — lastAllowedStart = 19:30, startMin = 19:45 > 19:30
    const slots = simulateSlots("19:45", "20:00", 30);
    expect(slots.length).toBe(0);
  });
});
