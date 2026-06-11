const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts', 'utf8');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: ' + tag); c++; }
  else console.log('MISS: ' + tag);
}

// ── 1. Tabela: botão novo vira toggle + adicionar editar/excluir ──────────────
rep(
  `        <a href="/admin/configuracoes?tab=equipe&novo=1" class="btn btn-primary" style="font-size:12px;padding:8px 16px">+ Novo Profissional</a>`,
  `        <button onclick="toggleFormNovo()" id="btn-novo-prof" class="btn btn-primary" style="font-size:12px;padding:8px 16px">+ Novo Profissional</button>`,
  'botao novo'
);

rep(
  `                <td>
                  <form method="POST" action="/admin/configuracoes/equipe/toggle" style="display:inline">
                    <input type="hidden" name="id" value="\${b.id}" />
                    <input type="hidden" name="isActive" value="\${!b.isActive}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">\${b.isActive ? 'Desativar' : 'Reativar'}</button>
                  </form>
                </td>
              </tr>\`).join('')}
        </tbody>
      </table>
    </div>`,
  `                <td style="display:flex;gap:6px;flex-wrap:wrap">
                  <button type="button" onclick="openEditModal(\${b.id})" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">✏️ Editar</button>
                  <form method="POST" action="/admin/configuracoes/equipe/toggle" style="display:inline">
                    <input type="hidden" name="id" value="\${b.id}" />
                    <input type="hidden" name="isActive" value="\${!b.isActive}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px">\${b.isActive ? 'Desativar' : 'Reativar'}</button>
                  </form>
                  <form method="POST" action="/admin/configuracoes/equipe/excluir" style="display:inline" onsubmit="return confirm('Excluir \${esc(b.name)}? Esta ação não pode ser desfeita.')">
                    <input type="hidden" name="id" value="\${b.id}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:#ef4444;border-color:#ef444433">🗑 Excluir</button>
                  </form>
                </td>
              </tr>\`).join('')}
        </tbody>
      </table>
    </div>`,
  'botoes editar/excluir'
);

// ── 2. Formulário: substituir bloco condicional pelo novo ─────────────────────
const OLD_FORM = `    \${req.query.novo === '1' ? \`
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
    </div>\` : ''}
  \`;`;

const BARBERS_JS = `\${allBarbers.map((b: any) => '['+b.id+',"'+esc(b.name).replace(/"/g,'&quot;')+'","'+(b.email||'')+'","'+(b.phone||'')+'","'+(b.role==='super_admin'?'admin':b.role)+'",'+JSON.stringify(b.permissions??null)+']').join(',')}`;

