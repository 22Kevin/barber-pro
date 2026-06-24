// Script para criar conta demo no banco
// Rode com: node create-demo-account.cjs

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

    // 2. Criar barbeiro demo (super_admin)
    const passwordHash = '$2b$10$ozExW2CfOnf3pNpdtHckfuue4WwkOr7E4pWEHFUKMCM8Lgoh1eMJ6';
    const barberResult = await client.query(`
      INSERT INTO barbers ("tenantId", name, email, "passwordHash", role, "isActive")
      VALUES ($1, 'Barber Pro Demo', 'barber.pro@test.dev', $2, 'super_admin', true)
      ON CONFLICT (email) DO UPDATE SET
        "tenantId" = EXCLUDED."tenantId",
        "passwordHash" = EXCLUDED."passwordHash",
        role = EXCLUDED.role,
        "isActive" = true
      RETURNING id
    `, [tenantId, passwordHash]);
    const barberId = barberResult.rows[0].id;
    console.log('✅ Barbeiro demo criado/atualizado. ID:', barberId);

    await client.query('COMMIT');
    console.log('✅ Conta demo criada com sucesso!');
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
