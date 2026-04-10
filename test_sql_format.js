// Testar a comparação SQL com formato HH:MM:SS vs HH:MM
// O banco armazena "09:00:00" mas o código passa "09:30" como parâmetro
// SQL: startTime < endTime AND endTime > startTime
// Onde startTime/endTime do banco = "09:00:00"/"11:00:00"
// E startTime/endTime passados = "09:30"/"10:00"

// Simulação da comparação SQL (lexicográfica)
const appt = { startTime: "09:00:00", endTime: "11:00:00" };
const newSlot = { startTime: "09:30", endTime: "10:00" };

// SQL: appt.startTime < newSlot.endTime AND appt.endTime > newSlot.startTime
const conflict = appt.startTime < newSlot.endTime && appt.endTime > newSlot.startTime;
console.log('Conflito detectado (09:00:00-11:00:00 vs 09:30-10:00):', conflict);

// Agora testar o caso problemático: e se o endTime do banco for "09:30:00"?
const appt2 = { startTime: "09:00:00", endTime: "09:30:00" };
const newSlot2 = { startTime: "09:30", endTime: "10:00" };
const conflict2 = appt2.startTime < newSlot2.endTime && appt2.endTime > newSlot2.startTime;
console.log('Conflito detectado (09:00:00-09:30:00 vs 09:30-10:00):', conflict2);
// "09:30:00" > "09:30" ? → lexicograficamente "09:30:00" > "09:30" porque "0" > "" (string mais longa)
console.log('"09:30:00" > "09:30":', "09:30:00" > "09:30"); // true → conflito detectado

// Caso crítico: e se o endTime do banco for "09:30" (sem segundos)?
const appt3 = { startTime: "09:00", endTime: "09:30" };
const newSlot3 = { startTime: "09:30", endTime: "10:00" };
const conflict3 = appt3.startTime < newSlot3.endTime && appt3.endTime > newSlot3.startTime;
console.log('Conflito detectado (09:00-09:30 vs 09:30-10:00):', conflict3);
// "09:30" > "09:30" → false → SEM conflito (correto! slots adjacentes não conflitam)
