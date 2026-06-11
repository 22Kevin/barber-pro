const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// ── 1. Inserir modal bpConfirm antes do upgrade-modal-overlay existente ───────
rep(
  `  <div id="upgrade-modal-overlay"`,
  `  <!-- Modal de confirmação genérico (substitui confirm() nativo) -->
  <div id="bp-confirm-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10001;align-items:center;justify-content:center">
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:400px;width:90%;text-align:center">
      <div id="bp-confirm-icon" style="font-size:36px;margin-bottom:12px">⚠️</div>
      <div id="bp-confirm-title" style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px"></div>
      <div id="bp-confirm-msg" style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:24px"></div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="bp-confirm-cancel" style="flex:1;padding:11px 20px;border-radius:9px;background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:13px;font-weight:600;cursor:pointer">Cancelar</button>
        <button id="bp-confirm-ok" style="flex:1;padding:11px 20px;border-radius:9px;border:none;font-size:13px;font-weight:700;cursor:pointer">Confirmar</button>
      </div>
    </div>
  </div>
  <script>
    window._bpConfirmCb = null;
    window.bpConfirm = function(opts) {
      var modal = document.getElementById('bp-confirm-modal');
      document.getElementById('bp-confirm-icon').textContent = opts.icon || '⚠️';
      document.getElementById('bp-confirm-title').textContent = opts.title || 'Confirmar';
      document.getElementById('bp-confirm-msg').textContent = opts.msg || '';
      var ok = document.getElementById('bp-confirm-ok');
      ok.textContent = opts.okLabel || 'Confirmar';
      ok.style.background = opts.danger ? '#ef4444' : 'var(--gold)';
      ok.style.color = opts.danger ? '#fff' : '#0A0A0A';
      document.getElementById('bp-confirm-cancel').textContent = opts.cancelLabel || 'Cancelar';
      modal.style.display = 'flex';
      window._bpConfirmCb = opts.onConfirm || null;
    };
    document.getElementById('bp-confirm-ok').addEventListener('click', function() {
      document.getElementById('bp-confirm-modal').style.display = 'none';
      if (window._bpConfirmCb) { window._bpConfirmCb(); window._bpConfirmCb = null; }
    });
    document.getElementById('bp-confirm-cancel').addEventListener('click', function() {
      document.getElementById('bp-confirm-modal').style.display = 'none';
      window._bpConfirmCb = null;
    });
    document.getElementById('bp-confirm-modal').addEventListener('click', function(e) {
      if (e.target === this) { this.style.display = 'none'; window._bpConfirmCb = null; }
    });
  </script>
  <div id="upgrade-modal-overlay"`,
  'modal bpConfirm inserido'
);

// ── 2. confirm() em forms — serviços toggle ───────────────────────────────────
rep(
  `onsubmit="return confirm('Alterar status?)"`,
  `onsubmit="return false"`,'svc toggle dummy'
);
// O padrão real:
content = content.replace(
  /onsubmit="return confirm\('Alterar status\?'\)"([\s\S]*?)<button type="submit"([\s\S]*?)>([^<]*Desativar[^<]*)<\/button>/,
  (m, between, btnAttrs, btnLabel) => {
    return `onsubmit="return false"${between}<button type="button" onclick="var f=this.closest('form');bpConfirm({icon:'🔄',title:'Alterar status',msg:'Deseja alterar o status deste item?',okLabel:'Confirmar',onConfirm:function(){f.onsubmit=null;f.submit();}});"${btnAttrs}>${btnLabel}</button>`;
  }
);
c++;
console.log('OK: svc/prod toggle via regex');

// ── 3. Abordagem mais simples: substituir string exata por string exata ────────
// Serviços toggle form
content = content.split(`onsubmit="return confirm('Alterar status?')"`).join(`onsubmit="return false" data-bp-confirm-title="Alterar status" data-bp-confirm-msg="Deseja alterar o status deste item?" data-bp-confirm-icon="🔄"`);
console.log('OK: alterar status (global)');

// Serviços delete
content = content.split(`onsubmit="return confirm('Excluir este serviço? Esta ação não pode ser desfeita.')"`).join(`onsubmit="return false" data-bp-confirm-title="Excluir serviço" data-bp-confirm-msg="Esta ação não pode ser desfeita." data-bp-confirm-danger="1"`);
console.log('OK: excluir serviço');

// Produtos delete
content = content.split(`onsubmit="return confirm('Excluir este produto?')"`).join(`onsubmit="return false" data-bp-confirm-title="Excluir produto" data-bp-confirm-msg="Esta ação não pode ser desfeita." data-bp-confirm-danger="1"`);
console.log('OK: excluir produto');

