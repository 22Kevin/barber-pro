with open('/home/ubuntu/barber_app/server/superadmin-routes.ts', 'r') as f:
    content = f.read()

# Fix orderBy incorreto no orbit_leads
old = "          leads = await dbConn.select().from(orbitLeadsTable).orderBy((t: any) => t.createdAt).limit(500);"
new = "          const { desc } = await import('drizzle-orm');\n          leads = await dbConn.select().from(orbitLeadsTable).orderBy(desc(orbitLeadsTable.createdAt)).limit(500);"

if old in content:
    content = content.replace(old, new, 1)
    print("OK: Fix orderBy orbit_leads")
else:
    print("SKIP: padrao nao encontrado")

with open('/home/ubuntu/barber_app/server/superadmin-routes.ts', 'w') as f:
    f.write(content)
print("Salvo")
