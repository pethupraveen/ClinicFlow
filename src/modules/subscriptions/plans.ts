import seed from "./plans.seed.json";

export const LIMIT_METRICS = ["doctors", "staff_users", "appointments", "conversations"] as const;
export type LimitMetric = (typeof LIMIT_METRICS)[number];

export const BILLING_CYCLES = ["NONE", "MONTHLY", "YEARLY"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export interface Plan {
  code: string;
  name: string;
  isPublic: boolean;
  pricePaise: number;
  currency: string;
  billingCycle: BillingCycle;
  trialDays?: number;
  /** `null` means unlimited. */
  limits: Record<LimitMetric, number | null>;
  features: Record<string, boolean>;
  display: { tagline: string; popular: boolean };
  sortOrder: number;
}

export interface CatalogSettings {
  priceTaxNote: string;
  expiredDataRetentionDays: number;
}

export interface Catalog {
  plans: Plan[];
  settings: CatalogSettings;
}

function fail(message: string): never {
  throw new Error(`Invalid plan catalogue: ${message}`);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Validates raw catalogue data. Runs at module load, so a bad edit to the
 * seed file fails the build instead of rendering wrong prices.
 */
export function parseCatalog(raw: unknown): Catalog {
  if (!raw || typeof raw !== "object") fail("root must be an object");
  const { plans, settings } = raw as { plans?: unknown; settings?: unknown };
  if (!Array.isArray(plans) || plans.length === 0) fail("plans must be a non-empty array");

  const seen = new Set<string>();
  const parsed = plans.map((p, i): Plan => {
    const at = `plans[${i}]`;
    if (!p || typeof p !== "object") fail(`${at} must be an object`);
    const plan = p as Record<string, unknown>;

    if (typeof plan.code !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(plan.code)) fail(`${at}.code must be UPPER_SNAKE`);
    if (seen.has(plan.code)) fail(`duplicate plan code ${plan.code}`);
    seen.add(plan.code);
    if (typeof plan.name !== "string" || !plan.name.trim()) fail(`${at}.name is required`);
    if (typeof plan.isPublic !== "boolean") fail(`${at}.isPublic must be boolean`);
    if (!isNonNegativeInt(plan.pricePaise)) fail(`${at}.pricePaise must be a non-negative integer (paise)`);
    if (typeof plan.currency !== "string" || !/^[A-Z]{3}$/.test(plan.currency)) fail(`${at}.currency must be ISO 4217`);
    if (!BILLING_CYCLES.includes(plan.billingCycle as BillingCycle)) fail(`${at}.billingCycle is invalid`);
    if (plan.trialDays !== undefined && (!isNonNegativeInt(plan.trialDays) || plan.trialDays === 0)) {
      fail(`${at}.trialDays must be a positive integer`);
    }
    if (plan.isPublic && plan.billingCycle === "NONE") fail(`${at} is public but has no billing cycle`);

    const rawLimits = (plan.limits ?? {}) as Record<string, unknown>;
    const limits = {} as Record<LimitMetric, number | null>;
    for (const metric of LIMIT_METRICS) {
      const value = rawLimits[metric];
      if (value !== null && !isNonNegativeInt(value)) fail(`${at}.limits.${metric} must be an integer or null`);
      limits[metric] = value;
    }

    const features = (plan.features ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(features)) {
      if (typeof value !== "boolean") fail(`${at}.features.${key} must be boolean`);
    }

    const display = (plan.display ?? {}) as Record<string, unknown>;
    return {
      code: plan.code,
      name: plan.name,
      isPublic: plan.isPublic,
      pricePaise: plan.pricePaise,
      currency: plan.currency,
      billingCycle: plan.billingCycle as BillingCycle,
      trialDays: plan.trialDays as number | undefined,
      limits,
      features: features as Record<string, boolean>,
      display: {
        tagline: typeof display.tagline === "string" ? display.tagline : "",
        popular: display.popular === true,
      },
      sortOrder: isNonNegativeInt(plan.sortOrder) ? plan.sortOrder : 0,
    };
  });

  const trialPlans = parsed.filter((p) => p.trialDays !== undefined);
  if (trialPlans.length !== 1) fail("exactly one plan must define trialDays");

  const s = (settings ?? {}) as Record<string, unknown>;
  if (typeof s.priceTaxNote !== "string") fail("settings.priceTaxNote must be a string");
  if (!isNonNegativeInt(s.expiredDataRetentionDays)) fail("settings.expiredDataRetentionDays must be an integer");

  return {
    plans: parsed.sort((a, b) => a.sortOrder - b.sortOrder),
    settings: { priceTaxNote: s.priceTaxNote, expiredDataRetentionDays: s.expiredDataRetentionDays },
  };
}

const catalog = parseCatalog(seed);

export function getPublicPlans(): Plan[] {
  return catalog.plans.filter((p) => p.isPublic);
}

export function getTrialPlan(): Plan & { trialDays: number } {
  return catalog.plans.find((p) => p.trialDays !== undefined) as Plan & { trialDays: number };
}

export function getCatalogSettings(): CatalogSettings {
  return catalog.settings;
}

/** ₹1,499 — whole rupees only when there are no paise. */
export function formatPrice(pricePaise: number, currency: string): string {
  const amount = pricePaise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function billingCycleLabel(cycle: BillingCycle): string {
  return cycle === "YEARLY" ? "year" : cycle === "MONTHLY" ? "month" : "";
}
