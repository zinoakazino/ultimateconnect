import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { pickNotificationText } from '../../lib/localized';
import { HelpButton } from '../../components/GuideModal';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SectionLabel } from '../../components/SectionLabel';
import { EmergencyButton } from '../../features/istanbul/components/MapOverlays';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../hooks/useNotifications';
import { markNotificationRead } from '../../lib/api';
import { timeAgo, toDate } from '../../lib/dates';
import { fonts, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { NotificationDoc, NotificationType } from '../../types/models';

const ICONS: Record<NotificationType, keyof typeof Feather.glyphMap> = {
  reminder: 'clock',
  chat: 'message-circle',
  schedule: 'calendar',
  broadcast: 'radio',
  verification: 'check-circle',
  checkin: 'map-pin',
};

function isToday(n: NotificationDoc) {
  const date = toDate(n.createdAt);
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function AlertsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { authUser } = useAuth();
  const { notifications, unreadCount } = useNotifications(authUser?.uid);

  const { today, earlier } = useMemo(
    () => ({
      today: notifications.filter(isToday),
      earlier: notifications.filter((n) => !isToday(n)),
    }),
    [notifications]
  );

  const markRead = (n: NotificationDoc) => {
    if (n.read || !authUser) return;
    markNotificationRead(n.id).catch(() => {});
  };

  const markAllRead = () => {
    notifications.forEach(markRead);
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{t('alerts.title')}</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8}>
              <Text style={styles.markAll}>{t('alerts.markAllRead')}</Text>
            </Pressable>
          )}
          <HelpButton guide="alerts" />
          <EmergencyButton compact />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {notifications.length === 0 && <Text style={styles.empty}>{t('alerts.empty')}</Text>}
        {today.length > 0 && (
          <>
            <SectionLabel style={styles.firstLabel}>{t('alerts.today')}</SectionLabel>
            {today.map((n) => (
              <Row key={n.id} n={n} colors={colors} onPress={() => markRead(n)} />
            ))}
          </>
        )}
        {earlier.length > 0 && (
          <>
            <SectionLabel>{t('alerts.earlier')}</SectionLabel>
            {earlier.map((n) => (
              <Row key={n.id} n={n} colors={colors} onPress={() => markRead(n)} />
            ))}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Row({
  n,
  colors,
  onPress,
}: {
  n: NotificationDoc;
  colors: Colors;
  onPress: () => void;
}) {
  const { i18n } = useTranslation();
  const styles = makeStyles(colors);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.icon}>
        <Feather name={ICONS[n.type]} size={13} color={colors.greenDeep} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.text, !n.read && styles.textUnread]}>{pickNotificationText(n.text, i18n.language)}</Text>
        <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
      </View>
      {!n.read && <View style={styles.dot} />}
    </Pressable>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 20,
      color: colors.ink,
    },
    markAll: {
      fontFamily: fonts.bodyBold,
      fontSize: 11.5,
      color: colors.green,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    firstLabel: {
      marginTop: 2,
    },
    empty: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      paddingVertical: spacing.xl,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    icon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.greenPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
    },
    text: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.ink,
      lineHeight: 17,
    },
    textUnread: {
      fontFamily: fonts.bodySemiBold,
    },
    time: {
      fontFamily: fonts.mono,
      fontSize: 8.5,
      color: colors.inkSoft,
      marginTop: 2,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.danger,
    },
  });
}
