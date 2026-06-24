require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Criar tenant demo
    const tenantResult = await client.query(`
      INSERT INTO tenants (name, slug, plan, status, "trialEndsAt")
      VALUES ('Barber Pro', 'barberpro-demo', 'studio', 'active', NOW() + INTERVAL '10 years')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const tenantId = tenantResult.rows[0].id;
    console.log('✅ Tenant criado/atualizado. ID:', tenantId);

    // 2. Verificar se barbeiro já existe
    const passwordHash = '$2b$10$ozExW2CfOnf3pNpdtHckfuue4WwkOr7E4pWEHFUKMCM8Lgoh1eMJ6';
    const existing = await client.query(
      `SELECT id FROM barbers WHERE email = 'barber.pro@test.dev' LIMIT 1`
    );

    let barberId;
    if (existing.rows.length > 0) {
      barberId = existing.rows[0].id;
      await client.query(
        `UPDATE barbers SET "tenantId" = $1, "passwordHash" = $2, role = 'super_admin', "isActive" = true WHERE id = $3`,
        [tenantId, passwordHash, barberId]
      );
      console.log('✅ Barbeiro demo atualizado. ID:', barberId);
    } else {
      const barberResult = await client.query(
        `INSERT INTO barbers ("tenantId", name, email, "passwordHash", role, "isActive")
         VALUES ($1, 'Barber Pro Demo', 'barber.pro@test.dev', $2, 'super_admin', true)
         RETURNING id`,
        [tenantId, passwordHash]
      );
      barberId = barberResult.rows[0].id;
      console.log('✅ Barbeiro demo criado. ID:', barberId);
    }

    await client.query('COMMIT');
    console.log('\n✅ Conta demo pronta!');
    console.log('   Email: barber.pro@test.dev');
    console.log('   Senha: plus5061');
    console.log('   Tenant ID:', tenantId);
    console.log('   Barber ID:', barberId);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
