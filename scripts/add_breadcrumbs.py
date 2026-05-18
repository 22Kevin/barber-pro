#!/usr/bin/env python3
"""
Adiciona o 4º argumento (breadcrumbs) nas chamadas layout() do superadmin-routes.ts
Estratégia: encontrar o fechamento de cada template literal multilinha e inserir o 4º argumento.

O padrão é:
  res.send(layout("TITLE", session, `
    ...conteúdo multilinha...
  `));

Precisamos mudar para:
  res.send(layout("TITLE", session, `
    ...conteúdo multilinha...
  `, BREADCRUMBS));
"""

import re

path = "/home/ubuntu/barber_app/server/superadmin-routes.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Mapeamento de título → breadcrumbs
# Para títulos duplicados (Suporte, Planos), usamos índice de ocorrência
breadcrumb_map = {
    ("Dashboard", 1): None,  # sem breadcrumb (é a raiz)
    ("Barbearias", 1): '[{ label: "Dashboard", href: "/superadmin" }, { label: "Barbearias" }]',
    ("Erros", 1): '[{ label: "Dashboard", href: "/superadmin" }, { label: "Erros" }]',
    ("Leads", 1): '[{ label: "Dashboard", href: "/superadmin" }, { label: "Leads" }]',
    ("Usuários", 1): '[{ label: "Dashboard", href: "/superadmin" }, { label: "Usuários" }]',
    ("CMS — Landing Page", 1): '[{ label: "Dashboard", href: "/superadmin" }, { label: "CMS" }]',
    ("Suporte", 1): '[{ label: "Dashboard", href: "/superadmin" }, { label: "Suporte" }]',
    ("Suporte", 2): '[{ label: "Dashboard", href: "/superadmin" }, { label: "Suporte", href: "/superadmin/suporte" }, { label: "Ticket #" + String(ticketId) }]',
    ("Planos", 1): '[{ label: "Dashboard", href: "/superadmin" }, { label: "Planos" }]',
    ("Planos", 2): '[{ label: "Dashboard", href: "/superadmin" }, { label: "Planos", href: "/superadmin/planos" }, { label: "Editar Plano" }]',
    ("Preview de E-mails", 1): '[{ label: "Dashboard", href: "/superadmin" }, { label: "E-mails" }]',
}

# Encontrar todas as ocorrências de res.send(layout("TITLE", ...
# e rastrear o fechamento do template literal para inserir o 4º argumento
pattern = re.compile(r'res\.send\(layout\("([^"]+)",\s*(\w+),\s*`')

# Contar ocorrências por título
title_counts = {}

# Processar o conteúdo caractere por caractere para encontrar os fechamentos
result = list(content)
# Vamos trabalhar com o conteúdo como string e fazer substituições por posição

# Encontrar todas as matches e suas posições
matches = list(pattern.finditer(content))

# Para cada match, encontrar o fechamento do template literal e inserir o breadcrumb
# Processar de trás para frente para não invalidar posições
insertions = []  # lista de (posição, texto_a_inserir)

for match in matches:
    title = match.group(1)
    title_counts[title] = title_counts.get(title, 0) + 1
    occurrence = title_counts[title]
    
    key = (title, occurrence)
    bc = breadcrumb_map.get(key)
    
    if bc is None:
        continue  # sem breadcrumb para este
    
    # Encontrar o fechamento do template literal
    # Começar após o backtick de abertura
    start_pos = match.end()  # posição após o backtick de abertura
    
    # Encontrar o backtick de fechamento do template literal
    # Precisamos lidar com template literals aninhados (${...})
    depth = 0  # profundidade de ${
    pos = start_pos
    found_close = -1
    
    while pos < len(content):
        ch = content[pos]
        
        if ch == '$' and pos + 1 < len(content) and content[pos+1] == '{':
            depth += 1
            pos += 2
            continue
        
        if ch == '}' and depth > 0:
            depth -= 1
            pos += 1
            continue
        
        if ch == '`' and depth == 0:
            found_close = pos
            break
        
        # Pular strings dentro de ${...}
        if depth > 0:
            if ch in ('"', "'"):
                quote = ch
                pos += 1
                while pos < len(content) and content[pos] != quote:
                    if content[pos] == '\\':
                        pos += 1
                    pos += 1
                pos += 1
                continue
            
            # Template literal aninhado dentro de ${}
            if ch == '`':
                pos += 1
                inner_depth = 0
                while pos < len(content):
                    c = content[pos]
                    if c == '$' and pos + 1 < len(content) and content[pos+1] == '{':
                        inner_depth += 1
                        pos += 2
                        continue
                    if c == '}' and inner_depth > 0:
                        inner_depth -= 1
                        pos += 1
                        continue
                    if c == '`' and inner_depth == 0:
                        pos += 1
                        break
                    pos += 1
                continue
        
        pos += 1
    
    if found_close >= 0:
        # Inserir o breadcrumb após o backtick de fechamento
        # O padrão é: `...`)) → `...`, BREADCRUMBS))
        insertions.append((found_close, f", {bc}"))
        print(f"  ✓ {title} (ocorrência {occurrence}) → breadcrumb inserido na posição {found_close}")
    else:
        print(f"  ✗ {title} (ocorrência {occurrence}) → fechamento não encontrado")

# Aplicar inserções de trás para frente
insertions.sort(key=lambda x: x[0], reverse=True)
content_list = list(content)
for pos, text in insertions:
    content_list.insert(pos, text)

new_content = "".join(content_list)

with open(path, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"\nTotal de breadcrumbs inseridos: {len(insertions)}")
print("Arquivo atualizado com sucesso!")
