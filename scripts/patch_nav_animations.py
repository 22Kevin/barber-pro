#!/usr/bin/env python3
"""
Patch: animações de navegação suaves no painel administrativo web.

Adiciona:
1. Barra de progresso dourada na topbar (NProgress-style, puro CSS+JS)
2. Fade-in + slide-up no .content ao carregar a página
3. Estado de loading nos links da sidebar ao clicar (spinner + opacidade)
4. Animação de saída (fade-out) antes de navegar para outra página
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Adicionar CSS das animações logo antes de </style> ───────────────────
nav_animation_css = """
    /* ─── Animações de Navegação ─────────────────────────────────────────────── */
    /* Barra de progresso na topbar */
    #nav-progress {
      position: fixed;
      top: 0;
      left: 0;
      width: 0%;
      height: 3px;
      background: linear-gradient(90deg, #C9A84C, #F5D78A, #C9A84C);
      background-size: 200% 100%;
      z-index: 9999;
      transition: width 0.3s ease, opacity 0.3s ease;
      opacity: 0;
      border-radius: 0 2px 2px 0;
      box-shadow: 0 0 8px rgba(201,168,76,0.6);
      animation: none;
    }
    #nav-progress.running {
      opacity: 1;
      animation: progress-shimmer 1.2s linear infinite;
    }
    #nav-progress.done {
      width: 100% !important;
      opacity: 0;
      transition: width 0.2s ease, opacity 0.4s ease 0.1s;
    }
    @keyframes progress-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Fade-in + slide-up do conteúdo principal */
    @keyframes content-enter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .content {
      animation: content-enter 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    /* Estado de loading no nav-item */
    .nav-item.nav-loading {
      opacity: 0.55;
      pointer-events: none;
    }
    .nav-item.nav-loading::after {
      content: '';
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 2px solid rgba(201,168,76,0.3);
      border-top-color: #C9A84C;
      border-radius: 50%;
      animation: nav-spin 0.6s linear infinite;
      margin-left: auto;
      flex-shrink: 0;
    }
    @keyframes nav-spin {
      to { transform: rotate(360deg); }
    }

    /* Fade-out ao sair da página */
    body.page-leaving .content {
      animation: content-leave 0.2s ease forwards;
    }
    @keyframes content-leave {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(-8px); }
    }
"""

# Inserir antes de </style> (o primeiro </style> é do adminLayout)
old_style_close = "  </style>\n</head>"
new_style_close = nav_animation_css + "  </style>\n</head>"

if old_style_close in content:
    content = content.replace(old_style_close, new_style_close, 1)
    print("OK: CSS de animações adicionado")
else:
    # Tentar alternativa
    old_style_close2 = "  </style>\n<script>"
    if old_style_close2 in content:
        content = content.replace(old_style_close2, nav_animation_css + "  </style>\n<script>", 1)
        print("OK: CSS de animações adicionado (alternativo)")
    else:
        print("ERROR: fechamento de </style> não encontrado")

# ─── 2. Adicionar elemento da barra de progresso no <body> ───────────────────
old_body_start = '  <div class="sidebar-overlay"'
new_body_start = '  <div id="nav-progress"></div>\n  <div class="sidebar-overlay"'

if old_body_start in content:
    content = content.replace(old_body_start, new_body_start, 1)
    print("OK: elemento #nav-progress adicionado no body")
else:
    print("WARN: início do body não encontrado")

# ─── 3. Substituir o script global para adicionar lógica de animação ─────────
old_script = """  <script>
    // ─── Hambúrguer mobile ────────────────────────────────────────────────────
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    }
    function closeSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }
    // Fechar sidebar ao clicar em link de nav (mobile)
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.addEventListener('click', function() {
        if (window.innerWidth < 900) closeSidebar();
      });
    });
    // ─── Toggle de tema ────────────────────────────────────────────────────────
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('bp_theme', next);
    }
  </script>
