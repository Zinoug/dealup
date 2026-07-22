import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { hydrateNotificationAttribution, rememberDailyReminderOpen } from '@/services/notification-attribution';
import { telemetry } from '@/services/telemetry';

const DAILY_REMINDER_KIND = 'dealup_daily_reminder';
let lastHandledResponseKey: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function trackNotificationResponse(response: Notifications.NotificationResponse | null): Promise<void> {
  if (!response || response.notification.request.content.data?.kind !== DAILY_REMINDER_KIND) return;

  const notificationDate = response.notification.date;
  const responseKey = `${response.notification.request.identifier}:${notificationDate}:${response.actionIdentifier}`;
  if (lastHandledResponseKey === responseKey) return;
  lastHandledResponseKey = responseKey;

  const openedAt = new Date();
  const attribution = await rememberDailyReminderOpen(openedAt);
  telemetry.capture('notification_opened', attribution);
  await Notifications.clearLastNotificationResponseAsync();
}

export async function initializeNotificationTracking(): Promise<() => void> {
  await hydrateNotificationAttribution();
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void trackNotificationResponse(response).catch((reason) => {
      telemetry.error(reason, { operation: 'track_notification_opened' });
    });
  });
  await trackNotificationResponse(await Notifications.getLastNotificationResponseAsync());
  return () => subscription.remove();
}

async function replaceDailyReminder(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === DAILY_REMINDER_KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Une annonce en vue ?',
      body: 'Vérifie-la avec DealUp avant de te décider.',
      data: { kind: DAILY_REMINDER_KIND },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18,
      minute: 30,
    },
  });
}

export async function ensureDailyReminderIfAuthorized(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.some((item) => item.content.data?.kind === DAILY_REMINDER_KIND)) return;
  await replaceDailyReminder();
}

export async function enableDailyReminder(): Promise<'enabled' | 'denied' | 'unavailable'> {
  if (Platform.OS !== 'ios') return 'unavailable';

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted || !current.canAskAgain
    ? current
    : await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
  if (!permission.granted) return 'denied';

  await replaceDailyReminder();
  return 'enabled';
}
