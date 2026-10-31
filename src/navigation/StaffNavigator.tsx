import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StaffTabs } from './StaffTabs';
import { DmThreadScreen } from '../screens/shared/DmThreadScreen';
import { ManageTripScreen } from '../screens/staff/ManageTripScreen';
import { PlaceEditorScreen } from '../screens/staff/PlaceEditorScreen';
import { IstanbulMapScreen } from '../features/istanbul/IstanbulMapScreen';
import { EmergencyScreen } from '../features/istanbul/EmergencyScreen';
import type { StaffStackParamList } from './types';

const Stack = createNativeStackNavigator<StaffStackParamList>();

export function StaffNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StaffTabs" component={StaffTabs} />
      <Stack.Screen name="DmThread" component={DmThreadScreen} />
      <Stack.Screen name="ManageTrip" component={ManageTripScreen} />
      <Stack.Screen name="PlaceEditor" component={PlaceEditorScreen} />
      <Stack.Screen name="IstanbulMap" component={IstanbulMapScreen} />
      <Stack.Screen name="Emergency" component={EmergencyScreen} />
    </Stack.Navigator>
  );
}
