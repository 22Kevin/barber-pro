const fs = require('fs');
let ok = 0;

function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// 1. Quando numa FILIAL: mostrar a aba Filiais com painel de retorno à matriz
patch('server/admin-routes.ts',
`  let branches: any[] = [];
  if (isStudioPlan && !parentTenantId && barber?.tenantId) branches = await db.getBranches(barber.tenantId);
  const showBranchTab = isStudioPlan && !parentTenantId;`,
`  let branches: any[] = [];
  let matrixTenant: any = null;
  if (isStudioPlan && !parentTenantId && barber?.tenantId) branches = await db.getBranches(barber.tenantId);
  if (parentTenantId) matrixTenant = await db.getTenantById(parentTenantId);
  const showBranchTab = isStudioPlan && !parentTenantId;
  const isBranchContext = !!parentTenantId;`,
'lookup matriz quando em filial');

// 2. tabFiliais: matriz = grid normal; filial = painel de retorno
patch('server/admin-routes.ts',
`  const tabFiliais = showBranchTab ? renderBranchTab(branches) : '';
  const tabs = [
    { id: 'dados', label: 'Dados' },
    { id: 'horarios', label: 'Horários' },
    { id: 'equipe', label: 'Equipe' },
    ...(showBranchTab ? [{ id: 'filiais', label: '🏪 Filiais' }] : []),
    { id: 'pagamentos', label: '💳 Pagamentos' },
  ];`,
`  const tabFiliais = showBranchTab
    ? renderBranchTab(branches)
    : (isBranchContext ? \`
      <div style="text-align:center;padding:50px 20px;background:var(--surface);border:1px solid var(--border);border-radius:16px;max-width:480px;margin:0 auto">
        <div style="font-size:40px;margin-bottom:12px">🏪</div>
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:6px">Você está na filial \${esc((tenant as any)?.displayName || tenant?.name || '')}</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:24px">Matriz: \${esc(matrixTenant?.name ?? '')}</div>
        <form method="POST" action="/admin/filiais/trocar">
          <input type="hidden" name="branchId" value="\${parentTenantId}" />
          <button type="submit" class="btn btn-primary" style="padding:12px 28px">← Voltar para a matriz</button>
        </form>
      </div>
    \` : '');
  const tabs = [
    { id: 'dados', label: 'Dados' },
    { id: 'horarios', label: 'Horários' },
    { id: 'equipe', label: 'Equipe' },
    ...((showBranchTab || isBranchContext) ? [{ id: 'filiais', label: '🏪 Filiais' }] : []),
    { id: 'pagamentos', label: '💳 Pagamentos' },
  ];`,
'painel voltar à matriz na aba filiais');

console.log('\\nTotal: ' + ok);
