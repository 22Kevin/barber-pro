const fs = require('fs');
let c = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');

// O problema: renderBranchTab está declarada DENTRO do bloco de rotas (app.post)
// mas é chamada dentro de renderConfiguracoes que vem antes.
// Solução: extrair a função e colocá-la ANTES de renderConfiguracoes como função de módulo.

// 1. Extrair o corpo da função renderBranchTab de onde está
const funcStart = '  // ── renderBranchTab ────────────────────────────────────────────────────────\n  function renderBranchTab(branches: any[]): string {';
const funcEnd = "      +'<\\/script></div>';\n  }\n\n  app.post(\"/admin/filiais/criar\"";

if (!c.includes(funcStart)) { console.log('MISS: renderBranchTab não encontrada'); process.exit(1); }

const startIdx = c.indexOf(funcStart);
const endIdx = c.indexOf(funcEnd);
if (endIdx === -1) { console.log('MISS: fim da função não encontrado'); process.exit(1); }

// Extrair a função completa
const funcBody = c.slice(startIdx, endIdx + funcEnd.indexOf('\n\n  app.post'));
const withoutIndent = funcBody.replace(/^  /gm, ''); // remover 2 espaços de indentação (era método interno)

// 2. Remover a função do local atual
c = c.slice(0, startIdx) + c.slice(endIdx + funcEnd.indexOf('\n\n  app.post'));

// 3. Inserir ANTES de renderConfiguracoes como função top-level
const insertBefore = 'async function renderConfiguracoes(req: Request, res: Response) {';
if (!c.includes(insertBefore)) { console.log('MISS: renderConfiguracoes não encontrada'); process.exit(1); }

c = c.replace(insertBefore, withoutIndent + '\n\n' + insertBefore);

fs.writeFileSync('server/admin-routes.ts', c, 'utf8');
console.log('OK: renderBranchTab movida para escopo global antes de renderConfiguracoes');
