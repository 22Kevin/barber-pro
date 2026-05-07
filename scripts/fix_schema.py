#!/usr/bin/env python3
"""
Corrige o drizzle/schema.ts: migra de pg-core para mysql-core.
"""

with open('/home/ubuntu/barber_app/drizzle/schema.ts', 'r') as f:
    content = f.read()

# 1. Corrigir o bloco de imports para usar mysql-core corretamente
old_imports = '''import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";'''

new_imports = '''import {
  boolean,
  date,
  int as integer,
  decimal as numeric,
  mysqlEnum,
  mysqlTable as pgTable,
  serial,
  text,
  time,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
const pgEnum = mysqlEnum;'''

content = content.replace(old_imports, new_imports)

# 2. Verificar se ainda há referências a pg-core
if 'drizzle-orm/pg-core' in content:
    content = content.replace('from "drizzle-orm/pg-core"', 'from "drizzle-orm/mysql-core"')
    print("  Fixed remaining pg-core references")

# 3. Verificar se pgEnum ainda é usado sem definição
import re
if 'pgEnum(' in content and 'const pgEnum = mysqlEnum' not in content:
    content = content.replace('pgEnum(', 'mysqlEnum(')
    print("  Fixed pgEnum -> mysqlEnum")

# 4. Verificar se pgTable ainda é usado sem definição
if 'pgTable(' in content and 'mysqlTable as pgTable' not in content:
    content = content.replace('pgTable(', 'mysqlTable(')
    print("  Fixed pgTable -> mysqlTable")

with open('/home/ubuntu/barber_app/drizzle/schema.ts', 'w') as f:
    f.write(content)

print("✓ drizzle/schema.ts corrigido")

# Verificar resultado
with open('/home/ubuntu/barber_app/drizzle/schema.ts', 'r') as f:
    lines = f.readlines()
print(f"  Total: {len(lines)} linhas")
print("  Primeiras 20 linhas:")
for i, line in enumerate(lines[:20], 1):
    print(f"  {i:3}: {line}", end='')
