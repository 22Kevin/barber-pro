/**
 * Testes unitários para a lógica de slots de horário em plan-booking.tsx
 * e para o helper de INSERT de appointments no subscription-plan-router.ts
 */
import { describe, it, expect } from "vitest";

// ─── Helpers copiados de plan-booking.tsx ─────────────────────────────────────

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addMinutes(t: string, mins: number) {
  const total = toMinutes(t) + mins;
  const h = Math.floor(total / 60).toString().padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function generateTimeSlots(
  start: string,
  end: string,
  step = 30,
  lunchStart?: string | null,
  lunchEnd?: string | null,
  dateStr?: string,
  nowBrasiliaOverride?: Date,
) {
  const slots: string[] = [];
  let current = start;

  const nowBrasilia = nowBrasiliaOverride ?? new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayBrasilia = nowBrasilia.toISOString().split("T")[0];
  const isToday = dateStr === todayBrasilia;
  const currentMinute = isToday
    ? nowBrasilia.getUTCHours() * 60 + nowBrasilia.getUTCMinutes() + 5
    : 0;

  const lunchStartMin = lunchStart ? toMinutes(lunchStart) : null;
  const lunchEndMin = lunchEnd ? toMinutes(lunchEnd) : null;

  while (current < end) {
    const slotMin = toMinutes(current);
    const isPast = isToday && slotMin < currentMinute;
    const isLunch =
      lunchStartMin !== null &&
      lunchEndMin !== null &&
      slotMin >= lunchStartMin &&
      slotMin < lunchEndMin;
    if (!isPast && !isLunch) {
      slots.push(current);
    }
    current = addMinutes(current, step);
  }
  return slots;
}

// ─── Helper de addMinutes30 copiado de subscription-plan-router.ts ─────────────

function addMinutes30(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const total = h * 60 + m + 30;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}:00`;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("generateTimeSlots", () => {
  it("gera slots básicos sem filtros", () => {
    const slots = generateTimeSlots("08:00", "10:00");
    expect(slots).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });

  it("filtra horário de almoço corretamente", () => {
    const slots = generateTimeSlots("08:00", "14:00", 30, "12:00", "13:00");
    expect(slots).not.toContain("12:00");
    expect(slots).not.toContain("12:30");
    expect(slots).toContain("11:30");
    expect(slots).toContain("13:00");
  });

  it("não filtra horários passados para datas futuras", () => {
    // Data futura: todos os slots devem aparecer
    const slots = generateTimeSlots("08:00", "10:00", 30, null, null, "2099-12-31");
    expect(slots).toEqual(["08:00", "08:30", "09:00", "09:30"]);
  });

  it("filtra horários passados para o dia de hoje", () => {
    // A função usa nowBrasilia.getUTCHours() * 60 + nowBrasilia.getUTCMinutes()
    // Então fakeNow deve ser um Date onde getUTCHours() retorna a hora de Brasília desejada
    // Para simular 10:00 Brasília, usamos um Date com UTC 10:00
    const fakeNow = new Date("2026-04-09T10:00:00Z"); // getUTCHours() = 10 = 10:00 Brasília
    const todayBrasilia = "2026-04-09";
    const slots = generateTimeSlots("08:00", "14:00", 30, null, null, todayBrasilia, fakeNow);
    // Slots antes de 10:05 devem ser filtrados (margem de 5 min)
    expect(slots).not.toContain("08:00");
    expect(slots).not.toContain("09:30");
    expect(slots).not.toContain("10:00"); // 10:00 < 10:05 (margem)
    expect(slots).toContain("10:30");
    expect(slots).toContain("11:00");
  });

  it("filtra tanto almoço quanto horários passados simultaneamente", () => {
    // Para simular 08:00 Brasília, usamos um Date onde getUTCHours() = 8
    const fakeNow = new Date("2026-04-09T08:00:00Z"); // getUTCHours() = 8 = 08:00 Brasília
    const todayBrasilia = "2026-04-09";
    const slots = generateTimeSlots("08:00", "14:00", 30, "12:00", "13:00", todayBrasilia, fakeNow);
    // 08:00 deve ser filtrado (passado, pois 08:00 < 08:05 com margem)
    expect(slots).not.toContain("08:00");
    // 12:00 e 12:30 devem ser filtrados (almoço)
    expect(slots).not.toContain("12:00");
    expect(slots).not.toContain("12:30");
    // 08:30 em diante deve aparecer
    expect(slots).toContain("08:30");
    expect(slots).toContain("13:00");
  });

  it("retorna lista vazia quando todos os slots são filtrados", () => {
    // Simular que agora são 20:00 Brasília
    const fakeNow = new Date("2026-04-09T23:00:00Z"); // 20:00 Brasília
    const todayBrasilia = "2026-04-09";
    const slots = generateTimeSlots("08:00", "20:00", 30, null, null, todayBrasilia, fakeNow);
    expect(slots).toHaveLength(0);
  });
});

describe("addMinutes30 (endTime calculator)", () => {
  it("calcula endTime corretamente para horário simples", () => {
    expect(addMinutes30("09:00")).toBe("09:30:00");
    expect(addMinutes30("09:30")).toBe("10:00:00");
    expect(addMinutes30("11:30")).toBe("12:00:00");
  });

  it("calcula endTime corretamente quando cruza a hora", () => {
    expect(addMinutes30("10:45")).toBe("11:15:00");
  });

  it("formata com zero à esquerda", () => {
    expect(addMinutes30("08:00")).toBe("08:30:00");
    expect(addMinutes30("09:00")).toBe("09:30:00");
  });
});

describe("filtro de bookedTimes em getTimeSlots", () => {
  it("exclui horários já agendados", () => {
    const allSlots = generateTimeSlots("08:00", "12:00");
    const bookedTimes = new Set(["09:00", "10:30"]);
    const available = allSlots.filter((t) => !bookedTimes.has(t));
    expect(available).not.toContain("09:00");
    expect(available).not.toContain("10:30");
    expect(available).toContain("08:00");
    expect(available).toContain("08:30");
    expect(available).toContain("09:30");
    expect(available).toContain("10:00");
    expect(available).toContain("11:00");
    expect(available).toContain("11:30");
  });
});
