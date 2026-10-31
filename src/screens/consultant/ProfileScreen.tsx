import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { ReplayGuideRow } from '../../components/WelcomeTour';
import { Brandmark } from '../../components/Brandmark';
import { EmergencyButton } from '../../features/istanbul/components/MapOverlays';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ToggleRow } from '../../components/ToggleRow';
import { SectionLabel } from '../../components/SectionLabel';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { setLocationSharing } from '../../lib/api';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors, mode, setMode } = useTheme();
  const styles = makeStyles(colors);
  const { profile, authUser, signOut } = useAuth();
  const [locationError, setLocationError] = useState<string | null>(null);

  // This only asks permission and flips the flag. The always-mounted LocationSharer
  // watches the flag and does the actual position updates.
  const onToggleLocation = async (next: boolean) => {
    if (!authUser) return;
    setLocationError(null);
    try {
      if (!next) {
        await setLocationSharing(authUser.uid, false);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError(t('profile.locationDenied'));
        return;
      }
      await setLocationSharing(authUser.uid, true);
    } catch {
      setLocationError(t('auth.errorGeneric'));
    }
  };

  if (!profile || !authUser) return null;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.emergencyRow}>
          <EmergencyButton />
        </View>
        <View style={styles.top}>
          <Brandmark size="lg" letter={profile.name.charAt(0).toUpperCase()} />
          <Text style={styles.name}>{profile.name}</Text>
          <View
            style={[
              styles.verifiedPill,
              profile.verified ? styles.verifiedPillOk : styles.verifiedPillPending,
            ]}
          >
            <Feather
              name={profile.verified ? 'check-circle' : 'clock'}
              size={11}
              color={profile.verified ? colors.green : colors.warnPaleText}
            />
            <Text
              style={[
                styles.verifiedText,
                { color: profile.verified ? colors.green : colors.warnPaleText },
              ]}
            >
              {profile.verified ? t('profile.verified') : t('profile.pendingVerification')}
            </Text>
          </View>
        </View>

        <Card style={styles.infoCard}>
          <InfoRow label={t('profile.phone')} value={profile.phone} colors={colors} />
          <InfoRow label={t('profile.email')} value={profile.email} colors={colors} />
        </Card>

        <SectionLabel>{t('profile.privacy')}</SectionLabel>
        <Card style={styles.locationCard}>
          <ToggleRow
            title={t('profile.shareLocation')}
            subtitle={t('profile.shareLocationSub')}
            value={profile.locationSharing}
            onValueChange={onToggleLocation}
          />
          {profile.locationSharing && (
            <View style={styles.sharingBanner}>
              <Feather name="map-pin" size={12} color={colors.greenDeep} />
              <Text style={styles.sharingBannerText}>{t('profile.locationSharingOn')}</Text>
            </View>
          )}
          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
        </Card>

        <SectionLabel>{t('profile.settings')}</SectionLabel>
        <Card style={styles.settingsCard}>
          <Text style={styles.settingsLabel}>{t('profile.language')}</Text>
          <LanguageSwitch />

          <Text style={[styles.settingsLabel, styles.settingsLabelSpaced]}>
            {t('profile.theme')}
          </Text>
          <View style={styles.pillRow}>
            <Pressable
              style={[styles.pill, mode === 'light' && styles.pillOn]}
              onPress={() => setMode('light')}
            >
              <Text style={[styles.pillText, mode === 'light' && styles.pillTextOn]}>
                {t('profile.light')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.pill, mode === 'dark' && styles.pillOn]}
              onPress={() => setMode('dark')}
            >
              <Text style={[styles.pillText, mode === 'dark' && styles.pillTextOn]}>
                {t('profile.dark')}
              </Text>
            </Pressable>
          </View>
        </Card>

        <ReplayGuideRow role="consultant" />

        <Button label={t('profile.signOut')} variant="outline" onPress={signOut} style={styles.signOut} />
      </ScrollView>
    </ScreenContainer>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: Colors }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    emergencyRow: {
      alignItems: 'flex-end',
      marginBottom: spacing.xs,
    },
    top: {
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    name: {
      fontFamily: fonts.display,
      fontSize: 19,
      color: colors.ink,
    },
    verifiedPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radii.pill,
    },
    verifiedPillOk: {
      backgroundColor: colors.greenPale,
    },
    verifiedPillPending: {
      backgroundColor: colors.warnPaleBg,
    },
    verifiedText: {
      fontFamily: fonts.mono,
      fontSize: 10,
    },
    infoCard: {
      gap: spacing.sm,
    },
    infoRow: {
      marginBottom: spacing.xs,
    },
    infoLabel: {
      fontFamily: fonts.mono,
      fontSize: 9.5,
      letterSpacing: 0.5,
      color: colors.inkSoft,
      marginBottom: 2,
    },
    infoValue: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
    },
    locationCard: {},
    sharingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
      backgroundColor: colors.greenPale,
      borderRadius: radii.sm,
      padding: spacing.sm,
    },
    sharingBannerText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.greenDeep,
    },
    errorText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.danger,
      marginTop: spacing.sm,
    },
    settingsCard: {},
    settingsLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 12.5,
      color: colors.ink,
      marginBottom: spacing.sm,
    },
    settingsLabelSpaced: {
      marginTop: spacing.lg,
    },
    pillRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    pill: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
    },
    pillOn: {
      backgroundColor: colors.green,
      borderColor: colors.green,
    },
    pillText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.inkSoft,
    },
    pillTextOn: {
      color: colors.white,
    },
    restartBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      backgroundColor: colors.warnPaleBg,
      borderRadius: radii.sm,
      padding: spacing.sm,
    },
    restartText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 10.5,
      color: colors.warnPaleText,
    },
    signOut: {
      marginTop: spacing.xl,
    },
  });
}
