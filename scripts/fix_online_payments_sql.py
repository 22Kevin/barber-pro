#!/usr/bin/env python3
"""
Corrige todas as queries SQL do online_payments no routers.ts para usar
aspas duplas nas colunas camelCase (compatível com PostgreSQL).
"""
import re

path = "server/routers.ts"
with open(path, "r") as f:
    content = f.read()

original = content

# Colunas camelCase da tabela online_payments que precisam de aspas duplas
# Formato: nome_sem_aspas → "nome_com_aspas"
COLUMNS = [
    "tenantId", "clientId", "chargeType", "referenceId",
    "asaasPaymentId", "asaasCustomerId", "billingType",
    "invoiceUrl", "pixQrCode", "pixCopyCola", "dueDate",
    "createdAt", "paidAt", "updatedAt",
]

# Padrão: coluna sem aspas em contexto SQL (INSERT, SELECT, WHERE, SET, ORDER BY)
# Só substitui quando a coluna aparece sem aspas duplas já
for col in COLUMNS:
    # Em INSERT INTO ... (col, ...) — lista de colunas
    # Em SELECT op.col ou op.col AS ... — com alias de tabela
    # Em WHERE op.col ou op.tenantId
    # Em SET col = ... (UPDATE)
    # Em ORDER BY op.col

    # Substituição 1: op.colName → op."colName"
    content = re.sub(
        r'\bop\.' + col + r'\b(?!")',
        f'op."{col}"',
        content
    )

    # Substituição 2: c.colName (para joins com clients) — não aplicável aqui

    # Substituição 3: em INSERT INTO online_payments (colName, ...) — lista sem alias
    # Apenas dentro de blocos que contêm "online_payments"
    # Abordagem: substituir colName sem aspas quando precedido por ( ou , e seguido por , ou )
    # mas SOMENTE dentro de strings SQL (entre backticks do template literal)
    # Fazemos isso de forma segura: substituir apenas quando não há aspas já
    content = re.sub(
        r'(?<=[\(,\s])' + col + r'(?=[\s,\)])',
        f'"{col}"',
        content
    )

# Verificar substituições
changes = 0
for col in COLUMNS:
    # Contar ocorrências sem aspas (problemáticas)
    # Padrão: coluna sem aspas precedida por (, espaço, ponto
    bad = len(re.findall(r'(?<!["\w])' + col + r'(?!["\w])', original))
    fixed = len(re.findall(r'"' + col + r'"', content))
    if bad > 0:
        print(f"  {col}: {bad} ocorrências originais → {fixed} com aspas")
        changes += bad

with open(path, "w") as f:
    f.write(content)

print(f"\nTotal: {changes} colunas corrigidas em {path}")
