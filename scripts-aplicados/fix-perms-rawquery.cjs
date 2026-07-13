const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// Após buscar allBarbers, enriquecer com permissions via rawQuery
rep(
  `  const allBarbers = await db.getAllBarbersIncludingInactive(barber?.tenantId);
  const workingHoursMap: Record<number, any[]> = {};`,
  `  const allBarbers = await db.getAllBarbersIncludingInactive(barber?.tenantId) as any[];
  // Buscar permissions via rawQuery pois a coluna não está no schema Drizzle
  try {
    const dbConn = await db.getDb();
    if (dbConn && allBarbers.length > 0) {
      const ids = allBarbers.map((b: any) => b.id).join(',');
      const rows = await (dbConn as any).execute('SELECT id, permissions FROM barbers WHERE id IN (' + ids + ')') as any;
      const permsMap: Record<number, any> = {};
      const rowArr = Array.isArray(rows) ? rows[0] : (rows?.rows ?? []);
      for (const row of rowArr) {
        if (row.permissions) {
          try { permsMap[row.id] = JSON.parse(row.permissions); } catch(e) { permsMap[row.id] = null; }
        }
      }
      for (const b of allBarbers) { (b as any).permissions = permsMap[b.id] ?? null; }
    }
  } catch(e) {}
  const workingHoursMap: Record<number, any[]> = {};`,
  'allBarbers com permissions rawQuery'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
