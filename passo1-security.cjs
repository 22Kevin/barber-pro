const fs = require('fs');
let ok = 0, miss = 0;

function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) {
    c = c.replace(old, novo);
    fs.writeFileSync(file, c, 'utf8');
    console.log('OK: ' + tag); ok++;
  } else { console.log('MISS: ' + tag); miss++; }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX 1 (CRÍTICO): Sessão admin SEM assinatura → HMAC-SHA256 real
// Qualquer um podia forjar base64({barberId:1,role:"super_admin"}) e invadir
// ═══════════════════════════════════════════════════════════════════════════
patch('server/admin-routes.ts',
`function encodeSession(barberId: number, role: string, maxAge = SESSION_MAX_AGE): string {
  const payload = Buffer.from(JSON.stringify({ barberId, role, ts: Date.now(), maxAge })).toString("base64url");
  return payload;
}

function decodeSession(token: string): { barberId: number; role: string } | null {
  try {
    const data = JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
    if (!data.barberId || !data.role) return null;
    // Usar maxAge armazenado no token (suporta 8h ou 30 dias)
    const maxAge = data.maxAge ?? SESSION_MAX_AGE;
    if (Date.now() - data.ts > maxAge * 1000) return null;
    return { barberId: data.barberId, role: data.role };
  } catch {
    return null;
  }
}`,
`const SESSION_HMAC_SECRET = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "barber-pro-session-fallback";
const SECURE_COOKIE = process.env.NODE_ENV === "production" ? "; Secure" : "";

function signSessionPayload(payload: string): string {
  return crypto.createHmac("sha256", SESSION_HMAC_SECRET).update(payload).digest("base64url");
}

function encodeSession(barberId: number, role: string, maxAge = SESSION_MAX_AGE): string {
  const payload = Buffer.from(JSON.stringify({ barberId, role, ts: Date.now(), maxAge })).toString("base64url");
  return payload + "." + signSessionPayload(payload);
}

function decodeSession(token: string): { barberId: number; role: string } | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    // Verificação de assinatura em tempo constante (anti timing attack)
    const expected = signSessionPayload(payload);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (!data.barberId || !data.role) return null;
    const maxAge = data.maxAge ?? SESSION_MAX_AGE;
    if (Date.now() - data.ts > maxAge * 1000) return null;
    return { barberId: data.barberId, role: data.role };
  } catch {
    return null;
  }
}`,
'FIX 1: sessão admin com HMAC-SHA256');

// ═══════════════════════════════════════════════════════════════════════════
// FIX 2 (CRÍTICO): "Assinatura" do superadmin era base64 reversível (fake)
// Os 16 primeiros chars dependiam só do payload — forjável sem o secret
// ═══════════════════════════════════════════════════════════════════════════
patch('server/superadmin-routes.ts',
`function encodeSession(data: BOSession): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64");
  const sig = Buffer.from(payload + SESSION_SECRET).toString("base64").slice(0, 16);
  return \`\${payload}.\${sig}\`;
}`,
`function encodeSession(data: BOSession): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return \`\${payload}.\${sig}\`;
}`,
'FIX 2a: superadmin encode HMAC');

patch('server/superadmin-routes.ts',
`    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expectedSig = Buffer.from(payload + SESSION_SECRET).toString("base64").slice(0, 16);
    if (sig !== expectedSig) return null;`,
`    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;`,
'FIX 2b: superadmin decode HMAC');

