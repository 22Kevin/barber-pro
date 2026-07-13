const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');

const old = `          <div style="display:flex;gap:8px;flex-shrink:0">
            <a href="/admin/pagina-cliente" class="btn btn-ghost btn-sm">Configurar</a>
            <a href="\${esc(dashPublicUrl)}" target="_blank" class="btn btn-ghost btn-sm">Abrir ↗</a>
          </div>`;

const novo = `          <div style="display:flex;gap:8px;flex-shrink:0">
            \${!isBarberRole ? \`<a href="/admin/pagina-cliente" class="btn btn-ghost btn-sm">Configurar</a>\` : ""}
            <a href="\${esc(dashPublicUrl)}" target="_blank" class="btn btn-ghost btn-sm">Abrir ↗</a>
          </div>`;

if (content.includes(old)) {
  content = content.replace(old, novo);
  console.log('OK: botao Configurar oculto para barbeiro');
} else {
  console.log('MISS');
}

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
