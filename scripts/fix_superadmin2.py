with open('/home/ubuntu/barber_app/server/superadmin-routes.ts', 'r') as f:
    lines = f.readlines()

# Encontrar as linhas das funções de banco (308-351 baseado no grep)
start_marker = '// \u2500\u2500\u2500 Fun\u00e7\u00f5es de banco para backoffice_users'
end_marker = '// \u2500\u2500\u2500 Registro das rotas'

start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if start_marker in line and start_idx is None:
        start_idx = i
    if end_marker in line and start_idx is not None and end_idx is None:
        end_idx = i
        break

print(f"start_idx={start_idx}, end_idx={end_idx}")
if start_idx is None or end_idx is None:
    print("ERRO: marcadores nao encontrados")
    exit(1)

new_funcs = '''// \u2500\u2500\u2500 Fun\u00e7\u00f5es de banco para backoffice_users (Drizzle ORM / PostgreSQL) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
async function getBoUser(email: string): Promise<any | null> {
  const dbConn = await db.getDb();
  if (!dbConn) return null;
  const rows = await dbConn
    .select()
    .from(backofficeUsers)
    .where(eq(backofficeUsers.email, email.toLowerCase().trim()))
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}
async function getAllBoUsers(): Promise<any[]> {
  const dbConn = await db.getDb();
  if (!dbConn) return [];
  return dbConn.select().from(backofficeUsers).orderBy(backofficeUsers.createdAt);
}
async function createBoUser(name: string, email: string, passwordHash: string, role: BORoleType): Promise<void> {
  const dbConn = await db.getDb();
  if (!dbConn) throw new Error("DB unavailable");
  await dbConn.insert(backofficeUsers).values({ name, email: email.toLowerCase().trim(), passwordHash, role });
}
async function updateBoUser(id: number, data: { name?: string; email?: string; passwordHash?: string; role?: string; isActive?: boolean }): Promise<void> {
  const dbConn = await db.getDb();
  if (!dbConn) throw new Error("DB unavailable");
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
  if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (Object.keys(updateData).length === 0) return;
  await dbConn.update(backofficeUsers).set(updateData).where(eq(backofficeUsers.id, id));
}
'''

new_lines = lines[:start_idx] + [new_funcs] + lines[end_idx:]

with open('/home/ubuntu/barber_app/server/superadmin-routes.ts', 'w') as f:
    f.writelines(new_lines)
print(f"OK: substituidas linhas {start_idx+1} a {end_idx}")
