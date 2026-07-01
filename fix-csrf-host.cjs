const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

patch('server/_core/index.ts',
  `  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const origin = req.headers.origin;
    if (!origin) return next(); // mobile app, webhooks Asaas, curl — sem Origin
    try {
      const originHost = new URL(origin).host;
      if (originHost === req.headers.host || CORS_ALLOWED.has(origin)) return next();
    } catch {}
    console.warn("[csrf] Bloqueado POST de origem não autorizada:", origin, req.path);
    res.status(403).json({ error: "Origem não autorizada" });
  });`,
  `  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const origin = req.headers.origin;
    if (!origin) return next(); // mobile app, webhooks Asaas, curl — sem Origin
    try {
      const originHost = new URL(origin).host.replace(/:443$|:80$/, "");
      const reqHost = (req.headers.host || "").replace(/:443$|:80$/, "");
      // Permitir: mesmo host, domínio configurado, ou subdomínio do mesmo domínio
      const PROD_DOMAIN = "usebarberpro.com";
      const sameHost = originHost === reqHost;
      const allowedOrigin = CORS_ALLOWED.has(origin);
      const sameDomain = originHost === PROD_DOMAIN || originHost.endsWith("." + PROD_DOMAIN);
      if (sameHost || allowedOrigin || sameDomain) return next();
    } catch {}
    console.warn("[csrf] Bloqueado POST de origem não autorizada:", origin, req.path);
    res.status(403).json({ error: "Origem não autorizada" });
  });`,
  'CSRF host comparison robusta'
);

console.log('\nTotal: ' + ok + '/1');
