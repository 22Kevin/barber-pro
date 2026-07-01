const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// Converter o form Asaas setup de POST direto para fetch (evita bloqueio do WAF do Cloudflare)
patch('server/admin-routes.ts',
  `            <button type="submit" class="btn btn-primary" style="padding:12px 28px;width:100%" id="asaas-submit-btn">
              Criar conta de recebimentos
            </button>
          </form>`,
  `            <div id="asaas-setup-error" style="display:none;background:#EF444422;border:1px solid #EF444444;border-radius:8px;padding:12px;margin-top:12px;font-size:13px;color:#F87171"></div>
            <button type="button" class="btn btn-primary" style="padding:12px 28px;width:100%" id="asaas-submit-btn"
              onclick="submitAsaasSetup()">
              Criar conta de recebimentos
            </button>
          </form>
          <script>
          async function submitAsaasSetup() {
            var btn = document.getElementById('asaas-submit-btn');
            var errDiv = document.getElementById('asaas-setup-error');
            var form = document.getElementById('asaas-setup-form');
            if (!form) return;
            btn.disabled = true; btn.textContent = 'Criando conta...';
            errDiv.style.display = 'none';
            try {
              var data = new FormData(form);
              var body = new URLSearchParams();
              data.forEach(function(v, k) { body.append(k, v); });
              var resp = await fetch('/admin/configuracoes/asaas/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                credentials: 'include',
                body: body.toString()
              });
              if (resp.redirected || resp.ok) {
                window.location.href = resp.url || '/admin/configuracoes?tab=pagamentos&saved=1';
              } else {
                var text = await resp.text();
                errDiv.textContent = 'Erro ' + resp.status + ': ' + (text || 'Tente novamente.');
                errDiv.style.display = 'block';
                btn.disabled = false; btn.textContent = 'Criar conta de recebimentos';
              }
            } catch(e) {
              errDiv.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
              errDiv.style.display = 'block';
              btn.disabled = false; btn.textContent = 'Criar conta de recebimentos';
            }
          }
          <\/script>`,
  'asaas setup via fetch (evita WAF)'
);

console.log('\nTotal: ' + ok + '/1');
