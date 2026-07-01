const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// ── 1. Adicionar helper parseMoneyInput no topo do admin-routes ───────────────
patch('server/admin-routes.ts',
  `const ADMIN_SESSION_COOKIE = "bp_admin_session";`,
  `// ─── Helper universal de parsing de valores monetários ────────────────────────
// Aceita qualquer formato: "1.234,56" "1,234.56" "1234.56" "1234,56" "0,15" "0.15"
function parseMoneyInput(val: any, defaultVal = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  const s = String(val).trim();
  if (!s) return defaultVal;
  // Detectar formato: se tem vírgula E ponto, o último separador é o decimal
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma > lastDot) {
    // Formato BR: 1.234,56 → remover pontos, trocar vírgula por ponto
    normalized = s.replace(/\\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Formato US: 1,234.56 → remover vírgulas
    normalized = s.replace(/,/g, '');
  } else {
    // Sem separador decimal: apenas dígitos
    normalized = s.replace(/[^0-9]/g, '');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? defaultVal : n;
}
function moneyStr(val: any, defaultVal = '0.00'): string {
  const n = parseMoneyInput(val);
  return n > 0 ? n.toFixed(2) : defaultVal;
}

const ADMIN_SESSION_COOKIE = "bp_admin_session";`,
  'helper parseMoneyInput + moneyStr'
);

// ── 2. Serviços: normalizar price ─────────────────────────────────────────────
patch('server/admin-routes.ts',
  `    const rawPrice = (req.body.price ?? '').toString().replace(/\\./g, '').replace(',', '.');
    const price = isNaN(parseFloat(rawPrice)) ? '0' : String(parseFloat(rawPrice));`,
  `    const price = moneyStr(req.body.price);`,
  'serviços: moneyStr(price)'
);

// ── 3. Produtos: normalizar price e costPrice ─────────────────────────────────
patch('server/admin-routes.ts',
  `    // Normalizar preços (vêm do form com máscara "1.234,56" → banco espera "1234.56")
    const priceNum = price ? parseFloat(String(price).replace(/\\./g,'').replace(',','.')) : 0;
    const priceStr = priceNum > 0 ? priceNum.toFixed(2) : "0.00";
    const costPriceNum = costPrice ? parseFloat(String(costPrice).replace(/\\./g,'').replace(',','.')) : null;
    const costPriceStr = costPriceNum && costPriceNum > 0 ? costPriceNum.toFixed(2) : null;`,
  `    const priceStr = moneyStr(price);
    const costPriceNum = parseMoneyInput(costPrice);
    const costPriceStr = costPriceNum > 0 ? costPriceNum.toFixed(2) : null;`,
  'produtos: moneyStr(price) + parseMoneyInput(costPrice)'
);

// ── 4. Despesas: normalizar amount ────────────────────────────────────────────
patch('server/admin-routes.ts',
  `      const { description, category, amount, date, paymentMethod } = req.body ?? {};`,
  `      const { description, category, date, paymentMethod } = req.body ?? {};
      const amount = moneyStr(req.body.amount);`,
  'despesas: moneyStr(amount)'
);

// ── 5. Planos de assinatura: normalizar price ─────────────────────────────────
patch('server/admin-routes.ts',
  `    const { name, description, price, recurrences, maxServices, maxProducts } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;\n    if (editId) {`,
  `    const { name, description, recurrences, maxServices, maxProducts } = req.body;
    const price = moneyStr(req.body.price);
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;\n    if (editId) {`,
  'planos assinatura POST edit: moneyStr(price)'
);

patch('server/admin-routes.ts',
  `    const { name, description, price, recurrences, maxServices, maxProducts } = req.body;
    if (!name || !price || !recurrences) {`,
  `    const { name, description, recurrences, maxServices, maxProducts } = req.body;
    const price = moneyStr(req.body.price);
    if (!name || !price || !recurrences) {`,
  'planos assinatura POST novo: moneyStr(price)'
);

// ── 6. Movimentação de estoque: normalizar unitCost ───────────────────────────
patch('server/admin-routes.ts',
  `    const unitCostNum = unitCost ? parseFloat(unitCost.replace(/\\./g,'').replace(',','.')) : null;`,
  `    const unitCostNum = unitCost ? parseMoneyInput(unitCost) : null;`,
  'estoque movimentação: parseMoneyInput(unitCost)'
);

// ── 7. Pagamento de agendamento: normalizar amount ────────────────────────────
patch('server/admin-routes.ts',
  `      const { appointmentId, serviceId, serviceName, clientId, barberId, amount, paymentMethod } = req.body;`,
  `      const { appointmentId, serviceId, serviceName, clientId, barberId, paymentMethod } = req.body;
      const amount = moneyStr(req.body.amount);`,
  'pagamento agendamento: moneyStr(amount)'
);

// ── 8. Cancelar cobrança Asaas / cancel charge: normalizar amount ─────────────
patch('server/admin-routes.ts',
  `      const { appointmentId, clientId, clientName, clientPhone, amount, description } = req.body;`,
  `      const { appointmentId, clientId, clientName, clientPhone, description } = req.body;
      const amount = moneyStr(req.body.amount);`,
  'cancel charge: moneyStr(amount)'
);

console.log('\nTotal: ' + ok + '/8');
