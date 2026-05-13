#!/usr/bin/env python3
"""
Patch Dashboard Round 2:
1. Adicionar card "Nova Promoção" nas Ações Rápidas (5º card, grid 5 colunas)
2. Adicionar animação fade-in + slide-up nos KPI cards via CSS keyframes
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Adicionar keyframe e animação nos metric-card ─────────────────────────
old_metric_css = '    /* ── Cards de métrica ── */\n    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }\n    .metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; transition: border-color 0.15s, box-shadow 0.15s; }'

new_metric_css = '''    /* ── Cards de métrica ── */
    @keyframes kpi-in {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; transition: border-color 0.15s, box-shadow 0.15s; animation: kpi-in 0.35s ease both; }
    .metric-card:nth-child(1) { animation-delay: 0ms; }
    .metric-card:nth-child(2) { animation-delay: 60ms; }
    .metric-card:nth-child(3) { animation-delay: 120ms; }
    .metric-card:nth-child(4) { animation-delay: 180ms; }'''

if old_metric_css in content:
    content = content.replace(old_metric_css, new_metric_css, 1)
    print('OK: animação kpi-in adicionada aos metric-card')
else:
    print('ERRO: CSS dos metric-card não encontrado')

# ─── 2. Mudar grid de 4 para 5 colunas nas Ações Rápidas ─────────────────────
old_grid = '      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">'
new_grid = '      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">'

if old_grid in content:
    content = content.replace(old_grid, new_grid, 1)
    print('OK: grid alterado para 5 colunas')
else:
    print('ERRO: grid das Ações Rápidas não encontrado')

# ─── 3. Adicionar 5º card "Nova Promoção" antes do fechamento do grid ─────────
old_servicos_card = '''        <a href="/admin/servicos" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(156,39,176,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9C27B0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3L8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--foreground);text-align:center;">Serviços</span>
        </a>
      </div>
    </div>'''

new_servicos_card = '''        <a href="/admin/servicos" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(156,39,176,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9C27B0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3L8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--foreground);text-align:center;">Serviços</span>
        </a>
        <a href="/admin/promocoes" style="text-decoration:none;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(239,68,68,.12);display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </div>
          <span style="font-size:12px;font-weight:600;color:var(--foreground);text-align:center;">Nova Promoção</span>
        </a>
      </div>
    </div>'''

if old_servicos_card in content:
    content = content.replace(old_servicos_card, new_servicos_card, 1)
    print('OK: card Nova Promoção adicionado')
else:
    print('ERRO: card Serviços não encontrado para inserir após')

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Concluído.')
