import React from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../hooks/useTrip';
import { compareScheduleItems, useFullSchedule } from '../../hooks/useSchedule';
import { formatDateRange, toDate, todayKey } from '../../lib/dates';
import { groupTag, itemsForGroup } from '../../lib/groups';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { ConsultantStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ConsultantStackParamList, 'TripSchedule'>;

function dayLabel(key: string, locale: string) {
  const [y, m, d] = key.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The whole trip programme, day by day (what staff published in the Programme tab). */
export function TripScheduleScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { trip } = useTrip();
  const { profile } = useAuth();
  const { days, loading } = useFullSchedule();
  const today = todayKey();
  const start = trip ? toDate(trip.startDate) : null;
  const end = trip ? toDate(trip.endDate) : null;
  // the lines for everybody plus those for this person's own travel group (all of them, tagged, while no group is set)
  const groupId = profile?.groupId ?? null;
  const filled = days.map((d) => ({ ...d, items: itemsForGroup(d.items, groupId) })).filter((d) => d.items.length > 0);
  const hasGroupLines = days.some((d) => d.items.some((i) => i.group != null));

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Feather name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'} size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('schedule.fullTitle')}</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {trip && (
          <Card variant="dark" noShadow style={styles.tripCard}>
            <Text style={styles.tripName}>{trip.name}</Text>
            {start && end && <Text style={styles.tripDates}>{formatDateRange(start, end)}</Text>}
          </Card>
        )}
        {hasGroupLines && (
          <Text style={styles.groupCaption}>
            {groupId != null ? t('schedule.forGroup', { n: groupId }) : t('schedule.allGroups')}
          </Text>
        )}

        {filled.map((day) => (
          <View key={day.date} style={styles.day}>
            <View style={styles.dayHead}>
              <Text style={styles.dayTitle}>{dayLabel(day.date, i18n.language)}</Text>
              {day.date === today && (
                <View style={styles.todayPill}>
                  <Text style={styles.todayText}>{t('schedule.today')}</Text>
                </View>
              )}
            </View>
            {day.items
              .slice()
              .sort(compareScheduleItems)
              .map((item) => (
                <View key={item.id} style={styles.item}>
                  <Text style={styles.time}>{item.time}</Text>
                  <Text style={[styles.itemTitle, item.important && styles.itemImportant]}>
                    {item.group != null && groupId == null ? `${groupTag(item.group)} · ` : ''}
                    {item.title}
                  </Text>
                </View>
              ))}
          </View>
        ))}

        {!loading && filled.length === 0 && <Text style={styles.empty}>{t('schedule.empty')}</Text>}
      </ScrollView>
    </ScreenContainer>
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
      paddingBottom: spacing.sm,
    },
    title: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    tripCard: { marginBottom: spacing.md },
    tripName: { fontFamily: fonts.display, fontSize: 17, color: colors.white },
    tripDates: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
    groupCaption: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.green, marginTop: spacing.xs },
    day: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    dayTitle: { fontFamily: fonts.display, fontSize: 15, color: colors.greenDeep },
    todayPill: { backgroundColor: colors.green, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    todayText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.white },
    item: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    time: { fontFamily: fonts.mono, fontSize: 11, color: colors.green, width: 46 },
    itemTitle: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink, lineHeight: 18 },
    itemImportant: { fontFamily: fonts.bodyBold },
    empty: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: spacing.xl, textAlign: 'center' },
  });
}
