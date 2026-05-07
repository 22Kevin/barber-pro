#!/usr/bin/env python3
"""
Converte enums pg-style (planEnum("plan")) para inline mysql-style (mysqlEnum("plan", [...values]))
no drizzle/schema.ts.
"""
import re

with open('/home/ubuntu/barber_app/drizzle/schema.ts', 'r') as f:
    content = f.read()

# 1. Extrair todos os enums definidos: export const planEnum = mysqlEnum("plan", [...]);
enum_map = {}
for m in re.finditer(r'export const (\w+) = mysqlEnum\("([^"]+)",\s*\[([^\]]+)\]\)', content):
    var_name = m.group(1)  # e.g. planEnum
    col_name = m.group(2)  # e.g. "plan"
    values = m.group(3)    # e.g. '"solo", "team", "studio"'
    enum_map[var_name] = (col_name, values)

print(f"Enums encontrados: {list(enum_map.keys())}")

# 2. Substituir usos de planEnum("plan") por mysqlEnum("plan", [...values])
# Padrão: planEnum("colname") -> mysqlEnum("colname", [...values])
def replace_enum_usage(match):
    var_name = match.group(1)
    col_name_used = match.group(2)
    if var_name in enum_map:
        _, values = enum_map[var_name]
        return f'mysqlEnum("{col_name_used}", [{values}])'
    return match.group(0)

# Substituir todos os usos: varName("colname")
pattern = re.compile(r'(\w+Enum)\("([^"]+)"\)')
new_content = pattern.sub(replace_enum_usage, content)

# 3. Remover as declarações de enum que agora são desnecessárias nas colunas
# (mas manter as exports para compatibilidade com imports externos)
# Não remover — apenas garantir que os usos inline estejam corretos

# 4. Verificar se ainda há usos não substituídos
remaining = pattern.findall(new_content)
unresolved = [(v, c) for v, c in remaining if v in enum_map]
if unresolved:
    print(f"AVISO: Usos não resolvidos: {unresolved}")

with open('/home/ubuntu/barber_app/drizzle/schema.ts', 'w') as f:
    f.write(new_content)

print(f"✓ schema.ts corrigido ({len(enum_map)} enums convertidos para inline)")

# Verificar resultado
with open('/home/ubuntu/barber_app/drizzle/schema.ts', 'r') as f:
    lines = f.readlines()
print(f"  Total: {len(lines)} linhas")
