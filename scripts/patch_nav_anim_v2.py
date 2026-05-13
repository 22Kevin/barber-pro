#!/usr/bin/env python3
"""
Insere CSS de animações de navegação no adminLayout correto.
Usa busca por string exata para evitar problemas de posição.
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── CSS de animações (inserir antes de "  </style>\n  <script>\n    (function() {") ──
CSS_ANCHOR = "  </style>\n  <script>\n    (function() {"

CSS_INSERT = """    /* ─── Animações de Navegação ─────────────────────────────────────────────── */
    /* Barra de progresso na topbar */
    #nav-progress {
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 3px;
      background: linear-gradient(90deg, #C9A84C, #f0d080, #C9A84C);
      background-size: 200% 100%;
      z-index: 9999;
      transition: width 0.25s ease, opacity 0.4s ease;
      opacity: 0;
      pointer-events: none;
    }
    #nav-progress.running {
      opacity: 1;
      animation: progress-shimmer 1.2s linear infinite;
    }
    #nav-progress.done {
      width: 100% !important;
      opacity: 0;
      transition: width 0.1s ease, opacity 0.5s ease 0.1s;
    }
    @keyframes progress-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    /* Fade-in do conteúdo principal ao navegar */
    .content-enter {
      animation: content-enter 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    @keyframes content-enter {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    /* Feedback visual nos links da sidebar ao clicar */
    .nav-item.nav-loading {
      opacity: 0.5;
      pointer-events: none;
    }
    @keyframes content-leave {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(-8px); }
    }
"""

if CSS_ANCHOR not in content:
    print("ERROR: âncora CSS não encontrada")
    exit(1)

if '/* ─── Animações de Navegação' in content:
    print("INFO: CSS de animações já existe, pulando inserção de CSS")
else:
    content = content.replace(CSS_ANCHOR, CSS_INSERT + CSS_ANCHOR, 1)
    print("OK: CSS de animações inserido")

# ─── Elemento HTML da barra de progresso (inserir após <body>) ─────────────
BODY_ANCHOR = "<body>\n  <div class=\"sidebar-overlay\""
BODY_INSERT = """<body>
  <div id="nav-progress"></div>
  <div class="sidebar-overlay\""""

if '<div id="nav-progress">' in content:
    print("INFO: elemento nav-progress já existe, pulando")
else:
    if BODY_ANCHOR not in content:
        print("ERROR: âncora body não encontrada")
        exit(1)
    content = content.replace(BODY_ANCHOR, BODY_INSERT, 1)
    print("OK: elemento nav-progress inserido")

# ─── JavaScript de interceptação de links (inserir antes de </body>\n</html>\n`) ──
JS_ANCHOR = "</body>\n</html>\n`"

JS_INSERT = """  <script>
    // ── Animações de navegação ──────────────────────────────────────────────
    (function() {
      var bar = document.getElementById('nav-progress');
      var content = document.querySelector('.content');
      var timer = null;
      var width = 0;

      function startProgress() {
        if (!bar) return;
        clearInterval(timer);
        width = 0;
        bar.style.width = '0%';
        bar.classList.remove('done');
        bar.classList.add('running');
        timer = setInterval(function() {
          // Avança rápido até 70%, depois devagar
          var step = width < 40 ? 8 : width < 70 ? 3 : 0.5;
          width = Math.min(width + step, 92);
          bar.style.width = width + '%';
        }, 80);
      }

      function finishProgress() {
        if (!bar) return;
        clearInterval(timer);
        bar.style.width = '100%';
        bar.classList.remove('running');
        bar.classList.add('done');
        setTimeout(function() {
          bar.classList.remove('done');
          bar.style.width = '0%';
        }, 600);
      }

      // Interceptar todos os links internos do painel
      document.addEventListener('click', function(e) {
        var a = e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href');
        // Ignorar links externos, âncoras, javascript: e links que abrem nova aba
        if (!href || href.startsWith('#') || href.startsWith('javascript') ||
            href.startsWith('http') || href.startsWith('//') ||
            a.target === '_blank') return;
        // Adicionar feedback visual no link clicado
        var navItem = a.closest('.nav-item');
        if (navItem) navItem.classList.add('nav-loading');
        startProgress();
      });

      // Animar o conteúdo ao carregar a página
      window.addEventListener('DOMContentLoaded', function() {
        if (content) {
          content.classList.add('content-enter');
          finishProgress();
        }
      });

      // Também animar se o DOM já carregou
      if (document.readyState !== 'loading') {
        if (content) {
          content.classList.add('content-enter');
        }
      }
    })();
  </script>
</body>
</html>
`"""

if 'Animações de navegação' in content and 'startProgress' in content:
    print("INFO: JavaScript de animações já existe, pulando")
else:
    if JS_ANCHOR not in content:
        # Tentar variante com espaços diferentes
        JS_ANCHOR2 = "</body>\n</html>\n\`"
        if JS_ANCHOR2 not in content:
            # Buscar manualmente
            idx = content.find("</body>\n</html>")
            if idx == -1:
                print("ERROR: âncora JS não encontrada")
                # Mostrar contexto do fim do adminLayout
                body_end = content.find("</body>")
                if body_end != -1:
                    print(f"INFO: </body> encontrado na posição {body_end}")
                    print(f"INFO: contexto: {content[body_end:body_end+50]!r}")
                exit(1)
            else:
                print(f"INFO: </body></html> encontrado na posição {idx}")
                print(f"INFO: contexto: {content[idx:idx+30]!r}")
        else:
            content = content.replace(JS_ANCHOR2, JS_INSERT, 1)
            print("OK: JavaScript de animações inserido (variante 2)")
    else:
        content = content.replace(JS_ANCHOR, JS_INSERT, 1)
        print("OK: JavaScript de animações inserido")

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Arquivo salvo!")

# Verificação
with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    check = f.read()

checks = [
    ('CSS de animações', '/* ─── Animações de Navegação'),
    ('nav-progress element', '<div id="nav-progress">'),
    ('JS startProgress', 'startProgress'),
    ('JS content-enter', 'content-enter'),
]
for name, pattern in checks:
    found = pattern in check
    print(f"{'OK' if found else 'MISSING'}: {name}")
