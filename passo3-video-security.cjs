const fs = require('fs');
let ok = 0, miss = 0;
function patch(file, old, novo, tag, all) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) {
    c = all ? c.split(old).join(novo) : c.replace(old, novo);
    fs.writeFileSync(file, c, 'utf8');
    console.log('OK: ' + tag); ok++;
  } else { console.log('MISS: ' + tag); miss++; }
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 1 do vídeo: .env fora do código → .gitignore
// ═══════════════════════════════════════════════════════════════════════════
{
  let g = fs.readFileSync('.gitignore').toString('utf8');
  if (!/^\.env$/m.test(g)) {
    g = g.replace('# local env files', '# local env files\n.env\n.env.*\n!.env.example');
    fs.writeFileSync('.gitignore', g, 'utf8');
    console.log('OK: .env no .gitignore'); ok++;
  } else console.log('SKIP: .env já ignorado');
  // .env.example para documentar sem segredos
  if (!fs.existsSync('.env.example')) {
    fs.writeFileSync('.env.example', 'EXPO_PUBLIC_API_BASE_URL=https://usebarberpro.com\n', 'utf8');
    console.log('OK: .env.example criado'); ok++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 7 do vídeo: CORS — allowlist em vez de refletir qualquer origem
// ITEM 8 do vídeo: headers de segurança (X-Frame-Options, nosniff, etc)
// ═══════════════════════════════════════════════════════════════════════════
patch('server/_core/index.ts',
`  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");`,
`  // CORS com allowlist — refletir qualquer origem com credentials é falha grave
  const CORS_ALLOWED = new Set([
    "https://usebarberpro.com",
    "https://www.usebarberpro.com",
    ...(process.env.NODE_ENV !== "production" ? [
      "http://localhost:3000", "http://localhost:8081", "http://localhost:19006",
    ] : []),
  ]);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && CORS_ALLOWED.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    // Headers de segurança básicos (clickjacking, MIME sniffing, referrer)
    res.header("X-Frame-Options", "SAMEORIGIN");
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Referrer-Policy", "strict-origin-when-cross-origin");
    res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");`,
'CORS allowlist + security headers');

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 5 do vídeo: cookie de token = HttpOnly + Secure + ASSINADO
// client_session era base64 puro com CPF dentro — forjável + dado pessoal
// ═══════════════════════════════════════════════════════════════════════════
patch('server/public-routes.ts',
`import bcrypt from "bcryptjs";`,
`import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Sessão do cliente: assinada com HMAC (anti-forjamento) ────────────────────
const CLIENT_SESSION_SECRET = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "barber-pro-client-fallback";
const CLIENT_COOKIE_SECURE = process.env.NODE_ENV === "production";
function encodeClientSession(data: any): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto.createHmac("sha256", CLIENT_SESSION_SECRET).update(payload).digest("base64url");
  return payload + "." + sig;
}
function decodeClientSession(token?: string | null): any | null {
  try {
    if (!token) return null;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", CLIENT_SESSION_SECRET).update(payload).digest("base64url");
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch { return null; }
}`,
'helpers encodeClientSession/decodeClientSession');

// Leituras (3 variações, global)
patch('server/public-routes.ts',
`try { loggedClient = JSON.parse(Buffer.from(clientSessionRaw, "base64").toString()); } catch {}`,
`loggedClient = decodeClientSession(clientSessionRaw);`,
'leituras loggedClient → decode assinado', true);

patch('server/public-routes.ts',
`if (sessionData) { try { clientInfo = JSON.parse(Buffer.from(sessionData, "base64").toString()); } catch {} }`,
`if (sessionData) { clientInfo = decodeClientSession(sessionData); }`,
'leituras clientInfo → decode assinado', true);

patch('server/public-routes.ts',
`try { clientInfo = JSON.parse(Buffer.from(sessionData, "base64").toString()); } catch { res.status(401).json({ error: "Sessão inválida" }); return; }`,
`clientInfo = decodeClientSession(sessionData);
      if (!clientInfo) { res.status(401).json({ error: "Sessão inválida" }); return; }`,
'leituras 401 → decode assinado', true);

// Escritas (remover CPF do payload + assinar)
patch('server/public-routes.ts',
`const sessionData = Buffer.from(JSON.stringify({ id: client.id, name: client.name, email: client.email, cpf: (client as any).cpf ?? null })).toString("base64");`,
`const sessionData = encodeClientSession({ id: client.id, name: client.name, email: client.email });`,
'escrita login senha (sem CPF)');

patch('server/public-routes.ts',
`const sessionData = Buffer.from(JSON.stringify({ id: clientId, name, email, cpf: cpf ?? null })).toString("base64");`,
`const sessionData = encodeClientSession({ id: clientId, name, email });`,
'escrita registro (sem CPF)');

patch('server/public-routes.ts',
`const sessionCookie = Buffer.from(JSON.stringify(sessionData)).toString("base64");`,
`const sessionCookie = encodeClientSession(sessionData);`,
'escrita login Google');

patch('server/public-routes.ts',
`const sessionValue = Buffer.from(JSON.stringify(updatedSession)).toString("base64");`,
`const sessionValue = encodeClientSession(updatedSession);`,
'escrita atualização perfil');

// Flag Secure nos cookies do cliente (global nas duas variantes de maxAge)
patch('server/public-routes.ts',
`{ httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" }`,
`{ httpOnly: true, secure: CLIENT_COOKIE_SECURE, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" }`,
'Secure flag cookies 7d', true);

patch('server/public-routes.ts',
`{ httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" }`,
`{ httpOnly: true, secure: CLIENT_COOKIE_SECURE, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" }`,
'Secure flag cookies 30d', true);

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 4 do vídeo: localStorage sem dados pessoais (e-mail saía no login)
// "Lembrar e-mail" agora usa cookie HttpOnly + prefill server-side
// ═══════════════════════════════════════════════════════════════════════════
// 4a. Input de e-mail aceita prefill do servidor
patch('server/admin-routes.ts',
`function loginPage(error = false, errorMsg?: string, info?: string, infoEmail?: string): string {`,
`function loginPage(error = false, errorMsg?: string, info?: string, infoEmail?: string, rememberedEmail?: string): string {`,
'loginPage aceita rememberedEmail');

patch('server/admin-routes.ts',
`<input class="form-input" type="email" name="email" id="emailInput" placeholder="seu@email.com" required autofocus />`,
`<input class="form-input" type="email" name="email" id="emailInput" placeholder="seu@email.com" value="\${rememberedEmail ? rememberedEmail.replace(/"/g, '&quot;') : ''}" required autofocus />`,
'input email com prefill server-side');

// 4b. JS do login: remover localStorage (restauração)
patch('server/admin-routes.ts',
`    // Restaurar e-mail salvo
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        const { email, remember } = JSON.parse(saved);
        if (remember && email) {
          emailInput.value = email;
          rememberCheck.checked = true;
          rememberInput.value = "1";
        }
      }
    } catch(e) {}`,
`    // Prefill vem do servidor via cookie HttpOnly (sem dados pessoais no localStorage)
    if (emailInput.value) { rememberCheck.checked = true; rememberInput.value = "1"; }`,
'remover restauração via localStorage');

// 4c. JS do login: remover gravação no localStorage
patch('server/admin-routes.ts',
`    document.getElementById("loginForm").addEventListener("submit", function() {
      try {
        if (rememberCheck.checked) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: emailInput.value, remember: true }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch(e) {}
    });`,
`    // E-mail lembrado é gerenciado pelo servidor via cookie HttpOnly
    try { localStorage.removeItem(REMEMBER_KEY); } catch(e) {} // limpa dados antigos`,
'remover gravação no localStorage');

// 4d. GET /admin/login lê o cookie e passa para a página
patch('server/admin-routes.ts',
`    const infoEmail = req.query.email ? decodeURIComponent(req.query.email as string) : undefined;
    res.send(loginPage(req.query.error === "1", errorMsg, info, infoEmail));`,
`    const infoEmail = req.query.email ? decodeURIComponent(req.query.email as string) : undefined;
    const rememberedEmail = (req as any).cookies?.["bp_remember_email"] || undefined;
    res.send(loginPage(req.query.error === "1", errorMsg, info, infoEmail, rememberedEmail));`,
'GET login lê cookie de e-mail lembrado');

// 4e. POST /admin/login seta/limpa o cookie HttpOnly de e-mail
patch('server/admin-routes.ts',
`      const token = encodeSession(barber.id, barber.role, maxAge);
      res.setHeader("Set-Cookie", \`\${ADMIN_SESSION_COOKIE}=\${token}; Path=/; HttpOnly; SameSite=Lax\${SECURE_COOKIE}; Max-Age=\${maxAge}\`);`,
`      const token = encodeSession(barber.id, barber.role, maxAge);
      const rememberCookie = rememberMe
        ? \`bp_remember_email=\${encodeURIComponent(email)}; Path=/admin; HttpOnly; SameSite=Lax\${SECURE_COOKIE}; Max-Age=\${90*24*3600}\`
        : \`bp_remember_email=; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=0\`;
      res.setHeader("Set-Cookie", [
        \`\${ADMIN_SESSION_COOKIE}=\${token}; Path=/; HttpOnly; SameSite=Lax\${SECURE_COOKIE}; Max-Age=\${maxAge}\`,
        rememberCookie,
      ]);`,
'POST login gerencia cookie de e-mail');

// ═══════════════════════════════════════════════════════════════════════════
// ITEM 2 do vídeo: source maps não expostos no build web
// ═══════════════════════════════════════════════════════════════════════════
if (fs.existsSync('app-server.cjs')) {
  let c = fs.readFileSync('app-server.cjs').toString('utf8');
  if (!c.includes('.map')) {
    // Bloquear servir arquivos .map em produção
    c = c.replace(
      /(const\s+server\s*=\s*http\.createServer\(\s*(?:async\s*)?\(\s*req\s*,\s*res\s*\)\s*=>\s*\{)/,
      '$1\n  if (req.url && req.url.split("?")[0].endsWith(".map")) { res.writeHead(404); res.end(); return; }'
    );
    fs.writeFileSync('app-server.cjs', c, 'utf8');
    console.log('OK: app-server bloqueia .map'); ok++;
  } else console.log('SKIP: app-server já trata .map');
} else console.log('INFO: app-server.cjs não está neste repo (serviço separado) — bloquear .map lá também');

console.log('\\nResultado: ' + ok + ' aplicados, ' + miss + ' não encontrados');
