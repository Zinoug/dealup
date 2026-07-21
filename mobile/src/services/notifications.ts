import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const DAILY_REMINDER_KIND = 'dealup_daily_reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
