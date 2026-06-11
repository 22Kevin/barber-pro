const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts', 'utf8');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: ' + tag); c++; }
  else console.log('MISS: ' + tag);
}

// 1. Mover script para FORA do card oculto — inserir logo antes do fechamento do tabEquipe
// O tabEquipe fecha com:  `;\n\n  // Aba: URL
rep(
  `  \`;\n\n  // Aba: URL Pública`,
  `  <script>
    var DEFS_EQUIPE={admin:['agenda','clientes','lista-espera','servicos','financeiro','relatorios','comissoes','minhas-comissoes','produtos','marketing','configuracoes'],barber:['agenda','clientes','lista-espera','servicos','minhas-comissoes'],receptionist:['agenda','clientes','lista-espera','servicos','financeiro','relatorios','produtos','marketing']};
    var _profissionais=[\${allBarbers.map((b)=>'['+b.id+',"'+((b.name||'').replace(/"/g,'&quot;').replace(/\\\\/g,'\\\\\\\\'))+'","'+((b.email||'').replace(/"/g,'&quot;'))+'","'+((b.phone||'').replace(/"/g,'&quot;'))+'","'+(b.role==='super_admin'?'admin':b.role)+'",'+JSON.stringify(b.permissions??null)+']').join(',')}];
    function toggleFormNovo(){var card=document.getElementById('card-novo-prof');var btn=document.getElementById('btn-novo-prof');if(!card)return;if(card.style.display==='none'||card.style.display===''){card.style.display='block';btn.textContent='✕ Fechar';card.scrollIntoView({behavior:'smooth',block:'start'});}else{card.style.display='none';btn.textContent='+ Novo Profissional';}}
    function setRoleNovo(r){document.getElementById('hidden-jobrole').value=r;['admin','barber','receptionist'].forEach(function(x){var el=document.getElementById('role-btn-'+x);if(!el)return;if(x===r){el.style.borderColor='rgba(201,168,76,.6)';el.style.background='rgba(201,168,76,.08)';el.style.color='var(--gold)';}else{el.style.borderColor='#2a2a2a';el.style.background='#1a1a1a';el.style.color='var(--muted)';}});var perms=DEFS_EQUIPE[r]||[];var isAdmin=r==='admin';document.querySelectorAll('#perms-grid-novo input[type=checkbox]').forEach(function(chk){chk.checked=perms.includes(chk.value);chk.disabled=isAdmin;chk.closest('label').style.opacity=isAdmin?'.7':'1';});}
    function openEditModalProf(id){var b=_profissionais.find(function(x){return x[0]==id;});if(!b)return;document.getElementById('edit-prof-id').value=b[0];document.getElementById('edit-prof-name').value=b[1];document.getElementById('edit-prof-email').value=b[2];document.getElementById('edit-prof-phone').value=b[3]||'';document.getElementById('edit-prof-pass').value='';setRoleEdit(b[4]||'barber');var perms=b[5];document.querySelectorAll('#perms-grid-edit input[type=checkbox]').forEach(function(chk){chk.checked=perms?perms.includes(chk.value):false;});var modal=document.getElementById('edit-prof-modal');modal.style.display='flex';}
    function closeEditModalProf(){document.getElementById('edit-prof-modal').style.display='none';}
    function setRoleEdit(r){var hid=document.getElementById('edit-prof-role');if(hid)hid.value=r;['admin','barber','receptionist'].forEach(function(x){var el=document.getElementById('edit-role-btn-'+x);if(!el)return;if(x===r){el.style.borderColor='rgba(201,168,76,.6)';el.style.background='rgba(201,168,76,.08)';el.style.color='var(--gold)';}else{el.style.borderColor='#2a2a2a';el.style.background='#1a1a1a';el.style.color='var(--muted)';}});var isAdmin=r==='admin';document.querySelectorAll('#perms-grid-edit input[type=checkbox]').forEach(function(chk){chk.disabled=isAdmin;chk.closest('label').style.opacity=isAdmin?'.7':'1';});}
    document.addEventListener('DOMContentLoaded',function(){var m=document.getElementById('edit-prof-modal');if(m)m.addEventListener('click',function(e){if(e.target===m)closeEditModalProf();});});
  </script>
  \`;\n\n  // Aba: URL Pública`,
  'script global equipe'
);

