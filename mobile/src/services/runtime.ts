import { Platform } from 'react-native';

export const runtime = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '',
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  revenueCatApiKey:
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? ''
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '',
  revenueCatEntitlementId: process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? 'premium',
  revenueCatWeeklyProductId: process.env.EXPO_PUBLIC_REVENUECAT_WEEKLY_PRODUCT_ID ?? 'dealup_premium_weekly',
  revenueCatMonthlyProductId: process.env.EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID ?? 'dealup_premium_monthly',
  revenueCatTopUp15ProductId: process.env.EXPO_PUBLIC_REVENUECAT_TOPUP_15_PRODUCT_ID ?? 'dealup_analysis_topup_15',
  revenueCatTopUp40ProductId: process.env.EXPO_PUBLIC_REVENUECAT_TOPUP_40_PRODUCT_ID ?? 'dealup_analysis_topup_40',
  posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '',
  posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  appStoreUrl: process.env.EXPO_PUBLIC_APP_STORE_URL ?? '',
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
  devTools: __DEV__ && process.env.EXPO_PUBLIC_DEV_TOOLS !== 'false',
};

export function missingRequiredConfiguration(): string[] {
  return [
    !runtime.apiUrl && 'EXPO_PUBLIC_API_URL',
    !runtime.clerkPublishableKey && 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
  ].filter((value): value is string => Boolean(value));
}
