const fs = require('fs');
let c = 0;

function rep(file, old, novo, tag) {
  let content = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (content.includes(old)) {
    content = content.replace(old, novo);
    fs.writeFileSync(file, content, 'utf8');
    console.log('OK: '+tag); c++;
  } else console.log('MISS: '+tag);
}

// ── 1. auto-migrate.ts ────────────────────────────────────────────────────────
rep('server/auto-migrate.ts',
  `    { name: 'tenants."barberproTrialEndsAt"',        sql: \`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproTrialEndsAt" DATE\` },
  ];`,
  `    { name: 'tenants."barberproTrialEndsAt"',        sql: \`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "barberproTrialEndsAt" DATE\` },
    // ── Filiais (Plano Estúdio) ──────────────────────────────────────────────
    { name: 'tenants."parentTenantId"', sql: \`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "parentTenantId" INTEGER REFERENCES tenants(id) ON DELETE CASCADE\` },
    { name: 'tenants."displayName"',    sql: \`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "displayName" VARCHAR(100)\` },
    { name: 'tenants."isHeadquarters"', sql: \`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "isHeadquarters" BOOLEAN DEFAULT false\` },
    { name: 'tenants."branchOrder"',    sql: \`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "branchOrder" INTEGER DEFAULT 0\` },
  ];`,
  'auto-migrate filiais'
);

// ── 2. db.ts — funções de filiais ─────────────────────────────────────────────
const dbContent = fs.readFileSync('server/db.ts').toString('utf8').replace(/\r\n/g,'\n');
const insertPoint = '// ─── Vendas ───────────────────────────────────────────────────────────────────';
if (!dbContent.includes('getBranches') && dbContent.includes(insertPoint)) {
  const branchCode = `
// ─── Filiais (Plano Estúdio) ──────────────────────────────────────────────────

export async function getBranches(parentTenantId: number): Promise<any[]> {
  if (!_pool) await getDb();
  if (!_pool) return [];
  try {
    const result = await _pool.query(
      \`SELECT t.*, ss."shopName" FROM tenants t
       LEFT JOIN shop_settings ss ON ss."tenantId" = t.id
       WHERE t."parentTenantId" = $1 ORDER BY t."branchOrder" ASC, t.id ASC\`,
      [parentTenantId]
    );
    return result.rows;
  } catch { return []; }
}

export async function createBranch(parentTenantId: number, data: {
  name: string; displayName: string; slug: string;
  phone?: string; address?: string; cep?: string;
  addressNumber?: string; city?: string; state?: string; cnpj?: string;
}): Promise<number> {
  if (!_pool) await getDb();
  if (!_pool) throw new Error('Pool indisponível');
  const result = await _pool.query(
    \`INSERT INTO tenants (slug, name, "displayName", phone, cnpj, address, cep, "addressNumber", city, state, plan, status, "parentTenantId")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'studio','active',$11) RETURNING id\`,
    [data.slug, data.name, data.displayName, data.phone??null, data.cnpj??null,
     data.address??null, data.cep??null, data.addressNumber??null,
     data.city??null, data.state??null, parentTenantId]
  );
  const branchId = result.rows[0].id;
  await _pool.query(
    \`INSERT INTO shop_settings ("tenantId","shopName",phone,cnpj,address) VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("tenantId") DO NOTHING\`,
    [branchId, data.name, data.phone??null, data.cnpj??null, data.address??null]
  );
  return branchId;
}

export async function updateBranch(branchId: number, data: {
  name?: string; displayName?: string; phone?: string; address?: string;
  cep?: string; addressNumber?: string; city?: string; cnpj?: string;
}): Promise<void> {
  if (!_pool) await getDb();
  if (!_pool) return;
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  if (data.name !== undefined)        { sets.push(\`name = $\${i++}\`); vals.push(data.name); }
  if (data.displayName !== undefined) { sets.push(\`"displayName" = $\${i++}\`); vals.push(data.displayName); }
  if (data.phone !== undefined)       { sets.push(\`phone = $\${i++}\`); vals.push(data.phone); }
  if (data.address !== undefined)     { sets.push(\`address = $\${i++}\`); vals.push(data.address); }
  if (data.cep !== undefined)         { sets.push(\`cep = $\${i++}\`); vals.push(data.cep); }
  if (data.addressNumber !== undefined){ sets.push(\`"addressNumber" = $\${i++}\`); vals.push(data.addressNumber); }
  if (data.city !== undefined)        { sets.push(\`city = $\${i++}\`); vals.push(data.city); }
  if (data.cnpj !== undefined)        { sets.push(\`cnpj = $\${i++}\`); vals.push(data.cnpj); }
  if (!sets.length) return;
  vals.push(branchId);
  await _pool.query(\`UPDATE tenants SET \${sets.join(', ')} WHERE id = $\${i}\`, vals);
}

export async function deleteBranch(branchId: number): Promise<{ success: boolean; error?: string }> {
  if (!_pool) await getDb();
  if (!_pool) return { success: false, error: 'Pool indisponível' };
  const today = new Date().toISOString().split('T')[0];
  const check = await _pool.query(
    \`SELECT COUNT(*) as cnt FROM appointments a
     INNER JOIN barbers b ON b.id = a."barberId"
     WHERE b."tenantId" = $1 AND a.date >= $2 AND a.status NOT IN ('cancelled','no_show')\`,
    [branchId, today]
  );
  if (parseInt(check.rows[0].cnt) > 0) {
    return { success: false, error: 'Esta filial tem agendamentos futuros. Cancele-os antes de excluir.' };
  }
  await _pool.query('DELETE FROM tenants WHERE id = $1', [branchId]);
  return { success: true };
}

`;
  const newDb = dbContent.replace(insertPoint, branchCode + insertPoint);
  fs.writeFileSync('server/db.ts', newDb, 'utf8');
  console.log('OK: funções filiais no db.ts'); c++;
} else {
  console.log(dbContent.includes('getBranches') ? 'SKIP: db.ts já tem getBranches' : 'MISS: ponto de inserção db.ts');
}

