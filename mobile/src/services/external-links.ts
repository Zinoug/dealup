import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

export const externalLinks = {
  privacy: 'https://joindealup.com/confidentialite/',
  terms: 'https://joindealup.com/conditions/',
  support: 'https://joindealup.com/support/',
  subscriptions: 'https://apps.apple.com/account/subscriptions',
} as const;

export async function openExternalLink(url: string): Promise<boolean> {
  if (url.startsWith('https://joindealup.com/')) {
    try {
      await WebBrowser.openBrowserAsync(url);
      return true;
    } catch {
      // Fall back to the system URL handler below.
    }
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
