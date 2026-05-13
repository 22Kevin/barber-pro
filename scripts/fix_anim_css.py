#!/usr/bin/env python3
"""
Corrige a posição do CSS de animações: move do lugar errado (página de login)
para o adminLayout correto (função adminLayout que renderiza todas as páginas).
"""

with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Marcador de início e fim do bloco de CSS de animações
START_MARKER = "    /* ─── Animações de Navegação"
END_MARKER = "    @keyframes content-leave {"

start_idx = content.find(START_MARKER)
if start_idx == -1:
    print("INFO: CSS de animações não encontrado no lugar errado - pode já estar correto")
    # Verificar se está no lugar certo
    correct_check = content.find("content-enter")
    if correct_check > 0:
        print(f"INFO: content-enter encontrado na linha ~{content[:correct_check].count(chr(10))}")
    exit(0)

# Encontrar o fim do bloco (após o último @keyframes)
end_search = content.find(END_MARKER, start_idx)
if end_search == -1:
    print("ERROR: fim do bloco não encontrado")
    exit(1)

# Encontrar o fechamento do último @keyframes (dois fechamentos de })
pos = end_search
# Pular até o segundo fechamento de chave após content-leave
brace_count = 0
i = pos
while i < len(content):
    if content[i] == '{':
        brace_count += 1
    elif content[i] == '}':
        brace_count -= 1
        if brace_count < 0:
            # Encontrou o fechamento do @keyframes content-leave
            # Agora precisamos do fechamento do próximo nível
            i += 1
            break
    i += 1

# Avançar para o próximo fechamento (o do @keyframes externo)
while i < len(content) and content[i] in ' \n':
    i += 1
if i < len(content) and content[i] == '}':
    i += 1

# Incluir a nova linha após o fechamento
while i < len(content) and content[i] == '\n':
    i += 1
    break

end_idx = i
anim_css_block = content[start_idx:end_idx]
print(f"INFO: bloco CSS extraído ({len(anim_css_block)} chars, linhas {content[:start_idx].count(chr(10))}-{content[:end_idx].count(chr(10))})")

# Remover do lugar errado
content_without = content[:start_idx] + content[end_idx:]

# Verificar se o adminLayout correto está presente
# O adminLayout fecha com: .card-body { padding: 12px 14px; }\n    }\n  </style>
# seguido do script de tema
admin_close = "    }\n  </style>\n  <script>\n    (function() {"
idx_close = content_without.find(admin_close)
if idx_close == -1:
    print("WARN: fechamento do adminLayout não encontrado, tentando padrão alternativo...")
    admin_close = "    }\n  </style>\n  <script>"
    idx_close = content_without.find(admin_close)

if idx_close == -1:
    print("ERROR: não foi possível encontrar o ponto de inserção no adminLayout")
    exit(1)

print(f"INFO: ponto de inserção encontrado na linha ~{content_without[:idx_close].count(chr(10))}")

# Inserir o CSS antes do fechamento
insert_point = idx_close + len("    }\n")
content_fixed = content_without[:insert_point] + anim_css_block + content_without[insert_point:]

with open('server/admin-routes.ts', 'w', encoding='utf-8') as f:
    f.write(content_fixed)

print("OK: CSS de animações movido para o adminLayout correto!")

# Verificar resultado
with open('server/admin-routes.ts', 'r', encoding='utf-8') as f:
    check = f.read()

anim_line = check.find("Animações de Navegação")
close_line = check.find("  </style>\n  <script>\n    (function()")
print(f"INFO: CSS de animações na linha ~{check[:anim_line].count(chr(10))}")
print(f"INFO: fechamento </style> na linha ~{check[:close_line].count(chr(10))}")
if anim_line < close_line:
    print("OK: CSS está ANTES do fechamento </style> - posição correta!")
else:
    print("ERROR: CSS está DEPOIS do fechamento </style> - posição incorreta!")
