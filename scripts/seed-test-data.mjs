/**
 * Script de seed de dados de teste para o tenant 1 (teste-barbearia)
 * Executa: node scripts/seed-test-data.mjs
 */
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL não configurado'); process.exit(1); }

const db = await mysql.createConnection(url);

try {
  console.log('🌱 Iniciando seed de dados de teste...\n');

  // 1. Atualizar settings do tenant 1 com googleMapsUrl e whatsapp
  await db.query(`
    UPDATE shop_settings SET
      googleMapsUrl = 'https://maps.google.com/?cid=123456789',
      whatsapp = '11999999999',
      shopName = 'Barbearia Teste Pro'
    WHERE tenantId = 1
  `);
  console.log('✅ Shop settings atualizados (googleMapsUrl, whatsapp)');

  // 2. Criar serviços para o tenant 1
  const [existingServices] = await db.query('SELECT COUNT(*) as c FROM services WHERE tenantId = 1');
  if (existingServices[0].c === 0) {
    await db.query(`
      INSERT INTO services (name, description, price, durationMinutes, isActive, tenantId) VALUES
      ('Corte Masculino', 'Corte clássico com acabamento', 35.00, 30, 1, 1),
      ('Barba Completa', 'Modelagem e hidratação da barba', 25.00, 20, 1, 1),
      ('Corte + Barba', 'Combo completo corte e barba', 55.00, 50, 1, 1),
      ('Pigmentação', 'Coloração e pigmentação capilar', 80.00, 60, 1, 1)
    `);
    console.log('✅ 4 serviços criados para tenant 1');
  } else {
    console.log('ℹ️  Serviços já existem, pulando...');
  }

  // 3. Criar conta de cliente de teste
  const [existingClients] = await db.query("SELECT COUNT(*) as c FROM clients WHERE tenantId = 1");
  if (existingClients[0].c === 0) {
    await db.query(`
      INSERT INTO clients (name, phone, email, tenantId) VALUES
      ('João Silva Teste', '11988887777', 'joao.teste@email.com', 1),
      ('Maria Santos Teste', '11977776666', 'maria.teste@email.com', 1)
    `);
    console.log('✅ 2 clientes criados para tenant 1');
  } else {
    console.log('ℹ️  Clientes já existem, pulando...');
  }

  // 4. Verificar se há client_accounts
  const [clientAccCols] = await db.query('DESCRIBE client_accounts').catch(() => [[null]]);
  if (clientAccCols[0]) {
    const [existingAccounts] = await db.query("SELECT COUNT(*) as c FROM client_accounts LIMIT 1");
    if (existingAccounts[0].c === 0) {
      // Obter o cliente criado
      const [clients] = await db.query("SELECT id FROM clients WHERE tenantId = 1 LIMIT 1");
      if (clients.length > 0) {
        // Criar account com senha hash (bcrypt de "teste123")
        const bcryptHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVKkNTNZrK'; // hash de "teste123"
        await db.query(`
          INSERT INTO client_accounts (clientId, email, passwordHash) VALUES
          (?, 'joao.teste@email.com', ?)
        `, [clients[0].id, bcryptHash]);
        console.log('✅ Conta de cliente criada (email: joao.teste@email.com, senha: teste123)');
      }
    } else {
      console.log('ℹ️  Client accounts já existem, pulando...');
    }
  }

  // 5. Criar agendamento de teste (status completed para testar review-job)
  const [services] = await db.query('SELECT id FROM services WHERE tenantId = 1 LIMIT 1');
  const [clientsForAppt] = await db.query('SELECT id FROM clients WHERE tenantId = 1 LIMIT 1');
  
  if (services.length > 0 && clientsForAppt.length > 0) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    
    const [existingAppts] = await db.query('SELECT COUNT(*) as c FROM appointments WHERE barberId = 120001');
    if (existingAppts[0].c === 0) {
      await db.query(`
        INSERT INTO appointments (barberId, clientId, serviceId, date, startTime, endTime, status)
        VALUES (120001, ?, ?, ?, '10:00', '10:30', 'completed')
      `, [clientsForAppt[0].id, services[0].id, dateStr]);
      console.log('✅ Agendamento de teste criado (status: completed, data: ontem)');
    } else {
      console.log('ℹ️  Agendamentos já existem, pulando...');
    }
  }

  // 6. Atualizar tenant para aparecer no marketplace
  await db.query(`
    UPDATE tenants SET
      visivelMarketplace = 1,
      descricao = 'Barbearia moderna com os melhores profissionais da região. Especializada em cortes masculinos, barba e tratamentos capilares.',
      city = 'São Paulo',
      state = 'SP'
    WHERE id = 1
  `);
  console.log('✅ Tenant 1 configurado para aparecer no Marketplace');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\nDados criados:');
  console.log('  - Tenant: teste-barbearia (id: 1)');
  console.log('  - Barbeiro: admin@teste.com (id: 120001)');
  console.log('  - Serviços: 4 serviços cadastrados');
  console.log('  - Clientes: João Silva Teste, Maria Santos Teste');
  console.log('  - Conta cliente: joao.teste@email.com / teste123');
  console.log('  - Agendamento: 1 concluído (ontem)');
  console.log('  - Marketplace: visível com descrição');
  console.log('\nURLs para teste:');
  console.log('  - Página pública: /pub/teste-barbearia');
  console.log('  - Login cliente: /pub/teste-barbearia/login');
  console.log('  - Marketplace: /marketplace');
  console.log('  - Admin: /admin/login (admin@teste.com)');

} catch (e) {
  console.error('❌ Erro no seed:', e.message);
} finally {
  await db.end();
}
