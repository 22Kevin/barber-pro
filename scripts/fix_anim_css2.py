#!/usr/bin/env python3
"""
Correção precisa: move o CSS de animações para o adminLayout correto.

O adminLayout começa na linha 245 com 'return `<!DOCTYPE html>'
e seu <style> fecha em alguma linha antes da linha 560.
O CSS de animações está sendo inserido na página de Recuperar Senha (linha ~485+).

Estratégia:
1. Encontrar o bloco de CSS de animações (de /* ─── Animações de Navegação até @keyframes content-leave {...})
2. Removê-lo de onde está
3. Inserir no adminLayout correto: antes do fechamento </style> do adminLayout
   (que é o primeiro </style> após a linha 245, mas DENTRO do template literal do adminLayout)
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# ─── Passo 1: Encontrar o bloco de CSS de animações ──────────────────────────
anim_start = None
anim_end = None

for i, line in enumerate(lines):
    if '/* ─── Animações de Navegação' in line and anim_start is None:
        anim_start = i
    if anim_start is not None and '@keyframes content-leave' in line:
        # Encontrar o fechamento deste @keyframes (dois })
        j = i + 1
        brace = 0
        while j < len(lines):
            brace += lines[j].count('{') - lines[j].count('}')
            if brace < 0:
                anim_end = j + 1
                break
            j += 1
        break

if anim_start is None or anim_end is None:
    print("ERROR: bloco de animações não encontrado")
    exit(1)

print(f"INFO: bloco de animações nas linhas {anim_start+1}-{anim_end}")
anim_block = lines[anim_start:anim_end]

# ─── Passo 2: Encontrar o fechamento correto do adminLayout ──────────────────
# O adminLayout começa na linha 245 (índice 244)
# Precisamos do PRIMEIRO </style> que está DENTRO do template literal do adminLayout
# O adminLayout tem seu próprio <style> que fecha antes do </head>
# Mas o bloco de animações está sendo inserido na página de Recuperar Senha

# Encontrar o </style> correto do adminLayout
# O adminLayout usa @media (max-width: 480px) como último bloco de CSS
# Precisamos inserir APÓS esse bloco e ANTES do </style>

# Procurar o padrão: "    }\n  </style>\n</head>\n<body>\n  <div id=\"sidebar\""
# que é o fechamento correto do adminLayout

admin_insert_line = None
for i in range(244, min(len(lines), 600)):
    # O adminLayout fecha com </style> seguido de </head> seguido de <body> com sidebar
    if (lines[i].strip() == '</style>' and 
        i+1 < len(lines) and lines[i+1].strip() == '</head>' and
        i+2 < len(lines) and lines[i+2].strip() == '<body>' and
        i+3 < len(lines) and 'sidebar' in lines[i+3]):
        admin_insert_line = i  # Inserir ANTES desta linha
        print(f"INFO: fechamento correto do adminLayout na linha {i+1}")
        # Mostrar contexto
        for j in range(max(0, i-3), min(len(lines), i+4)):
            print(f"  {j+1}: {lines[j].rstrip()}")
        break

if admin_insert_line is None:
    # Tentar alternativa: procurar </style> seguido de </head> seguido de <body> com nav-progress
    for i in range(244, min(len(lines), 700)):
        if (lines[i].strip() == '</style>' and 
            i+1 < len(lines) and lines[i+1].strip() == '</head>' and
            i+2 < len(lines) and lines[i+2].strip() == '<body>' and
            i+3 < len(lines) and 'nav-progress' in lines[i+3]):
            admin_insert_line = i
            print(f"INFO: fechamento do adminLayout (via nav-progress) na linha {i+1}")
            for j in range(max(0, i-3), min(len(lines), i+4)):
                print(f"  {j+1}: {lines[j].rstrip()}")
            break

if admin_insert_line is None:
    print("ERROR: fechamento correto do adminLayout não encontrado")
    # Mostrar todos os </style></head><body> para diagnóstico
    for i in range(244, min(len(lines), 700)):
        if lines[i].strip() == '</style>':
            print(f"  </style> na linha {i+1}, próxima: {lines[i+1].strip() if i+1 < len(lines) else 'EOF'}")
    exit(1)

# ─── Passo 3: Verificar se o bloco de animações está no lugar errado ─────────
# O bloco está nas linhas anim_start a anim_end
# Deve estar ANTES de admin_insert_line para estar no adminLayout
if anim_start < admin_insert_line:
    print(f"INFO: bloco de animações ({anim_start+1}) está ANTES do fechamento ({admin_insert_line+1})")
    print("INFO: o CSS já está no adminLayout correto! Verificando compilação...")
    exit(0)
else:
    print(f"INFO: bloco de animações ({anim_start+1}) está DEPOIS do fechamento ({admin_insert_line+1}) - INCORRETO")

# ─── Passo 4: Remover do lugar errado e inserir no lugar certo ───────────────
# Remover o bloco de animações
new_lines = lines[:anim_start] + lines[anim_end:]

# Ajustar o índice de inserção (pois removemos linhas antes)
if anim_start < admin_insert_line:
    insert_idx = admin_insert_line - (anim_end - anim_start)
else:
    insert_idx = admin_insert_line

# Inserir antes do </style> do adminLayout
new_lines = new_lines[:insert_idx] + anim_block + new_lines[insert_idx:]

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"OK: CSS de animações movido para o adminLayout correto (linha {insert_idx+1})!")

# Verificação final
with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    check_lines = f.readlines()

for i, line in enumerate(check_lines):
    if '/* ─── Animações de Navegação' in line:
        print(f"INFO: CSS de animações agora na linha {i+1}")
        # Verificar se está antes do </style></head><body> com sidebar
        for j in range(i, min(len(check_lines), i+100)):
            if check_lines[j].strip() == '</style>':
                print(f"INFO: </style> na linha {j+1}")
                if j+1 < len(check_lines) and check_lines[j+1].strip() == '</head>':
                    if j+2 < len(check_lines) and check_lines[j+2].strip() == '<body>':
                        print("OK: posição correta confirmada!")
                break
        break