</body>
</html>`;"""

new_script = """  <script>
    // ─── Hambúrguer mobile ────────────────────────────────────────────────────
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    }
    function closeSidebar() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebarOverlay');
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    }

    // ─── Barra de progresso de navegação ─────────────────────────────────────
    var _navProgress = {
      bar: null,
      timer: null,
      start: function() {
        if (!this.bar) this.bar = document.getElementById('nav-progress');
        if (!this.bar) return;
        clearTimeout(this.timer);
        this.bar.style.width = '0%';
        this.bar.classList.remove('done');
        this.bar.classList.add('running');
        // Simular progresso incremental
        var self = this;
        var pct = 0;
        var steps = [15, 30, 50, 65, 78, 88, 93, 96];
        var i = 0;
        function step() {
          if (i < steps.length) {
            pct = steps[i++];
            self.bar.style.width = pct + '%';
            self.timer = setTimeout(step, 200 + Math.random() * 200);
          }
        }
        step();
      },
      done: function() {
        if (!this.bar) this.bar = document.getElementById('nav-progress');
        if (!this.bar) return;
        clearTimeout(this.timer);
        this.bar.classList.add('done');
        this.bar.classList.remove('running');
        setTimeout(function() {
          if (_navProgress.bar) {
            _navProgress.bar.style.width = '0%';
            _navProgress.bar.classList.remove('done');
          }
        }, 600);
      }
    };

    // ─── Animação de saída + loading nos links da sidebar ────────────────────
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        var href = el.getAttribute('href');
        // Não animar links âncora ou javascript:
        if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
        // Fechar sidebar em mobile
        if (window.innerWidth < 900) closeSidebar();
        // Marcar item como loading
        el.classList.add('nav-loading');
        // Iniciar barra de progresso
        _navProgress.start();
        // Fade-out do conteúdo
        document.body.classList.add('page-leaving');
      });
    });

    // Quando a página terminar de carregar, finalizar a barra
    window.addEventListener('pageshow', function() {
      _navProgress.done();
      document.body.classList.remove('page-leaving');
      // Remover loading de todos os nav-items
      document.querySelectorAll('.nav-item.nav-loading').forEach(function(el) {
        el.classList.remove('nav-loading');
      });
    });

    // Também iniciar barra em formulários de navegação (filtros, buscas)
    document.querySelectorAll('form[method="GET"], a.btn[href^="/admin"]').forEach(function(el) {
      el.addEventListener('submit', function() { _navProgress.start(); });
      if (el.tagName === 'A') {
        el.addEventListener('click', function() { _navProgress.start(); });
      }
    });

    // ─── Toggle de tema ────────────────────────────────────────────────────────
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('bp_theme', next);
    }
  </script>
</body>
</html>`;"""

if old_script in content:
    content = content.replace(old_script, new_script, 1)
    print("OK: script de animações de navegação adicionado")
else:
    print("WARN: script global não encontrado exatamente, tentando alternativa...")
    # Tentar encontrar apenas o fechamento
    old_script_end = """    // ─── Toggle de tema ────────────────────────────────────────────────────────
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('bp_theme', next);
    }
  </script>
</body>
</html>`;"""
    new_script_end = """    // ─── Barra de progresso de navegação ─────────────────────────────────────
    var _navProgress = {
      bar: null,
      timer: null,
      start: function() {
        if (!this.bar) this.bar = document.getElementById('nav-progress');
        if (!this.bar) return;
        clearTimeout(this.timer);
        this.bar.style.width = '0%';
        this.bar.classList.remove('done');
        this.bar.classList.add('running');
        var self = this;
        var pct = 0;
        var steps = [15, 30, 50, 65, 78, 88, 93, 96];
        var i = 0;
        function step() {
          if (i < steps.length) {
            pct = steps[i++];
            self.bar.style.width = pct + '%';
            self.timer = setTimeout(step, 200 + Math.random() * 200);
          }
        }
        step();
      },
      done: function() {
        if (!this.bar) this.bar = document.getElementById('nav-progress');
        if (!this.bar) return;
        clearTimeout(this.timer);
        this.bar.classList.add('done');
        this.bar.classList.remove('running');
        setTimeout(function() {
          if (_navProgress.bar) {
            _navProgress.bar.style.width = '0%';
            _navProgress.bar.classList.remove('done');
          }
        }, 600);
      }
    };

    // ─── Animação de saída + loading nos links da sidebar ────────────────────
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.addEventListener('click', function(e) {
        var href = el.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
        if (window.innerWidth < 900) closeSidebar();
        el.classList.add('nav-loading');
        _navProgress.start();
        document.body.classList.add('page-leaving');
      });
    });

    window.addEventListener('pageshow', function() {
      _navProgress.done();
      document.body.classList.remove('page-leaving');
      document.querySelectorAll('.nav-item.nav-loading').forEach(function(el) {
        el.classList.remove('nav-loading');
      });
    });

    document.querySelectorAll('form[method="GET"], a.btn[href^="/admin"]').forEach(function(el) {
      el.addEventListener('submit', function() { _navProgress.start(); });
      if (el.tagName === 'A') {
        el.addEventListener('click', function() { _navProgress.start(); });
      }
    });

    // ─── Toggle de tema ────────────────────────────────────────────────────────
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('bp_theme', next);
    }
  </script>
</body>
</html>`;"""
    if old_script_end in content:
        content = content.replace(old_script_end, new_script_end, 1)
        print("OK: script de animações adicionado (alternativo)")
    else:
        print("ERROR: não foi possível localizar o script global para modificação")

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("\nPatch de animações de navegação concluído!")
