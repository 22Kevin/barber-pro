import { useBarberAuth } from "@/lib/auth-context";
import { planHasFeature, type FeatureKey } from "@/lib/plan-features";

/**
 * Retorna se o tenant atual tem acesso à feature solicitada.
 *
 * @example
 * const canUseProducts = usePlanFeature("products");
 * if (!canUseProducts) return <UpgradePrompt />;
 */
export function usePlanFeature(feature: FeatureKey): boolean {
  const { barber } = useBarberAuth();
  return planHasFeature(barber?.tenantPlan, feature);
}
