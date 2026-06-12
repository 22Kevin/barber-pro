const fs = require('fs');

let content = fs.readFileSync('server/admin-routes.ts', 'utf8');
let changes = 0;

// 1. requireOwner middleware
if (!content.includes('function requireOwner(')) {
  const old = 'function requireAdminAuth(req: Request, res: Response, next: NextFunction) {';
  const novo = `function requireOwner(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).adminSession as { barberId: number; role: string } | undefined;
  if (!session || session.role !== "super_admin") {
    return res.redirect("/admin?erro=acesso_restrito");
  }
  return next();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {`;
  if (content.includes(old)) { content = content.replace(old, novo); changes++; console.log('OK: requireOwner'); }
  else console.log('MISS: requireAdminAuth');
}

// 2. res.locals.barberRole
if (!content.includes('res.locals.barberRole')) {
  const candidates = [
    '  (req as any).adminSession = session;\n  next();\n}\n\n// Middleware assíncrono',
    '  (req as any).adminSession = session;\n  return next();\n}\n\n// Middleware assíncrono',
  ];
  let found = false;
  for (const old of candidates) {
    if (content.includes(old)) {
      const novo = old.replace(
        '  (req as any).adminSession = session;\n',
        '  (req as any).adminSession = session;\n  if (res && res.locals) res.locals.barberRole = (session.role) || "super_admin";\n'
      );
      content = content.replace(old, novo); changes++; found = true;
      console.log('OK: res.locals.barberRole'); break;
    }
  }
  if (!found) console.log('MISS: fim requireAdminAuth');
}

// 3. adminLayoutWithGrace
if (!content.includes('barberRole = res')) {
  const old = 'function adminLayoutWithGrace(res: any, title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {\n  return adminLayout(title, activePage, body, barberName, tenantPlan, breadcrumb, res?.trialGrace ?? null);\n}';
  const novo = 'function adminLayoutWithGrace(res: any, title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {\n  const barberRole = (res && res.locals && res.locals.barberRole) || "super_admin";\n  return adminLayout(title, activePage, body, barberName, tenantPlan, breadcrumb, res && res.trialGrace ? res.trialGrace : null, barberRole);\n}';
  if (content.includes(old)) { content = content.replace(old, novo); changes++; console.log('OK: adminLayoutWithGrace'); }
  else console.log('MISS: adminLayoutWithGrace');
}

// 4. adminLayout signature
if (!content.includes('barberRole = "super_admin"')) {
  const old = 'function adminLayout(title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>, trialGrace?: { hoursLeft: number } | null): string {';
  const novo = 'function adminLayout(title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>, trialGrace?: { hoursLeft: number } | null, barberRole = "super_admin"): string {';
  if (content.includes(old)) { content = content.replace(old, novo); changes++; console.log('OK: adminLayout signature'); }
  else console.log('MISS: adminLayout signature');
}

// 5. navGroups filtrado
if (!content.includes('navGroupsAll') && !content.includes('BARBER_ALLOWED_IDS')) {
  const old = '  const navGroups = [';
  if (content.includes(old)) {
    content = content.replace(old, '  const isOwner = barberRole === "super_admin";\n  const navGroupsAll = [');
    changes++;
    console.log('OK: navGroupsAll');
  } else console.log('MISS: navGroups');

  const old2 = '  ];\n  // Logo URL: usa S3 se disponível, senão fallback para SVG inline';
  const novo2 = `  ];
  const BARBER_ALLOWED_IDS = new Set([
    "dashboard", "agenda", "clientes", "lista-espera",
    "servicos", "minhas-comissoes", "avaliacoes", "suporte"
  ]);
  const navGroups = isOwner
    ? navGroupsAll
    : navGroupsAll
        .map((g) => ({ ...g, items: g.items.filter((i) => BARBER_ALLOWED_IDS.has(i.id)) }))
        .filter((g) => g.items.length > 0);
  // Logo URL: usa S3 se disponível, senão fallback para SVG inline`;
  if (content.includes(old2)) { content = content.replace(old2, novo2); changes++; console.log('OK: nav filter'); }
  else console.log('MISS: nav filter anchor');
}

// 6. Proteger rotas críticas
const routes = [
  ['app.get("/admin/financeiro", requireAdminAuth,', 'app.get("/admin/financeiro", requireAdminAuth, requireOwner,'],
  ['app.post("/admin/financeiro/despesa", requireAdminAuth,', 'app.post("/admin/financeiro/despesa", requireAdminAuth, requireOwner,'],
  ['app.get("/admin/relatorios", requireAdminAuth,', 'app.get("/admin/relatorios", requireAdminAuth, requireOwner,'],
  ['app.get("/admin/comissoes", requireAdminAuth,', 'app.get("/admin/comissoes", requireAdminAuth, requireOwner,'],
  ['app.post("/admin/comissoes/config", requireAdminAuth,', 'app.post("/admin/comissoes/config", requireAdminAuth, requireOwner,'],
  ['app.get("/admin/promocoes", requireAdminAuth,', 'app.get("/admin/promocoes", requireAdminAuth, requireOwner,'],
  ['app.get("/admin/retorno-automatico", requireAdminAuth,', 'app.get("/admin/retorno-automatico", requireAdminAuth, requireOwner,'],
  ['app.get("/admin/pagina-cliente", requireAdminAuth,', 'app.get("/admin/pagina-cliente", requireAdminAuth, requireOwner,'],
  ['app.post("/admin/configuracoes/equipe/novo", requireAdminAuth,', 'app.post("/admin/configuracoes/equipe/novo", requireAdminAuth, requireOwner,'],
  ['app.post("/admin/configuracoes/equipe/toggle", requireAdminAuth,', 'app.post("/admin/configuracoes/equipe/toggle", requireAdminAuth, requireOwner,'],
];
let routeCount = 0;
for (const [old, novo] of routes) {
  if (content.includes(old) && !content.includes(novo)) {
    content = content.replace(old, novo); routeCount++; changes++;
  }
}
console.log(`OK: ${routeCount}/10 rotas protegidas`);

// 7. Dashboard filtrado por barbeiro
if (!content.includes('isBarberRole')) {
  const old = `  const stats = await db.getDashboardStats(dateStr, tenantId);
  const yesterdayStr = yesterday();
  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);`;
  const novo = `  const isBarberRole = session.role === "barber";
  const filterBarberId = isBarberRole ? session.barberId : undefined;
  const stats = await db.getDashboardStats(dateStr, tenantId, filterBarberId);
  const yesterdayStr = yesterday();
  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId, filterBarberId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  const appointments = (await db.getAllAppointmentsByDate(dateStr, tenantId)).filter((a) => !filterBarberId || a.barberId === filterBarberId);`;
  if (content.includes(old)) { content = content.replace(old, novo); changes++; console.log('OK: dashboard filtrado'); }
  else console.log('MISS: dashboard stats');
}

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log(`\nTotal: ${changes} mudanças aplicadas`);
console.log('Próximo passo:');
console.log('  git add server/admin-routes.ts');
console.log('  git commit -m "feat: permissoes por role"');
console.log('  git push');
