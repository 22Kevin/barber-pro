import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const conn = await mysql.createConnection(url);

// Buscar o usuário pelo email
const [rows] = await conn.execute(
  'SELECT id, name, email, role, isActive, passwordHash, tenantId FROM barbers WHERE email = ?',
  ['kevin.rayan25@gmail.com']
);

console.log('\n=== Resultado da busca ===');

if (rows.length > 0) {
  const user = rows[0];
  console.log('ID:', user.id);
  console.log('Nome:', user.name);
  console.log('Email:', user.email);
  console.log('Role:', user.role);
  console.log('isActive:', user.isActive);
  console.log('Tem passwordHash:', !!user.passwordHash);
  console.log('passwordHash (primeiros 20 chars):', user.passwordHash ? user.passwordHash.substring(0, 20) + '...' : 'NULL');
  console.log('tenantId:', user.tenantId);
  
  const isBcrypt = user.passwordHash && user.passwordHash.startsWith('$2');
  console.log('Hash parece ser bcrypt:', isBcrypt);
  
  if (isBcrypt) {
    const valid = await bcrypt.compare('plus5061', user.passwordHash);
    console.log('\n>>> Senha "plus5061" é válida:', valid);
  } else {
    console.log('\n>>> Hash NÃO é bcrypt! Comparação direta:', user.passwordHash === 'plus5061');
  }
} else {
  console.log('USUÁRIO NÃO ENCONTRADO no banco de dados!');
  
  const [allBarbers] = await conn.execute(
    'SELECT id, name, email, role, isActive, tenantId FROM barbers LIMIT 20'
  );
  console.log('\nTodos os barbeiros no banco:');
  allBarbers.forEach(b => {
    console.log(`  [${b.id}] ${b.name} | ${b.email} | role=${b.role} | isActive=${b.isActive} | tenant=${b.tenantId}`);
  });
}

await conn.end();
