const fs = require('fs');
let ok = 0;
function patch(file, old, novo, tag) {
  let c = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (c.includes(old)) { c = c.replace(old, novo); fs.writeFileSync(file, c, 'utf8'); console.log('OK: '+tag); ok++; }
  else console.log('MISS: '+tag);
}

// 1. Import nomeado no topo do admin-routes
patch('server/admin-routes.ts',
`import bcrypt from "bcryptjs";`,
`import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";`,
'import createHmac/timingSafeEqual');

// 2. signSessionPayload usa o import nomeado (não o WebCrypto global)
patch('server/admin-routes.ts',
`function signSessionPayload(payload: string): string {
  return crypto.createHmac("sha256", SESSION_HMAC_SECRET).update(payload).digest("base64url");
}`,
`function signSessionPayload(payload: string): string {
  return createHmac("sha256", SESSION_HMAC_SECRET).update(payload).digest("base64url");
}`,
'signSessionPayload');

// 3. decodeSession usa timingSafeEqual importado
patch('server/admin-routes.ts',
`    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;`,
`    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;`,
'decodeSession timingSafeEqual');

console.log('\\nTotal: ' + ok + '/3');
