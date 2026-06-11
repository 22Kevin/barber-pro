const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts', 'utf8');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: ' + tag); c++; }
  else console.log('MISS: ' + tag);
}

// 1. requireAdminAuth — res.locals + permissions
rep(
  '  (req as any).adminSession = session;\n  next();\n}\n\n// Middleware assíncrono que verifica se a assinatura Barber Pro está ativa/trial.',
  '  (req as any).adminSession = session;\n  if (res && res.locals) res.locals.barberRole = session.role || "super_admin";\n  db.getBarberById(session.barberId).then(function(b) {\n    if (b && b.permissions) { try { (req).adminSession.permissions = JSON.parse(b.permissions); } catch(e) { (req).adminSession.permissions = null; } }\n    else { (req).adminSession.permissions = null; }\n  }).catch(function() {});\n  next();\n}\n\n// Middleware assíncrono que verifica se a assinatura Barber Pro está ativa/trial.',
  'requireAdminAuth'
);

// 2. adminLayoutWithGrace
rep(
  'function adminLayoutWithGrace(res: any, title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {\n  return adminLayout(title, activePage, body, barberName, tenantPlan, breadcrumb, res?.trialGrace ?? null);\n}',
  'function adminLayoutWithGrace(res: any, title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>): string {\n  const bRole = (res && res.locals && res.locals.barberRole) || "super_admin";\n  let bPerms = null;\n  try { const p = res && res.req && res.req.adminSession && res.req.adminSession.permissions; if (Array.isArray(p)) bPerms = p; } catch(e) {}\n  return adminLayout(title, activePage, body, barberName, tenantPlan, breadcrumb, res && res.trialGrace ? res.trialGrace : null, bRole, bPerms);\n}',
  'adminLayoutWithGrace'
);

// 3. adminLayout signature
rep(
  'function adminLayout(title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>, trialGrace?: { hoursLeft: number } | null, barberRole = "super_admin"): string {',
  'function adminLayout(title: string, activePage: string, body: string, barberName = "", tenantPlan = "", breadcrumb?: Array<{label: string, href: string}>, trialGrace?: { hoursLeft: number } | null, barberRole = "super_admin", barberPerms: any = null): string {',
  'adminLayout signature'
);

// 4. CSS perm-locked
if (!content.includes('nav-item-perm-locked')) {
  const cssA = '    .nav-item-locked:hover { background:var(--surface2)!important }';
  const idx = content.lastIndexOf(cssA);
  if (idx !== -1) {
    content = content.slice(0,idx+cssA.length) + '\n    .nav-item-perm-locked { cursor:not-allowed!important }\n    .nav-item-perm-locked:hover { background:var(--surface2)!important }' + content.slice(idx+cssA.length);
    console.log('OK: CSS perm-locked'); c++;
  }
}

// 5. Sidebar — bloco perm-denied após plano locked
rep(
  '            </a>`;}\n            return `\n            <a href="${n.href}"',
  '            </a>`;}\n            const permId = n.permId||n.id;\n            const permDenied = barberRole!=="super_admin" && barberPerms!==null && !barberPerms.includes(permId);\n            if(permDenied){return `<a href="#" class="nav-item nav-item-perm-locked" onclick="return false;" title="Acesso bloqueado. Solicite ao administrador para liberar este módulo.">\n              <span class="nav-icon" style="opacity:.28">${n.icon}</span>\n              <span style="opacity:.28">${n.label}</span>\n              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:auto;opacity:.22;flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>\n            </a>`;}\n            return `\n            <a href="${n.href}"',
  'sidebar perm-denied'
);

// 6. Formulário — olhinho e grid de permissões
rep(
  '            <div class="form-group">\n              <label class="form-label">Senha *</label>\n              <input class="form-input" type="password" name="password" required placeholder="Mínimo 6 caracteres" minlength="6" />\n            </div>',
  '            <div class="form-group">\n              <label class="form-label">Senha *</label>\n              <div style="position:relative">\n                <input class="form-input" type="password" name="password" id="inp-senha-novo" required placeholder="Mínimo 6 caracteres" minlength="6" style="padding-right:40px" />\n                <button type="button" onclick="var i=document.getElementById(\'inp-senha-novo\');if(i.type===\'password\'){i.type=\'text\';}else{i.type=\'password\';}" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px" tabindex="-1">👁</button>\n              </div>\n            </div>',
  'olhinho senha'
);