// 2. Substituir formulário condicional por card toggleável + modal editar
rep(
  `    \${req.query.novo === '1' ? \`
    <div class="card">
      <div class="card-header"><div class="card-title">Novo Profissional</div></div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/configuracoes/equipe/novo">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label">Nome *</label>
              <input class="form-input" type="text" name="name" required placeholder="Nome do profissional" />
            </div>
            <div class="form-group">
              <label class="form-label">E-mail *</label>
              <input class="form-input" type="email" name="email" required placeholder="email@exemplo.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Senha *</label>
              <input class="form-input" type="password" name="password" required placeholder="Mínimo 6 caracteres" minlength="6" />
            </div>
            <div class="form-group">
              <label class="form-label">Telefone</label>
              <input class="form-input" type="text" name="phone" placeholder="(11) 99999-9999" maxlength="15" data-mask="phone" />
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">Cadastrar Profissional</button>
          <a href="/admin/configuracoes?tab=equipe" class="btn btn-ghost" style="margin-left:8px;padding:12px 20px">Cancelar</a>
        </form>
      </div>
    </div>\` : ''}`,
  `    <!-- Modal editar profissional -->
    <div id="edit-prof-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;align-items:center;justify-content:center;overflow-y:auto;padding:24px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:660px;width:100%;margin:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <div style="font-size:17px;font-weight:700;color:var(--text)">Editar Profissional</div>
          <button onclick="closeEditModalProf()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:20px;padding:4px">✕</button>
        </div>
        <form method="POST" action="/admin/configuracoes/equipe/editar">
          <input type="hidden" name="id" id="edit-prof-id" />
          <input type="hidden" name="jobRole" id="edit-prof-role" value="barber" />
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
            <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" type="text" name="name" id="edit-prof-name" required /></div>
            <div class="form-group"><label class="form-label">E-mail *</label><input class="form-input" type="email" name="email" id="edit-prof-email" required /></div>
            <div class="form-group"><label class="form-label">Nova senha <span style="font-size:11px;color:var(--muted)">(em branco = não altera)</span></label>
              <div style="position:relative"><input class="form-input" type="password" name="password" id="edit-prof-pass" placeholder="Nova senha" style="padding-right:38px" />
              <button type="button" onclick="var i=document.getElementById('edit-prof-pass');i.type=i.type==='password'?'text':'password';" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted)" tabindex="-1">👁</button></div>
            </div>
            <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" type="text" name="phone" id="edit-prof-phone" placeholder="(11) 99999-9999" maxlength="15" data-mask="phone" /></div>
          </div>
          <div class="form-group" style="margin-bottom:14px">
            <label class="form-label">Função</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
              <label id="edit-role-btn-admin" onclick="setRoleEdit('admin')" style="display:flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;color:var(--muted)">👑 Admin</label>
              <label id="edit-role-btn-barber" onclick="setRoleEdit('barber')" style="display:flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;color:var(--muted)">✂️ Barbeiro</label>
              <label id="edit-role-btn-receptionist" onclick="setRoleEdit('receptionist')" style="display:flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;color:var(--muted)">🗂️ Recepcionista</label>
            </div>
          </div>
          <div style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Permissões</div>
            <div id="perms-grid-edit" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:7px">
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="agenda" id="chk-e-agenda" style="accent-color:var(--gold)" /><span>📅</span><span style="font-size:12px">Agenda</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="clientes" id="chk-e-clientes" style="accent-color:var(--gold)" /><span>👥</span><span style="font-size:12px">Clientes</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="lista-espera" id="chk-e-lista-espera" style="accent-color:var(--gold)" /><span>⏳</span><span style="font-size:12px">Lista de Espera</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="servicos" id="chk-e-servicos" style="accent-color:var(--gold)" /><span>✂️</span><span style="font-size:12px">Serviços</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="financeiro" id="chk-e-financeiro" style="accent-color:var(--gold)" /><span>💰</span><span style="font-size:12px">Financeiro</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="relatorios" id="chk-e-relatorios" style="accent-color:var(--gold)" /><span>📊</span><span style="font-size:12px">Relatórios</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="comissoes" id="chk-e-comissoes" style="accent-color:var(--gold)" /><span>💎</span><span style="font-size:12px">Comissões</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="minhas-comissoes" id="chk-e-minhas-comissoes" style="accent-color:var(--gold)" /><span>🏅</span><span style="font-size:12px">Minhas Comissões</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="produtos" id="chk-e-produtos" style="accent-color:var(--gold)" /><span>📦</span><span style="font-size:12px">Produtos/Estoque</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="marketing" id="chk-e-marketing" style="accent-color:var(--gold)" /><span>📣</span><span style="font-size:12px">Marketing</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="configuracoes" id="chk-e-configuracoes" style="accent-color:var(--gold)" /><span>⚙️</span><span style="font-size:12px">Configurações</span></label>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button type="submit" class="btn btn-primary" style="padding:11px 24px">Salvar alterações</button>
            <button type="button" onclick="closeEditModalProf()" class="btn btn-ghost" style="padding:11px 18px">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
    <!-- Formulário novo profissional (oculto) -->
    <div id="card-novo-prof" style="display:none" class="card">
      <div class="card-header">
        <div class="card-title">Novo Profissional</div>
        <button onclick="toggleFormNovo()" class="btn btn-ghost" style="font-size:12px;padding:6px 14px">✕ Fechar</button>
      </div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/configuracoes/equipe/novo">
          <input type="hidden" name="jobRole" id="hidden-jobrole" value="barber" />
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:8px">
            <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" type="text" name="name" required placeholder="Nome do profissional" /></div>
            <div class="form-group"><label class="form-label">E-mail *</label><input class="form-input" type="email" name="email" required placeholder="email@exemplo.com" /></div>
            <div class="form-group"><label class="form-label">Senha *</label>
              <div style="position:relative"><input class="form-input" type="password" name="password" id="inp-senha-novo" required placeholder="Mínimo 6 caracteres" minlength="6" style="padding-right:38px" />
              <button type="button" onclick="var i=document.getElementById('inp-senha-novo');i.type=i.type==='password'?'text':'password';" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted)" tabindex="-1">👁</button></div>
            </div>
            <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" type="text" name="phone" placeholder="(11) 99999-9999" maxlength="15" data-mask="phone" /></div>
          </div>
          <div class="form-group" style="margin:16px 0">
            <label class="form-label">Função *</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
              <label id="role-btn-admin" onclick="setRoleNovo('admin')" style="display:flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;color:var(--muted)">👑 Admin</label>
              <label id="role-btn-barber" onclick="setRoleNovo('barber')" style="display:flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;border:1.5px solid rgba(201,168,76,.6);background:rgba(201,168,76,.08);cursor:pointer;font-size:13px;color:var(--gold)">✂️ Barbeiro</label>
              <label id="role-btn-receptionist" onclick="setRoleNovo('receptionist')" style="display:flex;align-items:center;gap:7px;padding:9px 16px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;color:var(--muted)">🗂️ Recepcionista</label>
            </div>
          </div>
          <div style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Permissões de acesso</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Módulos não selecionados aparecerão com cadeado no menu.</div>
            <div id="perms-grid-novo" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:7px">
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="agenda" checked style="accent-color:var(--gold)" /><span>📅</span><span style="font-size:12px">Agenda</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="clientes" checked style="accent-color:var(--gold)" /><span>👥</span><span style="font-size:12px">Clientes</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="lista-espera" checked style="accent-color:var(--gold)" /><span>⏳</span><span style="font-size:12px">Lista de Espera</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="servicos" checked style="accent-color:var(--gold)" /><span>✂️</span><span style="font-size:12px">Serviços</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="financeiro" style="accent-color:var(--gold)" /><span>💰</span><span style="font-size:12px">Financeiro</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="relatorios" style="accent-color:var(--gold)" /><span>📊</span><span style="font-size:12px">Relatórios</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="comissoes" style="accent-color:var(--gold)" /><span>💎</span><span style="font-size:12px">Comissões</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="minhas-comissoes" checked style="accent-color:var(--gold)" /><span>🏅</span><span style="font-size:12px">Minhas Comissões</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="produtos" style="accent-color:var(--gold)" /><span>📦</span><span style="font-size:12px">Produtos/Estoque</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="marketing" style="accent-color:var(--gold)" /><span>📣</span><span style="font-size:12px">Marketing</span></label>
              <label style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="configuracoes" style="accent-color:var(--gold)" /><span>⚙️</span><span style="font-size:12px">Configurações</span></label>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="padding:11px 24px">Cadastrar Profissional</button>
          <button type="button" onclick="toggleFormNovo()" class="btn btn-ghost" style="margin-left:8px;padding:11px 18px">Cancelar</button>
        </form>
      </div>
    </div>`,
  'formulario novo'
);