// ── 3. admin-routes.ts ────────────────────────────────────────────────────────
let ar = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');

// 3a. Botão serviços
if (ar.includes(`\${s.isActive ? "Desativar" : "Ativar"}</button>`)) {
  ar = ar.replace(`\${s.isActive ? "Desativar" : "Ativar"}</button>`, `\${s.isActive ? "Ocultar do agendamento" : "Exibir no agendamento"}</button>`);
  console.log('OK: label botão serviços'); c++;
} else console.log('MISS: botão serviços');

// 3b. Lookup de filiais em renderConfiguracoes (linha ~6694)
const tenantLookup = `  const tenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;
  const currentSlug = tenant?.slug ?? "";`;
const tenantLookupNew = `  const tenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : undefined;
  const parentTenantId = (tenant as any)?.parentTenantId ?? null;
  const isStudioPlan = ((tenant as any)?.plan ?? '') === 'studio';
  let branches: any[] = [];
  if (isStudioPlan && !parentTenantId && barber?.tenantId) branches = await db.getBranches(barber.tenantId);
  const showBranchTab = isStudioPlan && !parentTenantId;
  const currentSlug = tenant?.slug ?? "";`;
if (ar.includes(tenantLookup)) {
  ar = ar.replace(tenantLookup, tenantLookupNew);
  console.log('OK: branches lookup'); c++;
} else console.log('MISS: tenantLookup — tentando segunda ocorrência');

// 3c. Array de tabs de configurações
const oldTabs = `  const tabs = [
    { id: 'dados', label: 'Dados' },
    { id: 'horarios', label: 'Horários' },
    { id: 'equipe', label: 'Equipe' },
    { id: 'pagamentos', label: '💳 Pagamentos' },
  ];

  const tabContent: Record<string, string> = {
    dados: tabDados,
    horarios: tabHorarios,`;

