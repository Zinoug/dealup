import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { dealupApi } from '@/services/dealup-api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function enableAnalysisNotifications(): Promise<'enabled' | 'denied' | 'unavailable'> {
  if (Platform.OS !== 'ios' || !Device.isDevice) return 'unavailable';

  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  if (!permission.granted) return 'denied';

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return 'unavailable';

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await dealupApi.registerDevice(token.data);
  return 'enabled';
}