const NEW_FORM = `    <!-- Modal de edição -->
    <div id="edit-prof-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;align-items:center;justify-content:center;overflow-y:auto;padding:24px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:32px;max-width:680px;width:100%;margin:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <div style="font-size:17px;font-weight:700;color:var(--text)">Editar Profissional</div>
          <button onclick="closeEditModal()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:20px;padding:4px">✕</button>
        </div>
        <form method="POST" action="/admin/configuracoes/equipe/editar">
          <input type="hidden" name="id" id="edit-id" />
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" type="text" name="name" id="edit-name" required /></div>
            <div class="form-group"><label class="form-label">E-mail *</label><input class="form-input" type="email" name="email" id="edit-email" required /></div>
            <div class="form-group"><label class="form-label">Nova senha <span style="font-size:11px;color:var(--muted)">(em branco = não altera)</span></label>
              <div style="position:relative"><input class="form-input" type="password" name="password" id="edit-password" placeholder="Nova senha" style="padding-right:40px" />
              <button type="button" onclick="var i=document.getElementById('edit-password');i.type=i.type==='password'?'text':'password';" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px" tabindex="-1">👁</button></div>
            </div>
            <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" type="text" name="phone" id="edit-phone" placeholder="(11) 99999-9999" maxlength="15" data-mask="phone" /></div>
          </div>
          <div class="form-group" style="margin-bottom:16px">
            <label class="form-label">Função *</label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
              <label id="edit-role-btn-admin" onclick="setRoleEdit('admin')" style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted)">👑 Admin</label>
              <label id="edit-role-btn-barber" onclick="setRoleEdit('barber')" style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted)">✂️ Barbeiro</label>
              <label id="edit-role-btn-receptionist" onclick="setRoleEdit('receptionist')" style="display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a;cursor:pointer;font-size:13px;font-weight:500;color:var(--muted)">🗂️ Recepcionista</label>
            </div>
          </div>
          <input type="hidden" name="jobRole" id="edit-hidden-role" value="barber" />
          <div style="margin-bottom:20px">
            <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">Permissões de acesso</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Módulos não selecionados aparecerão com cadeado.</div>
            <div id="perms-grid-edit" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px">
              <label id="elbl-agenda" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="agenda" id="chk-e-agenda" style="accent-color:var(--gold)" /><span>📅</span><span style="font-size:13px">Agenda</span></label>
              <label id="elbl-clientes" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="clientes" id="chk-e-clientes" style="accent-color:var(--gold)" /><span>👥</span><span style="font-size:13px">Clientes</span></label>
              <label id="elbl-lista-espera" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="lista-espera" id="chk-e-lista-espera" style="accent-color:var(--gold)" /><span>⏳</span><span style="font-size:13px">Lista de Espera</span></label>
              <label id="elbl-servicos" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="servicos" id="chk-e-servicos" style="accent-color:var(--gold)" /><span>✂️</span><span style="font-size:13px">Serviços</span></label>
              <label id="elbl-financeiro" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="financeiro" id="chk-e-financeiro" style="accent-color:var(--gold)" /><span>💰</span><span style="font-size:13px">Financeiro</span></label>
              <label id="elbl-relatorios" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="relatorios" id="chk-e-relatorios" style="accent-color:var(--gold)" /><span>📊</span><span style="font-size:13px">Relatórios</span></label>
              <label id="elbl-comissoes" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="comissoes" id="chk-e-comissoes" style="accent-color:var(--gold)" /><span>💎</span><span style="font-size:13px">Comissões</span></label>
              <label id="elbl-minhas-comissoes" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="minhas-comissoes" id="chk-e-minhas-comissoes" style="accent-color:var(--gold)" /><span>🏅</span><span style="font-size:13px">Minhas Comissões</span></label>
              <label id="elbl-produtos" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="produtos" id="chk-e-produtos" style="accent-color:var(--gold)" /><span>📦</span><span style="font-size:13px">Produtos/Estoque</span></label>
              <label id="elbl-marketing" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="marketing" id="chk-e-marketing" style="accent-color:var(--gold)" /><span>📣</span><span style="font-size:13px">Marketing</span></label>
              <label id="elbl-configuracoes" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="configuracoes" id="chk-e-configuracoes" style="accent-color:var(--gold)" /><span>⚙️</span><span style="font-size:13px">Configurações</span></label>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button type="submit" class="btn btn-primary" style="padding:12px 28px">Salvar alterações</button>
            <button type="button" onclick="closeEditModal()" class="btn btn-ghost" style="padding:12px 20px">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
    <!-- Formulário novo profissional (oculto) -->
    <div id="card-novo-prof" style="display:none" class="card" style="margin-bottom:24px">
      <div class="card-header">
        <div class="card-title">Novo Profissional</div>
        <button onclick="toggleFormNovo()" class="btn btn-ghost" style="font-size:12px;padding:6px 14px">✕ Fechar</button>
      </div>
      <div class="card-body" style="padding:24px">
        <form method="POST" action="/admin/configuracoes/equipe/novo">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">
            <div class="form-group"><label class="form-label">Nome *</label><input class="form-input" type="text" name="name" required placeholder="Nome do profissional" /></div>
            <div class="form-group"><label class="form-label">E-mail *</label><input class="form-input" type="email" name="email" required placeholder="email@exemplo.com" /></div>
            <div class="form-group"><label class="form-label">Senha *</label>
              <div style="position:relative"><input class="form-input" type="password" name="password" id="inp-senha-novo" required placeholder="Mínimo 6 caracteres" minlength="6" style="padding-right:40px" />
              <button type="button" onclick="var i=document.getElementById('inp-senha-novo');i.type=i.type==='password'?'text':'password';" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);padding:4px" tabindex="-1">👁</button></div>
            </div>
            <div class="form-group"><label class="form-label">Telefone</label><input class="form-input" type="text" name="phone" placeholder="(11) 99999-9999" maxlength="15" data-mask="phone" /></div>
          </div>
          <input type="hidden" name="jobRole" id="hidden-jobrole" value="barber" />
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
            <div id="perms-grid-novo" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px">
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="agenda" id="chk-n-agenda" checked style="accent-color:var(--gold)" /><span>📅</span><span style="font-size:13px">Agenda</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="clientes" id="chk-n-clientes" checked style="accent-color:var(--gold)" /><span>👥</span><span style="font-size:13px">Clientes</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="lista-espera" id="chk-n-lista-espera" checked style="accent-color:var(--gold)" /><span>⏳</span><span style="font-size:13px">Lista de Espera</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="servicos" id="chk-n-servicos" checked style="accent-color:var(--gold)" /><span>✂️</span><span style="font-size:13px">Serviços</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="financeiro" id="chk-n-financeiro" style="accent-color:var(--gold)" /><span>💰</span><span style="font-size:13px">Financeiro</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="relatorios" id="chk-n-relatorios" style="accent-color:var(--gold)" /><span>📊</span><span style="font-size:13px">Relatórios</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="comissoes" id="chk-n-comissoes" style="accent-color:var(--gold)" /><span>💎</span><span style="font-size:13px">Comissões</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid rgba(201,168,76,.4);background:rgba(201,168,76,.06)"><input type="checkbox" name="permissions" value="minhas-comissoes" id="chk-n-minhas-comissoes" checked style="accent-color:var(--gold)" /><span>🏅</span><span style="font-size:13px">Minhas Comissões</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="produtos" id="chk-n-produtos" style="accent-color:var(--gold)" /><span>📦</span><span style="font-size:13px">Produtos/Estoque</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="marketing" id="chk-n-marketing" style="accent-color:var(--gold)" /><span>📣</span><span style="font-size:13px">Marketing</span></label>
              <label style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;border:1.5px solid #2a2a2a;background:#1a1a1a"><input type="checkbox" name="permissions" value="configuracoes" id="chk-n-configuracoes" style="accent-color:var(--gold)" /><span>⚙️</span><span style="font-size:13px">Configurações</span></label>
            </div>
          </div>
          <script>
            var DEFS={admin:['agenda','clientes','lista-espera','servicos','financeiro','relatorios','comissoes','minhas-comissoes','produtos','marketing','configuracoes'],barber:['agenda','clientes','lista-espera','servicos','minhas-comissoes'],receptionist:['agenda','clientes','lista-espera','servicos','financeiro','relatorios','produtos','marketing']};
            var _barbers=[${BARBERS_JS}];
            function toggleFormNovo(){var card=document.getElementById('card-novo-prof');var btn=document.getElementById('btn-novo-prof');if(card.style.display==='none'){card.style.display='';card.scrollIntoView({behavior:'smooth',block:'start'});btn.textContent='✕ Fechar';}else{card.style.display='none';btn.textContent='+ Novo Profissional';}}
            function setRoleNovo(r){document.getElementById('hidden-jobrole').value=r;['admin','barber','receptionist'].forEach(function(x){var el=document.getElementById('role-btn-'+x);if(x===r){el.style.borderColor='rgba(201,168,76,.6)';el.style.background='rgba(201,168,76,.08)';el.style.color='var(--gold)';}else{el.style.borderColor='#2a2a2a';el.style.background='#1a1a1a';el.style.color='var(--muted)';}});var perms=DEFS[r]||[];var isAdmin=r==='admin';document.querySelectorAll('#perms-grid-novo input[type=checkbox]').forEach(function(chk){chk.checked=perms.includes(chk.value);chk.disabled=isAdmin;chk.closest('label').style.opacity=isAdmin?'.7':'1';});}
            function openEditModal(id){var b=_barbers.find(function(x){return x[0]==id;});if(!b)return;document.getElementById('edit-id').value=b[0];document.getElementById('edit-name').value=b[1];document.getElementById('edit-email').value=b[2];document.getElementById('edit-phone').value=b[3]||'';document.getElementById('edit-password').value='';setRoleEdit(b[4]||'barber');var perms=b[5];if(perms){document.querySelectorAll('#perms-grid-edit input[type=checkbox]').forEach(function(chk){chk.checked=perms.includes(chk.value);});}var modal=document.getElementById('edit-prof-modal');modal.style.display='flex';}
            function closeEditModal(){document.getElementById('edit-prof-modal').style.display='none';}
            function setRoleEdit(r){document.getElementById('edit-hidden-role').value=r;['admin','barber','receptionist'].forEach(function(x){var el=document.getElementById('edit-role-btn-'+x);if(x===r){el.style.borderColor='rgba(201,168,76,.6)';el.style.background='rgba(201,168,76,.08)';el.style.color='var(--gold)';}else{el.style.borderColor='#2a2a2a';el.style.background='#1a1a1a';el.style.color='var(--muted)';}});var isAdmin=r==='admin';document.querySelectorAll('#perms-grid-edit input[type=checkbox]').forEach(function(chk){chk.disabled=isAdmin;chk.closest('label').style.opacity=isAdmin?'.7':'1';});}
            document.getElementById('edit-prof-modal').addEventListener('click',function(e){if(e.target===this)closeEditModal();});
          </script>
          <button type="submit" class="btn btn-primary" style="margin-top:8px;padding:12px 28px">Cadastrar Profissional</button>
          <button type="button" onclick="toggleFormNovo()" class="btn btn-ghost" style="margin-left:8px;padding:12px 20px">Cancelar</button>
        </form>
      </div>
    </div>
  \`;`;

