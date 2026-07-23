# Pendências de segurança (npm audit)

Última auditoria: 23/07/2026. Rodar `npm audit` periodicamente pra ver se a lista mudou.

## ✅ Resolvido

### nodemailer (HIGH) — corrigido em 23/07/2026
- **CVE:** opção `raw` permite contornar `disableFileAccess`/`disableUrlAccess`, possibilitando leitura arbitrária de arquivo e SSRF.
- **Ação:** atualizado `^8.0.1` → `^9.0.3`.
- **Verificado antes de corrigir:** `server/email.ts` nunca usa a opção `raw`, só `createTransport()` + `sendMail()` com `from/to/subject/html` (API básica, testada localmente como idêntica na v9).

---

## 🕒 Pendente — requer sessão dedicada

### drizzle-orm (HIGH) — NÃO MEXER SEM TEMPO RESERVADO PRA TESTAR
- **CVE:** SQL injection via identificadores SQL mal escapados.
- **Versão atual:** `^0.44.7` | **Versão corrigida:** `0.45.2`
- **Por que não corrigir "de passagem":** o Drizzle é usado em *todas* as queries do projeto inteiro (`db.ts`, `routers.ts`, `admin-routes.ts`, migrações). A atualização é marcada como possível breaking change. Uma regressão aqui pode quebrar qualquer parte do sistema, de forma sutil.
- **Quando fizer:** reservar uma sessão só pra isso — atualizar, depois testar manualmente as áreas mais críticas (login, agendamentos, pagamentos, relatórios financeiros) antes de dar deploy.

---

## ℹ️ Sem risco real — ferramentas de build/dev (não rodam em produção)

Essas aparecem no `npm audit` mas **não afetam o app publicado nem o servidor rodando** — só existem durante `npm install` / `expo start` / `gradlew build` na sua máquina. Investigado em detalhe em 23/07/2026 — nenhuma vale correção isolada agora:

- **`@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/prebuild-config`, `expo`, `expo-asset`, `expo-auth-session`, `expo-constants`, `expo-linking`, `expo-notifications`, `expo-router`, `expo-splash-screen`, `postcss`, `uuid`, `xcode`** — **todas** essas exigem atualizar `expo` de `54.0.29` pra `57.0.8` (3 versões inteiras de SDK à frente). Não é correção pontual, é uma migração completa do app — depois de todo o trabalho pra estabilizar o ambiente de build do SDK 54 (ninja, babel-preset-expo, assinatura), forçar isso agora tem alto risco de reabrir os mesmos problemas em escala maior. **Fica pra quando o Expo SDK 57 estiver maduro e for uma decisão deliberada de upgrade, não uma correção reativa de segurança.**
- **`drizzle-kit`** — a correção sugerida pelo `npm audit` é na verdade um **downgrade** (`0.31.8` → `0.18.1`). Investigado: o `drizzle-kit` só é referenciado no script `db:push`, que **não é usado no fluxo real do projeto** (as migrações de verdade passam por `server/auto-migrate.ts`). Risco prático: zero.
- **`@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `esbuild`, `@vitest/mocker`, `vite`, `vite-node`, `vitest`, `@expo/ngrok`** — dependências transitivas de ferramentas de teste/build, nunca rodam em produção.

**Reavaliar:** só faz sentido revisitar essa lista inteira quando decidir fazer uma migração de SDK do Expo por outros motivos (novos recursos, fim do suporte à versão atual) — nesse momento, a atualização de segurança vem "de brinde" junto com a migração maior, testada com calma.

---

## Como reavaliar essa lista no futuro

```
npm audit --json > /tmp/audit.json
```

Focar só em pacotes com `"isDirect": true` E que aparecem em `dependencies` (não `devDependencies`) no `package.json` — esses são os únicos com chance real de rodar em produção.
