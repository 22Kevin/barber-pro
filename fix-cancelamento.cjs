const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// ── FIX: botão Cancelar assinatura — usar onclick direto em vez de data-bp-confirm
// O onsubmit="return false" impedia o evento submit de chegar ao listener
patch('server/admin-routes.ts',
  `            \${bpStatus === 'active' && bpSubId ? \`
              <form method="POST" action="/admin/configuracoes/asaas/cancel-subscription" onsubmit="return false" data-bp-confirm-title="Cancelar assinatura" data-bp-confirm-msg="Tem certeza? Seu acesso continuará até o fim do período pago." data-bp-confirm-danger="1">
                <button type="submit" class="btn btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--error);border-color:var(--error)">Cancelar assinatura</button>
              </form>
            \` : ''}
            \${bpStatus === 'trial' ? \`
              <form method="POST" action="/admin/configuracoes/asaas/cancel-subscription" onsubmit="return false" data-bp-confirm-title="Encerrar conta" data-bp-confirm-msg="O acesso será removido imediatamente e o período de teste não poderá ser reativado." data-bp-confirm-danger="1">
                <button type="submit" style="background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;padding:4px 0;text-decoration:underline">Encerrar conta e cancelar trial</button>
              </form>
            \` : ''}`,
  `            \${bpStatus === 'active' && bpSubId ? \`
              <form id="form-cancel-sub" method="POST" action="/admin/configuracoes/asaas/cancel-subscription">
                <button type="button" class="btn btn-ghost" style="font-size:12px;padding:8px 16px;color:var(--error);border-color:var(--error)"
                  onclick="bpConfirm({icon:'⚠️',title:'Cancelar assinatura',msg:'Tem certeza? Seu acesso continuará até o fim do período pago.',okLabel:'Cancelar assinatura',danger:true,onConfirm:function(){document.getElementById(\\'form-cancel-sub\\').submit();}})">
                  Cancelar assinatura
                </button>
              </form>
            \` : ''}
            \${bpStatus === 'trial' ? \`
              <form id="form-cancel-trial" method="POST" action="/admin/configuracoes/asaas/cancel-subscription">
                <button type="button" style="background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;padding:4px 0;text-decoration:underline"
                  onclick="bpConfirm({icon:'⚠️',title:'Encerrar conta',msg:'O acesso será removido imediatamente e o período de teste não poderá ser reativado.',okLabel:'Encerrar conta',danger:true,onConfirm:function(){document.getElementById(\\'form-cancel-trial\\').submit();}})">
                  Encerrar conta e cancelar trial
                </button>
              </form>
            \` : ''}`,
  'fix cancelar assinatura onclick direto'
);

// ── FIX: também corrigir o botão de cancelar na seção de encerrar conta (segunda ocorrência)
// Verificar se há outra ocorrência semelhante
const content = fs.readFileSync('server/admin-routes.ts').toString('utf8');
const count = (content.match(/form-cancel-sub/g) || []).length;
console.log('form-cancel-sub no código: ' + count + ' ocorrências');

console.log('\nTotal: ' + ok + '/1');
