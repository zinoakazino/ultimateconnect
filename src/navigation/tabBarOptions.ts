import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { fonts } from '../theme';
import type { Colors } from '../theme';

export function makeTabBarScreenOptions(colors: Colors): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.green,
    tabBarInactiveTintColor: colors.inkSoft,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.line,
      borderTopWidth: 1,
      // Tall enough for the icon AND its label: at 62 the labels were clipped at the bottom on the web.
      height: 70,
      paddingTop: 8,
      paddingBottom: 12,
    },
    tabBarLabelStyle: {
      fontFamily: fonts.mono,
      fontSize: 9,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    tabBarBadgeStyle: {
      backgroundColor: colors.danger,
      color: colors.white,
      fontFamily: fonts.bodyBold,
      fontSize: 9,
    },
  };
}

/** A badge only when there is something to show (0 / undefined renders nothing). */
export function badge(count: number): number | undefined {
  return count > 0 ? count : undefined;
}
