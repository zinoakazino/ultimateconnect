import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ConsultantTabs } from './ConsultantTabs';
import { TripGuideScreen } from '../screens/consultant/TripGuideScreen';
import { TripScheduleScreen } from '../screens/consultant/TripScheduleScreen';
import { DmInboxScreen } from '../screens/consultant/DmInboxScreen';
import { DmThreadScreen } from '../screens/shared/DmThreadScreen';
import { EmergencyScreen } from '../features/istanbul/EmergencyScreen';
import type { ConsultantStackParamList } from './types';

const Stack = createNativeStackNavigator<ConsultantStackParamList>();

export function ConsultantNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConsultantTabs" component={ConsultantTabs} />
      <Stack.Screen name="TripGuide" component={TripGuideScreen} />
      <Stack.Screen name="TripSchedule" component={TripScheduleScreen} />
      <Stack.Screen name="DmInbox" component={DmInboxScreen} />
      <Stack.Screen name="DmThread" component={DmThreadScreen} />
      <Stack.Screen name="Emergency" component={EmergencyScreen} />
    </Stack.Navigator>
  );
}