const newTabs = `  const tabFiliais = showBranchTab ? renderBranchTab(branches) : '';
  const tabs = [
    { id: 'dados', label: 'Dados' },
    { id: 'horarios', label: 'Horários' },
    { id: 'equipe', label: 'Equipe' },
    ...(showBranchTab ? [{ id: 'filiais', label: '🏪 Filiais' }] : []),
    { id: 'pagamentos', label: '💳 Pagamentos' },
  ];

  const tabContent: Record<string, string> = {
    dados: tabDados,
    horarios: tabHorarios,`;

if (ar.includes(oldTabs)) {
  ar = ar.replace(oldTabs, newTabs);
  console.log('OK: tabs com filiais'); c++;
} else console.log('MISS: oldTabs');

// 3d. tabFiliais no tabContent
const oldTabContent = `    equipe: tabEquipe,
    pagamentos: tabPagamentos,
  };`;
const newTabContent = `    equipe: tabEquipe,
    filiais: tabFiliais,
    pagamentos: tabPagamentos,
  };`;
if (ar.includes(oldTabContent)) {
  ar = ar.replace(oldTabContent, newTabContent);
  console.log('OK: tabFiliais no tabContent'); c++;
} else console.log('MISS: tabContent');

// 3e. Inserir função renderBranchTab + rotas POST antes da rota GET de configurações
const routeGET = `  app.get("/admin/configuracoes", requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {`;

