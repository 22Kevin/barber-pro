const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// ── FIX 1: normalizar price do produto (vírgula → ponto) ──────────────────────
patch('server/admin-routes.ts',
  `    // Normalizar preço de custo (vem do form com máscara "1.234,56")
    const costPriceNum = costPrice ? parseFloat(costPrice.replace(/\\./g,'').replace(',','.')) : null;
    const costPriceStr = costPriceNum && costPriceNum > 0 ? costPriceNum.toFixed(2) : null;`,
  `    // Normalizar preços (vêm do form com máscara "1.234,56" → banco espera "1234.56")
    const priceNum = price ? parseFloat(String(price).replace(/\\./g,'').replace(',','.')) : 0;
    const priceStr = priceNum > 0 ? priceNum.toFixed(2) : "0.00";
    const costPriceNum = costPrice ? parseFloat(String(costPrice).replace(/\\./g,'').replace(',','.')) : null;
    const costPriceStr = costPriceNum && costPriceNum > 0 ? costPriceNum.toFixed(2) : null;`,
  'normalizar price do produto'
);

// Usar priceStr no lugar de price ao criar/editar
patch('server/admin-routes.ts',
  `      await db.updateProduct(editId, { name, description, price, costPrice: costPriceStr, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true", supplierId: supplierIdNum } as any);`,
  `      await db.updateProduct(editId, { name, description, price: priceStr, costPrice: costPriceStr, productType, stockQuantity: parseInt(stockQuantity), minStockAlert: parseInt(minStockAlert), isActive: isActive === "true", supplierId: supplierIdNum } as any);`,
  'usar priceStr no updateProduct'
);

patch('server/admin-routes.ts',
  `      const newProduct = await db.createProduct({ name, description, price: String(price), costPrice: costPriceStr,`,
  `      const newProduct = await db.createProduct({ name, description, price: priceStr, costPrice: costPriceStr,`,
  'usar priceStr no createProduct'
);

// ── FIX 2: requireFeature busca plano do banco via rawQuery simples ───────────
patch('server/plan-features.ts',
  `export function requireFeature(feature: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).adminSession;
    const plan: string | undefined = session?.plan;
    if (planHasFeature(plan, feature)) {
      return next();
    }
    return res.status(403).send(upgradePage(feature));
  };
}`,
  `export function requireFeature(feature: FeatureKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).adminSession;
    // 1. Tentar usar plan já na sessão
    if (session?.plan) {
      return planHasFeature(session.plan, feature) ? next() : res.status(403).send(upgradePage(feature));
    }
    // 2. Buscar plano do banco via rawQuery (sem Drizzle para evitar imports circulares)
    try {
      if (session?.barberId) {
        const { getDb } = await import("./db") as any;
        const pool = (await getDb())?.pool ?? null;
        // Usar _pool direto via getDb que expõe o pool pg
        const mod = await import("./db") as any;
        const _pool = mod._pool ?? null;
        if (_pool) {
          const r = await _pool.query(
            \`SELECT t.plan FROM barbers b
             JOIN tenants t ON t.id = b."tenantId"
             WHERE b.id = $1 LIMIT 1\`,
            [session.barberId]
          );
          const plan = r.rows?.[0]?.plan ?? "solo";
          session.plan = plan;
          return planHasFeature(plan, feature) ? next() : res.status(403).send(upgradePage(feature));
        }
      }
    } catch(e) {}
    return res.status(403).send(upgradePage(feature));
  };
}`,
  'requireFeature busca plano via _pool'
);

console.log('\nTotal: ' + ok + '/4');
