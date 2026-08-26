// fix-instagram-link-landing.cjs
// Corrige o link do Instagram no rodape da landing page (server/landing/index.html)
// - estava apontando pra "instagram.com/usebarberpro" (provavelmente perfil
// de outra pessoa, ja que nao e o handle real da empresa) e passa a
// apontar pro perfil correto: instagram.com/barberpro.crm
//
// Uso:
//   node fix-instagram-link-landing.cjs

const fs = require('fs');
const path = require('path');

const LANDING_PATH = path.join(__dirname, 'server', 'landing', 'index.html');

const oldStr = Buffer.from("PGEgaHJlZj0iaHR0cHM6Ly9pbnN0YWdyYW0uY29tL3VzZWJhcmJlcnBybyIgdGFyZ2V0PSJfYmxhbmsiIGNsYXNzPSJmb290ZXItc29jaWFsLWxpbmsiIGFyaWEtbGFiZWw9Ikluc3RhZ3JhbSI+", 'base64').toString('utf8');
const newStr = Buffer.from("PGEgaHJlZj0iaHR0cHM6Ly93d3cuaW5zdGFncmFtLmNvbS9iYXJiZXJwcm8uY3JtLyIgdGFyZ2V0PSJfYmxhbmsiIGNsYXNzPSJmb290ZXItc29jaWFsLWxpbmsiIGFyaWEtbGFiZWw9Ikluc3RhZ3JhbSI+", 'base64').toString('utf8');

try {
  if (!fs.existsSync(LANDING_PATH)) {
    throw new Error('Arquivo não encontrado: ' + LANDING_PATH);
  }
  let content = fs.readFileSync(LANDING_PATH, 'utf8');
  const occurrences = content.split(oldStr).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `esperado 1 ocorrência do trecho original, encontrado ${occurrences}. ` +
      `Abortando sem gravar nada.`
    );
  }
  content = content.replace(oldStr, () => newStr);
  fs.writeFileSync(LANDING_PATH, content, 'utf8');
  console.log('✅ server/landing/index.html: link do Instagram corrigido.');
  console.log('');
  console.log('Próximos passos:');
  console.log('  1. git diff server/landing/index.html   (conferir visualmente)');
  console.log('  2. git add server/landing/index.html');
  console.log('  3. git commit -m "fix: corrige link do Instagram no rodape da landing page"');
  console.log('  4. git push   (o Railway faz o deploy automaticamente)');
} catch (err) {
  console.error('❌ Falha ao aplicar a alteração:');
  console.error(err.message);
  process.exit(1);
}
