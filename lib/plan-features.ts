/**
 * plan-features.ts (mobile)
 * Espelho do server/plan-features.ts — mantê-los sincronizados.
 * Slugs do banco: solo | team | studio
 */

export type TenantPlan = "solo" | "team" | "studio";

export type FeatureKey =
  | "products"
  | "stock"
  | "suppliers"
  | "orders"
  | "coupons"
  | "subscription_plans"
  | "commissions"
  | "orbit"
  | "reports_full"
  | "priority_support";

// ─── Preços ───────────────────────────────────────────────────────────────────

export const PLAN_PRICING: Record<TenantPlan, { monthly: number; annual: number; label: string }> = {
  solo:   { monthly: 49.90,  annual: 39.90,  label: "Solo"    },
  team:   { monthly: 99.90,  annual: 79.90,  label: "Equipe"  },
  studio: { monthly: 169.90, annual: 135.90, label: "Estúdio" },
};

// ─── Limites de barbeiros ─────────────────────────────────────────────────────

export const PLAN_BARBER_LIMITS: Record<TenantPlan, number> = {
  solo:   1,
  team:   3,
  studio: Infinity,
};

// ─── Features por plano ───────────────────────────────────────────────────────

export const PLAN_FEATURES: Record<TenantPlan, Set<FeatureKey>> = {
  solo: new Set([]),
  team: new Set([
    "products",
    "stock",
    "suppliers",
    "orders",
    "coupons",
    "subscription_plans",
    "reports_full",
  ]),
  studio: new Set([
    "products",
    "stock",
    "suppliers",
    "orders",
    "coupons",
    "subscription_plans",
    "reports_full",
    "commissions",
    "orbit",
    "priority_support",
  ]),
};

// ─── Labels de features para exibição ────────────────────────────────────────

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  products:           "Produtos",
  stock:              "Estoque",
  suppliers:          "Fornecedores",
  orders:             "Encomendas",
  coupons:            "Cupons",
  subscription_plans: "Planos de Assinatura",
  commissions:        "Comissões Automáticas",
  orbit:              "Radar de Leads (Órbita)",
  reports_full:       "Relatórios Completos",
  priority_support:   "Suporte Prioritário",
};

// ─── Qual plano desbloqueia a feature ─────────────────────────────────────────

export const FEATURE_REQUIRED_PLAN: Record<FeatureKey, TenantPlan> = {
  products:           "team",
  stock:              "team",
  suppliers:          "team",
  orders:             "team",
  coupons:            "team",
  subscription_plans: "team",
  reports_full:       "team",
  commissions:        "studio",
  orbit:              "studio",
  priority_support:   "studio",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function planHasFeature(plan: TenantPlan | null | undefined, feature: FeatureKey): boolean {
  if (!plan) return false;
  return PLAN_FEATURES[plan]?.has(feature) ?? false;
}

export function planBarberLimit(plan: TenantPlan | null | undefined): number {
  if (!plan) return 1;
  return PLAN_BARBER_LIMITS[plan] ?? 1;
}
