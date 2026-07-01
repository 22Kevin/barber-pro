const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// Adicionar plan na sessão ao autenticar
patch('server/admin-routes.ts',
  `  (req as any).adminSession = session;
  if (res && res.locals) res.locals.barberRole = session.role || "super_admin";
  // Carregar permissions do banco para uso no layout
  db.getBarberById(session.barberId).then(function(b) {
    if (b && b.permissions) {
      try { (req as any).adminSession.permissions = JSON.parse(b.permissions); }
      catch(e) { (req as any).adminSession.permissions = null; }
    } else { (req as any).adminSession.permissions = null; }
  }).catch(function() {});
  next();`,
  `  (req as any).adminSession = session;
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
  next();`,
  'session.plan populado no requireAdminAuth'
);

console.log('\nTotal: ' + ok + '/1');
