const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// Adicionar cache de plan em memória + timeout de segurança
patch('server/admin-routes.ts',
  `async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  const isApiCall = req.path.startsWith('/admin-api/') || (req.headers['content-type'] ?? '').includes('application/json');
  if (!token) {
    if (isApiCall) return res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
    return res.redirect('/admin/login');
  }
  const session = decodeSession(token);
  if (!session) {
    res.setHeader("Set-Cookie", \`\${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0\`);
    if (isApiCall) return res.status(401).json({ error: 'Sessao invalida. Faca login novamente.' });
    return res.redirect('/admin/login');
  }
  (req as any).adminSession = session;
  if (res && res.locals) res.locals.barberRole = session.role || "super_admin";
  // Carregar plan + permissions SINCRONAMENTE antes de chamar next()
  try {
    const b = await db.getBarberById(session.barberId);
    if (b) {
      // Permissions
      if (b.permissions) {
        try { (req as any).adminSession.permissions = JSON.parse(b.permissions as string); }
        catch(e) { (req as any).adminSession.permissions = null; }
      } else {
        (req as any).adminSession.permissions = null;
      }
      // Plan — obrigatório para feature gates
      if (b.tenantId) {
        const t = await db.getTenantById(b.tenantId);
        (req as any).adminSession.plan = (t as any)?.plan ?? "solo";
      }
    }
  } catch(e) {
    // Em caso de falha no banco, não bloquear — apenas sem plan/permissions
  }
  next();
}`,
  `// Cache de plan por barberId — TTL de 5 minutos para evitar queries a cada requisição
const _planCache = new Map<number, { plan: string; permissions: any; ts: number }>();
const PLAN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  const isApiCall = req.path.startsWith('/admin-api/') || (req.headers['content-type'] ?? '').includes('application/json');
  if (!token) {
    if (isApiCall) return res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
    return res.redirect('/admin/login');
  }
  const session = decodeSession(token);
  if (!session) {
    res.setHeader("Set-Cookie", \`\${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0\`);
    if (isApiCall) return res.status(401).json({ error: 'Sessao invalida. Faca login novamente.' });
    return res.redirect('/admin/login');
  }
  (req as any).adminSession = session;
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
  'requireAdminAuth com cache de plan (TTL 5min) + timeout 3s'
);

console.log('\nTotal: ' + ok + '/1');
