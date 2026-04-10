// Simular o problema de formato HH:MM:SS vs HH:MM
const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMinutes = (m) => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');

// O banco retorna "09:00:00" (HH:MM:SS) mas o código usa "09:00" (HH:MM)
// toMinutes("09:00:00") vs toMinutes("09:00")
console.log('toMinutes("09:00:00"):', toMinutes("09:00:00")); // 540
console.log('toMinutes("09:00"):', toMinutes("09:00"));       // 540
console.log('toMinutes("11:00:00"):', toMinutes("11:00:00")); // 660
console.log('toMinutes("11:00"):', toMinutes("11:00"));       // 660

// Simular busyIntervals com formato HH:MM:SS (como vem do banco)
const busyIntervals = [{ s: toMinutes('09:00:00'), e: toMinutes('11:00:00') }];

// Testar slot 09:30 com formato HH:MM (como o código gera)
const slot930start = toMinutes('09:30');
const slot930end = toMinutes('10:00');
const blocked = busyIntervals.some(({ s, e }) => slot930start < e && slot930end > s);
console.log('\n09:30-10:00 bloqueado (HH:MM:SS vs HH:MM):', blocked);

// Verificar o checkSlotAvailability SQL
// SQL: startTime < endTime AND endTime > startTime
// Se startTime no banco = "09:00:00" e endTime passado = "09:30"
// Comparação de strings: "09:00:00" < "09:30" → true (comparação lexicográfica)
// "11:00:00" > "09:30" → true
// Então conflito = true ✓

// Mas e se endTime no banco = "11:00:00" e startTime passado = "09:30"?
// "09:00:00" < "11:00:00" → true (ok)
// "11:00:00" > "09:30" → true (ok)
// Conflito detectado ✓

console.log('\nComparação lexicográfica SQL:');
console.log('"09:00:00" < "09:30":', "09:00:00" < "09:30"); // true
console.log('"11:00:00" > "09:30":', "11:00:00" > "09:30"); // true
console.log('"09:00:00" < "11:00":', "09:00:00" < "11:00"); // true
console.log('"11:00:00" > "09:00":', "11:00:00" > "09:00"); // true
