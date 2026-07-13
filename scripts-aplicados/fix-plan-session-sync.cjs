const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// Converter requireAdminAuth para async — carregar plan ANTES de chamar next()
patch('server/admin-routes.ts',
  `function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  const isApiCall = req.path.startsWith('/admin-api/') || (req.headers['content-type'] ?? '').includes('application/json');
  if (!token) {
    if (isApiCall) return res.status(401).json({ error: 'Sessao expirada. Faca login novamente.' });
    return res.redirect('/admin/login');
  }
  const session = decodeSession(token);
  if (!session) {
    // Clear invalid/expired cookie to force clean login
    res.setHeader("Set-Cookie", \`\${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0\`);
    if (isApiCall) return res.status(401).json({ error: 'Sessao invalida. Faca login novamente.' });
    return res.redirect('/admin/login');
  }
  (req as any).adminSession = session;
  if (res && res.locals) res.locals.barberRole = session.role || "super_admin";
  // Carregar plan + permissions do banco para uso no layout e feature gates
  db.getBarberById(session.barberId).then(async function(b) {
    if (!b?.tenantId) return;
    if (b.permissions) {
      try { (req as any).adminSession.permissions = JSON.parse(b.permissions as string); }
      catch(e) { (req as any).adminSession.permissions = null; }
    } else { (req as any).adminSession.permissions = null; }
    // Adicionar plan na sessão para o requireFeature funcionar corretamente
    try {
      const t = await db.getTenantById(b.tenantId);
      (req as any).adminSession.plan = (t as any)?.plan ?? "solo";
    } catch(e) {}
  }).catch(function() {});
  next();
}`,
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
  'requireAdminAuth async — plan carregado antes de next()'
);

console.log('\nTotal: ' + ok + '/1');
