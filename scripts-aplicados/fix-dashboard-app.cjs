const fs = require('fs');
let content = fs.readFileSync('app/admin/(tabs)/dashboard.tsx').toString('utf8').replace(/\r\n/g,'\n');
let c = 0;

function rep(old, novo, tag) {
  if (content.includes(old)) { content = content.replace(old, novo); console.log('OK: '+tag); c++; }
  else console.log('MISS: '+tag);
}

// Adicionar isBarberRole e myBarberId logo após barber
rep(
  `  const { barber, logout } = useBarberAuth();
  const colors = useColors();`,
  `  const { barber, logout } = useBarberAuth();
  const isBarberRole = useIsBarberRole();
  const myBarberId = barber?.id;
  const colors = useColors();`,
  'isBarberRole + myBarberId'
);

// Garantir que o import existe
if (!content.includes('useIsBarberRole')) {
  content = content.replace(
    `import { useBarberAuth } from "@/lib/auth-context";`,
    `import { useBarberAuth } from "@/lib/auth-context";
import { useIsBarberRole } from "@/hooks/usePermission";`
  );
  console.log('OK: import useIsBarberRole');
  c++;
}

fs.writeFileSync('app/admin/(tabs)/dashboard.tsx', content, 'utf8');
console.log('Total: '+c+' mudancas');
