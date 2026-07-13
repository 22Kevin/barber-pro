const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. Card condicional → card sempre no DOM com display:none
rep(
`    \${req.query.novo === '1' ? \`
    <div class="card">
      <div class="card-header"><div class="card-title">Novo Profissional</div></div>`,
`    <div id="card-novo-prof" style="display:none" class="card">
      <div class="card-header">
        <div class="card-title">Novo Profissional</div>
        <button onclick="toggleFormNovo()" class="btn btn-ghost" style="font-size:12px;padding:6px 14px">✕ Fechar</button>
      </div>`,
'card sempre no DOM'
);

// 2. Corrigir id do grid de permissões
rep(
'<div id="perms-grid" style="display:grid',
'<div id="perms-grid-novo" style="display:grid',
'id perms-grid'
);

// 3. Corrigir seletor no script interno do formulário
rep(
"document.querySelectorAll('#perms-grid input[type=checkbox]')",
"document.querySelectorAll('#perms-grid-novo input[type=checkbox]')",
'seletor perms-grid'
);

// 4. Fechar o card sem condicional
rep(
`          <button type="button" onclick="toggleFormNovo()" class="btn btn-ghost" style="margin-left:8px;padding:12px 20px">Cancelar</button>
        </form>
      </div>
    </div>\` : ''}`,
`          <button type="button" onclick="toggleFormNovo()" class="btn btn-ghost" style="margin-left:8px;padding:12px 20px">Cancelar</button>
        </form>
      </div>
    </div>`,
'fechar card'
);

// 5. Substituir confirm() pelo modal
rep(
`onsubmit="return confirm('Excluir \${esc(b.name)}?')"`,
`onsubmit="return false" onclick="openDeleteModal(\${b.id}, '\${esc(b.name).replace(/'/g,'\\\\&apos;')}')"`,
'confirm -> modal'
);

// 6. Adicionar openDeleteModal ao script global
rep(
`window.toggleFormNovo=function(){var card=document.getElementById('card-novo-prof');var btn=document.getElementById('btn-novo-prof');if(!card)return;var h=card.style.display==='none'||card.style.display==='';card.style.display=h?'block':'none';btn.textContent=h?'✕ Fechar':'+ Novo Profissional';if(h)card.scrollIntoView({behavior:'smooth',block:'start'});};`,
`window.toggleFormNovo=function(){var card=document.getElementById('card-novo-prof');var btn=document.getElementById('btn-novo-prof');if(!card)return;var h=card.style.display==='none'||card.style.display==='';card.style.display=h?'block':'none';btn.textContent=h?'✕ Fechar':'+ Novo Profissional';if(h)card.scrollIntoView({behavior:'smooth',block:'start'});};
    window.openDeleteModal=function(id,name){document.getElementById('del-prof-id').value=id;document.getElementById('del-prof-name').textContent=name;document.getElementById('delete-prof-modal').style.display='flex';};
    window.closeDeleteModal=function(){document.getElementById('delete-prof-modal').style.display='none';};`,
'openDeleteModal'
);

// 7. Adicionar modal de exclusão antes do fim do template
rep(
`  \`;\n\n  // Aba: URL Pública`,
`  <div id="delete-prof-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;align-items:center;justify-content:center">
    <div style="background:var(--surface);border:1px solid #333;border-radius:16px;padding:32px 28px;max-width:400px;width:90%;text-align:center">
      <div style="width:56px;height:56px;background:#ef444418;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px">🗑</div>
      <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">Excluir profissional?</div>
      <div style="font-size:14px;color:var(--muted);margin-bottom:24px">Tem certeza que deseja excluir <strong id="del-prof-name" style="color:var(--text)"></strong>? Esta ação não pode ser desfeita.</div>
      <form method="POST" action="/admin/configuracoes/equipe/excluir" style="display:flex;gap:10px;justify-content:center">
        <input type="hidden" name="id" id="del-prof-id" />
        <button type="button" onclick="closeDeleteModal()" class="btn btn-ghost" style="padding:11px 24px;flex:1">Cancelar</button>
        <button type="submit" style="padding:11px 24px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;flex:1">Excluir</button>
      </form>
    </div>
  </div>
  \`;\n\n  // Aba: URL Pública`,
'modal exclusao'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
console.log('git add server/admin-routes.ts && git commit -m "fix: equipe DOM" && git push');
