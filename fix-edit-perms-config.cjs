const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. Fix permissões no modal — parsear o JSON antes de serializar
// O problema: b.permissions é string JSON no banco, não array
rep(
  `var _profs=[\${allBarbers.map((b)=>'['+b.id+',\\"'+((b.name||'').replace(/\\"/g,'&quot;'))+'\\",' +
  '\\\"'+((b.email||'').replace(/\\"/g,'&quot;'))+'\\",' +
  '\\\"'+((b.phone||'').replace(/\\"/g,'&quot;'))+'\\",' +
  '\\\"'+(b.role==='super_admin'?'admin':b.role)+'\\",' +
  '+JSON.stringify(b.permissions??null)+']').join(',')}];`,
  `SKIP`,
  'skip'
);

// Tentativa direta no conteúdo real
const oldProfs = `var _profs=[\${allBarbers.map((b)=>'['+b.id+',"'+((b.name||'').replace(/"/g,'&quot;'))+'","'+((b.email||'').replace(/"/g,'&quot;'))+'","'+((b.phone||'').replace(/"/g,'&quot;'))+'","'+(b.role==='super_admin'?'admin':b.role)+'",'+JSON.stringify(b.permissions??null)+']').join(',')}];`;
const newProfs = `var _profs=[\${allBarbers.map((b)=>{var rp=b.permissions;var pp=null;if(rp){try{pp=typeof rp==='string'?JSON.parse(rp):rp;}catch(e){pp=null;}}return '['+b.id+',"'+((b.name||'').replace(/"/g,'&quot;'))+'","'+((b.email||'').replace(/"/g,'&quot;'))+'","'+((b.phone||'').replace(/"/g,'&quot;'))+'","'+(b.role==='super_admin'?'admin':b.role)+'",'+JSON.stringify(pp)+']';}).join(',')}];`;

rep(oldProfs, newProfs, 'permissions parse no _profs');

// 2. Fix configurações — proteger rota GET com verificação de permissão
// Em vez de requireOwner (que bloqueia recepcionista também), vamos redirecionar
// barbeiros sem permissão de configuracoes para a aba de perfil próprio
rep(
  `  app.get("/admin/configuracoes", requireAdminAuth, withErrorPage("Configurações", "configuracoes", renderConfiguracoes));`,
  `  app.get("/admin/configuracoes", requireAdminAuth, async (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).adminSession;
    // Se não é super_admin, verificar se tem permissão de configuracoes
    if (session && session.role !== 'super_admin') {
      const barberData = await db.getBarberById(session.barberId);
      let perms: string[] = [];
      if (barberData && (barberData as any).permissions) {
        try { perms = JSON.parse((barberData as any).permissions); } catch(e) {}
      }
      if (!perms.includes('configuracoes')) {
        return res.redirect('/admin?erro=acesso_restrito');
      }
    }
    return next();
  }, withErrorPage("Configurações", "configuracoes", renderConfiguracoes));`,
  'proteger rota GET configuracoes'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