// Despesa
content = content.split(`onsubmit="return confirm('Excluir esta despesa?')"`).join(`onsubmit="return false" data-bp-confirm-title="Excluir despesa" data-bp-confirm-msg="Esta ação não pode ser desfeita." data-bp-confirm-danger="1"`);
console.log('OK: excluir despesa');

// Fornecedor
content = content.split(`onsubmit="return confirm('Excluir este fornecedor?')"`).join(`onsubmit="return false" data-bp-confirm-title="Excluir fornecedor" data-bp-confirm-msg="Esta ação não pode ser desfeita." data-bp-confirm-danger="1"`);
console.log('OK: excluir fornecedor');

// Plano
content = content.split(`onsubmit="return confirm('Excluir plano?')"`).join(`onsubmit="return false" data-bp-confirm-title="Excluir plano" data-bp-confirm-msg="Esta ação não pode ser desfeita." data-bp-confirm-danger="1"`);
console.log('OK: excluir plano');

// Cliente delete
content = content.replace(
  /onsubmit="return confirm\('Excluir [^']*\? Esta ação não pode ser desfeita\.\)"/g,
  `onsubmit="return false" data-bp-confirm-title="Excluir cliente" data-bp-confirm-msg="Esta ação não pode ser desfeita." data-bp-confirm-danger="1"`
);
console.log('OK: excluir cliente (regex)');

// Cancelar agendamento
content = content.split(`if (!confirm('Cancelar este agendamento?')) return;`).join(`bpConfirm({icon:'❌',title:'Cancelar agendamento',msg:'Deseja cancelar este agendamento?',okLabel:'Cancelar agendamento',danger:true,onConfirm:function(){`);
console.log('OK: cancelar agendamento');

// Lista de espera
content = content.split(`onclick="return confirm('Remover da lista?')"`).join(`onclick="bpConfirm({icon:'🗑️',title:'Remover da lista',msg:'Deseja remover este cliente da lista de espera?',okLabel:'Remover',danger:true,onConfirm:function(){this.closest('form').submit();}.bind(this)});return false;"`);
console.log('OK: remover lista espera');

// Retorno automático
content = content.split(`onclick="return confirm('Remover esta configuração?')"`).join(`onclick="bpConfirm({icon:'🗑️',title:'Remover configuração',msg:'Deseja remover esta configuração de retorno automático?',okLabel:'Remover',danger:true,onConfirm:function(){this.closest('form').submit();}.bind(this)});return false;"`);
console.log('OK: remover retorno automatico');

// Cancelar assinatura
content = content.split(`onsubmit="return confirm('Tem certeza que deseja cancelar a assinatura?')"`).join(`onsubmit="return false" data-bp-confirm-title="Cancelar assinatura" data-bp-confirm-msg="Tem certeza? Seu acesso continuará até o fim do período pago." data-bp-confirm-danger="1"`);
console.log('OK: cancelar assinatura');

// Encerrar conta
content = content.split(`onsubmit="return confirm('Deseja encerrar sua conta? O acesso será removido imediatamente e o período de teste não poderá ser reativado.')"`).join(`onsubmit="return false" data-bp-confirm-title="Encerrar conta" data-bp-confirm-msg="O acesso será removido imediatamente e o período de teste não poderá ser reativado." data-bp-confirm-danger="1"`);
console.log('OK: encerrar conta');

// Alterar plano
content = content.split(`onclick="return confirm('Alterar o plano cancelará a assinatura atual e criará uma nova. Confirmar?')"`).join(`onclick="bpConfirm({icon:'🔄',title:'Alterar plano',msg:'Alterar o plano cancelará a assinatura atual e criará uma nova. Confirmar?',okLabel:'Alterar plano',onConfirm:function(){this.form.submit();}.bind(this)});return false;"`);
console.log('OK: alterar plano');

// Cancelar cobrança Asaas
content = content.split(`'  if (!confirm("Cancelar esta cobrança no Asaas? Esta ação não pode ser desfeita.")) return;'`).join(`'  bpConfirm({icon:"⚠️",title:"Cancelar cobrança",msg:"Cancelar esta cobrança no Asaas? Esta ação não pode ser desfeita.",okLabel:"Cancelar cobrança",danger:true,onConfirm:function(){' +`);
console.log('OK: cancelar cobrança Asaas');

