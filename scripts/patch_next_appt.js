const fs = require('fs');
let c = fs.readFileSync('server/admin-routes.ts', 'utf8');

const OLD = '    <!-- 2. Agenda de Hoje -->';
const NEXT_CARD = `    <!-- Card: Proximo Agendamento -->
    \${nextAppointment ? (() => {
      const naClientName = (nextAppointment as any).clientName ?? clientMap[(nextAppointment as any).clientId] ?? 'Cliente';
      const naServiceName = (nextAppointment as any).serviceName ?? serviceMap[(nextAppointment as any).serviceId] ?? 'Servico';
      const naBarberName = barberMap[(nextAppointment as any).barberId] ?? '';
      const naTime = ((nextAppointment as any).startTime ?? '').substring(0, 5);
      const naStatusColor = (nextAppointment as any).status === 'confirmed' ? '#22C55E' : '#C9A84C';
      const naStatusLabel = (nextAppointment as any).status === 'confirmed' ? 'Confirmado' : 'Agendado';
      return \`<div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border:1px solid rgba(201,168,76,0.3);border-radius:16px;padding:20px 24px;margin-bottom:24px;display:flex;align-items:center;gap:20px;box-shadow:0 4px 24px rgba(0,0,0,0.3);position:relative;overflow:hidden">
        <div style="position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,rgba(201,168,76,0.08) 0%,transparent 70%);pointer-events:none"></div>
        <div style="width:52px;height:52px;background:rgba(201,168,76,0.15);border:2px solid rgba(201,168,76,0.4);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px">Proximo Agendamento</span>
            <span style="font-size:10px;font-weight:700;color:\${naStatusColor};background:\${naStatusColor}22;border:1px solid \${naStatusColor}44;border-radius:4px;padding:1px 6px">\${naStatusLabel}</span>
          </div>
          <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${naClientName}</div>
          <div style="font-size:13px;color:var(--muted)">\${naServiceName}\${naBarberName ? ' - ' + naBarberName : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:28px;font-weight:900;color:#C9A84C;line-height:1">\${naTime}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">hoje</div>
        </div>
      </div>\`;
    })() : ''}
    <!-- 2. Agenda de Hoje -->`;

if (c.includes(OLD)) {
  c = c.replace(OLD, NEXT_CARD);
  console.log('OK: card proximo agendamento adicionado');
} else {
  console.log('MISS: Agenda de Hoje nao encontrado');
}

fs.writeFileSync('server/admin-routes.ts', c);
console.log('done');
