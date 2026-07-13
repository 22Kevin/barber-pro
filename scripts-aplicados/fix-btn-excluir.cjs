const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');

const old = `                  <form method="POST" action="/admin/configuracoes/equipe/excluir" style="display:inline" onsubmit="return false" onclick="openDeleteModal(\${b.id}, '\${esc(b.name).replace(/'/g,'\\\\&apos;')}')">
                    <input type="hidden" name="id" value="\${b.id}" />
                    <button type="submit" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:#ef4444">🗑 Excluir</button>
                  </form>`;

const novo = `                  <button type="button" onclick="openDeleteModal(\${b.id}, '\${esc(b.name).replace(/'/g,&quot;''&quot;)}')" class="btn btn-ghost" style="font-size:11px;padding:4px 10px;color:#ef4444">🗑 Excluir</button>`;

if (content.includes(old)) {
  content = content.replace(old, novo);
  console.log('OK: botao excluir simplificado');
} else {
  // Tentar encontrar variação
  const idx = content.indexOf('openDeleteModal(${b.id}');
  if (idx !== -1) {
    console.log('Contexto: ' + JSON.stringify(content.slice(idx-100, idx+200)));
  } else {
    console.log('MISS: nao encontrado');
  }
}

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
