import { useBarberAuth } from "@/lib/auth-context";

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
