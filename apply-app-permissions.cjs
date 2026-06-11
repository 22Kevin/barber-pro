const fs = require('fs');
let c = 0;

function rep(file, old, novo, tag) {
  let content = fs.readFileSync(file).toString('utf8').replace(/\r\n/g,'\n');
  if (content.includes(old)) {
    content = content.replace(old, novo);
    fs.writeFileSync(file, content, 'utf8');
    console.log('OK: '+tag);
    c++;
  } else {
    console.log('MISS: '+tag);
  }
}

// ── server/routers.ts — permissions nos retornos de login ────────────────────
rep('server/routers.ts',
  `        return { id: barber.id, name: barber.name, email: barber.email, phone: barber.phone, photoUrl: barber.photoUrl, role: barber.role, specialties: barber.specialties, tenantId: barber.tenantId, tenantPlan: tenant?.plan ?? null, token, refreshToken };`,
  `        const _p1 = (barber as any).permissions; let _pp1 = null; try { _pp1 = _p1 ? JSON.parse(_p1) : null; } catch(e) {}
        return { id: barber.id, name: barber.name, email: barber.email, phone: barber.phone, photoUrl: barber.photoUrl, role: barber.role, specialties: barber.specialties, tenantId: barber.tenantId, tenantPlan: tenant?.plan ?? null, permissions: _pp1, token, refreshToken };`,
  'routers auth.login permissions'
);

rep('server/routers.ts',
  `        return { id: barber2.id, name: barber2.name, email: barber2.email, phone: barber2.phone, photoUrl: photoUrl ?? barber2.photoUrl, role: barber2.role, specialties: barber2.specialties, tenantId: barber2.tenantId, tenantPlan: tenant2?.plan ?? null, token, refreshToken };`,
  `        const _p2 = (barber2 as any).permissions; let _pp2 = null; try { _pp2 = _p2 ? JSON.parse(_p2) : null; } catch(e) {}
        return { id: barber2.id, name: barber2.name, email: barber2.email, phone: barber2.phone, photoUrl: photoUrl ?? barber2.photoUrl, role: barber2.role, specialties: barber2.specialties, tenantId: barber2.tenantId, tenantPlan: tenant2?.plan ?? null, permissions: _pp2, token, refreshToken };`,
  'routers googleLogin permissions'
);

rep('server/routers.ts',
  `        return { id: barber.id, name: barber.name, email: barber.email, phone: barber.phone, photoUrl: barber.photoUrl, role: barber.role, specialties: barber.specialties, tenantId: barber.tenantId, tenantPlan: tenantAdmin?.plan ?? null, token, refreshToken };`,
  `        const _pA = (barber as any).permissions; let _ppA = null; try { _ppA = _pA ? JSON.parse(_pA) : null; } catch(e) {}
        return { id: barber.id, name: barber.name, email: barber.email, phone: barber.phone, photoUrl: barber.photoUrl, role: barber.role, specialties: barber.specialties, tenantId: barber.tenantId, tenantPlan: tenantAdmin?.plan ?? null, permissions: _ppA, token, refreshToken };`,
  'routers admin.login permissions'
);

// ── lib/auth-context.tsx — adicionar permissions no AuthBarber ───────────────
rep('lib/auth-context.tsx',
  `  tenantPlan?: TenantPlan | null;\n}`,
  `  tenantPlan?: TenantPlan | null;\n  permissions?: string[] | null;\n}`,
  'AuthBarber permissions field'
);

// ── hooks/usePermission.ts — criar se não existir ────────────────────────────
if (!fs.existsSync('hooks/usePermission.ts')) {
  fs.writeFileSync('hooks/usePermission.ts', `import { useBarberAuth } from "@/lib/auth-context";

export function usePermission(permId: string): boolean {
  const { barber } = useBarberAuth();
  if (!barber) return false;
  if (barber.role === "super_admin") return true;
  if (!barber.permissions) return false;
  return barber.permissions.includes(permId);
}

export function useIsOwner(): boolean {
  const { barber } = useBarberAuth();
  return barber?.role === "super_admin";
}

export function useIsBarberRole(): boolean {
  const { barber } = useBarberAuth();
  return barber?.role === "barber" || barber?.role === "receptionist";
}
`, 'utf8');
  console.log('OK: hooks/usePermission.ts criado');
  c++;
}

// ── app/admin/(tabs)/_layout.tsx — tab financeiro condicional ────────────────
rep('app/admin/(tabs)/_layout.tsx',
  `import { useBarberAuth } from "@/lib/auth-context";`,
  `import { useBarberAuth } from "@/lib/auth-context";
import { useIsOwner, usePermission } from "@/hooks/usePermission";`,
  '_layout import usePermission'
);

rep('app/admin/(tabs)/_layout.tsx',
  `  const { isAuthenticated, isLoading } = useBarberAuth();`,
  `  const { isAuthenticated, isLoading } = useBarberAuth();
  const isOwner = useIsOwner();
  const canFinanceiro = usePermission("financeiro");`,
  '_layout canFinanceiro'
);

rep('app/admin/(tabs)/_layout.tsx',
  `      <Tabs.Screen
        name="financial"
        options={{
          title: "Financeiro",
          tabBarIcon: ({ color }) => <IconSymbol name="dollarsign.circle.fill" size={24} color={color} />,
        }}
      />`,
  `      <Tabs.Screen
        name="financial"
        options={{
          title: "Financeiro",
          tabBarIcon: ({ color }) => <IconSymbol name="dollarsign.circle.fill" size={24} color={color} />,
          tabBarItemStyle: canFinanceiro ? undefined : { display: "none" },
        }}
      />`,
  '_layout financial tab condicional'
);

// ── app/admin/(tabs)/dashboard.tsx — filtrar dados por role ──────────────────
rep('app/admin/(tabs)/dashboard.tsx',
  `import { useBarberAuth } from "@/lib/auth-context";`,
  `import { useBarberAuth } from "@/lib/auth-context";
import { useIsBarberRole } from "@/hooks/usePermission";`,
  'dashboard import useIsBarberRole'
);

rep('app/admin/(tabs)/dashboard.tsx',
  `  const { barber, logout } = useBarberAuth();
  const tenantId = barber?.tenantId ?? undefined;`,
  `  const { barber, logout } = useBarberAuth();
  const isBarberRole = useIsBarberRole();
  const myBarberId = barber?.id;
  const tenantId = barber?.tenantId ?? undefined;`,
  'dashboard isBarberRole'
);

rep('app/admin/(tabs)/dashboard.tsx',
  `  const monthRevenue = useMemo(() => {
    return (monthlySalesQuery.data ?? [])
      .filter((s: any) => s.paymentStatus === "paid")
      .reduce((sum: number, s: any) => sum + parseFloat(s.total || "0"), 0);
  }, [monthlySalesQuery.data]);`,
  `  const monthRevenue = useMemo(() => {
    const sales = monthlySalesQuery.data ?? [];
    const filtered = isBarberRole
      ? sales.filter((s: any) => s.barberId === myBarberId && s.paymentStatus === "paid")
      : sales.filter((s: any) => s.paymentStatus === "paid");
    return filtered.reduce((sum: number, s: any) => sum + parseFloat(s.total || "0"), 0);
  }, [monthlySalesQuery.data, isBarberRole, myBarberId]);`,
  'dashboard monthRevenue por barbeiro'
);

console.log('\nTotal: '+c+' mudancas');
