import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import { runtime } from '@/services/runtime';
import type { PlanId } from '@/types/domain';

export interface BillingProduct {
  productId: string;
  price: number;
  priceString: string;
  currencyCode: string;
}

export interface BillingProducts {
  weekly: BillingProduct | null;
  monthly: BillingProduct | null;
  topUp: BillingProduct | null;
}

let configuredUserId: string | null = null;
let packages = new Map<string, PurchasesPackage>();

function publicProduct(item?: PurchasesPackage): BillingProduct | null {
  if (!item) return null;
  return {
    productId: item.product.identifier,
    price: item.product.price,
    priceString: item.product.priceString,
    currencyCode: item.product.currencyCode,
  };
}

function findPackage(productId: string): PurchasesPackage | undefined {
  return packages.get(productId);
}

async function ensureConfigured(userId: string): Promise<void> {
  if (!runtime.revenueCatApiKey) {
    throw new Error('RevenueCat n’est pas configuré sur cette version de DealUp.');
  }
  if (!(await Purchases.isConfigured())) {
    Purchases.configure({ apiKey: runtime.revenueCatApiKey, appUserID: userId });
    configuredUserId = userId;
    if (__DEV__) await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    return;
  }
  if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  }
}

async function loadPackages(): Promise<BillingProducts> {
  const offering = (await Purchases.getOfferings()).current;
  if (!offering) throw new Error('Aucune offre DealUp n’est disponible pour le moment.');
  packages = new Map(offering.availablePackages.map((item) => [item.product.identifier, item]));
  return {
    weekly: publicProduct(findPackage(runtime.revenueCatWeeklyProductId)),
    monthly: publicProduct(findPackage(runtime.revenueCatMonthlyProductId)),
    topUp: publicProduct(findPackage(runtime.revenueCatTopUpProductId)),
  };
}

function packageForPlan(plan: PlanId): PurchasesPackage {
  const productId = plan === 'weekly' ? runtime.revenueCatWeeklyProductId : runtime.revenueCatMonthlyProductId;
  const item = findPackage(productId);
  if (!item) throw new Error(`La formule ${plan === 'weekly' ? 'Hebdomadaire' : 'Mensuelle'} est indisponible.`);
  return item;
}

export const revenueCat = {
  async initialize(userId: string): Promise<{ products: BillingProducts; customerInfo: CustomerInfo }> {
    await ensureConfigured(userId);
    const [products, customerInfo] = await Promise.all([loadPackages(), Purchases.getCustomerInfo()]);
    return { products, customerInfo };
  },

  async purchasePlan(userId: string, plan: PlanId): Promise<CustomerInfo> {
    await ensureConfigured(userId);
    if (!packages.size) await loadPackages();
    return (await Purchases.purchasePackage(packageForPlan(plan))).customerInfo;
  },

  async purchaseTopUp(userId: string): Promise<CustomerInfo> {
    await ensureConfigured(userId);
    if (!packages.size) await loadPackages();
    const item = findPackage(runtime.revenueCatTopUpProductId);
    if (!item) throw new Error('Le pack de 10 analyses est indisponible.');
    return (await Purchases.purchasePackage(item)).customerInfo;
  },

  async restore(userId: string): Promise<CustomerInfo> {
    await ensureConfigured(userId);
    return Purchases.restorePurchases();
  },

  hasActiveEntitlement(customerInfo: CustomerInfo): boolean {
    return Boolean(customerInfo.entitlements.active[runtime.revenueCatEntitlementId]);
  },

  async logout(): Promise<void> {
    if (!(await Purchases.isConfigured())) return;
    try {
      await Purchases.logOut();
    } finally {
      configuredUserId = null;
      packages.clear();
    }
  },
};
