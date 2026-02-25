#!/usr/bin/env python3
"""
Patch public-routes.ts:
1. Adiciona botão "Continuar com Google" na renderLoginPage
2. Adiciona rota GET /pub-api/oauth-callback para processar o retorno do Google
"""

path = "/home/ubuntu/barber_app/server/public-routes.ts"
with open(path, "r") as f:
    content = f.read()

# 1. Adicionar botão Google antes do formulário de email/senha
old_form_start = '''      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px">
        <form id="auth-form">'''

new_form_start = '''      <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:28px">
        <!-- Botão Google OAuth -->
        <a href="/pub-api/oauth-start?slug=${slug}&redirect=${redirect}&service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px;background:#fff;color:#1a1a1a;border:1.5px solid #e0e0e0;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
          Continuar com Google
        </a>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div style="flex:1;height:1px;background:var(--border)"></div>
          <span style="font-size:12px;color:var(--muted)">ou</span>
          <div style="flex:1;height:1px;background:var(--border)"></div>
        </div>
        <form id="auth-form">'''

if old_form_start in content:
    content = content.replace(old_form_start, new_form_start, 1)
    print("✅ Botão Google adicionado na renderLoginPage")
else:
    print("❌ Ponto de inserção do botão Google não encontrado")

# 2. Adicionar rotas OAuth público antes do fechamento de registerPublicRoutes
old_closing = '''  // GET /pub/:slug/login
  app.get("/pub/:slug/login", async (req: Request, res: Response) => {'''

new_oauth_routes = '''  // GET /pub-api/oauth-start — inicia o fluxo OAuth Google para clientes públicos
  app.get("/pub-api/oauth-start", (req: Request, res: Response) => {
    const slug = req.query.slug as string;
    const redirect = (req.query.redirect as string) ?? "";
    const service = (req.query.service as string) ?? "";
    const date = (req.query.date as string) ?? "";
    const barber = (req.query.barber as string) ?? "";
    const start = (req.query.start as string) ?? "";
    const end = (req.query.end as string) ?? "";
    const appId = process.env.VITE_APP_ID ?? "";
    const portalUrl = process.env.VITE_OAUTH_PORTAL_URL ?? "https://manus.im";
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? `http://localhost:3000`;
    // Callback URL com parâmetros de contexto codificados no state
    const callbackUrl = `${apiBaseUrl}/pub-api/oauth-callback`;
    const stateData = Buffer.from(JSON.stringify({ slug, redirect, service, date, barber, start, end })).toString("base64");
    const redirectUri = callbackUrl;
    const state = Buffer.from(redirectUri).toString("base64");
    const loginUrl = new URL(`${portalUrl}/app-auth`);
    loginUrl.searchParams.set("appId", appId);
    loginUrl.searchParams.set("redirectUri", redirectUri);
    loginUrl.searchParams.set("state", state);
    loginUrl.searchParams.set("type", "signIn");
    loginUrl.searchParams.set("ctx", stateData);
    res.redirect(loginUrl.toString());
  });

  // GET /pub-api/oauth-callback — processa o retorno do OAuth e cria sessão de cliente público
  app.get("/pub-api/oauth-callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const ctx = req.query.ctx as string;
    if (!code || !state) { res.status(400).send("Parâmetros inválidos"); return; }
    try {
      // Decodificar contexto
      let slug = "", redirect = "", service = "", date = "", barber = "", start = "", end = "";
      if (ctx) {
        try {
          const parsed = JSON.parse(Buffer.from(ctx, "base64").toString());
          slug = parsed.slug ?? ""; redirect = parsed.redirect ?? "";
          service = parsed.service ?? ""; date = parsed.date ?? "";
          barber = parsed.barber ?? ""; start = parsed.start ?? ""; end = parsed.end ?? "";
        } catch {}
      }
      // Trocar code por token via SDK
      const { sdk } = await import("./_core/sdk.js");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.email) { res.status(400).send("E-mail não disponível na conta Google."); return; }
      // Buscar ou criar cliente público para o tenant
      let clientId: number | null = null;
      let clientName = userInfo.name ?? userInfo.email.split("@")[0];
      if (slug) {
        const tenant = await db.getTenantBySlug(slug);
        if (tenant) {
          // Buscar cliente existente pelo e-mail
          const allClients = await db.getAllClients(tenant.id);
          const existing = allClients.find((c: any) => c.email === userInfo.email);
          if (existing) {
            clientId = existing.id;
            clientName = existing.name;
          } else {
            // Criar novo cliente
            clientId = await db.createClient({
              name: clientName,
              email: userInfo.email,
              tenantId: tenant.id,
              isActive: true,
            } as any);
          }
        }
      }
      // Criar sessão de cliente público
      const sessionData = { id: clientId, name: clientName, email: userInfo.email };
      const sessionCookie = Buffer.from(JSON.stringify(sessionData)).toString("base64");
      const cookieKey = slug ? `client_session_${slug}` : "client_session";
      res.cookie(cookieKey, sessionCookie, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: "lax" });
      // Redirecionar de volta
      const qs = `?service=${service}&date=${date}&barber=${barber}&start=${start}&end=${end}`;
      const target = redirect ? `/pub/${slug}/${redirect}${qs}` : `/pub/${slug}`;
      res.redirect(target);
    } catch (e: any) {
      console.error("[OAuth Público] Erro:", e);
      res.status(500).send("Erro ao processar login com Google. Tente novamente.");
    }
  });

  // GET /pub/:slug/login
  app.get("/pub/:slug/login", async (req: Request, res: Response) => {'''

if old_closing in content:
    content = content.replace(old_closing, new_oauth_routes, 1)
    print("✅ Rotas OAuth público adicionadas")
else:
    print("❌ Ponto de inserção das rotas OAuth não encontrado")

with open(path, "w") as f:
    f.write(content)

print("✅ Patch aplicado com sucesso")
