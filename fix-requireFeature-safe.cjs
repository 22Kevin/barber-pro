const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// Reverter requireAdminAuth para versão síncrona original (sem queries extras)
patch('server/admin-routes.ts',
  `// Cache de plan por barberId — TTL de 5 minutos para evitar queries a cada requisição
const _planCache = new Map<number, { plan: string; permissions: any; ts: number }>();
const PLAN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {`,
  `function requireAdminAuth(req: Request, res: Response, next: NextFunction) {`,
  'reverter requireAdminAuth para síncrono'
);

// Remover o bloco de cache e queries adicionais, restaurar o next() original
patch('server/admin-routes.ts',
  `  (req as any).adminSession = session;
  if (res && res.locals) res.locals.barberRole = session.role || "super_admin";

  // Verificar cache antes de ir ao banco
  const cached = _planCache.get(session.barberId);
  if (cached && Date.now() - cached.ts < PLAN_CACHE_TTL) {
    (req as any).adminSession.plan = cached.plan;
    (req as any).adminSession.permissions = cached.permissions;
    return next();
  }

  // Cache expirado ou inexistente — buscar no banco com timeout de segurança
  try {
    const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))]);

    const b = await withTimeout(db.getBarberById(session.barberId), 3000);
    if (b) {
      let permissions: any = null;
      if ((b as any).permissions) {
        try { permissions = JSON.parse((b as any).permissions); } catch(e) {}
      }
      let plan = "solo";
      if ((b as any).tenantId) {
        const t = await withTimeout(db.getTenantById((b as any).tenantId), 3000);
        plan = (t as any)?.plan ?? "solo";
      }
      (req as any).adminSession.plan = plan;
      (req as any).adminSession.permissions = permissions;
      // Salvar no cache
      _planCache.set(session.barberId, { plan, permissions, ts: Date.now() });
    }
  } catch(e) {
    // Falha no banco — não bloquear, usar cache antigo se existir
    if (cached) {
      (req as any).adminSession.plan = cached.plan;
      (req as any).adminSession.permissions = cached.permissions;
    }
  }
  next();
}`,
  `  (req as any).adminSession = session;
  if (res && res.locals) res.locals.barberRole = session.role || "super_admin";
  // Carregar permissions do banco em background (não bloqueia a requisição)
  db.getBarberById(session.barberId).then(function(b) {
    if (b && (b as any).permissions) {
      try { (req as any).adminSession.permissions = JSON.parse((b as any).permissions); }
      catch(e) { (req as any).adminSession.permissions = null; }
    } else { (req as any).adminSession.permissions = null; }
  }).catch(function() {});
  next();
}`,
  'restaurar requireAdminAuth original'
);

// A correção real: requireFeature busca o plano do banco quando session.plan não existe
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
    // Se o plano já está na sessão, usar diretamente
    if (session?.plan) {
      return planHasFeature(session.plan, feature) ? next() : res.status(403).send(upgradePage(feature));
    }
    // Fallback: buscar plano do banco (barberId sempre está na sessão)
    try {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (db && session?.barberId) {
        const barberRows = await (db as any).select().from((await import("../drizzle/schema")).barbers)
          .where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).barbers.id, session.barberId))
          .limit(1);
        const barber = barberRows?.[0];
        if (barber?.tenantId) {
          const tenantRows = await (db as any).select().from((await import("../drizzle/schema")).tenants)
            .where((await import("drizzle-orm")).eq((await import("../drizzle/schema")).tenants.id, barber.tenantId))
            .limit(1);
          const plan = tenantRows?.[0]?.plan ?? "solo";
          session.plan = plan; // cachear na sessão para próximas chamadas
          return planHasFeature(plan, feature) ? next() : res.status(403).send(upgradePage(feature));
        }
      }
    } catch(e) {}
    // Se não conseguiu buscar, negar por segurança
    return res.status(403).send(upgradePage(feature));
  };
}`,
  'requireFeature busca plano do banco quando não está na sessão'
);

console.log('\nTotal: ' + ok + '/3');
