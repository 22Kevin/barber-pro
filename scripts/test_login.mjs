import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const dbUrl = new URL(process.env.DATABASE_URL);
const pool = mysql.createPool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port),
  user: dbUrl.username,
  password: dbUrl.password,
  database: dbUrl.pathname.slice(1).split('?')[0],
  ssl: { rejectUnauthorized: false }
});

const email = 'kevin.rayan@hotmail.com';
const [rows] = await pool.query('SELECT id, name, email, role, isActive, passwordHash FROM barbers WHERE email = ?', [email]);
const barber = rows[0];

console.log('Barber found:', !!barber);
console.log('isActive:', barber?.isActive);
console.log('passwordHash length:', barber?.passwordHash?.length);
console.log('passwordHash preview:', barber?.passwordHash?.substring(0, 10));

// Testar com algumas senhas comuns
const testPasswords = ['admin123', '123456', 'barber123', 'kevin123', 'password', '123456789'];
for (const pwd of testPasswords) {
  const valid = barber?.passwordHash ? await bcrypt.compare(pwd, barber.passwordHash) : false;
  if (valid) console.log(`✅ Senha correta: "${pwd}"`);
}
console.log('Teste concluído.');
await pool.end();
