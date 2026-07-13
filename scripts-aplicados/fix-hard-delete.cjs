const fs = require('fs');

// Fix 1: db.ts — adicionar hardDeleteBarber
let db = fs.readFileSync('server/db.ts').toString('utf8').replace(/\r\n/g,'\n');
if (!db.includes('hardDeleteBarber')) {
  db = db.replace(
    'export async function deleteBarber(id: number) {\n  const db = await getDb();\n  if (!db) throw new Error("Database not available");\n  await db.update(barbers).set({ isActive: false }).where(eq(barbers.id, id));\n}',
    'export async function deleteBarber(id: number) {\n  const db = await getDb();\n  if (!db) throw new Error("Database not available");\n  await db.update(barbers).set({ isActive: false }).where(eq(barbers.id, id));\n}\n\nexport async function hardDeleteBarber(id: number) {\n  const db = await getDb();\n  if (!db) throw new Error("Database not available");\n  await db.delete(barbers).where(eq(barbers.id, id));\n}'
  );
  fs.writeFileSync('server/db.ts', db, 'utf8');
  console.log('OK: hardDeleteBarber adicionado no db.ts');
} else {
  console.log('JA OK: hardDeleteBarber ja existe');
}

// Fix 2: admin-routes.ts — usar hardDeleteBarber
let routes = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
if (routes.includes('await db.deleteBarber(Number(id));\n      res.redirect("/admin/configuracoes?tab=equipe')) {
  routes = routes.replace(
    'await db.deleteBarber(Number(id));\n      res.redirect("/admin/configuracoes?tab=equipe',
    'await db.hardDeleteBarber(Number(id));\n      res.redirect("/admin/configuracoes?tab=equipe'
  );
  fs.writeFileSync('server/admin-routes.ts', routes, 'utf8');
  console.log('OK: rota usando hardDeleteBarber');
} else {
  console.log('MISS: verificar rota excluir');
}
