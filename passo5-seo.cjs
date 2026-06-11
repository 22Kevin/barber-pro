const fs = require('fs');
let ok = 0, miss = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else { console.log('MISS: '+tag); miss++; }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. robots.txt + sitemap.xml dinâmico (com cache de 1h)
//    Sitemap inclui a página pública de cada barbearia ativa
// ═══════════════════════════════════════════════════════════════════════════
patch('server/_core/index.ts',
`  app.get("/termos", (_req, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(TERMOS_HTML); });`,
`  // ── SEO: robots.txt ──────────────────────────────────────────────────────
  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send([
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /admin-api",
      "Disallow: /superadmin",
      "Disallow: /api/",
      "Disallow: /app",
      "",
      "Sitemap: https://usebarberpro.com/sitemap.xml",
    ].join("\\n"));
  });

  // ── SEO: sitemap.xml dinâmico (estáticas + páginas públicas das barbearias) ──
  let _sitemapCache: { xml: string; ts: number } | null = null;
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      if (!_sitemapCache || Date.now() - _sitemapCache.ts > 3600000) {
        const dbMod: any = await import("../db");
        const tenants: any[] = await dbMod.getAllTenants().catch(() => []);
        const today = new Date().toISOString().split("T")[0];
        const urls: string[] = [];
        urls.push(\`<url><loc>https://usebarberpro.com/</loc><lastmod>\${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\`);
        for (const p of ["/termos", "/privacidade", "/lgpd"]) {
          urls.push(\`<url><loc>https://usebarberpro.com\${p}</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\`);
        }
        for (const t of tenants) {
          if (!t?.slug) continue;
          const st = String(t.status || "").toLowerCase();
          if (st === "cancelled" || st === "expired") continue;
          urls.push(\`<url><loc>https://usebarberpro.com/pub/\${t.slug}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>\`);
        }
        _sitemapCache = {
          xml: '<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.join("") + '</urlset>',
          ts: Date.now(),
        };
      }
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(_sitemapCache.xml);
    } catch {
      res.status(500).send("");
    }
  });

  app.get("/termos", (_req, res) => { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(TERMOS_HTML); });`,
'robots.txt + sitemap.xml');

// ═══════════════════════════════════════════════════════════════════════════
// 2. Landing: canonical + JSON-LD (dados estruturados p/ rich results)
// ═══════════════════════════════════════════════════════════════════════════
patch('server/landing/index.html',
`  <meta name="twitter:card" content="summary_large_image" />`,
`  <meta name="twitter:card" content="summary_large_image" />
  <link rel="canonical" href="https://usebarberpro.com/" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Barber Pro",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web, Android",
    "description": "Sistema completo de gestão para barbearias: agendamento online, controle financeiro, comissões, estoque e clube de assinatura.",
    "url": "https://usebarberpro.com",
    "inLanguage": "pt-BR",
    "offers": {
      "@type": "AggregateOffer",
      "lowPrice": "49.90",
      "highPrice": "169.90",
      "priceCurrency": "BRL",
      "offerCount": "3"
    }
  }
  </script>`,
'canonical + JSON-LD na landing');

console.log('\\nResultado: ' + ok + ' aplicados, ' + miss + ' não encontrados');
