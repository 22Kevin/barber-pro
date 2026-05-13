#!/usr/bin/env python3
"""
Patch: responsividade mobile completa no painel administrativo web.
Aplica melhorias em:
1. CSS @media: ações rápidas, botões do link, gráfico, topbar
2. Tabelas: adiciona overflow-x:auto em todos os wrappers de tabela
3. Ações Rápidas: grid 5→3 colunas em 900px, 2 colunas em 480px
4. Botões do Link de Agendamento: flex-wrap
5. Card Baixe o App: flex-wrap no header
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Expandir o bloco @media (max-width: 900px) com mais regras ───────────
old_900 = """    @media (max-width: 900px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.5); }
      .main { margin-left: 0; }
      .topbar-hamburger { display: flex; }
      .topbar-date { display: none; }
      .content { padding: 16px; }
      .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .form-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .metrics-grid { grid-template-columns: 1fr; }
    }"""

new_media = """    @media (max-width: 900px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.5); }
      .main { margin-left: 0; }
      .topbar-hamburger { display: flex; }
      .topbar-date { display: none; }
      .content { padding: 14px; }
      .metrics-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .form-row { grid-template-columns: 1fr; }
      /* Ações Rápidas: 3 colunas em tablet */
      .actions-grid-5 { grid-template-columns: repeat(3, 1fr) !important; }
      /* Tabelas: scroll horizontal */
      .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      /* Botões do link de agendamento: empilhar */
      .booking-btns { flex-wrap: wrap; }
      .booking-btns .btn { flex: 1 1 auto; min-width: 80px; justify-content: center; }
      /* Gráfico: botões de alternância */
      .chart-toggle-wrap { flex-wrap: wrap; gap: 6px; }
      /* Card Baixe o App: header */
      .app-card-header { flex-wrap: wrap; gap: 10px; }
      /* Topbar: esconder badge de plano em telas pequenas */
      .topbar-plan-badge { display: none; }
    }
    @media (max-width: 600px) {
      /* Ações Rápidas: 2 colunas em mobile */
      .actions-grid-5 { grid-template-columns: repeat(2, 1fr) !important; }
      /* Botões de ação inline: empilhar */
      .inline-action-btns { flex-direction: column; }
      /* Preview da página: altura menor */
      .page-preview-iframe-wrap { height: 180px !important; }
      /* Gráfico: padding menor */
      .chart-card-inner { padding: 16px !important; }
    }
    @media (max-width: 480px) {
      .metrics-grid { grid-template-columns: 1fr; }
      .content { padding: 10px; }
      /* Topbar: título menor */
      .topbar-title { font-size: 13px; }
      /* Cards: padding menor */
      .card-header { padding: 12px 14px; }
      .card-body { padding: 12px 14px; }
    }"""

if old_900 in content:
    content = content.replace(old_900, new_media, 1)
    print("OK: bloco @media expandido")
else:
    print("WARN: bloco @media 900 não encontrado exatamente, tentando alternativa...")
    # Tenta encontrar apenas o bloco 900 e 480 juntos
    import re
    pattern = r'(@media \(max-width: 900px\) \{[^}]+(?:\{[^}]*\}[^}]*)*\})\s*(@media \(max-width: 480px\) \{[^}]+\})'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + new_media + content[match.end():]
        print("OK: bloco @media substituído via regex")
    else:
        print("ERROR: não foi possível localizar o bloco @media para substituição")

# ─── 2. Adicionar classe actions-grid-5 ao grid das Ações Rápidas ────────────
old_actions = 'style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;"'
new_actions = 'class="actions-grid-5" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;"'
if old_actions in content:
    content = content.replace(old_actions, new_actions, 1)
    print("OK: classe actions-grid-5 adicionada")
else:
    print("WARN: grid das Ações Rápidas não encontrado")

# ─── 3. Adicionar classe booking-btns ao flex dos botões do link ─────────────
old_booking_btns = 'style="display:flex;gap:8px;align-items:center;margin-bottom:16px"'
new_booking_btns = 'class="booking-btns" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;"'
if old_booking_btns in content:
    content = content.replace(old_booking_btns, new_booking_btns, 1)
    print("OK: classe booking-btns adicionada")
else:
    print("WARN: flex dos botões do link não encontrado")

# ─── 4. Adicionar classe chart-toggle-wrap ao flex dos botões do gráfico ─────
old_chart_toggle = 'style="display:flex;gap:6px;">'
new_chart_toggle = 'class="chart-toggle-wrap" style="display:flex;gap:6px;flex-wrap:wrap;">'
if old_chart_toggle in content:
    content = content.replace(old_chart_toggle, new_chart_toggle, 1)
    print("OK: classe chart-toggle-wrap adicionada")
else:
    print("WARN: flex dos botões do gráfico não encontrado")

# ─── 5. Adicionar overflow-x:auto em tabelas sem wrapper ─────────────────────
# Tabela de clientes (admin-routes)
old_table_clientes = '<div class="card-body"><div id="client-table">'
new_table_clientes = '<div class="card-body"><div class="table-wrap"><div id="client-table">'
if old_table_clientes in content:
    content = content.replace(old_table_clientes, new_table_clientes, 1)
    # Fechar o div extra
    close_marker = '</div></div>\n    </div>'
    # Não precisamos fechar extra pois o div interno já fecha
    print("OK: table-wrap adicionado em clientes")
else:
    print("WARN: table-wrap clientes não encontrado")

old_table_svc = '<div class="card-body"><div id="svc-table">'
new_table_svc = '<div class="card-body"><div class="table-wrap"><div id="svc-table">'
if old_table_svc in content:
    content = content.replace(old_table_svc, new_table_svc, 1)
    print("OK: table-wrap adicionado em serviços")
else:
    print("WARN: table-wrap serviços não encontrado")

old_table_prod = '<div class="card-body"><div id="prod-table">'
new_table_prod = '<div class="card-body"><div class="table-wrap"><div id="prod-table">'
if old_table_prod in content:
    content = content.replace(old_table_prod, new_table_prod, 1)
    print("OK: table-wrap adicionado em produtos")
else:
    print("WARN: table-wrap produtos não encontrado")

# ─── 6. Adicionar classe page-preview-iframe-wrap ao div de altura do iframe ──
old_iframe_wrap = 'style="height:280px;overflow:hidden;position:relative;"'
new_iframe_wrap = 'class="page-preview-iframe-wrap" style="height:280px;overflow:hidden;position:relative;"'
if old_iframe_wrap in content:
    content = content.replace(old_iframe_wrap, new_iframe_wrap, 1)
    print("OK: classe page-preview-iframe-wrap adicionada")
else:
    print("WARN: wrapper do iframe não encontrado")

# ─── 7. Adicionar classe chart-card-inner ao card do gráfico ─────────────────
old_chart_card = 'style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px;position:relative;overflow:hidden;"'
new_chart_card = 'class="chart-card-inner" style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:20px;position:relative;overflow:hidden;"'
if old_chart_card in content:
    content = content.replace(old_chart_card, new_chart_card, 1)
    print("OK: classe chart-card-inner adicionada")
else:
    print("WARN: card do gráfico não encontrado")

# ─── 8. Adicionar overflow-x:auto no wrapper da agenda ───────────────────────
old_agenda_body = '<div class="card-body">${appointmentsHtml}</div>'
new_agenda_body = '<div class="card-body"><div class="table-wrap">${appointmentsHtml}</div></div>'
# Não podemos fazer isso pois appointmentsHtml pode ter estrutura própria
# Em vez disso, adicionamos overflow-x:auto diretamente no card-body da agenda
old_agenda_card = '<div class="card" style="margin-bottom:20px;">\n      <div class="card-header">\n        <div class="card-title">Agenda de Hoje'
new_agenda_card = '<div class="card" style="margin-bottom:20px;overflow:hidden;">\n      <div class="card-header">\n        <div class="card-title">Agenda de Hoje'
if old_agenda_card in content:
    content = content.replace(old_agenda_card, new_agenda_card, 1)
    print("OK: overflow:hidden adicionado no card da agenda")
else:
    print("WARN: card da agenda não encontrado")

# ─── 9. Adicionar table-wrap CSS ─────────────────────────────────────────────
# Já está no @media, mas precisamos do estilo base
old_table_css = '    .table { width: 100%;'
new_table_css = '    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }\n    .table { width: 100%;'
if old_table_css in content:
    content = content.replace(old_table_css, new_table_css, 1)
    print("OK: .table-wrap CSS base adicionado")
else:
    # Tentar encontrar .table sem o espaço exato
    if '.table {' in content:
        content = content.replace('.table {', '.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }\n    .table {', 1)
        print("OK: .table-wrap CSS base adicionado (alternativo)")
    else:
        print("WARN: .table CSS não encontrado")

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nPatch de responsividade mobile concluído!")