// Garantir import de crypto no superadmin
{
  let c = fs.readFileSync('server/superadmin-routes.ts').toString('utf8');
  if (!c.includes('import crypto from "crypto"') && !c.includes("import crypto from 'crypto'") && !c.includes('require("crypto")')) {
    const firstImport = c.indexOf('import ');
    c = c.slice(0, firstImport) + 'import crypto from "crypto";\n' + c.slice(firstImport);
    fs.writeFileSync('server/superadmin-routes.ts', c, 'utf8');
    console.log('OK: import crypto no superadmin'); ok++;
  } else console.log('SKIP: crypto já importado no superadmin');
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX 3 (CRÍTICO): IDOR nas rotas de filiais — validar ownership
// Qualquer super_admin de qualquer tenant podia editar/excluir filiais alheias
// ═══════════════════════════════════════════════════════════════════════════
patch('server/admin-routes.ts',
`  app.post("/admin/filiais/editar", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      if (session.role !== 'super_admin') { res.redirect('/admin/configuracoes?tab=filiais'); return; }
      const { branchId, name, displayName, phone, cnpj, address, cep, addressNumber, city } = req.body;
      await db.updateBranch(parseInt(branchId), { name, displayName, phone, cnpj, address, cep, addressNumber, city });`,
`  app.post("/admin/filiais/editar", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      if (session.role !== 'super_admin') { res.redirect('/admin/configuracoes?tab=filiais'); return; }
      const { branchId, name, displayName, phone, cnpj, address, cep, addressNumber, city } = req.body;
      // SEGURANÇA: a filial precisa pertencer à matriz do admin logado
      const adminBarber = await db.getBarberById(session.barberId);
      const branchTenant = await db.getTenantById(parseInt(branchId));
      if (!adminBarber?.tenantId || (branchTenant as any)?.parentTenantId !== adminBarber.tenantId) {
        res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent('Filial não pertence à sua rede')); return;
      }
      await db.updateBranch(parseInt(branchId), { name, displayName, phone, cnpj, address, cep, addressNumber, city });`,
'FIX 3a: IDOR editar filial');

patch('server/admin-routes.ts',
`  app.post("/admin/filiais/excluir", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      if (session.role !== 'super_admin') { res.redirect('/admin/configuracoes?tab=filiais'); return; }
      const result = await db.deleteBranch(parseInt(req.body.branchId));`,
`  app.post("/admin/filiais/excluir", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      if (session.role !== 'super_admin') { res.redirect('/admin/configuracoes?tab=filiais'); return; }
      // SEGURANÇA: a filial precisa pertencer à matriz do admin logado
      const adminBarber = await db.getBarberById(session.barberId);
      const branchTenant = await db.getTenantById(parseInt(req.body.branchId));
      if (!adminBarber?.tenantId || (branchTenant as any)?.parentTenantId !== adminBarber.tenantId) {
        res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent('Filial não pertence à sua rede')); return;
      }
      const result = await db.deleteBranch(parseInt(req.body.branchId));`,
'FIX 3b: IDOR excluir filial');

// ═══════════════════════════════════════════════════════════════════════════
// FIX 4 (CRÍTICO + FEATURE): /admin/filiais/trocar — antes era um cookie morto.
// Agora: troca REAL de contexto via barbeiro-espelho, com validação de ownership.
// ═══════════════════════════════════════════════════════════════════════════
patch('server/admin-routes.ts',
`  app.post("/admin/filiais/trocar", requireAdminAuth, (req: Request, res: Response) => {
    res.cookie('bp_branch_ctx', req.body.branchId ?? '', { httpOnly: true, sameSite: 'lax', maxAge: 86400000 });
    res.redirect(req.body.returnTo ?? '/admin');
  });`,
`  app.post("/admin/filiais/trocar", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const session = (req as any).adminSession as { barberId: number; role: string };
      if (session.role !== 'super_admin') { res.redirect('/admin'); return; }
      const adminBarber = await db.getBarberById(session.barberId);
      if (!adminBarber?.tenantId || !adminBarber.email) { res.redirect('/admin'); return; }
      const targetTenantId = parseInt(req.body.branchId);
      const currentTenant = await db.getTenantById(adminBarber.tenantId);
      const targetTenant = await db.getTenantById(targetTenantId);
      if (!targetTenant) { res.redirect('/admin'); return; }

      // Caso 1: estou numa filial e quero voltar para a matriz
      const myParent = (currentTenant as any)?.parentTenantId ?? null;
      const targetIsMyMatrix = myParent === targetTenantId;
      // Caso 2: estou na matriz e quero entrar numa filial minha
      const targetIsMyBranch = (targetTenant as any)?.parentTenantId === adminBarber.tenantId;

      if (!targetIsMyMatrix && !targetIsMyBranch) {
        res.redirect('/admin?erro=acesso_restrito'); return;
      }

      // Localizar o barbeiro-espelho (mesmo e-mail, super_admin) no tenant destino
      const mirror = await db.getMirrorAdmin(targetTenantId, adminBarber.email);
      if (!mirror) { res.redirect('/admin/configuracoes?tab=filiais&error=' + encodeURIComponent('Conta de acesso à filial não encontrada')); return; }

      const token = encodeSession(mirror.id, 'super_admin');
      res.setHeader("Set-Cookie", \`\${ADMIN_SESSION_COOKIE}=\${token}; Path=/; HttpOnly; SameSite=Lax\${SECURE_COOKIE}; Max-Age=\${SESSION_MAX_AGE}\`);
      res.redirect('/admin');
    } catch(e: any) {
      res.redirect('/admin');
    }
  });`,
'FIX 4: troca de filial real com ownership');

// ═══════════════════════════════════════════════════════════════════════════
// FIX 5 (ALTO): Rate limit no POST /admin/login web (brute force)
// ═══════════════════════════════════════════════════════════════════════════
patch('server/admin-routes.ts',
`  app.post("/admin/login", async (req: Request, res: Response) => {
    try {
      const { email, password, remember } = req.body ?? {};
      if (!email || !password) return res.redirect("/admin/login?error=1");`,
`  // Rate limit simples em memória: 10 tentativas por IP a cada 15 min
  const _loginAttempts = new Map<string, { count: number; resetAt: number }>();
  function loginRateCheck(ip: string): boolean {
    const now = Date.now();
    const entry = _loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) { _loginAttempts.set(ip, { count: 1, resetAt: now + 15*60*1000 }); return true; }
    entry.count++;
    return entry.count <= 10;
  }
  setInterval(() => { const now = Date.now(); for (const [k,v] of _loginAttempts) if (now > v.resetAt) _loginAttempts.delete(k); }, 10*60*1000).unref?.();

  app.post("/admin/login", async (req: Request, res: Response) => {
    try {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
      if (!loginRateCheck(ip)) return res.redirect("/admin/login?error=2&msg=" + encodeURIComponent("Muitas tentativas. Aguarde 15 minutos."));
      const { email, password, remember } = req.body ?? {};
      if (!email || !password) return res.redirect("/admin/login?error=1");`,
'FIX 5: rate limit login web');

// ═══════════════════════════════════════════════════════════════════════════
// FIX 6: remember-me — token interno agora respeita o maxAge do cookie
// ═══════════════════════════════════════════════════════════════════════════
patch('server/admin-routes.ts',
`      const rememberMe = remember === "1" || remember === "true";
      const maxAge = rememberMe ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE;
      const token = encodeSession(barber.id, barber.role);
      res.setHeader("Set-Cookie", \`\${ADMIN_SESSION_COOKIE}=\${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=\${maxAge}\`);`,
`      const rememberMe = remember === "1" || remember === "true";
      const maxAge = rememberMe ? SESSION_MAX_AGE_REMEMBER : SESSION_MAX_AGE;
      const token = encodeSession(barber.id, barber.role, maxAge);
      res.setHeader("Set-Cookie", \`\${ADMIN_SESSION_COOKIE}=\${token}; Path=/; HttpOnly; SameSite=Lax\${SECURE_COOKIE}; Max-Age=\${maxAge}\`);`,
'FIX 6: remember-me maxAge + Secure flag');

// ═══════════════════════════════════════════════════════════════════════════
// FIX 7: criar barbeiro-espelho ao criar filial (acesso do dono)
// ═══════════════════════════════════════════════════════════════════════════
patch('server/db.ts',
`export async function createBranch(parentTenantId: number, data: {
  name: string; displayName: string; slug: string;
  phone?: string; address?: string; cep?: string;
  addressNumber?: string; city?: string; state?: string; cnpj?: string;
}): Promise<number> {`,
`/** Busca o barbeiro-espelho (super_admin com determinado e-mail) num tenant */
export async function getMirrorAdmin(tenantId: number, email: string): Promise<any | null> {
  if (!_pool) await getDb();
  if (!_pool) return null;
  const r = await _pool.query(
    \`SELECT * FROM barbers WHERE "tenantId" = $1 AND LOWER(email) = LOWER($2) AND role = 'super_admin' AND "isActive" = true LIMIT 1\`,
    [tenantId, email]
  );
  return r.rows[0] ?? null;
}

export async function createBranch(parentTenantId: number, data: {
  name: string; displayName: string; slug: string;
  phone?: string; address?: string; cep?: string;
  addressNumber?: string; city?: string; state?: string; cnpj?: string;
  ownerName?: string; ownerEmail?: string; ownerPasswordHash?: string;
}): Promise<number> {`,
'FIX 7a: getMirrorAdmin + assinatura createBranch');

patch('server/db.ts',
`  await _pool.query(
    \`INSERT INTO shop_settings ("tenantId","shopName",phone,cnpj,address) VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("tenantId") DO NOTHING\`,
    [branchId, data.name, data.phone??null, data.cnpj??null, data.address??null]
  );
  return branchId;
}`,
`  await _pool.query(
    \`INSERT INTO shop_settings ("tenantId","shopName",phone,cnpj,address) VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("tenantId") DO NOTHING\`,
    [branchId, data.name, data.phone??null, data.cnpj??null, data.address??null]
  );
  // Barbeiro-espelho: o dono da matriz acessa a filial com o mesmo login
  if (data.ownerEmail && data.ownerPasswordHash) {
    await _pool.query(
      \`INSERT INTO barbers ("tenantId", name, email, "passwordHash", role, "isActive")
       VALUES ($1, $2, $3, $4, 'super_admin', true)\`,
      [branchId, data.ownerName ?? 'Administrador', data.ownerEmail, data.ownerPasswordHash]
    );
  }
  return branchId;
}`,
'FIX 7b: barbeiro-espelho na criação da filial');

patch('server/admin-routes.ts',
`      await db.createBranch(barber!.tenantId!, { name, displayName, slug, phone, cnpj, address, cep, addressNumber, city, state });
      res.redirect('/admin/configuracoes?tab=filiais&saved=1');`,
`      await db.createBranch(barber!.tenantId!, {
        name, displayName, slug, phone, cnpj, address, cep, addressNumber, city, state,
        ownerName: barber!.name, ownerEmail: barber!.email ?? undefined, ownerPasswordHash: (barber as any).passwordHash ?? undefined,
      });
      res.redirect('/admin/configuracoes?tab=filiais&saved=1');`,
'FIX 7c: passar dados do dono ao criar filial');

console.log('\\nResultado: ' + ok + ' aplicados, ' + miss + ' não encontrados');
