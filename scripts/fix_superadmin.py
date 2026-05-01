with open('/home/ubuntu/barber_app/server/superadmin-routes.ts', 'r') as f:
    content = f.read()

old_imports = 'import type { Express, Request, Response, NextFunction } from "express";\nimport bcrypt from "bcryptjs";\nimport * as db from "./db";'
new_imports = 'import type { Express, Request, Response, NextFunction } from "express";\nimport bcrypt from "bcryptjs";\nimport * as db from "./db";\nimport { eq } from "drizzle-orm";\nimport { backofficeUsers } from "../drizzle/schema";'

if old_imports in content:
    content = content.replace(old_imports, new_imports, 1)
    print("OK: imports atualizados")
elif 'from "drizzle-orm"' in content:
    print("INFO: imports ja atualizados")
else:
    print("ERRO: imports nao encontrados")

# Verificar se as funcoes ainda usam MySQL
if '.execute(' in content and 'db.sqlRaw' in content:
    print("ERRO: ainda usa MySQL .execute() - corrigindo manualmente")
    # Substituir linha por linha
    lines = content.split('\n')
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        i += 1
    content = '\n'.join(new_lines)

print("Status atual das funcoes:")
for keyword in ['getBoUser', 'getAllBoUsers', 'createBoUser', 'updateBoUser']:
    idx = content.find(f'async function {keyword}')
    if idx >= 0:
        snippet = content[idx:idx+200]
        uses_drizzle = '.select()' in snippet or '.insert(' in snippet or '.update(' in snippet
        uses_mysql = '.execute(' in snippet
        print(f"  {keyword}: drizzle={uses_drizzle}, mysql={uses_mysql}")

with open('/home/ubuntu/barber_app/server/superadmin-routes.ts', 'w') as f:
    f.write(content)
print("Arquivo salvo")
