import * as SecureStore from 'expo-secure-store';
import * as StoreReview from 'expo-store-review';
import { Linking } from 'react-native';

import { runtime } from '@/services/runtime';

export type ReviewMilestone = 'first_identification' | 'first_premium_analysis';

const REVIEW_REQUESTED_KEYS: Record<ReviewMilestone, string> = {
  first_identification: 'dealup.review-requested.first-identification',
  first_premium_analysis: 'dealup.review-requested.first-premium-analysis',
};

export type ReviewActionResult = 'requested' | 'already_requested' | 'unavailable';

const pendingAutomaticRequests = new Map<ReviewMilestone, Promise<ReviewActionResult>>();

async function requestOnce(milestone: ReviewMilestone): Promise<ReviewActionResult> {
  const storageKey = REVIEW_REQUESTED_KEYS[milestone];
  if (await SecureStore.getItemAsync(storageKey)) return 'already_requested';
  if (!(await StoreReview.isAvailableAsync())) return 'unavailable';

  // Persist before presenting so a milestone can never trigger twice locally.
  await SecureStore.setItemAsync(storageKey, new Date().toISOString());
  try {
    await StoreReview.requestReview();
    return 'requested';
  } catch {
    return 'unavailable';
  }
}

export function requestInAppReviewForMilestone(milestone: ReviewMilestone): Promise<ReviewActionResult> {
  const pending = pendingAutomaticRequests.get(milestone);
  if (pending) return pending;
  const request = requestOnce(milestone).finally(() => {
    pendingAutomaticRequests.delete(milestone);
  });
  pendingAutomaticRequests.set(milestone, request);
  return request;
}

export async function resetInAppReviewRequestForDevelopment(): Promise<void> {
  if (!runtime.devTools) return;
  await Promise.all(Object.values(REVIEW_REQUESTED_KEYS).map((key) => SecureStore.deleteItemAsync(key)));
}

export async function openAppStoreReview(): Promise<ReviewActionResult> {
  const configuredUrl = runtime.appStoreUrl.trim();
  const storeUrl = configuredUrl || StoreReview.storeUrl();
  if (storeUrl) {
    const separator = storeUrl.includes('?') ? '&' : '?';
    try {
      await Linking.openURL(`${storeUrl}${separator}action=write-review`);
      return 'requested';
    } catch {
      return 'unavailable';
    }
  }
  if (!(await StoreReview.isAvailableAsync())) return 'unavailable';
  try {
    await StoreReview.requestReview();
    return 'requested';
  } catch {
    return 'unavailable';
  }
}
