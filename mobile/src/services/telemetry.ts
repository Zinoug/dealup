import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

import { runtime } from '@/services/runtime';

type Properties = Record<string, boolean | number | string | null>;

const posthog = runtime.posthogApiKey
  ? new PostHog(runtime.posthogApiKey, {
      host: runtime.posthogHost,
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
    })
  : null;

export const telemetry = {
  capture(event: string, properties?: Properties) {
    posthog?.capture(event, properties);
    if (__DEV__ && !posthog) console.info(`[DealUp event] ${event}`, properties ?? {});
  },
  screen(name: string) {
    posthog?.screen(name);
    if (__DEV__ && !posthog) console.info(`[DealUp screen] ${name}`);
  },
  identify(userId: string, properties?: Properties) {
    posthog?.identify(userId, properties);
    Sentry.setUser({ id: userId });
  },
  setPersonProperties(properties: Properties) {
    posthog?.setPersonProperties(properties);
  },
  clearPersonProperties() {
    posthog?.unsetPersonProperties([
      'email',
      'auth_provider',
      'plan',
      'subscription_active',
      'quota_limit',
      'quota_used',
      'quota_remaining',
      'topup_remaining',
      'onboarding_completed',
      'account_created_at',
    ]);
  },
  reset() {
    posthog?.reset();
    Sentry.setUser(null);
  },
  error(error: unknown, context?: Record<string, string | number | boolean | null>) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  },
};
