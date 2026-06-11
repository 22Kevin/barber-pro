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
// 1. ANTI-DoS: limite do body 50mb → 25mb + middleware CSRF (Origin check)
//    Inserido ANTES do express.json para barrar cedo
// ═══════════════════════════════════════════════════════════════════════════
patch('server/_core/index.ts',
`  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));`,
`  // ── Proteção CSRF: verificação de Origin em requisições que alteram estado ──
  // Browsers sempre enviam Origin em POST cross-site; apps nativos/webhooks não
  // enviam Origin (passam direto — protegidos por token próprio e SameSite).
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const origin = req.headers.origin;
    if (!origin) return next(); // mobile app, webhooks Asaas, curl — sem Origin
    try {
      const originHost = new URL(origin).host;
      if (originHost === req.headers.host || CORS_ALLOWED.has(origin)) return next();
    } catch {}
    console.warn("[csrf] Bloqueado POST de origem não autorizada:", origin, req.path);
    res.status(403).json({ error: "Origem não autorizada" });
  });

  // Limite reduzido (era 50mb — convite a DoS). Uploads validados individualmente.
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));`,
'CSRF origin-check + body limit 25mb');

// ═══════════════════════════════════════════════════════════════════════════
// 2. CSP + HSTS nos headers de segurança (complementa o passo 3)
// ═══════════════════════════════════════════════════════════════════════════
patch('server/_core/index.ts',
`    res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");`,
`    res.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    // CSP: 'unsafe-inline' necessário (painel usa scripts inline); ainda protege
    // contra object/embed, base hijack e clickjacking via frame-ancestors
    res.header("Content-Security-Policy",
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://accounts.google.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https:; " +
      "media-src 'self' blob: https:; " +
      "connect-src 'self' https://accounts.google.com; " +
      "frame-src https://accounts.google.com; " +
      "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'");
    if (process.env.NODE_ENV === "production") {
      res.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }`,
'CSP + HSTS');

// ═══════════════════════════════════════════════════════════════════════════
// 3. VALIDAÇÃO DE UPLOADS: helper + aplicar em todos os pontos
// ═══════════════════════════════════════════════════════════════════════════
patch('server/admin-routes.ts',
`const ADMIN_SESSION_COOKIE = "bp_admin_session";`,
`// ─── Validação de uploads base64 (mime allowlist + limite de tamanho) ─────────
const UPLOAD_IMAGE_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const UPLOAD_VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const UPLOAD_MAX_IMAGE = 5 * 1024 * 1024;   // 5 MB
const UPLOAD_MAX_VIDEO = 20 * 1024 * 1024;  // 20 MB
function assertValidUpload(b64: string, mime: string, kind: "image" | "media"): Buffer {
  const m = (mime || "").toLowerCase().trim();
  const isImage = UPLOAD_IMAGE_MIMES.has(m);
  const isVideo = kind === "media" && UPLOAD_VIDEO_MIMES.has(m);
  if (!isImage && !isVideo) throw new Error("Tipo de arquivo não permitido: " + m);
  const buf = Buffer.from(b64, "base64");
  const max = isVideo ? UPLOAD_MAX_VIDEO : UPLOAD_MAX_IMAGE;
  if (buf.length > max) throw new Error("Arquivo excede o limite de " + Math.round(max / 1024 / 1024) + "MB");
  if (buf.length < 50) throw new Error("Arquivo inválido ou vazio");
  return buf;
}

const ADMIN_SESSION_COOKIE = "bp_admin_session";`,
'helper assertValidUpload');

// Logo
patch('server/admin-routes.ts',
`          const buf = Buffer.from(logoBase64, "base64");`,
`          const buf = assertValidUpload(logoBase64, logoMime, "image");`,
'validação logo');

// Banner
patch('server/admin-routes.ts',
`          const buf = Buffer.from(bannerBase64, "base64");`,
`          const buf = assertValidUpload(bannerBase64, bannerMime, "image");`,
'validação banner');

// Galeria (reordenar: mime antes do buffer)
patch('server/admin-routes.ts',
`            const buf = Buffer.from(base64Arr[i], "base64");
            const mime = mimeArr[i] || "image/jpeg";`,
`            const mime = mimeArr[i] || "image/jpeg";
            const buf = assertValidUpload(base64Arr[i], mime, "image");`,
'validação galeria');

// SEO image
patch('server/admin-routes.ts',
`          const buf = Buffer.from(seoImageBase64, "base64");`,
`          const buf = assertValidUpload(seoImageBase64, seoImageMime, "image");`,
'validação seo image');

// Mídia de serviços e produtos (2 ocorrências — aceita vídeo)
patch('server/admin-routes.ts',
`        const buffer = Buffer.from(mediaBase64, "base64");`,
`        const buffer = assertValidUpload(mediaBase64, mediaMime, "media");`,
'validação mídia serviço/produto', true);

// ═══════════════════════════════════════════════════════════════════════════
// 4. Foto do cliente (public-routes): mime allowlist + 5MB + path seguro
//    (antes: ext vinha de mimeType.split("/")[1] — injeção de caminho)
// ═══════════════════════════════════════════════════════════════════════════
patch('server/public-routes.ts',
`      const { storagePut } = await import("./storage");
      const ext = mimeType.split("/")[1] || "jpg";
      const key = \`barber-pro/clients/photo-\${clientId}-\${Date.now()}.\${ext}\`;
      const buffer = Buffer.from(fileBase64, "base64");`,
`      const { storagePut } = await import("./storage");
      const PHOTO_MIMES: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp" };
      const mt = String(mimeType).toLowerCase().trim();
      const ext = PHOTO_MIMES[mt];
      if (!ext) { res.status(400).json({ error: "Tipo de imagem não permitido" }); return; }
      const buffer = Buffer.from(fileBase64, "base64");
      if (buffer.length > 5 * 1024 * 1024) { res.status(400).json({ error: "Imagem excede o limite de 5MB" }); return; }
      if (buffer.length < 50) { res.status(400).json({ error: "Imagem inválida" }); return; }
      const key = \`barber-pro/clients/photo-\${Number(clientId)}-\${Date.now()}.\${ext}\`;`,
'validação foto cliente + path seguro');

console.log('\\nResultado: ' + ok + ' aplicados, ' + miss + ' não encontrados');
