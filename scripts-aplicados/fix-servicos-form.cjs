const fs = require('fs');
let content = fs.readFileSync('server/admin-routes.ts').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// 1. Duração — step=5 → step=1
rep(
  `<input class="form-input" type="number" name="durationMinutes" min="1" step="5" value="\${editService?.durationMinutes ?? 30}" required />`,
  `<input class="form-input" type="number" name="durationMinutes" min="1" step="1" value="\${editService?.durationMinutes ?? 30}" required />`,
  'duracao step=1'
);

// 2. Máscara de preço — substituir versão antiga pela nova com separador de milhar
rep(
  `        if (type === 'price') {
          // Permite apenas números e vírgula/ponto como decimal
          var cleaned = (raw || '').replace(/[^0-9.,]/g, '');
          // Normalizar: trocar ponto por vírgula e remover duplicatas
          cleaned = cleaned.replace('.', ',').replace(/,(.*),/, function(m, g){ return ',' + g.replace(/,/g,''); });
          // Limitar a 2 casas decimais
          var parts = cleaned.split(',');
          if (parts[1] !== undefined) parts[1] = parts[1].slice(0, 2);
          return parts.join(',');
        }`,
  `        if (type === 'price') {
          var s = (raw || '').replace(/[^0-9.,]/g, '');
          var lastComma = s.lastIndexOf(',');
          var lastDot = s.lastIndexOf('.');
          var decSep = -1;
          if (lastComma > lastDot) decSep = lastComma;
          else if (lastDot > lastComma) decSep = lastDot;
          var intPart, decPart;
          if (decSep !== -1) {
            intPart = s.slice(0, decSep).replace(/[^0-9]/g, '');
            decPart = s.slice(decSep + 1).replace(/[^0-9]/g, '').slice(0, 2);
          } else {
            intPart = s.replace(/[^0-9]/g, '');
            decPart = null;
          }
          if (intPart.length > 9) intPart = intPart.slice(0, 9);
          var intFormatted = intPart.replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
          if (decPart !== null) return intFormatted + ',' + decPart;
          return intFormatted;
        }`,
  'mascara preco'
);

// 3. Normalizar preço no POST antes de salvar
rep(
  `    const { name, description, price, durationMinutes, isActive, mediaBase64, mediaMime } = req.body;
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;`,
  `    const { name, description, durationMinutes, isActive, mediaBase64, mediaMime } = req.body;
    const rawPrice = (req.body.price ?? '').toString().replace(/\\./g, '').replace(',', '.');
    const price = isNaN(parseFloat(rawPrice)) ? '0' : String(parseFloat(rawPrice));
    const editId = req.query.edit ? parseInt(req.query.edit as string) : null;`,
  'normalizar preco POST'
);

fs.writeFileSync('server/admin-routes.ts', content, 'utf8');
console.log('Total: '+c+' mudancas');
