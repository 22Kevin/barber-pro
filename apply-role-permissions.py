import sys

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. requireOwner middleware
if 'function requireOwner(' not in content:
    old = 'function requireAdminAuth(req: Request, res: Response, next: NextFunction) {'
    new = '''function requireOwner(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).adminSession as { barberId: number; role: string } | undefined;
  if (!session || session.role !== "super_admin") {
    return res.redirect("/admin?erro=acesso_restrito");
  }
  return next();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {'''
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
        print("OK: requireOwner criado")
    else:
        print("MISS: requireAdminAuth não encontrado")

# 2. res.locals.barberRole no requireAdminAuth
if 'res.locals.barberRole' not in content:
    # Tentar várias variações do fim do requireAdminAuth
    candidates = [
        '  (req as any).adminSession = session;\n  next();\n}\n\n// Middleware assíncrono',
        '  (req as any).adminSession = session;\n  return next();\n}\n\n// Middleware assíncrono',
    ]
    for old in candidates:
        if old in content:
            new = old.replace(
                '  (req as any).adminSession = session;\n',
                '  (req as any).adminSession = session;\n  if (res?.locals) res.locals.barberRole = (session as any).role ?? "super_admin";\n'
            )
            content = content.replace(old, new, 1)
            changes += 1
            print("OK: res.locals.barberRole adicionado")
            break
    else:
        print("MISS: fim do requireAdminAuth não encontrado")

# 3. adminLayoutWithGrace — adicionar barberRole
if 'barberRole' not in content:
    old = 'function adminLayoutWithGrace(res: any, title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {\n  return adminLayout(title, activePage, body, barberName, tenantPlan, breadcrumb, res?.trialGrace ?? null);\n}'
    new = 'function adminLayoutWithGrace(res: any, title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {\n  const barberRole = res?.locals?.barberRole ?? "super_admin";\n  return adminLayout(title, activePage, body, barberName, tenantPlan, breadcrumb, res?.trialGrace ?? null, barberRole);\n}'
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
        print("OK: barberRole no adminLayoutWithGrace")
    else:
        print("MISS: adminLayoutWithGrace não encontrado")

# 4. adminLayout — adicionar parâmetro barberRole
if 'barberRole = "super_admin"' not in content:
    old = 'function adminLayout(title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>, trialGrace?: { hoursLeft: number } | null): string {'
    new = 'function adminLayout(title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>, trialGrace?: { hoursLeft: number } | null, barberRole = "super_admin"): string {'
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
        print("OK: parâmetro barberRole no adminLayout")
    else:
        print("MISS: adminLayout signature não encontrada")

# 5. navGroups — renomear para navGroupsAll e adicionar filtro
if 'navGroupsAll' not in content and 'BARBER_ALLOWED_IDS' not in content:
    old = '  const navGroups = ['
    new = '  const isOwner = barberRole === "super_admin";\n  const navGroupsAll = ['
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
        print("OK: navGroupsAll criado")

    # Fechar com filtro
    old2 = '  ];\n  // Logo URL: usa S3 se disponível, senão fallback para SVG inline'
    new2 = '''  ];
  const BARBER_ALLOWED_IDS = new Set([
    "dashboard", "agenda", "clientes", "lista-espera",
    "servicos", "minhas-comissoes", "avaliacoes", "suporte"
  ]);
  const navGroups = isOwner
    ? navGroupsAll
    : navGroupsAll
        .map((g: any) => ({ ...g, items: g.items.filter((i: any) => BARBER_ALLOWED_IDS.has(i.id)) }))
        .filter((g: any) => g.items.length > 0);
  // Logo URL: usa S3 se disponível, senão fallback para SVG inline'''
    if old2 in content:
        content = content.replace(old2, new2, 1)
        changes += 1
        print("OK: filtro de nav por role adicionado")
    else:
        print("MISS: fechamento do navGroups não encontrado")

# 6. Proteger rotas críticas com requireOwner
routes_to_protect = [
    ('app.get("/admin/financeiro", requireAdminAuth,', 'app.get("/admin/financeiro", requireAdminAuth, requireOwner,'),
    ('app.post("/admin/financeiro/despesa", requireAdminAuth,', 'app.post("/admin/financeiro/despesa", requireAdminAuth, requireOwner,'),
    ('app.get("/admin/relatorios", requireAdminAuth,', 'app.get("/admin/relatorios", requireAdminAuth, requireOwner,'),
    ('app.get("/admin/comissoes", requireAdminAuth,', 'app.get("/admin/comissoes", requireAdminAuth, requireOwner,'),
    ('app.post("/admin/comissoes/config", requireAdminAuth,', 'app.post("/admin/comissoes/config", requireAdminAuth, requireOwner,'),
    ('app.get("/admin/promocoes", requireAdminAuth,', 'app.get("/admin/promocoes", requireAdminAuth, requireOwner,'),
    ('app.get("/admin/retorno-automatico", requireAdminAuth,', 'app.get("/admin/retorno-automatico", requireAdminAuth, requireOwner,'),
    ('app.get("/admin/pagina-cliente", requireAdminAuth,', 'app.get("/admin/pagina-cliente", requireAdminAuth, requireOwner,'),
    ('app.post("/admin/configuracoes/equipe/novo", requireAdminAuth,', 'app.post("/admin/configuracoes/equipe/novo", requireAdminAuth, requireOwner,'),
    ('app.post("/admin/configuracoes/equipe/toggle", requireAdminAuth,', 'app.post("/admin/configuracoes/equipe/toggle", requireAdminAuth, requireOwner,'),
]
for old, new in routes_to_protect:
    if old in content and new not in content:
        content = content.replace(old, new, 1)
        changes += 1

print(f"OK: {sum(1 for o,n in routes_to_protect if n in content)}/10 rotas protegidas")

# 7. Dashboard — filtrar por barbeiro quando role = barber
if 'isBarberRole' not in content:
    old = '''  const stats = await db.getDashboardStats(dateStr, tenantId);
  const yesterdayStr = yesterday();
  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  const appointments = await db.getAllAppointmentsByDate(dateStr, tenantId);'''
    new = '''  const isBarberRole = session.role === "barber";
  const filterBarberId = isBarberRole ? session.barberId : undefined;
  const stats = await db.getDashboardStats(dateStr, tenantId, filterBarberId);
  const yesterdayStr = yesterday();
  const statsYesterday = await db.getDashboardStats(yesterdayStr, tenantId, filterBarberId).catch(() => ({ appointmentsToday: 0, revenueToday: 0, clientsToday: 0, pendingAppointments: 0 }));
  const appointments = (await db.getAllAppointmentsByDate(dateStr, tenantId)).filter((a: any) => !filterBarberId || a.barberId === filterBarberId);'''
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
        print("OK: dashboard filtrado por barbeiro")
    else:
        print("MISS: dashboard stats não encontrado")

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal de mudanças aplicadas: {changes}")
print("Agora rode: git add server/admin-routes.ts && git commit -m 'feat: permissoes por role' && git push")
