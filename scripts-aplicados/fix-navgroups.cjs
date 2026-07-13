const fs = require('fs');
let lines = fs.readFileSync('server/admin-routes.ts', 'utf8').split('\n');

// Verificar se já está aplicado
const already = lines.some(l => l.includes('navGroups = isOwner'));
if (already) {
  console.log('JA APLICADO');
  process.exit(0);
}

// Encontrar a linha que fecha o navGroupsAll ('];\n  // Logo URL')
// A linha 383 é '];' e a 384 começa com '  // Logo URL'
let insertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '];' && i + 1 < lines.length && lines[i+1].includes('Logo URL')) {
    insertIdx = i + 1; // inserir ANTES do comentário Logo URL
    break;
  }
}

if (insertIdx === -1) {
  console.log('ERRO: posicao nao encontrada');
  process.exit(1);
}

const injection = [
  '  const BARBER_ALLOWED_IDS = new Set([',
  '    "dashboard", "agenda", "clientes", "lista-espera",',
  '    "servicos", "minhas-comissoes", "avaliacoes", "suporte"',
  '  ]);',
  '  const navGroups = isOwner',
  '    ? navGroupsAll',
  '    : navGroupsAll',
  '        .map((g) => ({ ...g, items: g.items.filter((i) => BARBER_ALLOWED_IDS.has(i.id)) }))',
  '        .filter((g) => g.items.length > 0);',
];

lines.splice(insertIdx, 0, ...injection);
fs.writeFileSync('server/admin-routes.ts', lines.join('\n'), 'utf8');
console.log('OK — navGroups definido na linha ' + insertIdx);
