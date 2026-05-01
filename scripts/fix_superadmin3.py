with open('/home/ubuntu/barber_app/server/superadmin-routes.ts', 'r') as f:
    content = f.read()

# Fix 1: COUNT de orbit_leads (linha ~447)
old1 = "          const rows: any[] = await dbConn.execute(db.sqlRaw`SELECT COUNT(*) as cnt FROM orbit_leads`) as any;\n          return rows?.[0]?.[0]?.cnt ?? 0;"
new1 = "          const { sql } = await import('drizzle-orm');\n          const rows = await dbConn.execute(sql`SELECT COUNT(*) as cnt FROM orbit_leads`);\n          return (rows.rows?.[0] as any)?.cnt ?? 0;"

if old1 in content:
    content = content.replace(old1, new1, 1)
    print("OK: Fix 1 - COUNT orbit_leads")
else:
    print("SKIP: Fix 1 - padrao nao encontrado")

# Fix 2: SELECT orbit_leads (linha ~827-829)
old2 = '''          const rows = await dbConn.execute(
            db.sqlRaw`SELECT id, name, email, phone, source, createdAt FROM orbit_leads ORDER BY createdAt DESC LIMIT 500`
          );
          leads = ((rows as any).rows as any[]);'''
new2 = '''          const { orbitLeads: orbitLeadsTable } = await import("../drizzle/schema");
          leads = await dbConn.select().from(orbitLeadsTable).orderBy((t: any) => t.createdAt).limit(500);'''

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("OK: Fix 2 - SELECT orbit_leads")
else:
    print("SKIP: Fix 2 - padrao nao encontrado")

# Fix 3: CREATE TABLE + INSERT landing_testimonials (linhas ~1140-1145)
# A tabela landing_testimonials nao existe no schema Drizzle, entao vamos usar sql raw do Drizzle
old3 = '''        await dbConn.execute(
          db.sqlRaw`CREATE TABLE IF NOT EXISTS landing_testimonials (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), shop VARCHAR(100), text TEXT, rating INT DEFAULT 5, isActive BOOLEAN DEFAULT true, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`
        );
        await dbConn.execute(
          db.sqlRaw`INSERT INTO landing_testimonials (name, shop, text, rating) VALUES (${name}, ${shop}, ${text}, ${parseInt(rating) || 5})`
        );'''
new3 = '''        const { sql: sqlTag } = await import('drizzle-orm');
        await dbConn.execute(sqlTag`CREATE TABLE IF NOT EXISTS landing_testimonials (id SERIAL PRIMARY KEY, name VARCHAR(100), shop VARCHAR(100), text TEXT, rating INT DEFAULT 5, "isActive" BOOLEAN DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT NOW())`);
        await dbConn.execute(sqlTag`INSERT INTO landing_testimonials (name, shop, text, rating) VALUES (${name}, ${shop}, ${text}, ${parseInt(rating) || 5})`);'''

if old3 in content:
    content = content.replace(old3, new3, 1)
    print("OK: Fix 3 - landing_testimonials")
else:
    print("SKIP: Fix 3 - padrao nao encontrado")

with open('/home/ubuntu/barber_app/server/superadmin-routes.ts', 'w') as f:
    f.write(content)
print("Arquivo salvo")
