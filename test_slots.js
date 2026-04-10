// Simular a lógica de getAvailableSlots
const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMinutes = (m) => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');

// Agendamento existente: 09:00 - 11:00
const busyIntervals = [{ s: toMinutes('09:00'), e: toMinutes('11:00') }];

// Testar slots com durationMinutes=30
const durationMinutes = 30;
const startMin = toMinutes('08:00');
const endMin = toMinutes('20:00');

const slots = [];
let cursor = startMin;
while (cursor + durationMinutes <= endMin) {
  const slotEnd = cursor + durationMinutes;
  const conflict = busyIntervals.some(({ s, e }) => cursor < e && slotEnd > s);
  if (!conflict) {
    slots.push(fromMinutes(cursor) + ' - ' + fromMinutes(slotEnd));
  }
  cursor += 15;
}
console.log('Slots disponíveis (30min):', slots.slice(0, 15).join(', '));
console.log('');
console.log('Verificação: 09:30 deveria estar BLOQUEADO?');
const slot930start = toMinutes('09:30');
const slot930end = toMinutes('10:00');
const blocked = busyIntervals.some(({ s, e }) => slot930start < e && slot930end > s);
console.log('09:30-10:00 bloqueado:', blocked);
