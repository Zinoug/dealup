import { DarkTheme, ThemeProvider } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS } from 'react-native';

import { colors } from '@/theme/tokens';

const adaptiveLabel = DynamicColorIOS({ dark: '#DCE7E1', light: '#173127' });
const adaptiveIcon = DynamicColorIOS({ dark: '#A9BBB3', light: '#41534A' });

export default function TabsLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <NativeTabs
        tintColor={colors.lime}
        iconColor={{ default: adaptiveIcon, selected: colors.lime }}
        labelStyle={{ default: { color: adaptiveLabel, fontSize: 11 }, selected: { color: colors.lime, fontSize: 11, fontWeight: '600' } }}
        blurEffect="systemChromeMaterialDark"
        minimizeBehavior="onScrollDown"
        shadowColor="rgba(196,245,42,.16)"
      >
        <NativeTabs.Trigger name="index" disableAutomaticContentInsets disableScrollToTop contentStyle={{ backgroundColor: colors.brand900 }}>
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md={{ default: 'home', selected: 'home' }} />
          <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="history">
          <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md={{ default: 'monitoring', selected: 'monitoring' }} />
          <NativeTabs.Trigger.Label>Analyses</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="favorites">
          <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md={{ default: 'favorite', selected: 'favorite' }} />
          <NativeTabs.Trigger.Label>Favoris</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md={{ default: 'person', selected: 'person' }} />
          <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
}
