import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { HomeScreen } from '../screens/consultant/HomeScreen';
import { ChatScreen } from '../screens/consultant/ChatScreen';
import { AlertsScreen } from '../screens/consultant/AlertsScreen';
import { ProfileScreen } from '../screens/consultant/ProfileScreen';
import { IstanbulMapScreen } from '../features/istanbul/IstanbulMapScreen';
import { useTheme } from '../context/ThemeContext';
import { useUnread } from '../context/UnreadContext';
import { badge, makeTabBarScreenOptions } from './tabBarOptions';
import type { ConsultantTabParamList } from './types';

const Tab = createBottomTabNavigator<ConsultantTabParamList>();

export function ConsultantTabs() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { groupUnread, unreadThreadIds, notificationsUnread } = useUnread();

  return (
    <Tab.Navigator screenOptions={makeTabBarScreenOptions(colors)}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('nav.home') ?? undefined,
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size - 3} />,
        }}
      />
      <Tab.Screen
        name="Map"
        component={IstanbulMapScreen}
        options={{
          tabBarLabel: t('nav.map') ?? undefined,
          tabBarIcon: ({ color, size }) => <Feather name="map" color={color} size={size - 3} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: t('nav.chat') ?? undefined,
          tabBarBadge: badge(unreadThreadIds.length + (groupUnread ? 1 : 0)),
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" color={color} size={size - 3} />
          ),
        }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{
          tabBarLabel: t('nav.alerts') ?? undefined,
          tabBarBadge: badge(notificationsUnread),
          tabBarIcon: ({ color, size }) => <Feather name="bell" color={color} size={size - 3} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('nav.profile') ?? undefined,
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size - 3} />,
        }}
      />
    </Tab.Navigator>
  );
}
