#!/usr/bin/env python3
"""
Melhora getShopOpenStatus para:
1. Adicionar campo isLunch ao retorno
2. Formatar horas sem segundos (HH:MM em vez de HH:MM:SS)
3. Atualizar o badge no public-routes.ts para 3 estados
"""

# ─── Patch 1: db.ts — adicionar isLunch e formatar horas ───
with open('/home/ubuntu/barber_app/server/db.ts', 'r', encoding='utf-8') as f:
    db_content = f.read()

old_return = '  return { isOpen, opensAt: earliestStart, closesAt: latestEnd, lunchStart, lunchEnd };'
new_return = '''  // Formatar horas sem segundos (HH:MM)
  const fmt = (t: string | null) => t ? t.slice(0, 5) : null;
  return { isOpen, isLunch: inLunch, opensAt: fmt(earliestStart), closesAt: fmt(latestEnd), lunchStart: fmt(lunchStart), lunchEnd: fmt(lunchEnd) };'''

if old_return in db_content:
    db_content = db_content.replace(old_return, new_return, 1)
    print('OK db.ts: isLunch adicionado e horas formatadas')
else:
    print('ERRO db.ts: trecho nao encontrado')
    idx = db_content.find('isOpen, opensAt')
    if idx >= 0:
        print('  Contexto:', repr(db_content[idx-10:idx+80]))

with open('/home/ubuntu/barber_app/server/db.ts', 'w', encoding='utf-8') as f:
    f.write(db_content)

# ─── Patch 2: public-routes.ts — atualizar tipo e badge ───
with open('/home/ubuntu/barber_app/server/public-routes.ts', 'r', encoding='utf-8') as f:
    pub_content = f.read()

# Atualizar o tipo de shopOpenStatus para incluir isLunch
old_type = '  let shopOpenStatus: { isOpen: boolean; opensAt: string | null; closesAt: string | null; lunchStart: string | null; lunchEnd: string | null } = { isOpen: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };'
new_type = '  let shopOpenStatus: { isOpen: boolean; isLunch?: boolean; opensAt: string | null; closesAt: string | null; lunchStart: string | null; lunchEnd: string | null } = { isOpen: false, isLunch: false, opensAt: null, closesAt: null, lunchStart: null, lunchEnd: null };'

if old_type in pub_content:
    pub_content = pub_content.replace(old_type, new_type, 1)
    print('OK public-routes.ts: tipo atualizado com isLunch')
else:
    print('ERRO public-routes.ts: tipo nao encontrado')

# Substituir o bloco do badge por versão com 3 estados
old_badge = (
    '        ${shopOpenStatus.isOpen\n'
    '          ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.4);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#4ade80;margin-bottom:8px;letter-spacing:0.3px"><span style="width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;animation:pulse-green 2s infinite"></span>Aberto agora${shopOpenStatus.closesAt ? ` \xb7 fecha \xe0s ${shopOpenStatus.closesAt}` : ""}</div>`\n'
    '          : shopOpenStatus.opensAt\n'
    '            ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#f87171;margin-bottom:8px;letter-spacing:0.3px"><span style="width:7px;height:7px;border-radius:50%;background:#f87171;display:inline-block"></span>Fechado \xb7 abre \xe0s ${shopOpenStatus.opensAt}</div>`\n'
    '            : ""\n'
    '        }'
)

new_badge = (
    '        ${shopOpenStatus.isOpen\n'
    '          ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.4);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#4ade80;margin-bottom:8px;letter-spacing:0.3px"><span style="width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;animation:pulse-green 2s infinite"></span>Aberto agora${shopOpenStatus.closesAt ? ` \xb7 fecha \xe0s ${shopOpenStatus.closesAt}` : ""}</div>`\n'
    '          : shopOpenStatus.isLunch && shopOpenStatus.lunchEnd\n'
    '            ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.4);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:8px;letter-spacing:0.3px"><span style="width:7px;height:7px;border-radius:50%;background:#fbbf24;display:inline-block"></span>Hor\xe1rio de almo\xe7o \xb7 volta \xe0s ${shopOpenStatus.lunchEnd}</div>`\n'
    '            : shopOpenStatus.opensAt\n'
    '              ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#f87171;margin-bottom:8px;letter-spacing:0.3px"><span style="width:7px;height:7px;border-radius:50%;background:#f87171;display:inline-block"></span>Fechado \xb7 abre \xe0s ${shopOpenStatus.opensAt}</div>`\n'
    '              : ""\n'
    '        }'
)

if old_badge in pub_content:
    pub_content = pub_content.replace(old_badge, new_badge, 1)
    print('OK public-routes.ts: badge atualizado com 3 estados')
else:
    print('ERRO public-routes.ts: badge nao encontrado')
    idx = pub_content.find('shopOpenStatus.isOpen')
    if idx >= 0:
        print('  Contexto:', repr(pub_content[idx:idx+400]))

with open('/home/ubuntu/barber_app/server/public-routes.ts', 'w', encoding='utf-8') as f:
    f.write(pub_content)

print('Concluido.')