// ── 4. Adicionar listener global para forms com data-bp-confirm-* ─────────────
rep(
  `    window.showUpgradeModal = function(f, p) {`,
  `    // Delegação para forms com data-bp-confirm-*
    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      var title = form.getAttribute('data-bp-confirm-title');
      if (!title) return;
      e.preventDefault();
      bpConfirm({
        icon: form.getAttribute('data-bp-confirm-danger') ? '🗑️' : '🔄',
        title: title,
        msg: form.getAttribute('data-bp-confirm-msg') || '',
        okLabel: form.getAttribute('data-bp-confirm-danger') ? 'Confirmar' : 'Confirmar',
        danger: !!form.getAttribute('data-bp-confirm-danger'),
        onConfirm: function() { form.removeAttribute('data-bp-confirm-title'); form.submit(); }
      });
    }, true);
    window.showUpgradeModal = function(f, p) {`,
  'listener global data-bp-confirm'
);

// ── 5. alert() → showToast ─────────────────────────────────────────────────────
const alertMap = [
  [`alert('Número do cartão inválido.');`, `showToast('<b>Número do cartão inválido.</b>', 5000);`],
  [`alert('Data de validade inválida. Use MM/AAAA.');`, `showToast('<b>Data de validade inválida.</b> Use MM/AAAA.', 5000);`],
  [`alert('CVV obrigatório.');`, `showToast('<b>CVV obrigatório.</b>', 5000);`],
  [`alert('Nome no cartão obrigatório.');`, `showToast('<b>Nome no cartão obrigatório.</b>', 5000);`],
  [`alert('CPF do titular obrigatório.');`, `showToast('<b>CPF do titular obrigatório.</b>', 5000);`],
  [`alert('CEP obrigatório.');`, `showToast('<b>CEP obrigatório.</b>', 5000);`],
  [`alert('Número do endereço obrigatório.');`, `showToast('<b>Número do endereço obrigatório.</b>', 5000);`],
  [`alert('Erro: ' + data.error);`, `showToast('<b>Erro:</b> ' + data.error, 6000);`],
  [`alert('Erro ao gerar novo QR Code. Tente novamente.');`, `showToast('<b>Erro ao gerar QR Code.</b> Tente novamente.', 6000);`],
  [`} catch(err) { btn.disabled = false; btn.style.opacity='1'; alert('Erro: ' + err.message);`, `} catch(err) { btn.disabled = false; btn.style.opacity='1'; showToast('<b>Erro:</b> ' + err.message, 6000);`],
  [`alert('Erro ao salvar. Tente novamente.');`, `showToast('<b>Erro ao salvar.</b> Tente novamente.', 6000);`],
  [`else { alert('Erro: ' + (data.error || 'Erro desconhecido')); }`, `else { showToast('<b>Erro:</b> ' + (data.error || 'Erro desconhecido'), 6000); }`],
  [`} catch(e) { alert('Código: ' + pixCode); }`, `} catch(e) { showToast('Código Pix: ' + pixCode, 8000); }`],
  [`if (!pmt.clientPhone) { alert('Cliente sem telefone cadastrado.'); return; }`, `if (!pmt.clientPhone) { showToast('<b>Cliente sem telefone cadastrado.</b>', 5000); return; }`],
  [`'  } catch(e) { alert("Erro: " + e.message); btn.disabled = false; btn.textContent = "Cancelar"; }'`, `'  } catch(e) { showToast("<b>Erro:</b> " + e.message, 6000); btn.disabled = false; btn.textContent = "Cancelar"; }'`],
];
alertMap.forEach(([old, novo]) => {
  if (content.includes(old)) { content = content.split(old).join(novo); c++; console.log('OK: alert → toast: '+old.slice(0,40)); }
  else console.log('MISS alert: '+old.slice(0,40));
});

// Alerts dentro de strings escapadas (multi-step planos)
content = content.replace(/alert\('Selecione um cliente\.'\)/g, `showToast('<b>Selecione um cliente.</b>',4000)`);
content = content.replace(/alert\('Selecione um plano\.'\)/g, `showToast('<b>Selecione um plano.</b>',4000)`);
content = content.replace(/alert\('Selecione todos os hor[^']+'\)/g, `showToast('<b>Selecione todos os horários.</b>',4000)`);
content = content.replace(/alert\('Já selecionou todos os horários\.'\)/g, `showToast('<b>Já selecionou todos os horários.</b>',4000)`);
content = content.replace(/alert\('Dados incompletos\.'\)/g, `showToast('<b>Dados incompletos.</b>',4000)`);
content = content.replace(/alert\('Erro: ' \+ e\.message\)/g, `showToast('<b>Erro:</b> ' + e.message, 6000)`);
content = content.replace(/alert\('Erro de conexão\. Tente novamente\.'\)/g, `showToast('<b>Erro de conexão.</b> Tente novamente.', 6000)`);
console.log('OK: alerts em strings escapadas (regex)');

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('\nTotal mudanças: '+c);
