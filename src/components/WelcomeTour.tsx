import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { GuideModal, useGuideSteps } from './GuideModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { fonts, radii, spacing } from '../theme';
import type { Colors } from '../theme';
import type { Role } from '../types/models';

const seenKey = (uid: string) => `uc_tour_v1_${uid}`;

/** Opens the welcome tour once, the first time someone is signed in on this device. */
export function WelcomeTour({ role }: { role: Role }) {
  const { profile } = useAuth();
  const steps = useGuideSteps(role === 'staff' ? 'welcomeStaff' : 'welcomeConsultant');
  const [open, setOpen] = useState(false);
  const uid = profile?.uid;

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    AsyncStorage.getItem(seenKey(uid))
      .then((seen) => {
        if (alive && !seen) setOpen(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid]);

  const close = () => {
    setOpen(false);
    if (uid) AsyncStorage.setItem(seenKey(uid), '1').catch(() => {});
  };

  return <GuideModal visible={open && steps.length > 0} steps={steps} onClose={close} />;
}

/** A row for the profile screens: replays the welcome tour whenever someone wants it. */
export function ReplayGuideRow({ role }: { role: Role }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const styles = makeStyles(colors);
  const steps = useGuideSteps(role === 'staff' ? 'welcomeStaff' : 'welcomeConsultant');
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  return (
    <>
      <Pressable style={styles.row} onPress={() => setOpen(true)} accessibilityRole="button">
        <View style={styles.icon}>
          <Feather name="help-circle" size={16} color={colors.greenDeep} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{t('guide.replay')}</Text>
          <Text style={styles.sub}>{t('guide.replaySub')}</Text>
        </View>
        <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={18} color={colors.inkSoft} />
      </Pressable>
      <GuideModal visible={open} steps={steps} onClose={() => setOpen(false)} />
    </>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      marginTop: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.greenPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1 },
    title: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.ink },
    sub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 1 },
  });
}
