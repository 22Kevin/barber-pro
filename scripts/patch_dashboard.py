#!/usr/bin/env python3
"""
Patch do Dashboard Admin Web:
1. Redesenhar card "Baixe o App" com layout moderno
2. Corrigir ícone do card "Novo Agendamento" (substituir stroke var(--primary) por cor fixa)
3. Adicionar preview da página pública no bloco "Link de Agendamento"
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Adicionar dashPublicUrl logo após dashBookingUrl ──────────────────────
old_urls = '  const dashBookingUrl = dashSlug ? `${dashBaseUrl}/pub/${dashSlug}/agendar` : "";'
new_urls = '''  const dashBookingUrl = dashSlug ? `${dashBaseUrl}/pub/${dashSlug}/agendar` : "";
  const dashPublicUrl = dashSlug ? `${dashBaseUrl}/pub/${dashSlug}` : "";'''

if old_urls in content:
    content = content.replace(old_urls, new_urls, 1)
    print('OK: dashPublicUrl adicionado')
else:
    print('ERRO: dashBookingUrl não encontrado')

# ─── 2. Redesenhar card "Baixe o App" ─────────────────────────────────────────
old_app_card_start = '    <!-- Card: Baixe o App (detecção de dispositivo via JS) -->\n    <div class="card" id="download-app-card" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border:1px solid #3d5a8044;display:none">\n      <div class="card-header">\n        <div class="card-title">Baixe o App no Celular</div>\n        <button onclick="document.getElementById(\'download-app-card\').style.display=\'none\';localStorage.setItem(\'hideAppCard\',\'1\')" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:0 4px" title="Fechar">×</button>'

new_app_card_start = '''    <!-- Card: Baixe o App (detecção de dispositivo via JS) -->
    <div id="download-app-card" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%);border:1px solid rgba(201,168,76,0.25);border-radius:16px;padding:0;margin-bottom:20px;display:none;overflow:hidden;position:relative">
      <!-- Brilho decorativo -->
      <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(201,168,76,0.12) 0%,transparent 70%);pointer-events:none"></div>
      <div style="position:absolute;bottom:-60px;left:-20px;width:180px;height:180px;background:radial-gradient(circle,rgba(96,165,250,0.06) 0%,transparent 70%);pointer-events:none"></div>
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px 0">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,rgba(201,168,76,0.2),rgba(201,168,76,0.05));border:1px solid rgba(201,168,76,0.3);display:flex;align-items:center;justify-content:center;font-size:22px">📱</div>
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--foreground)">Barber Pro no seu celular</div>
            <div style="font-size:12px;color:var(--muted);margin-top:1px">Gerencie sua barbearia de qualquer lugar</div>
          </div>
        </div>
        <button onclick="document.getElementById('download-app-card').style.display='none';localStorage.setItem('hideAppCard','1')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);font-size:16px;cursor:pointer;padding:4px 8px;border-radius:8px;line-height:1" title="Fechar">×</button>'''

if old_app_card_start in content:
    content = content.replace(old_app_card_start, new_app_card_start, 1)
    print('OK: header do card Baixe o App redesenhado')
else:
    print('ERRO: header do card Baixe o App não encontrado')

# ─── 3. Substituir o conteúdo interno do card (Android/iOS/Desktop) ──────────
# Encontrar o bloco entre o header e o </div> final do card
old_android_section = '''        <!-- Android -->
        <div id="app-android" style="display:none">
          <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Gerencie sua barbearia de onde estiver. Instale o app Barber Pro no seu Android:</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
            <a id="play-store-link" href="https://play.google.com/store/apps/details?id=space.manus.barber.app" target="_blank" style="display:inline-flex;align-items:center;gap:10px;background:#01875f;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;font-size:14px">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3.18 23.76c.3.17.65.19.96.06l12.45-7.2-2.78-2.78-10.63 9.92zM.5 1.4C.19 1.73 0 2.24 0 2.9v18.2c0 .66.19 1.17.5 1.5l.08.07 10.2-10.2v-.24L.58 1.33.5 1.4zM20.27 10.3l-2.9-1.68-3.1 3.1 3.1 3.1 2.92-1.69c.83-.48.83-1.26-.02-1.83zM4.14.24L16.59 7.44l-2.78 2.78L3.18.24C3.49.11 3.84.13 4.14.24z"/></svg>
              Google Play
            </a>
            <span style="font-size:12px;color:var(--muted)">ou</span>
            <a href="/admin/download-apk" style="display:inline-flex;align-items:center;gap:8px;background:var(--surface2);color:var(--foreground);padding:12px 20px;border-radius:12px;text-decoration:none;font-size:13px;border:1px solid var(--border)">
              ⬇️ Baixar APK direto
            </a>
          </div>
        </div>
        <!-- iPhone / iOS -->
        <div id="app-ios" style="display:none">
          <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Você está usando um iPhone. O app Barber Pro está disponível de duas formas:</p>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div style="background:var(--surface2);border-radius:12px;padding:14px 16px;border:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">Usar pelo navegador (recomendado)</div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Acesse o painel completo pelo Safari — sem instalar nada. Toque em <strong>Compartilhar → Adicionar à Tela de Início</strong> para criar um atalho.</div>
              <a href="/admin" style="display:inline-flex;align-items:center;gap:6px;background:var(--primary);color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600">Acessar painel →</a>
            </div>
            <div style="background:var(--surface2);border-radius:12px;padding:14px 16px;border:1px solid var(--border)">
              <div style="font-weight:600;font-size:13px;margin-bottom:4px">App nativo (em breve)</div>
              <div style="font-size:12px;color:var(--muted)">O app para iPhone estará disponível na App Store em breve. Você será notificado por e-mail quando estiver disponível.</div>
            </div>
          </div>
        </div>
        <!-- Desktop -->
        <div id="app-desktop" style="display:none">
          <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Escaneie o QR Code com seu celular para baixar o app Barber Pro:</p>
          <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap">
            <div style="background:#fff;padding:10px;border-radius:12px;border:1px solid var(--border)">
              <img src="/admin/app-qrcode" width="140" height="140" alt="QR Code App" style="display:block" />
            </div>
            <div style="flex:1;min-width:200px">
              <div style="margin-bottom:12px">
                <div style="font-weight:600;font-size:13px;margin-bottom:4px">Android</div>
                <a id="play-store-link-desktop" href="https://play.google.com/store/apps/details?id=space.manus.barber.app" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:#01875f;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600">Google Play →</a>
              </div>
              <div>
                <div style="font-weight:600;font-size:13px;margin-bottom:4px">iPhone</div>
                <span style="font-size:12px;color:var(--muted)">App Store — em breve</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>'''

new_android_section = '''      <!-- Conteúdo adaptativo por plataforma -->
      <div style="padding:16px 20px 20px">
        <!-- Android -->
        <div id="app-android" style="display:none">
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.5">Instale o app e gerencie agendamentos, clientes e financeiro direto do seu Android.</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <a id="play-store-link" href="https://play.google.com/store/apps/details?id=space.manus.barber.app" target="_blank" style="display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,#01875f,#017a55);color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700;font-size:13px;box-shadow:0 4px 12px rgba(1,135,95,0.3)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M3.18 23.76c.3.17.65.19.96.06l12.45-7.2-2.78-2.78-10.63 9.92zM.5 1.4C.19 1.73 0 2.24 0 2.9v18.2c0 .66.19 1.17.5 1.5l.08.07 10.2-10.2v-.24L.58 1.33.5 1.4zM20.27 10.3l-2.9-1.68-3.1 3.1 3.1 3.1 2.92-1.69c.83-.48.83-1.26-.02-1.83zM4.14.24L16.59 7.44l-2.78 2.78L3.18.24C3.49.11 3.84.13 4.14.24z"/></svg>
                  Google Play
                </a>
                <a href="/admin/download-apk" style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.07);color:var(--foreground);padding:11px 16px;border-radius:12px;text-decoration:none;font-size:12px;border:1px solid rgba(255,255,255,0.12)">
                  ⬇️ APK direto
                </a>
              </div>
            </div>
          </div>
        </div>
        <!-- iPhone / iOS -->
        <div id="app-ios" style="display:none">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px 16px;border:1px solid rgba(255,255,255,0.08)">
              <div style="font-size:20px;margin-bottom:8px">🌐</div>
              <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:var(--foreground)">Usar pelo Safari</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.4">Toque em Compartilhar → Adicionar à Tela de Início para criar um atalho.</div>
              <a href="/admin" style="display:inline-flex;align-items:center;gap:6px;background:rgba(201,168,76,0.15);color:#C9A84C;padding:7px 12px;border-radius:8px;text-decoration:none;font-size:11px;font-weight:700;border:1px solid rgba(201,168,76,0.3)">Acessar painel →</a>
            </div>
            <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px 16px;border:1px solid rgba(255,255,255,0.08)">
              <div style="font-size:20px;margin-bottom:8px">🍎</div>
              <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:var(--foreground)">App Store</div>
              <div style="font-size:11px;color:var(--muted);line-height:1.4">App nativo para iPhone em breve. Você será notificado por e-mail.</div>
              <div style="margin-top:8px;display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.06);padding:4px 8px;border-radius:6px;font-size:10px;color:var(--muted)">⏳ Em breve</div>
            </div>
          </div>
        </div>
        <!-- Desktop -->
        <div id="app-desktop" style="display:none">
          <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
            <div style="background:#fff;padding:10px;border-radius:14px;border:2px solid rgba(201,168,76,0.3);box-shadow:0 0 20px rgba(201,168,76,0.1);flex-shrink:0">
              <img src="/admin/app-qrcode" width="130" height="130" alt="QR Code App" style="display:block;border-radius:6px" />
            </div>
            <div style="flex:1;min-width:180px">
              <div style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.5">Aponte a câmera do celular para o QR Code ou use os links abaixo:</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <a id="play-store-link-desktop" href="https://play.google.com/store/apps/details?id=space.manus.barber.app" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#01875f,#017a55);color:#fff;padding:9px 14px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;box-shadow:0 3px 8px rgba(1,135,95,0.25);width:fit-content">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M3.18 23.76c.3.17.65.19.96.06l12.45-7.2-2.78-2.78-10.63 9.92zM.5 1.4C.19 1.73 0 2.24 0 2.9v18.2c0 .66.19 1.17.5 1.5l.08.07 10.2-10.2v-.24L.58 1.33.5 1.4zM20.27 10.3l-2.9-1.68-3.1 3.1 3.1 3.1 2.92-1.69c.83-.48.83-1.26-.02-1.83zM4.14.24L16.59 7.44l-2.78 2.78L3.18.24C3.49.11 3.84.13 4.14.24z"/></svg>
                  Android — Google Play
                </a>
                <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);padding:9px 14px;border-radius:10px;font-size:12px;color:var(--muted);border:1px solid rgba(255,255,255,0.08);width:fit-content">
                  🍎 iPhone — App Store em breve
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>'''

if old_android_section in content:
    content = content.replace(old_android_section, new_android_section, 1)
    print('OK: conteúdo do card Baixe o App redesenhado')
else:
    print('ERRO: conteúdo do card Baixe o App não encontrado')

# ─── 4. Adicionar preview da página pública no bloco Link de Agendamento ──────
old_booking_card = '''    ${dashBookingUrl ? `
    <div class="card" style="background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);border:1px solid var(--gold)44">
      <div class="card-header">
        <div class="card-title">Link de Agendamento Online</div>
        <a href="/admin/pagina-cliente" class="btn btn-ghost btn-sm">Configurar página</a>
      </div>
      <div class="card-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Compartilhe este link com seus clientes para que eles possam agendar online:</p>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="dash-booking-url" class="form-input" type="text" value="${esc(dashBookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
          <button onclick="(function(btn){navigator.clipboard.writeText(document.getElementById('dash-booking-url').value).then(()=>{var o=btn.innerHTML;btn.innerHTML='Copiado!';setTimeout(()=>btn.innerHTML=o,2000)});})(this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Copiar</button>
          <a href="${esc(dashBookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Abrir</a>
          <a href="https://wa.me/?text=${encodeURIComponent('Agende seu horário: ' + dashBookingUrl)}" target="_blank" class="btn btn-primary" style="flex-shrink:0;padding:8px 14px;font-size:12px">WhatsApp</a>
        </div>
      </div>
    </div>` : ''}'''

new_booking_card = '''    ${dashBookingUrl ? `
    <div class="card" style="background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);border:1px solid var(--gold)44">
      <div class="card-header">
        <div class="card-title">Link de Agendamento Online</div>
        <a href="/admin/pagina-cliente" class="btn btn-ghost btn-sm">Configurar página</a>
      </div>
      <div class="card-body">
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Compartilhe este link com seus clientes para que eles possam agendar online:</p>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
          <input id="dash-booking-url" class="form-input" type="text" value="${esc(dashBookingUrl)}" readonly style="font-size:12px;font-family:monospace;flex:1" />
          <button onclick="(function(btn){navigator.clipboard.writeText(document.getElementById('dash-booking-url').value).then(()=>{var o=btn.innerHTML;btn.innerHTML='Copiado!';setTimeout(()=>btn.innerHTML=o,2000)});})(this)" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Copiar</button>
          <a href="${esc(dashBookingUrl)}" target="_blank" class="btn btn-ghost" style="flex-shrink:0;padding:8px 14px;font-size:12px">Abrir</a>
          <a href="https://wa.me/?text=${encodeURIComponent('Agende seu horário: ' + dashBookingUrl)}" target="_blank" class="btn btn-primary" style="flex-shrink:0;padding:8px 14px;font-size:12px">WhatsApp</a>
        </div>
        ${dashPublicUrl ? `
        <!-- Preview da Página Pública -->
        <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2)">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(0,0,0,0.2);border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:10px;height:10px;border-radius:50%;background:#ff5f57"></div>
              <div style="width:10px;height:10px;border-radius:50%;background:#febc2e"></div>
              <div style="width:10px;height:10px;border-radius:50%;background:#28c840"></div>
            </div>
            <div style="font-size:11px;color:var(--muted);font-family:monospace;background:rgba(0,0,0,0.2);padding:3px 10px;border-radius:6px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(dashPublicUrl)}</div>
            <a href="${esc(dashPublicUrl)}" target="_blank" style="font-size:11px;color:var(--primary);text-decoration:none;font-weight:600">Abrir ↗</a>
          </div>
          <div style="position:relative;height:320px;overflow:hidden">
            <iframe src="${esc(dashPublicUrl)}" style="width:100%;height:100%;border:none;pointer-events:none;transform-origin:top left" scrolling="no" loading="lazy" title="Preview da sua página"></iframe>
            <a href="${esc(dashPublicUrl)}" target="_blank" style="position:absolute;inset:0;display:block;cursor:pointer" title="Abrir página pública"></a>
          </div>
        </div>` : ''}
      </div>
    </div>` : ''}'''

if old_booking_card in content:
    content = content.replace(old_booking_card, new_booking_card, 1)
    print('OK: preview da página pública adicionado ao bloco Link de Agendamento')
else:
    print('ERRO: bloco Link de Agendamento não encontrado')

# ─── 5. Corrigir ícone do card "Novo Agendamento" (usar cor fixa #C9A84C) ─────
old_novo_agend_svg = '''<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>'''
new_novo_agend_svg = '''<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>'''

if old_novo_agend_svg in content:
    content = content.replace(old_novo_agend_svg, new_novo_agend_svg, 1)
    print('OK: ícone do card Novo Agendamento corrigido para cor fixa')
else:
    print('AVISO: ícone do card Novo Agendamento não encontrado (pode já estar correto)')

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Concluído.')