// Função + grid após o telefone, antes do submit
rep(
  '          <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">Cadastrar Profissional</button>',
  `          <input type="hidden" name="jobRole" id="hidden-jobrole" value="barber" />
          <div class="form-group" style="margin:20px 0 0">
            <label class="form-label">Função *</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
              <label id="role-btn-admin" onclick="setRoleNovo('admin')" style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted)">👑 Admin</label>
              <label id="role-btn-barber" onclick="setRoleNovo('barber')" style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;border:1.5px solid rgba(201,168,76,.6);background:rgba(201,168,76,.08);cursor:pointer;font-size:13px;font-weight:500;color:var(--gold)">✂️ Barbeiro</label>
              <label id="role-btn-receptionist" onclick="setRoleNovo('receptionist')" style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted)">🗂️ Recepcionista</label>
            </div>
          </div>
          <div style="margin:20px 0">
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Permissões de acesso</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Módulos não selecionados aparecerão com cadeado no menu.</div>
            <div id="perms-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px">
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="agenda" id="chk-agenda" checked style="accent-color:var(--gold)" /> <span>📅</span> <span style="font-size:13px">Agenda</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="clientes" id="chk-clientes" checked style="accent-color:var(--gold)" /> <span>👥</span> <span style="font-size:13px">Clientes</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="lista-espera" id="chk-lista-espera" checked style="accent-color:var(--gold)" /> <span>⏳</span> <span style="font-size:13px">Lista de Espera</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="servicos" id="chk-servicos" checked style="accent-color:var(--gold)" /> <span>✂️</span> <span style="font-size:13px">Serviços</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="financeiro" id="chk-financeiro" style="accent-color:var(--gold)" /> <span>💰</span> <span style="font-size:13px">Financeiro</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="relatorios" id="chk-relatorios" style="accent-color:var(--gold)" /> <span>📊</span> <span style="font-size:13px">Relatórios</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="comissoes" id="chk-comissoes" style="accent-color:var(--gold)" /> <span>💎</span> <span style="font-size:13px">Comissões</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="minhas-comissoes" id="chk-minhas-comissoes" checked style="accent-color:var(--gold)" /> <span>🏅</span> <span style="font-size:13px">Minhas Comissões</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="produtos" id="chk-produtos" style="accent-color:var(--gold)" /> <span>📦</span> <span style="font-size:13px">Produtos/Estoque</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="marketing" id="chk-marketing" style="accent-color:var(--gold)" /> <span>📣</span> <span style="font-size:13px">Marketing</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="configuracoes" id="chk-configuracoes" style="accent-color:var(--gold)" /> <span>⚙️</span> <span style="font-size:13px">Configurações</span></label>
            </div>
          </div>
          <script>
            var DEFS={admin:['agenda','clientes','lista-espera','servicos','financeiro','relatorios','comissoes','minhas-comissoes','produtos','marketing','configuracoes'],barber:['agenda','clientes','lista-espera','servicos','minhas-comissoes'],receptionist:['agenda','clientes','lista-espera','servicos','financeiro','relatorios','produtos','marketing']};
            function setRoleNovo(r){
              document.getElementById('hidden-jobrole').value=r;
              ['admin','barber','receptionist'].forEach(function(x){var el=document.getElementById('role-btn-'+x);if(x===r){el.style.borderColor='rgba(201,168,76,.6)';el.style.background='rgba(201,168,76,.08)';el.style.color='var(--gold)';}else{el.style.borderColor='#2a2a2a';el.style.background='#1a1a1a';el.style.color='var(--muted)';}});
              var perms=DEFS[r]||[];var isAdmin=r==='admin';
              document.querySelectorAll('#perms-grid input[type=checkbox]').forEach(function(chk){chk.checked=perms.includes(chk.value);chk.disabled=isAdmin;chk.closest('label').style.opacity=isAdmin?'.7':'1';});
            }
          </script>
          <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">Cadastrar Profissional</button>`,
  'formulario funcao+permissoes'
);

// 7. POST salvar permissões
rep(
  '      const { name, email, password, phone } = req.body ?? {};\n      if (!name || !email || !password) {\n        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Preencha+todos+os+campos"); return;\n      }\n      if (password.length < 6) {\n        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Senha+deve+ter+m%C3%ADnimo+6+caracteres"); return;\n      }\n      const passwordHash = await bcrypt.hash(password, 10);\n      await db.createBarber({ name, email, phone: phone || null, passwordHash, role: "barber", isActive: true, tenantId });\n      res.redirect("/admin/configuracoes?tab=equipe&saved=1");',
  '      const { name, email, password, phone, jobRole } = req.body ?? {};\n      if (!name || !email || !password) {\n        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Preencha+todos+os+campos"); return;\n      }\n      if (password.length < 6) {\n        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Senha+deve+ter+m%C3%ADnimo+6+caracteres"); return;\n      }\n      const rawPerms = req.body.permissions;\n      const permissions = jobRole === "admin"\n        ? ["agenda","clientes","lista-espera","servicos","financeiro","relatorios","comissoes","minhas-comissoes","produtos","marketing","configuracoes"]\n        : (Array.isArray(rawPerms) ? rawPerms : (rawPerms ? [rawPerms] : []));\n      const dbRole = jobRole === "admin" ? "super_admin" : jobRole === "receptionist" ? "receptionist" : "barber";\n      const passwordHash = await bcrypt.hash(password, 10);\n      const newBarber = await db.createBarber({ name, email, phone: phone || null, passwordHash, role: dbRole as any, isActive: true, tenantId });\n      if (newBarber && newBarber.id) {\n        const safePerms = JSON.stringify(permissions).replace(/\'/g, "\'\'");\n        const dbConn = await db.getDb();\n        if (dbConn) await (dbConn as any).execute("UPDATE barbers SET permissions = \'" + safePerms + "\' WHERE id = " + newBarber.id);\n      }\n      res.redirect("/admin/configuracoes?tab=equipe&saved=1");',
  'POST permissoes'
);

// 8. auto-migrate — coluna permissions
let migrate = fs.readFileSync('server/auto-migrate.ts', 'utf8');
if (!migrate.includes('barbers.permissions')) {
  const anchor = "    { name: 'products.\"supplierId\"',";
  if (migrate.includes(anchor)) {
    migrate = migrate.replace(anchor, "    { name: 'barbers.permissions', sql: `ALTER TABLE barbers ADD COLUMN IF NOT EXISTS permissions TEXT` },\n    { name: 'barbers.\"jobTitle\"', sql: `ALTER TABLE barbers ADD COLUMN IF NOT EXISTS \"jobTitle\" VARCHAR(100)` },\n    " + anchor.slice(4));
    fs.writeFileSync('server/auto-migrate.ts', migrate, 'utf8');
    console.log('OK: auto-migrate permissions'); c++;
  } else console.log('MISS: auto-migrate anchor');
}

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('\nTotal: ' + c + ' mudancas');
console.log('Proximo: git add server/admin-routes.ts server/auto-migrate.ts && git commit -m "feat: permissoes granulares" && git push');