rep(OLD_FORM, NEW_FORM, 'formulario novo + modal edicao');

// ── 3. POST salvar permissões no novo ─────────────────────────────────────────
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
      if (!name || !email || !password) {
        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Preencha+todos+os+campos"); return;
      }
      if (password.length < 6) {
        res.redirect("/admin/configuracoes?tab=equipe&novo=1&error=Senha+deve+ter+m%C3%ADnimo+6+caracteres"); return;
      }
      const rawPerms = req.body.permissions;
      const permissions = jobRole === "admin"
        ? ["agenda","clientes","lista-espera","servicos","financeiro","relatorios","comissoes","minhas-comissoes","produtos","marketing","configuracoes"]
        : (Array.isArray(rawPerms) ? rawPerms : (rawPerms ? [rawPerms] : []));
      const dbRole = jobRole === "admin" ? "super_admin" : jobRole === "receptionist" ? "receptionist" : "barber";
      const passwordHash = await bcrypt.hash(password, 10);
      const newBarber = await db.createBarber({ name, email, phone: phone || null, passwordHash, role: dbRole as any, isActive: true, tenantId });
      if (newBarber && newBarber.id) {
        const safePerms = JSON.stringify(permissions).replace(/'/g, "''");
        const dbConn = await db.getDb();
        if (dbConn) await (dbConn as any).execute("UPDATE barbers SET permissions = '" + safePerms + "' WHERE id = " + newBarber.id);
      }
      res.redirect("/admin/configuracoes?tab=equipe&saved=1");`,
  'POST novo com permissoes'
);

// ── 4. Rotas editar e excluir ─────────────────────────────────────────────────
rep(
  `  // POST /admin/configuracoes/equipe/toggle (ativar/desativar profissional)`,
  `  // POST /admin/configuracoes/equipe/editar
  app.post("/admin/configuracoes/equipe/editar", requireAdminAuth, requireOwner, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession;
      const currentBarber = await db.getBarberById(session.barberId);
      const tenantId = currentBarber?.tenantId ?? null;
      const { id, name, email, password, phone, jobRole } = req.body ?? {};
      if (!id || !name || !email) { res.redirect("/admin/configuracoes?tab=equipe&error=Campos+obrigatorios"); return; }
      const targetBarber = await db.getBarberById(Number(id));
      if (!targetBarber || targetBarber.tenantId !== tenantId) { res.redirect("/admin/configuracoes?tab=equipe&error=Profissional+nao+encontrado"); return; }
      const rawPerms = req.body.permissions;
      const permissions = jobRole === "admin"
        ? ["agenda","clientes","lista-espera","servicos","financeiro","relatorios","comissoes","minhas-comissoes","produtos","marketing","configuracoes"]
        : (Array.isArray(rawPerms) ? rawPerms : (rawPerms ? [rawPerms] : []));
      const dbRole = jobRole === "admin" ? "super_admin" : jobRole === "receptionist" ? "receptionist" : "barber";
      const updates: any = { name, email, phone: phone || null, role: dbRole };
      if (password && password.length >= 6) updates.passwordHash = await bcrypt.hash(password, 10);
      await db.updateBarber(Number(id), updates);
      const safePerms = JSON.stringify(permissions).replace(/'/g, "''");
      const dbConn = await db.getDb();
      if (dbConn) await (dbConn as any).execute("UPDATE barbers SET permissions = '" + safePerms + "' WHERE id = " + Number(id));
      res.redirect("/admin/configuracoes?tab=equipe&saved=1");
    } catch (e: any) { res.redirect("/admin/configuracoes?tab=equipe&error=" + encodeURIComponent(e.message)); }
  });

  // POST /admin/configuracoes/equipe/excluir
  app.post("/admin/configuracoes/equipe/excluir", requireAdminAuth, requireOwner, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession;
      const currentBarber = await db.getBarberById(session.barberId);
      const tenantId = currentBarber?.tenantId ?? null;
      const { id } = req.body ?? {};
      if (!id) { res.redirect("/admin/configuracoes?tab=equipe"); return; }
      const targetBarber = await db.getBarberById(Number(id));
      if (!targetBarber || targetBarber.tenantId !== tenantId) { res.redirect("/admin/configuracoes?tab=equipe&error=Profissional+nao+encontrado"); return; }
      if (Number(id) === session.barberId) { res.redirect("/admin/configuracoes?tab=equipe&error=Nao+e+possivel+excluir+sua+propria+conta"); return; }
      await db.deleteBarber(Number(id));
      res.redirect("/admin/configuracoes?tab=equipe&saved=1");
    } catch (e: any) { res.redirect("/admin/configuracoes?tab=equipe&error=" + encodeURIComponent(e.message)); }
  });

  // POST /admin/configuracoes/equipe/toggle (ativar/desativar profissional)`,
  'rotas editar/excluir'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('\nTotal: ' + c + ' mudancas');
console.log('git add server/admin-routes.ts && git commit -m "feat: equipe CRUD" && git push');
