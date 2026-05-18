# Asaas API — Criar Assinatura com Cartão de Crédito

## Endpoint
POST /v3/subscriptions/

## Campos obrigatórios para cartão
- billingType: "CREDIT_CARD"
- creditCard:
  - holderName: string (nome no cartão)
  - number: string (número do cartão)
  - expiryMonth: string (MM)
  - expiryYear: string (YYYY)
  - ccv: string (CVV)
- creditCardHolderInfo:
  - name: string
  - email: string
  - cpfCnpj: string
  - postalCode: string
  - addressNumber: string
  - phone: string
- remoteIp: string (IP do cliente — obrigatório)

## Notas
- DEBIT_CARD não é suportado diretamente em assinaturas recorrentes via API
- Para débito, usar billingType: "UNDEFINED" que habilita débito na fatura
- O cartão é validado na criação mas cobrado apenas no vencimento
- Usar HTTPS obrigatório
- Timeout recomendado: 60s
- billingType permitidos em assinaturas: UNDEFINED, BOLETO, CREDIT_CARD, PIX

## Detecção de bandeira por número
- Visa: começa com 4
- Mastercard: começa com 51-55 ou 2221-2720
- Elo: 4011, 4312, 4389, 4514, 4573, 4576, 5041, 5066, 5090, 6277, 6362, 6363, 6504, 6505, 6516, 6550
- Hipercard: começa com 606282 ou 3841
- Amex: começa com 34 ou 37
- Diners: começa com 300-305, 36, 38
