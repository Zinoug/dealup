import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'dealup:daily-reminder-attribution';
const ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DailyReminderAttribution = {
  attribution_source: 'daily_reminder';
  notification_kind: 'dealup_daily_reminder';
  notification_opened_at: string;
};

type StoredAttribution = DailyReminderAttribution & {
  expires_at: string;
};

let currentAttribution: StoredAttribution | null = null;

function isActive(attribution: StoredAttribution | null, now = Date.now()): attribution is StoredAttribution {
  return Boolean(attribution && Date.parse(attribution.expires_at) > now);
}

export async function hydrateNotificationAttribution(): Promise<void> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) as StoredAttribution : null;
    if (isActive(parsed)) {
      currentAttribution = parsed;
      return;
    }
  } catch {
    // A missing or corrupted attribution must never block application startup.
  }
  currentAttribution = null;
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

export async function rememberDailyReminderOpen(openedAt: Date): Promise<DailyReminderAttribution> {
  const attribution: StoredAttribution = {
    attribution_source: 'daily_reminder',
    notification_kind: 'dealup_daily_reminder',
    notification_opened_at: openedAt.toISOString(),
    expires_at: new Date(openedAt.getTime() + ATTRIBUTION_WINDOW_MS).toISOString(),
  };
  currentAttribution = attribution;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  return attribution;
}

export function getDailyReminderAttribution(): DailyReminderAttribution | undefined {
  if (!isActive(currentAttribution)) {
    currentAttribution = null;
    void AsyncStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
  const { attribution_source, notification_kind, notification_opened_at } = currentAttribution;
  return { attribution_source, notification_kind, notification_opened_at };
}

export function clearNotificationAttribution(): void {
  currentAttribution = null;
  void AsyncStorage.removeItem(STORAGE_KEY);
}
