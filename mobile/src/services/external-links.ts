import { Linking } from 'react-native';

export const externalLinks = {
  privacy: 'https://joindealup.com/confidentialite/',
  terms: 'https://joindealup.com/conditions/',
  support: 'https://joindealup.com/support/',
  subscriptions: 'https://apps.apple.com/account/subscriptions',
} as const;

export async function openExternalLink(url: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
