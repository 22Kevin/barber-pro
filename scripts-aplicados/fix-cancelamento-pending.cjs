const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// Adicionar botão de cancelar no bloco de status pending
patch('server/admin-routes.ts',
  `            \${bpStatus === 'pending' ? \`
              <div style="display:flex;flex-direction:column;gap:8px;width:100%">
                <div style="font-size:12px;color:var(--muted);padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px">
                  ⏳ Aguardando confirmação do pagamento. Se você já realizou o pagamento via Pix, clique no botão abaixo para verificar.
                </div>
                <button type="button" id="check-payment-btn" onclick="checkPaymentStatus()" style="padding:10px 18px;background:var(--primary);color:var(--bg);border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%">
                  ✔ Já paguei — verificar status
                </button>
                <div id="check-payment-msg" style="font-size:12px;text-align:center;display:none"></div>
              </div>
            \` : ''}`,
  `            \${bpStatus === 'pending' ? \`
              <div style="display:flex;flex-direction:column;gap:8px;width:100%">
                <div style="font-size:12px;color:var(--muted);padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:8px">
                  ⏳ Aguardando confirmação do pagamento. Se você já realizou o pagamento via Pix, clique no botão abaixo para verificar.
                </div>
                <button type="button" id="check-payment-btn" onclick="checkPaymentStatus()" style="padding:10px 18px;background:var(--primary);color:var(--bg);border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%">
                  ✔ Já paguei — verificar status
                </button>
                <div id="check-payment-msg" style="font-size:12px;text-align:center;display:none"></div>
                <form id="form-cancel-pending" method="POST" action="/admin/configuracoes/asaas/cancel-subscription">
                  <button type="button" style="background:none;border:none;color:var(--muted);font-size:12px;cursor:pointer;padding:4px 0;text-decoration:underline;width:100%;text-align:center"
                    onclick="bpConfirm({icon:'⚠️',title:'Cancelar e descartar pagamento',msg:'Isso cancelará o pagamento pendente e encerrará sua conta. Tem certeza?',okLabel:'Cancelar pagamento',danger:true,onConfirm:function(){document.getElementById(\\'form-cancel-pending\\').submit();}})">
                    Cancelar e descartar pagamento pendente
                  </button>
                </form>
              </div>
            \` : ''}`,
  'botão cancelar no status pending'
);

console.log('\nTotal: ' + ok + '/1');
