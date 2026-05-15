#!/usr/bin/env python3
"""
Corrige variáveis CSS erradas na função renderAgenda do admin-routes.ts.
O painel admin usa --gold, --text, --bg, --surface, --border, --muted.
O redesign da Agenda usou --primary, --foreground, --background que não existem.
"""
import re

path = "server/admin-routes.ts"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Substituições apenas no bloco da renderAgenda (linhas ~1970-2400)
# Fazemos substituição global mas apenas nas strings que são parte do HTML da Agenda
# As substituições são seguras pois --primary não existe no CSS do admin

replacements = [
    # --primary -> --gold (cor principal dourada)
    ("var(--primary)", "var(--gold)"),
    # --foreground -> --text (texto principal)
    ("var(--foreground)", "var(--text)"),
    # --background -> --bg (fundo principal)
    ("var(--background)", "var(--bg)"),
]

original = content
for old, new in replacements:
    content = content.replace(old, new)

count = sum(original.count(old) for old, _ in replacements)
print(f"Substituições feitas: {count}")

# Verificar que não sobrou nenhuma variável errada
remaining = sum(content.count(f"var({v})") for v in ["--primary", "--foreground", "--background"])
print(f"Variáveis erradas restantes: {remaining}")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Arquivo salvo com sucesso.")