// 3. Adicionar botões editar/excluir na tabela
rep(
  `                <td>
                  <form method="POST" action="/admin/configuracoes/equipe/toggle" style="display:inline">
                    <input type="hidden" name="id" value="\${b.id}" />
                    <input type="hidden" name="isActive" value="\${!b.isActive}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">\${b.isActive ? 'Desativar' : 'Reativar'}</button>
                  </form>
                </td>`,
  `                <td style="display:flex;gap:5px;flex-wrap:wrap">
                  <button type="button" onclick="openEditModalProf(\${b.id})" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">✏️ Editar</button>
                  <form method="POST" action="/admin/configuracoes/equipe/toggle" style="display:inline">
                    <input type="hidden" name="id" value="\${b.id}" />
                    <input type="hidden" name="isActive" value="\${!b.isActive}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">\${b.isActive ? 'Desativar' : 'Reativar'}</button>
                  </form>
                  <form method="POST" action="/admin/configuracoes/equipe/excluir" style="display:inline" onsubmit="return confirm('Excluir \${esc(b.name)}? Esta ação não pode ser desfeita.')">
                    <input type="hidden" name="id" value="\${b.id}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:#ef4444">🗑 Excluir</button>
                  </form>
                </td>`,
  'botoes tabela'
);

// 4. POST novo com permissões
rep(
  `      const { name, email, password, phone } = req.body ?? {};
      if (!name || !email || !password) {
        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Preencha+todos+os+campos"); return;
      }
      if (password.length < 6) {
        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Senha+deve+ter+m%C3%ADnimo+6+caracteres"); return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await db.createBarber({ name, email, phone: phone || null, passwordHash, role: "barber", isActive: true, tenantId });
      res.redirect("/admin/configuracoes?tab=equipe&saved=1");`,
  `      const { name, email, password, phone, jobRole } = req.body ?? {};
      if (!name || !email || !password) { res.redirect("/admin/configuracoes?tab=equipe&error=Preencha+todos+os+campos"); return; }
      if (password.length < 6) { res.redirect("/admin/configuracoes?tab=equipe&error=Senha+min+6+caracteres"); return; }
      const rawPerms = req.body.permissions;
      const permissions = jobRole === "admin" ? ["agenda","clientes","lista-espera","servicos","financeiro","relatorios","comissoes","minhas-comissoes","produtos","marketing","configuracoes"] : (Array.isArray(rawPerms) ? rawPerms : (rawPerms ? [rawPerms] : []));
      const dbRole = jobRole === "admin" ? "super_admin" : jobRole === "receptionist" ? "receptionist" : "barber";
      const passwordHash = await bcrypt.hash(password, 10);
      const newBarber = await db.createBarber({ name, email, phone: phone || null, passwordHash, role: dbRole as any, isActive: true, tenantId });
      if (newBarber && newBarber.id) { const sp = JSON.stringify(permissions).replace(/'/g,"''"); const dc = await db.getDb(); if (dc) await (dc as any).execute("UPDATE barbers SET permissions = '" + sp + "' WHERE id = " + newBarber.id); }
      res.redirect("/admin/configuracoes?tab=equipe&saved=1");`,
  'POST novo'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('\\nTotal: ' + c + ' mudancas aplicadas');
