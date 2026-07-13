const fs = require('fs');
let c = 0;

function rep(file, old, novo, tag) {
  let content = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (content.includes(old)) {
    content = content.replace(old, novo);
    fs.writeFileSync(file, content, 'utf8');
    console.log('OK: '+tag);
    c++;
  } else {
    console.log('MISS: '+tag);
  }
}

// ── 1. db.ts — adicionar createAppointmentAtomic após checkSlotAvailability ───
rep('server/db.ts',
  `  const conflicts = await db.select().from(appointments).where(and(...conditions));
  return conflicts.length === 0;
}

// ─── Vendas ───────────────────────────────────────────────────────────────────`,
  `  const conflicts = await db.select().from(appointments).where(and(...conditions));
  return conflicts.length === 0;
}

/**
 * Versão atômica: verifica disponibilidade e insere em uma única transação
 * com SELECT FOR UPDATE para evitar race condition entre requisições concorrentes.
 */
export async function createAppointmentAtomic(data: {
  clientId: number; serviceId: number; barberId: number;
  date: string; startTime: string; endTime: string;
  status: string; notes?: string | null;
}): Promise<{ success: boolean; appointmentId?: number; error?: string }> {
  if (!_pool) await getDb();
  if (!_pool) return { success: false, error: "Banco indisponível" };
  const client = await _pool.connect();
  try {
    await client.query('BEGIN');
    const lockResult = await client.query(
      \`SELECT id FROM appointments
       WHERE "barberId" = $1
         AND date = $2
         AND status NOT IN ('cancelled','no_show')
         AND "startTime" < $4
         AND "endTime" > $3
       FOR UPDATE\`,
      [data.barberId, data.date, data.startTime, data.endTime]
    );
    if (lockResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: "Horário já ocupado" };
    }
    const insert = await client.query(
      \`INSERT INTO appointments ("clientId","serviceId","barberId",date,"startTime","endTime",status,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id\`,
      [data.clientId, data.serviceId, data.barberId, data.date,
       data.startTime, data.endTime, data.status, data.notes ?? null]
    );
    await client.query('COMMIT');
    return { success: true, appointmentId: insert.rows[0].id };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { success: false, error: err.message };
  } finally {
    client.release();
  }
}

// ─── Vendas ───────────────────────────────────────────────────────────────────`,
  'db.ts createAppointmentAtomic'
);

// ── 2. admin-routes.ts — usar createAppointmentAtomic ─────────────────────────
rep('server/admin-routes.ts',
  `      const available = await db.checkSlotAvailability(parseInt(barberId), date, startTimeFmt, endTime);
      if (!available) { res.redirect("/admin/agenda/novo?error=Hor%C3%A1rio+j%C3%A1+ocupado"); return; }
      await db.createAppointment({
        clientId: parseInt(clientId), serviceId: parseInt(serviceId), barberId: parseInt(barberId),
        date, startTime: startTimeFmt, endTime, status: "scheduled",
        notes: notes ?? null,
      });
      res.redirect(\`/admin/agenda?date=\${date}&created=1\`);`,
  `      const atomicResult = await db.createAppointmentAtomic({
        clientId: parseInt(clientId), serviceId: parseInt(serviceId), barberId: parseInt(barberId),
        date, startTime: startTimeFmt, endTime, status: "scheduled",
        notes: notes ?? null,
      });
      if (!atomicResult.success) { res.redirect(\`/admin/agenda/novo?error=\${encodeURIComponent(atomicResult.error ?? "Horário já ocupado")}\`); return; }
      res.redirect(\`/admin/agenda?date=\${date}&created=1\`);`,
  'admin-routes createAppointmentAtomic'
);

// ── 3. routers.ts — usar createAppointmentAtomic ──────────────────────────────
rep('server/routers.ts',
  `        const available = await db.checkSlotAvailability(input.barberId, input.date, input.startTime, input.endTime);
        if (!available) throw new Error("Horário não disponível. Por favor, escolha outro horário.");

        // ── Regra de horário limite ──────────────────────────────────────────────
        // Verifica se o endTime ultrapassa o horário de fechamento do barbeiro naquele dia
        const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const dayOfWeek = new Date(input.date + "T12:00:00").getDay();
        const wh = await db.getWorkingHoursForDay(input.barberId, dayOfWeek);
        let exceedsClosingTime = false;
        let overtimeMinutes = 0;
        let closingTime = "";
        if (wh) {
          const closeMin = toMin(wh.endTime);
          const endMin = toMin(input.endTime);
          if (endMin > closeMin) {
            exceedsClosingTime = true;
            overtimeMinutes = endMin - closeMin;
            closingTime = wh.endTime;
          }
        }

        // Se ultrapassa o horário de fechamento, cria como pending_approval
        const finalStatus = exceedsClosingTime ? "pending_approval" : "confirmed";
        const apptId = await db.createAppointment({ ...input, status: finalStatus } as any);`,
  `        // ── Regra de horário limite ──────────────────────────────────────────────
        const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const dayOfWeek = new Date(input.date + "T12:00:00").getDay();
        const wh = await db.getWorkingHoursForDay(input.barberId, dayOfWeek);
        let exceedsClosingTime = false;
        let overtimeMinutes = 0;
        let closingTime = "";
        if (wh) {
          const closeMin = toMin(wh.endTime);
          const endMin = toMin(input.endTime);
          if (endMin > closeMin) {
            exceedsClosingTime = true;
            overtimeMinutes = endMin - closeMin;
            closingTime = wh.endTime;
          }
        }

        // Criar agendamento de forma atômica (SELECT FOR UPDATE previne race condition)
        const finalStatus = exceedsClosingTime ? "pending_approval" : "confirmed";
        const atomicResult = await db.createAppointmentAtomic({
          clientId: input.clientId, serviceId: input.serviceId, barberId: input.barberId,
          date: input.date, startTime: input.startTime, endTime: input.endTime,
          status: finalStatus, notes: input.notes ?? null,
        });
        if (!atomicResult.success) throw new Error(atomicResult.error ?? "Horário não disponível. Por favor, escolha outro horário.");
        const apptId = atomicResult.appointmentId!;`,
  'routers.ts createAppointmentAtomic'
);

console.log('\nTotal: '+c+' mudancas');
