#!/usr/bin/env python3
"""
Correção definitiva: move o CSS de animações para o adminLayout correto.

O adminLayout correto fecha com:
  }  </style>
  <script>
    (function() {
      var t = localStorage.getItem('bp_theme')...

O CSS de animações está atualmente na página de Recuperar Senha (linhas 485-559).
Precisa estar ANTES de "  }  </style>" do adminLayout.
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── Identificar o bloco de CSS de animações ─────────────────────────────────
ANIM_START = "    /* ─── Animações de Navegação"
ANIM_END_MARKER = "@keyframes content-leave {"

start_idx = content.find(ANIM_START)
if start_idx == -1:
    print("INFO: CSS de animações não encontrado - pode já estar correto")
    exit(0)

# Encontrar o fim do bloco (após o fechamento do @keyframes content-leave)
end_search = content.find(ANIM_END_MARKER, start_idx)
if end_search == -1:
    print("ERROR: fim do bloco não encontrado")
    exit(1)

# Avançar até o fechamento do @keyframes (dois })
pos = end_search
depth = 0
i = pos
while i < len(content):
    if content[i] == '{':
        depth += 1
    elif content[i] == '}':
        depth -= 1
        if depth < 0:
            i += 1
            break
    i += 1

# Incluir a nova linha após o fechamento
while i < len(content) and content[i] == '\n':
    i += 1
    break

anim_end_idx = i
anim_block = content[start_idx:anim_end_idx]
print(f"INFO: bloco CSS extraído ({len(anim_block)} chars)")
print(f"INFO: primeiros 60 chars: {anim_block[:60]!r}")
print(f"INFO: últimos 60 chars: {anim_block[-60:]!r}")

# ─── Identificar o ponto de inserção correto no adminLayout ──────────────────
# O adminLayout correto fecha com "  }  </style>\n  <script>\n    (function() {"
# seguido do script de tema e depois </head><body> com nav-progress
TARGET_CLOSE = "  }  </style>\n  <script>\n    (function() {"

close_idx = content.find(TARGET_CLOSE)
if close_idx == -1:
    print("ERROR: fechamento do adminLayout não encontrado")
    # Tentar alternativa
    TARGET_CLOSE2 = "}  </style>\n  <script>"
    close_idx = content.find(TARGET_CLOSE2)
    if close_idx == -1:
        print("ERROR: alternativa também não encontrada")
        exit(1)
    print(f"INFO: fechamento encontrado via alternativa na posição {close_idx}")
else:
    print(f"INFO: fechamento do adminLayout encontrado na posição {close_idx}")

# Verificar se o bloco de animações está antes ou depois do fechamento
if start_idx < close_idx:
    print("INFO: CSS já está ANTES do fechamento - posição correta!")
    print("INFO: verificando se está dentro do adminLayout ou em outra página...")
    # Verificar se está dentro do adminLayout (entre a linha 245 e o fechamento)
    # O adminLayout começa com 'return `<!DOCTYPE html>'
    admin_start = content.find("  return `<!DOCTYPE html>")
    if admin_start == -1:
        admin_start = content.find("return `<!DOCTYPE html>")
    print(f"INFO: adminLayout começa na posição {admin_start}")
    print(f"INFO: CSS de animações na posição {start_idx}")
    print(f"INFO: fechamento adminLayout na posição {close_idx}")
    if start_idx > admin_start:
        print("OK: CSS está dentro do adminLayout!")
    else:
        print("WARN: CSS pode estar fora do adminLayout")
    exit(0)

print(f"INFO: CSS ({start_idx}) está DEPOIS do fechamento ({close_idx}) - INCORRETO, corrigindo...")

# ─── Remover do lugar errado ──────────────────────────────────────────────────
content_without = content[:start_idx] + content[anim_end_idx:]

# ─── Inserir antes do fechamento do adminLayout ───────────────────────────────
# O fechamento é "  }  </style>" - inserir o CSS antes do "  }  </style>"
# Mas precisamos manter o "  }" do @media (max-width: 480px)
# O padrão é: "    }\n  }  </style>" onde o primeiro } fecha o @media e o segundo fecha o style

# Encontrar o ponto de inserção no conteúdo sem o bloco de animações
insert_target = "  }  </style>\n  <script>\n    (function() {"
insert_idx = content_without.find(insert_target)
if insert_idx == -1:
    print("ERROR: ponto de inserção não encontrado após remoção")
    exit(1)

# Inserir o bloco de animações ANTES do "  }  </style>"
# O "  }" que precede "  </style>" é o fechamento do último @media
# Queremos: ...@media block...}\n[ANIM CSS]  }  </style>
# Mas o anim_block já começa com "    /* ─── Animações de Navegação"
# Precisamos inserir antes de "  }  </style>"

content_fixed = content_without[:insert_idx] + anim_block + content_without[insert_idx:]

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content_fixed)

print("OK: CSS de animações movido para o adminLayout correto!")

# Verificação final
with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    check = f.read()

anim_pos = check.find(ANIM_START)
close_pos = check.find(TARGET_CLOSE)
print(f"INFO: CSS de animações agora na posição {anim_pos}")
print(f"INFO: fechamento adminLayout na posição {close_pos}")
if anim_pos < close_pos:
    print("OK: CSS está ANTES do fechamento - posição correta!")
else:
    print("ERROR: CSS ainda está DEPOIS do fechamento!")
