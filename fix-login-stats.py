import re

path = r"server\admin-routes.ts"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    '<div class=\\"brand-stat-value\\">500+</div>',
    '<div class=\\"brand-stat-value\\">14</div>'
)
content = content.replace(
    '<div class=\\"brand-stat-label\\">Barbearias</div>',
    '<div class=\\"brand-stat-label\\">Dias gr\\u00e1tis</div>'
)
content = content.replace(
    '<div class=\\"brand-stat-value\\">98%</div>',
    '<div class=\\"brand-stat-value\\">5min</div>'
)
content = content.replace(
    '<div class=\\"brand-stat-label\\">Satisfa\\u00e7\\u00e3o</div>',
    '<div class=\\"brand-stat-label\\">Para configurar</div>'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Feito! Verifique as linhas com brand-stat no arquivo.")
