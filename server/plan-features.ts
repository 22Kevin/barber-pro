import type { Request, Response, NextFunction } from "express";

// ─── Preços ───────────────────────────────────────────────────────────────────

export const PLAN_PRICING = {
  solo:    { monthly: 49.90, annual: 39.90, annualTotal: 478.80 },
  equipe:  { monthly: 99.90, annual: 79.90, annualTotal: 958.80 },
  estudio: { monthly: 169.90, annual: 135.90, annualTotal: 1630.80 },
} as const;

export type PlanSlug = keyof typeof PLAN_PRICING;

// ─── Limites de barbeiros ─────────────────────────────────────────────────────

export const PLAN_BARBER_LIMITS: Record<PlanSlug, number> = {
  solo:    1,
  equipe:  3,
  estudio: Infinity,
};

// ─── Features por plano ───────────────────────────────────────────────────────

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

export const PLAN_FEATURES: Record<PlanSlug, Set<FeatureKey>> = {
  solo: new Set([]),
  equipe: new Set([
    "products",
    "stock",
    "suppliers",
    "orders",
    "coupons",
    "subscription_plans",
    "reports_full",
  ]),
  estudio: new Set([
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function planHasFeature(plan: string | null | undefined, feature: FeatureKey): boolean {
  if (!plan) return false;
  const slug = plan.toLowerCase() as PlanSlug;
  return PLAN_FEATURES[slug]?.has(feature) ?? false;
}

export function planBarberLimit(plan: string | null | undefined): number {
  if (!plan) return 1;
  const slug = plan.toLowerCase() as PlanSlug;
  return PLAN_BARBER_LIMITS[slug] ?? 1;
}

// ─── HTML de upgrade ──────────────────────────────────────────────────────────

export function upgradePage(feature: FeatureKey): string {
  const featureNames: Record<FeatureKey, string> = {
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

  const name = featureNames[feature] ?? feature;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recurso bloqueado — Barber Pro</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f0f; color: #fff;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px;
    }
    .card {
      background: #1a1a1a; border: 1px solid #333;
      border-radius: 16px; padding: 48px 40px;
      max-width: 480px; width: 100%; text-align: center;
    }
    .lock { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    p { color: #aaa; font-size: 14px; line-height: 1.6; margin-bottom: 32px; }
    a.btn {
      display: inline-block;
      background: linear-gradient(135deg, #c9a227, #e8bc30);
      color: #000; font-weight: 700; font-size: 15px;
      padding: 14px 32px; border-radius: 8px;
      text-decoration: none; transition: opacity .2s;
    }
    a.btn:hover { opacity: .85; }
    .back { margin-top: 16px; }
    .back a { color: #666; font-size: 13px; text-decoration: none; }
    .back a:hover { color: #aaa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="lock">🔒</div>
    <h1>${name}</h1>
    <p>Este recurso não está disponível no seu plano atual.<br>Faça upgrade para desbloquear.</p>
    <a href="/admin/configuracoes?tab=pagamentos" class="btn">Ver planos e fazer upgrade</a>
    <div class="back"><a href="javascript:history.back()">← Voltar</a></div>
  </div>
</body>
</html>`;
}

// ─── Middleware Express ───────────────────────────────────────────────────────

export function requireFeature(feature: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = (req as any).adminSession;
    const plan: string | undefined = session?.plan;
    if (planHasFeature(plan, feature)) {
      return next();
    }
    return res.status(403).send(upgradePage(feature));
  };
}

// ─── Guard tRPC ───────────────────────────────────────────────────────────────

export function assertFeature(plan: string | null | undefined, feature: FeatureKey): void {
  if (!planHasFeature(plan, feature)) {
    throw new Error(`UPGRADE_REQUIRED:${feature}`);
  }
}

export function assertBarberLimit(plan: string | null | undefined, currentCount: number): void {
  const limit = planBarberLimit(plan);
  if (currentCount >= limit) {
    const slug = (plan?.toLowerCase() ?? "solo") as PlanSlug;
    throw new Error(`BARBER_LIMIT_REACHED:${limit}:${slug}`);
  }
}
