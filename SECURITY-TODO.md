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

Essas aparecem no `npm audit` mas **não afetam o app publicado nem o servidor rodando** — só existem durante `npm install` / `expo start` / `gradlew build` na sua máquina. Não precisam de ação:

- `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `esbuild` — usados pelo `drizzle-kit` (ferramenta de migração) e por scripts de build
- `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/ngrok`, `@expo/prebuild-config` — ferramentas de linha de comando do Expo (`expo start`, `expo prebuild`), não código que vai pro app publicado
- `drizzle-kit` — CLI de migração, roda só localmente
- `postcss` — processamento de CSS em tempo de build
- `uuid`, `xcode` — dependências internas de ferramentas de build do Expo/iOS
- `vite`, `vite-node`, `vitest`, `@vitest/mocker` — ferramentas de teste, nunca rodam em produção

**Reavaliar:** se algum dia essas dependências forem atualizadas automaticamente via `expo install --fix` ou atualização do SDK Expo, ótimo. Não vale forçar isoladamente — risco de quebrar compatibilidade de versão do SDK por pouco benefício real.

---

## Como reavaliar essa lista no futuro

```
npm audit --json > /tmp/audit.json
```

Focar só em pacotes com `"isDirect": true` E que aparecem em `dependencies` (não `devDependencies`) no `package.json` — esses são os únicos com chance real de rodar em produção.
