import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { Brandmark } from '../../components/Brandmark';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { FlightsCard } from '../../components/FlightsCard';
import { ReplayGuideRow } from '../../components/WelcomeTour';
import { FormField } from '../../components/FormField';
import { SectionLabel } from '../../components/SectionLabel';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import { useMyGroup } from '../../hooks/useTripGroups';
import { fetchInviteCode, saveInviteCode } from '../../lib/api';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { StaffStackParamList, StaffTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<StaffTabParamList, 'Profile'>,
  NativeStackScreenProps<StaffStackParamList>
>;

export function StaffProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors, mode, setMode } = useTheme();
  const { isRTL } = useLanguage();
  const styles = makeStyles(colors);
  const { profile, signOut } = useAuth();
  // the staff member's own travel group (picked at sign-up from the list): their own flights
  const { group } = useMyGroup();

  const [code, setCode] = useState('');
  // false once we know no code has been set yet — nobody can sign up until one is.
  const [codeMissing, setCodeMissing] = useState(false);
  const [codeState, setCodeState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // The invite code lives in the `config` table, which only staff can read or change.
  useEffect(() => {
    fetchInviteCode()
      .then((saved) => {
        setCode(saved);
        setCodeMissing(!saved);
      })
      .catch(() => {});
  }, []);

  const saveCode = async () => {
    const next = code.trim();
    if (next.length < 4) {
      setCodeState('error');
      return;
    }
    setCodeState('saving');
    try {
      await saveInviteCode(next);
      setCodeMissing(false);
      setCodeState('saved');
    } catch {
      setCodeState('error');
    }
  };

  if (!profile) return null;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Brandmark size="lg" letter={profile.name.charAt(0).toUpperCase()} />
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>

        {group ? <FlightsCard group={group} own /> : null}

        <Pressable style={styles.manageRow} onPress={() => navigation.navigate('ManageTrip')}>
          <View style={styles.manageIcon}>
            <Feather name="map" size={16} color={colors.greenDeep} />
          </View>
          <Text style={styles.manageText}>{t('manage.manageTrip')}</Text>
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.inkSoft}
          />
        </Pressable>

        <Card style={styles.codeCard}>
          <FormField
            label={t('manage.inviteCode')}
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setCodeState('idle');
            }}
            autoCapitalize="characters"
          />
          <Text style={styles.help}>{t('manage.inviteCodeHelp')}</Text>
          {codeMissing && <Text style={styles.err}>{t('manage.inviteCodeMissing')}</Text>}
          {codeState === 'saved' && <Text style={styles.ok}>{t('manage.saved')}</Text>}
          {codeState === 'error' && <Text style={styles.err}>{t('auth.errorGeneric')}</Text>}
          <Button
            label={t('manage.save')}
            variant="outline"
            onPress={saveCode}
            loading={codeState === 'saving'}
            style={styles.codeSave}
          />
        </Card>

        <ReplayGuideRow role="staff" />

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

        <Button label={t('profile.signOut')} variant="outline" onPress={signOut} style={styles.signOut} />
      </ScrollView>
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    top: {
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    name: {
      fontFamily: fonts.display,
      fontSize: 19,
      color: colors.ink,
    },
    email: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
    },
    manageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
    },
    manageIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.greenPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    manageText: {
      flex: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    settingsCard: {},
    codeCard: { marginTop: spacing.lg },
    help: {
      fontFamily: fonts.body,
      fontSize: 11,
      lineHeight: 16,
      color: colors.inkSoft,
    },
    ok: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.green,
      marginTop: spacing.sm,
    },
    err: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.danger,
      marginTop: spacing.sm,
    },
    codeSave: {
      marginTop: spacing.md,
      paddingVertical: 10,
    },
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
