# Tutorial: Configurar Webhook IPN do Mercado Pago

**O que é o Webhook IPN?**

O IPN (Instant Payment Notification) é o mecanismo pelo qual o Mercado Pago notifica automaticamente o seu servidor quando um pagamento é aprovado, recusado ou cancelado. Sem essa configuração, o app não saberá quando um pagamento Pix ou cartão foi confirmado — o agendamento ficará como "pendente" para sempre.

---

## Pré-requisito: URL pública do servidor

O webhook só funciona com uma URL pública (HTTPS). Após publicar o Barber Pro, você terá uma URL do tipo:

```
https://seu-dominio.manus.space/api/mp/webhook
```

> **Importante:** durante o desenvolvimento local, o webhook não funcionará porque o servidor roda em `localhost`. Configure-o apenas após publicar o app.

---

## Passo a Passo

### 1. Acesse o Portal de Desenvolvedores

Acesse [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers) e faça login com sua conta.

### 2. Vá em "Suas integrações"

No menu lateral, clique em **"Suas integrações"** → selecione a aplicação do Barber Pro (ou crie uma nova se ainda não existir).

### 3. Acesse a seção "Webhooks"

Dentro da aplicação, clique na aba **"Webhooks"** no menu superior.

### 4. Configure a URL de notificação

Clique em **"Configurar notificações"** e preencha:

| Campo | Valor |
|---|---|
| **URL de produção** | `https://seu-dominio.manus.space/api/mp/webhook` |
| **Eventos** | Marque: `Pagamentos` (payment) |

### 5. Salve e teste

Clique em **"Salvar"**. O Mercado Pago enviará uma notificação de teste para a URL configurada. Se o servidor responder com `200 OK`, a configuração está correta.

---

## Como verificar se está funcionando

Após um pagamento ser aprovado, acesse o painel admin do Barber Pro → **Financeiro** e verifique se o status da venda mudou de "Pendente" para "Pago". Se sim, o webhook está funcionando corretamente.

---

## Solução de problemas

| Problema | Solução |
|---|---|
| Status continua "Pendente" | Verifique se a URL do webhook está correta e acessível publicamente |
| Erro 404 no webhook | Confirme que o servidor está rodando e a rota `/api/mp/webhook` existe |
| Erro 500 no webhook | Verifique os logs do servidor para identificar o erro |
| Notificações duplicadas | Normal — o MP reenvia até receber `200 OK`. O servidor já trata isso com idempotência |

---

## URL do webhook no código

O webhook já está implementado no arquivo `server/mp-routes.ts`. Quando o pagamento for aprovado, o servidor:

1. Recebe a notificação do Mercado Pago
2. Consulta o status do pagamento via API
3. Atualiza o status da venda para `paid`
4. Atualiza o status do agendamento para `confirmed`

Nenhuma alteração de código é necessária — apenas configure a URL no painel do Mercado Pago após publicar o app.
