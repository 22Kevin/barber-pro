import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./load-env.js');

const from = process.env.SMTP_FROM ?? '';
const masked = from ? from.replace(/(?<=\w).(?=\w*@)/g, '*') : '(não configurado)';
console.log('SMTP_FROM:', masked);

const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const nameEmailRegex = /^.+\s*<[^@\s]+@[^@\s]+\.[^@\s]+>$/;
const isValid = emailRegex.test(from) || nameEmailRegex.test(from);
console.log('Formato válido:', isValid);

if (from && !isValid) {
  console.error('ERRO: Formato inválido. Use: email@dominio.com ou Nome <email@dominio.com>');
  process.exit(1);
}

if (!from) {
  console.log('AVISO: SMTP_FROM não configurado — e-mails usarão endereço padrão');
}

console.log('OK: SMTP_FROM configurado corretamente');
