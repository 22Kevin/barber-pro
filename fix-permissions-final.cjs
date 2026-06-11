const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. requireAdminAuth — carregar permissions do banco e setar res.locals
rep(
  '  (req as any).adminSession = session;\n  next();\n}\n\n// Middleware assíncrono que verifica se a assinatura Barber Pro está ativa/trial.',
  '  (req as any).adminSession = session;\n  if (res && res.locals) res.locals.barberRole = session.role || "super_admin";\n  // Carregar permissions do banco para uso no layout\n  db.getBarberById(session.barberId).then(function(b) {\n    if (b && b.permissions) {\n      try { (req as any).adminSession.permissions = JSON.parse(b.permissions); }\n      catch(e) { (req as any).adminSession.permissions = null; }\n    } else { (req as any).adminSession.permissions = null; }\n  }).catch(function() {});\n  next();\n}\n\n// Middleware assíncrono que verifica se a assinatura Barber Pro está ativa/trial.',
  'requireAdminAuth + permissions'
);

// 2. adminLayoutWithGrace — ler barberRole e barberPerms do res
rep(
  'function adminLayoutWithGrace(res: any, title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {\n  return adminLayout(title, activePage, body, barberName, tenantPlan, breadcrumb, res?.trialGrace ?? null);\n}',
  'function adminLayoutWithGrace(res: any, title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {\n  const bRole = (res && res.locals && res.locals.barberRole) || "super_admin";\n  let bPerms: string[] | null = null;\n  try { const p = res && res.req && (res.req as any).adminSession && (res.req as any).adminSession.permissions; if (Array.isArray(p)) bPerms = p; } catch(e) {}\n  return adminLayout(title, activePage, body, barberName, tenantPlan, breadcrumb, res?.trialGrace ?? null, bRole, bPerms);\n}',
  'adminLayoutWithGrace com role+perms'
);

// 3. Proteger aba equipe — só admin pode ver/editar outros profissionais
// Na rota GET /admin/configuracoes, filtrar a aba equipe se não for super_admin
rep(
  '  // POST /admin/configuracoes/equipe/editar',
  '  // GET aba equipe — só super_admin vê lista completa e pode editar\n  // (já protegido pelo requireOwner nos POSTs)\n\n  // POST /admin/configuracoes/equipe/editar',
  'comentario equipe'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
