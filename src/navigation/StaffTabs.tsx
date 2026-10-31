import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { ScheduleComposerScreen } from '../screens/staff/ScheduleComposerScreen';
import { ConsultantsScreen } from '../screens/staff/ConsultantsScreen';
import { StaffChatScreen } from '../screens/staff/StaffChatScreen';
import { BroadcastScreen } from '../screens/staff/BroadcastScreen';
import { StaffProfileScreen } from '../screens/staff/StaffProfileScreen';
import { useTheme } from '../context/ThemeContext';
import { useUnread } from '../context/UnreadContext';
import { useOpenHelpRequests } from '../hooks/useHelpRequests';
import { badge, makeTabBarScreenOptions } from './tabBarOptions';
import type { StaffTabParamList } from './types';

const Tab = createBottomTabNavigator<StaffTabParamList>();

export function StaffTabs() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { groupUnread, unreadThreadIds } = useUnread();
  const helpRequests = useOpenHelpRequests(true);

  return (
    <Tab.Navigator screenOptions={makeTabBarScreenOptions(colors)}>
      <Tab.Screen
        name="Schedule"
        component={ScheduleComposerScreen}
        options={{
          tabBarLabel: t('nav.schedule') ?? undefined,
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" color={color} size={size - 3} />
          ),
        }}
      />
      <Tab.Screen
        name="Consultants"
        component={ConsultantsScreen}
        options={{
          tabBarLabel: t('nav.people') ?? undefined,
          // Open help requests and unread private messages both live on this tab.
          tabBarBadge: badge(helpRequests.length + unreadThreadIds.length),
          tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size - 3} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={StaffChatScreen}
        options={{
          tabBarLabel: t('nav.chat') ?? undefined,
          tabBarBadge: badge(groupUnread ? 1 : 0),
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" color={color} size={size - 3} />
          ),
        }}
      />
      <Tab.Screen
        name="Broadcast"
        component={BroadcastScreen}
        options={{
          tabBarLabel: t('nav.notify') ?? undefined,
          tabBarIcon: ({ color, size }) => (
            <Feather name="radio" color={color} size={size - 3} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={StaffProfileScreen}
        options={{
          tabBarLabel: t('nav.profile') ?? undefined,
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size - 3} />,
        }}
      />
    </Tab.Navigator>
  );
}
