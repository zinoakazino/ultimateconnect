import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DefaultTheme, DarkTheme, NavigationContainer } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabaseConfigured } from '../lib/supabase';
import { fonts, spacing } from '../theme';
import { WelcomeTour } from '../components/WelcomeTour';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { AuthStack } from './AuthStack';
import { ConsultantNavigator } from './ConsultantNavigator';
import { StaffNavigator } from './StaffNavigator';

export function RootNavigator() {
  const { authUser, profile, initializing, recovering } = useAuth();
  const { mode, colors } = useTheme();
  const { t } = useTranslation();

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.surface,
      border: colors.line,
      primary: colors.green,
      text: colors.ink,
    },
  };

  // The app was built without the address of its database: say so rather than show a dead login form.
  if (!supabaseConfigured) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <Text style={[styles.notice, { color: colors.ink }]}>{t('auth.errorNotConfigured')}</Text>
      </View>
    );
  }

  if (initializing) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }

  if (recovering) return <ResetPasswordScreen />;

  return (
    <>
      <NavigationContainer theme={navTheme}>
        {!authUser || !profile ? (
          <AuthStack />
        ) : profile.role === 'staff' ? (
          <StaffNavigator />
        ) : (
          <ConsultantNavigator />
        )}
      </NavigationContainer>
      {/* the first time someone signs in on this device, a short tour explains the app (it can be replayed from the profile) */}
      {authUser && profile ? <WelcomeTour role={profile.role} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  notice: {
    fontFamily: fonts.body,
    fontSize: 15,
    textAlign: 'center',
  },
});