const branchRoutes = `  // ── Filiais: função helper + rotas CRUD ────────────────────────────────────
  function renderBranchTab(branches: any[]): string {
    const cards = branches.length === 0
      ? '<div style="text-align:center;padding:60px 20px;background:var(--surface);border:1px solid var(--border);border-radius:16px"><div style="font-size:40px;margin-bottom:12px">🏪</div><div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:8px">Nenhuma filial cadastrada</div><div style="font-size:13px;color:var(--muted)">Crie sua primeira filial para começar a gerenciar sua rede.</div></div>'
      : '<div style="display:grid;gap:12px">' + branches.map(b => {
          const id = b.id;
          const dname = (b.displayName||b.name||'').replace(/"/g,'&quot;');
          const addr = (b.address||'Endereço não cadastrado').replace(/"/g,'&quot;');
          const bslug = b.slug||'';
          const editJson = JSON.stringify({id,name:b.name||'',displayName:b.displayName||'',phone:b.phone||'',address:b.address||'',city:b.city||'',cnpj:b.cnpj||'',cep:b.cep||'',addressNumber:b.addressNumber||''});
          return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:20px;display:flex;align-items:center;gap:16px">'
            +'<div style="width:48px;height:48px;border-radius:12px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🏪</div>'
            +'<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:700;color:var(--text)">'+dname+'</div>'
            +'<div style="font-size:12px;color:var(--muted);margin-top:2px">'+addr+'</div>'
            +'<div style="font-size:11px;margin-top:4px"><a href="https://usebarberpro.com/pub/'+bslug+'" target="_blank" style="color:var(--gold);text-decoration:none">usebarberpro.com/pub/'+bslug+'</a></div></div>'
            +'<div style="display:flex;gap:8px;flex-shrink:0">'
            +'<form method="POST" action="/admin/filiais/trocar" style="display:inline"><input type="hidden" name="branchId" value="'+id+'"/><input type="hidden" name="returnTo" value="/admin"/><button type="submit" class="btn btn-ghost" style="font-size:12px;padding:8px 14px">Acessar</button></form>'
            +'<button onclick="openBranchEdit('+id+')" data-branch=\''+editJson.replace(/'/g,'&apos;')+'\' class="btn btn-ghost" style="font-size:12px;padding:8px 14px">Editar</button>'
            +'<button onclick="deleteBranchConfirm('+id+',this)" data-bname="'+dname+'" class="btn btn-ghost" style="font-size:12px;padding:8px 14px;color:var(--error)">Excluir</button>'
            +'</div></div>';
        }).join('')+'</div>';

    const stateOpts = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(s=>'<option value="'+s+'">'+s+'</option>').join('');

    return '<div style="margin-bottom:24px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">'
      +'<div><h2 style="font-size:18px;font-weight:700;color:var(--text);margin:0 0 4px">Filiais</h2>'
      +'<p style="font-size:13px;color:var(--muted);margin:0">Gerencie as unidades da sua rede.</p></div>'
      +'<button onclick="document.getElementById(\\'modal-nova-filial\\').style.display=\\'flex\\'" class="btn btn-primary" style="padding:10px 20px">+ Nova Filial</button></div>'
      +cards
      +'<div id="modal-nova-filial" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;align-items:center;justify-content:center">'
      +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:520px;width:95%;max-height:90vh;overflow-y:auto">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px"><h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0">Nova Filial</h3>'
      +'<button onclick="document.getElementById(\\'modal-nova-filial\\').style.display=\\'none\\'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:20px">×</button></div>'
      +'<form method="POST" action="/admin/filiais/criar">'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">'
      +'<div style="grid-column:1/-1"><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Nome completo da filial *</label><input name="name" class="form-input" required placeholder="Ex: Marcos Studio - Centro" /></div>'
      +'<div style="grid-column:1/-1"><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Nome curto (seletor) *</label><input name="displayName" class="form-input" required placeholder="Ex: Centro" maxlength="30" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Telefone</label><input name="phone" class="form-input" data-mask="phone" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">CNPJ</label><input name="cnpj" class="form-input" data-mask="cnpj" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">CEP</label><input name="cep" class="form-input" data-mask="cep" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Número</label><input name="addressNumber" class="form-input" /></div>'
      +'<div style="grid-column:1/-1"><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Endereço</label><input name="address" class="form-input" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Cidade</label><input name="city" class="form-input" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Estado</label><select name="state" class="form-input"><option value="">UF</option>'+stateOpts+'</select></div>'
      +'</div><div style="display:flex;gap:10px;justify-content:flex-end">'
      +'<button type="button" onclick="document.getElementById(\\'modal-nova-filial\\').style.display=\\'none\\'" class="btn btn-ghost">Cancelar</button>'
      +'<button type="submit" class="btn btn-primary">Criar Filial</button></div></form></div></div>'
      +'<div id="modal-edit-filial" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;align-items:center;justify-content:center">'
      +'<div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:520px;width:95%;max-height:90vh;overflow-y:auto">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px"><h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0">Editar Filial</h3>'
      +'<button onclick="document.getElementById(\\'modal-edit-filial\\').style.display=\\'none\\'" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:20px">×</button></div>'
      +'<form method="POST" action="/admin/filiais/editar"><input type="hidden" name="branchId" id="efb-id"/>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">'
      +'<div style="grid-column:1/-1"><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Nome completo *</label><input name="name" id="efb-name" class="form-input" required /></div>'
      +'<div style="grid-column:1/-1"><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Nome curto *</label><input name="displayName" id="efb-display" class="form-input" required maxlength="30"/></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Telefone</label><input name="phone" id="efb-phone" class="form-input" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">CNPJ</label><input name="cnpj" id="efb-cnpj" class="form-input" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">CEP</label><input name="cep" id="efb-cep" class="form-input" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Número</label><input name="addressNumber" id="efb-num" class="form-input" /></div>'
      +'<div style="grid-column:1/-1"><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Endereço</label><input name="address" id="efb-address" class="form-input" /></div>'
      +'<div><label style="font-size:12px;color:var(--muted);margin-bottom:4px;display:block">Cidade</label><input name="city" id="efb-city" class="form-input" /></div>'
      +'</div><div style="display:flex;gap:10px;justify-content:flex-end">'
      +'<button type="button" onclick="document.getElementById(\\'modal-edit-filial\\').style.display=\\'none\\'" class="btn btn-ghost">Cancelar</button>'
      +'<button type="submit" class="btn btn-primary">Salvar</button></div></form></div></div>'
      +'<script>'
      +'function openBranchEdit(id){var btn=document.querySelector("[onclick=\\'openBranchEdit("+id+")\\']");var d=JSON.parse(btn.getAttribute("data-branch").replace(/&apos;/g,"\'"));'
      +'document.getElementById("efb-id").value=d.id;document.getElementById("efb-name").value=d.name;document.getElementById("efb-display").value=d.displayName;'
      +'document.getElementById("efb-phone").value=d.phone;document.getElementById("efb-address").value=d.address;document.getElementById("efb-city").value=d.city;'
      +'document.getElementById("efb-cnpj").value=d.cnpj;document.getElementById("efb-cep").value=d.cep;document.getElementById("efb-num").value=d.addressNumber;'
      +'document.getElementById("modal-edit-filial").style.display="flex";}'
      +'function deleteBranchConfirm(id,btn){var name=btn.getAttribute("data-bname");bpConfirm({icon:"🗑️",title:"Excluir filial",msg:"Excluir "+name+"? Esta ação não pode ser desfeita.",okLabel:"Excluir",danger:true,onConfirm:function(){var f=document.createElement("form");f.method="POST";f.action="/admin/filiais/excluir";var i=document.createElement("input");i.type="hidden";i.name="branchId";i.value=id;f.appendChild(i);document.body.appendChild(f);f.submit();}});}'
      +'<\\/script></div>';
  }

  app.post("/admin/filiais/criar", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      if (session.role !== 'super_admin') { res.redirect('/admin/configuracoes?tab=filiais'); return; }
      const barber = await db.getBarberById(session.barberId);
      const tenant = barber?.tenantId ? await db.getTenantById(barber.tenantId) : null;
      if ((tenant as any)?.plan !== 'studio') { res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent('Recurso exclusivo do plano Estúdio')); return; }
      const { name, displayName, phone, cnpj, address, cep, addressNumber, city, state } = req.body;
      if (!name || !displayName) { res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent('Nome e nome curto são obrigatórios')); return; }
      const baseSlug = (name as string).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').substring(0,50);
      let slug = baseSlug; let att = 0;
      while (await db.getTenantBySlug(slug)) { att++; slug = baseSlug + '-' + att; }
      await db.createBranch(barber!.tenantId!, { name, displayName, slug, phone, cnpj, address, cep, addressNumber, city, state });
      res.redirect('/admin/configuracoes?tab=filiais&saved=1');
    } catch(e: any) { res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent(e.message)); }
  });

  app.post("/admin/filiais/editar", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      if (session.role !== 'super_admin') { res.redirect('/admin/configuracoes?tab=filiais'); return; }
      const { branchId, name, displayName, phone, cnpj, address, cep, addressNumber, city } = req.body;
      await db.updateBranch(parseInt(branchId), { name, displayName, phone, cnpj, address, cep, addressNumber, city });
      res.redirect('/admin/configuracoes?tab=filiais&saved=1');
    } catch(e: any) { res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent(e.message)); }
  });

  app.post("/admin/filiais/excluir", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      if (session.role !== 'super_admin') { res.redirect('/admin/configuracoes?tab=filiais'); return; }
      const result = await db.deleteBranch(parseInt(req.body.branchId));
      if (!result.success) { res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent(result.error ?? 'Erro ao excluir')); return; }
      res.redirect('/admin/configuracoes?tab=filiais&saved=1');
    } catch(e: any) { res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent(e.message)); }
  });

  app.post("/admin/filiais/trocar", requireAdminAuth, (req: Request, res: Response) => {
    res.cookie('bp_branch_ctx', req.body.branchId ?? '', { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
    res.redirect(req.body.returnTo ?? '/admin');
  });

  app.get("/admin/configuracoes", requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {`;

if (ar.includes(routeGET)) {
  ar = ar.replace(routeGET, branchRoutes);
  console.log('OK: rotas filiais + renderBranchTab'); c++;
} else console.log('MISS: routeGET');

fs.writeFileSync('server/admin-routes.ts', ar, 'utf8');
console.log('\nTotal: '+c+' mudancas');
