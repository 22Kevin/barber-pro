# Incidentes — Registro

Histórico de bugs reais que afetaram clientes em produção, causa raiz e correção aplicada.
Objetivo: manter memória do que já quebrou e por quê, pra não repetir o mesmo erro de outra forma.

---

## 2026-08-04 — Cliente travado no cadastro ("Este email já está cadastrado")

**Cliente afetado:** Jhony Oliveira (jhonyoliveiralima@gmail.com), tentando cadastrar barbearia nova, e-mail nunca usado antes.

**Sintoma:** ao finalizar o cadastro, viu o erro "Este email já está cadastrado" — mesmo sendo um e-mail genuinamente novo. Ficou sem conseguir completar nem recomeçar o cadastro.

**Causa raiz (confirmada pelo próprio cliente):** ele digitou um horário de funcionamento num formato que o sistema não aceitava. Os campos de horário (abertura, fechamento, início/fim do almoço) eram `<input type="text">` com uma máscara em JavaScript (`maskTime`) que só removia caracteres não numéricos e inseria `:` — sem validar o intervalo (deixaria passar `99:99`) nem garantir 2 dígitos completos em cada parte. Isso ia direto pro banco como uma coluna `TIME` do PostgreSQL, que rejeitou o valor.

**Por que isso travou a conta pela metade:** a mutation de cadastro (`onboarding.register`) cria tudo numa sequência (tenant → configurações da loja → barbeiro admin → horários de trabalho). Quando a etapa de horários falhou, as etapas anteriores **já tinham sido gravadas no banco com sucesso** — sobrou um barbeiro cadastrado, mas sem horários. Toda nova tentativa de cadastro com o mesmo e-mail batia na checagem de e-mail duplicado (correta, tecnicamente, mas confusa pro cliente, que não sabia que já tinha uma conta pela metade).

**Correção aplicada (3 partes):**
1. **Seletor nativo de horário** — trocado `<input type="text">` + máscara customizada por `<input type="time">` nativo do navegador, nos 4 campos de horário, nos 4 arquivos de cadastro (`index.html`, `pagamentos.html`, `sistema.html`, `assinaturas.html`). Elimina completamente a possibilidade de formato inválido.
2. **Validação no servidor** — adicionada regex (`HH:MM`) no schema Zod de `onboarding.register`, como segunda camada de defesa (protege mesmo se alguém acessar a API diretamente ou tiver uma versão antiga da página em cache).
3. **Rollback automático** — se qualquer etapa da criação da barbearia falhar no meio do caminho (por esse motivo ou qualquer outro), o sistema agora desfaz automaticamente tudo que já tinha sido criado, permitindo que o cliente tente de novo do zero sem ficar com uma conta pela metade.

**Correção adicional relacionada (mesma investigação):** também descoberto e corrigido que o botão final de cadastro não tinha proteção contra clique duplicado — em conexão instável ou toque duplo, duas requisições podiam disparar quase juntas, causando o mesmo tipo de confusão mesmo sem erro de horário envolvido. Adicionada trava (`window._submittingRegistration`) nos mesmos 4 arquivos.

**Correção manual pro cliente:** inseridos manualmente os horários de trabalho corretos (terça a sexta 8h30-19h, sábado 7h30-14h) direto no banco, via `psql`, depois de confirmar que o resto da conta (tenant, configurações, barbeiro) estava íntegro.

**Commits relacionados:**
- `fix: proteger cadastro contra envio duplicado`
- `fix: desfazer cadastro parcial se qualquer etapa falhar no meio do caminho`
- `fix: seletor nativo de horario no cadastro + validacao no servidor`
