// backfill-subscription-sales.cjs
// Rodar no Railway Console: node backfill-subscription-sales.cjs
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const c = await pool.connect();
  const payMap = {
    cash: 'cash', pix: 'pix', credit_card: 'credit',
    debit: 'debit', credit: 'credit', debit_card: 'debit'
  };

  const subs = await c.query(`
    SELECT cs.id, cs."tenantId", cs."clientId", cs."barberId",
           cs.price, cs."paymentMethod", cs."cycleStart",
           sp.name as pname, cl.name as cname
    FROM client_subscriptions cs
    JOIN subscription_plans sp ON sp.id = cs."planId"
    JOIN clients cl ON cl.id = cs."clientId"
    WHERE NOT EXISTS (
      SELECT 1 FROM sales s
      WHERE s.notes LIKE '[subscription]%'
        AND s."clientId" = cs."clientId"
        AND DATE(s."createdAt") = cs."cycleStart"
    )
    ORDER BY cs."createdAt" ASC
  `);

  console.log('Assinaturas sem venda:', subs.rows.length);

  let n = 0;
  for (const s of subs.rows) {
    let bid = s.barberId;
    if (!bid) {
      const r = await c.query(
        `SELECT id FROM barbers WHERE "tenantId" = $1 AND "isActive" = true ORDER BY id LIMIT 1`,
        [s.tenantId]
      );
      bid = r.rows[0]?.id;
    }
    if (!bid) { console.log('Sem barbeiro para assinatura', s.id); continue; }

    const m = payMap[s.paymentMethod] || 'cash';
    const pr = parseFloat(s.price);
    const dt = new Date(s.cycleStart + 'T12:00:00Z');
    const notes = '[subscription] ' + s.pname + ' - ' + s.cname;

    await c.query(
      `INSERT INTO sales ("barberId","clientId",date,subtotal,total,"paymentMethod","paymentStatus",notes,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,'paid',$7,$8,$8)`,
      [bid, s.clientId, s.cycleStart, pr, pr, m, notes, dt]
    );
    console.log('OK:', s.cname, '-', s.pname, '- R$', pr);
    n++;
  }

  console.log('\nTotal inserido:', n, 'vendas');
  c.release();
  await pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
