import React, { useState } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import Feather from '@expo/vector-icons/Feather';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Wordmark } from '../../components/Wordmark';
import { EmergencyButton } from '../../features/istanbul/components/MapOverlays';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { FlightsCard } from '../../components/FlightsCard';
import { SectionLabel } from '../../components/SectionLabel';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnread } from '../../context/UnreadContext';
import { useTrip } from '../../hooks/useTrip';
import { useMyGroup } from '../../hooks/useTripGroups';
import { useTodaySchedule } from '../../hooks/useTodaySchedule';
import { groupTag } from '../../lib/groups';
import { usePlaces } from '../../hooks/usePlaces';
import { answerCheckin, useLatestCheckin, useMyCheckinResponse } from '../../hooks/useCheckin';
import { createHelpRequest } from '../../hooks/useHelpRequests';
import { toDate, formatDateRange, daysUntil } from '../../lib/dates';
import { callPhone, openInMaps } from '../../lib/maps';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { ConsultantStackParamList, ConsultantTabParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ConsultantTabParamList, 'Home'>,
  NativeStackScreenProps<ConsultantStackParamList>
>;

type HelpStep = 'idle' | 'confirm' | 'sending' | 'sent' | 'error';

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { profile } = useAuth();
  const { trip } = useTrip();
  const { items, pinned } = useTodaySchedule();
  const { group, groups } = useMyGroup();
  const { notificationsUnread } = useUnread();
  const { places } = usePlaces();
  const checkin = useLatestCheckin();
  const answered = useMyCheckinResponse(checkin?.id, profile?.uid);

  const [checkinBusy, setCheckinBusy] = useState(false);
  const [helpStep, setHelpStep] = useState<HelpStep>('idle');

  // The whole name: people write theirs in either order (family name first or last), so the app never guesses which word is the first name.
  const displayName = profile?.name ?? '';
  const start = trip ? toDate(trip.startDate) : null;
  const end = trip ? toDate(trip.endDate) : null;
  const countdown = start ? daysUntil(start) : null;
  const contacts = places.filter((p) => p.category === 'emergency').slice(0, 4);
  const openCheckin = checkin && !checkin.closed ? checkin : null;

  const onCheckin = async () => {
    if (!openCheckin || !profile) return;
    setCheckinBusy(true);
    try {
      await answerCheckin(openCheckin.id, profile.uid, profile.name);
    } finally {
      setCheckinBusy(false);
    }
  };

  const onSendHelp = async () => {
    if (!profile) return;
    setHelpStep('sending');
    let coords: { lat?: number; lng?: number } = {};
    try {
      // An explicit, one-off request from the person asking for help — not tracking.
      const current = await Location.getForegroundPermissionsAsync();
      const granted = current.granted || (await Location.requestForegroundPermissionsAsync()).granted;
      if (granted) {
        // A cold GPS fix indoors can take a long time; the alert must not wait for it.
        const fix = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000));
        const position =
          (await Promise.race([fix, timeout])) ?? (await Location.getLastKnownPositionAsync());
        if (position) {
          coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        }
      }
    } catch {
      // Location is a bonus — the alert still goes out without it.
    }
    try {
      await createHelpRequest({
        uid: profile.uid,
        name: profile.name,
        phone: profile.phone,
        ...coords,
      });
      setHelpStep('sent');
    } catch {
      setHelpStep('error');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Wordmark width={92} />
          <View style={styles.topActions}>
            <EmergencyButton />
            <Pressable style={styles.bell} onPress={() => navigation.navigate('Alerts')}>
              <Feather name="bell" size={16} color={colors.greenDeep} />
              {notificationsUnread > 0 && <View style={styles.bellDot} />}
            </Pressable>
          </View>
        </View>
        <Text style={styles.greeting}>{t('home.greeting', { name: displayName })}</Text>

        {trip && (
          <Card variant="dark" noShadow style={styles.confirmCard}>
            <Pressable
              style={styles.mapBtn}
              onPress={() => navigation.navigate('TripGuide')}
              accessibilityLabel={t('tripGuide.title') ?? undefined}
              hitSlop={8}
            >
              <Feather name="map-pin" size={14} color={colors.white} />
            </Pressable>
            <View style={styles.confirmTop}>
              <View style={styles.confirmSeal}>
                <Feather name="check" size={16} color={colors.white} />
              </View>
              <View>
                <Text style={styles.confirmT1}>{trip.name}</Text>
                <Text style={styles.confirmT2}>{t('home.confirmed')}</Text>
              </View>
            </View>
            <View style={styles.confirmBottom}>
              <Text style={styles.confirmDates}>
                {start && end ? formatDateRange(start, end) : ''}
              </Text>
              {countdown !== null && countdown >= 0 && (
                <View style={styles.confirmCountdown}>
                  <Text style={styles.confirmCountdownN}>{countdown}</Text>
                  <Text style={styles.confirmCountdownL}>{t('home.daysToGo')}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {group ? (
          <FlightsCard group={group} own />
        ) : groups.length > 0 ? (
          <>
            <Card variant="pale" noShadow style={styles.noGroupNote}>
              <Text style={styles.noGroupText}>{t('flights.noGroup')}</Text>
            </Card>
            {groups.map((g) => (
              <FlightsCard key={g.id} group={g} defaultOpen={false} />
            ))}
          </>
        ) : null}

        {openCheckin && (
          <Card variant="pale" noShadow style={styles.checkinCard}>
            <Text style={styles.checkinLabel}>{t('home.checkinLabel')}</Text>
            <Text style={styles.checkinTitle}>{openCheckin.title}</Text>
            {answered ? (
              <View style={styles.checkinDone}>
                <Feather name="check-circle" size={15} color={colors.greenDeep} />
                <Text style={styles.checkinDoneText}>{t('home.checkinDone')}</Text>
              </View>
            ) : (
              <Button
                label={t('home.checkinHere')}
                onPress={onCheckin}
                loading={checkinBusy}
                style={styles.checkinBtn}
              />
            )}
          </Card>
        )}

        <SectionLabel>{t('home.todaySchedule')}</SectionLabel>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>{t('home.noSchedule')}</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.schedItem}>
              <Text style={styles.schedTime}>{item.time}</Text>
              <Text style={styles.schedTitle}>
                {item.group != null && profile?.groupId == null ? `${groupTag(item.group)} · ` : ''}
                {item.title}
              </Text>
            </View>
          ))
        )}

        <Pressable style={styles.fullScheduleLink} onPress={() => navigation.navigate('TripSchedule')} hitSlop={6}>
          <Text style={styles.fullScheduleText}>{t('home.fullSchedule')}</Text>
          <Feather name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'} size={16} color={colors.green} />
        </Pressable>

        {pinned && (
          <Card variant="pale" noShadow style={styles.pinCard}>
            <Feather name="bookmark" size={14} color={colors.greenDeep} style={styles.pinIcon} />
            <Text style={styles.pinText}>
              {t('home.reminderPrefix')}
              {pinned.title}
            </Text>
          </Card>
        )}

        <View style={styles.quickRow}>
          <Button
            label={t('home.openChat')}
            onPress={() => navigation.navigate('Chat')}
            style={styles.quickBtn}
          />
          <Button
            label={t('home.tripDetails')}
            variant="outline"
            onPress={() => navigation.navigate('TripGuide')}
            style={styles.quickBtn}
          />
        </View>

        {contacts.length > 0 && (
          <>
            <SectionLabel>{t('home.contacts')}</SectionLabel>
            {contacts.map((c) => (
              <View key={c.id} style={styles.contactRow}>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  {c.description ? (
                    <Text style={styles.contactDesc} numberOfLines={1}>
                      {c.description}
                    </Text>
                  ) : null}
                </View>
                {c.phone ? (
                  <Pressable
                    style={styles.contactBtn}
                    onPress={() => callPhone(c.phone as string)}
                    accessibilityLabel={t('home.call') ?? undefined}
                    hitSlop={8}
                  >
                    <Feather name="phone" size={14} color={colors.greenDeep} />
                  </Pressable>
                ) : (c.lat !== undefined && c.lng !== undefined) || c.address ? (
                  <Pressable
                    style={styles.contactBtn}
                    onPress={() => openInMaps({ lat: c.lat, lng: c.lng, address: c.address, label: c.name })}
                    hitSlop={8}
                  >
                    <Feather name="navigation" size={14} color={colors.greenDeep} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        )}

        <View style={styles.helpWrap}>
          {helpStep === 'idle' && (
            <Pressable style={styles.helpBtn} onPress={() => setHelpStep('confirm')}>
              <Feather name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.helpBtnText}>{t('home.help')}</Text>
            </Pressable>
          )}
          {helpStep === 'confirm' && (
            <Card noShadow style={styles.helpConfirm}>
              <Text style={styles.helpConfirmText}>{t('home.helpConfirm')}</Text>
              <View style={styles.helpActions}>
                <Button
                  label={t('home.helpCancel')}
                  variant="outline"
                  onPress={() => setHelpStep('idle')}
                  style={styles.helpActionBtn}
                />
                <Button label={t('home.helpSend')} onPress={onSendHelp} style={styles.helpActionBtn} />
              </View>
            </Card>
          )}
          {helpStep === 'sending' && <Text style={styles.helpStatus}>{t('common.loading')}</Text>}
          {helpStep === 'sent' && (
            <Pressable onPress={() => setHelpStep('idle')}>
              <Text style={[styles.helpStatus, styles.helpStatusOk]}>{t('home.helpSent')}</Text>
            </Pressable>
          )}
          {helpStep === 'error' && (
            <Pressable onPress={() => setHelpStep('idle')}>
              <Text style={[styles.helpStatus, styles.helpStatusError]}>{t('home.helpFailed')}</Text>
            </Pressable>
          )}
        </View>
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
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    greeting: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: colors.ink,
      marginBottom: spacing.lg,
    },
    bell: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.greenPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellDot: {
      position: 'absolute',
      top: 5,
      right: 6,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.danger,
      borderWidth: 1.5,
      borderColor: colors.white,
    },
    confirmCard: {
      marginBottom: spacing.xs,
      position: 'relative',
    },
    mapBtn: {
      position: 'absolute',
      top: spacing.md,
      [I18nManager.isRTL ? 'left' : 'right']: spacing.md,
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1.4,
      borderColor: 'rgba(255,255,255,0.5)',
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    confirmTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    confirmSeal: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.4,
      borderColor: 'rgba(255,255,255,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmT1: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.75)',
    },
    confirmT2: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: colors.white,
      marginTop: 2,
    },
    confirmBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: spacing.md,
    },
    confirmDates: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: 'rgba(255,255,255,0.85)',
    },
    confirmCountdown: {
      alignItems: 'flex-end',
    },
    confirmCountdownN: {
      fontFamily: fonts.mono,
      fontSize: 18,
      color: colors.white,
    },
    confirmCountdownL: {
      fontFamily: fonts.mono,
      fontSize: 8,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 1,
    },
    noGroupNote: {
      marginTop: spacing.md,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    noGroupText: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      lineHeight: 18,
      color: colors.greenDeep,
    },
    checkinCard: {
      marginTop: spacing.md,
      borderRadius: radii.xl,
    },
    checkinLabel: {
      fontFamily: fonts.mono,
      fontSize: 9.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.greenDeep,
      opacity: 0.75,
    },
    checkinTitle: {
      fontFamily: fonts.display,
      fontSize: 16,
      color: colors.greenDeep,
      marginTop: 4,
    },
    checkinBtn: {
      marginTop: spacing.md,
    },
    checkinDone: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    checkinDoneText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12.5,
      color: colors.greenDeep,
    },
    emptyText: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      paddingVertical: spacing.sm,
    },
    schedItem: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    schedTime: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.green,
      width: 46,
    },
    schedTitle: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.ink,
      lineHeight: 18,
    },
    fullScheduleLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    fullScheduleText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.green,
    },
    pinCard: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    pinIcon: {
      marginTop: 2,
    },
    pinText: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: colors.greenDeep,
      lineHeight: 18,
    },
    quickRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    quickBtn: {
      flex: 1,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    contactInfo: {
      flex: 1,
      minWidth: 0,
    },
    contactName: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    contactDesc: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.inkSoft,
      marginTop: 1,
    },
    contactBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.greenPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    helpWrap: {
      marginTop: spacing.xl,
    },
    helpBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 12,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    helpBtnText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.danger,
    },
    helpConfirm: {
      borderWidth: 1,
      borderColor: colors.danger,
    },
    helpConfirmText: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.ink,
      lineHeight: 18,
    },
    helpActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    helpActionBtn: {
      flex: 1,
    },
    helpStatus: {
      fontFamily: fonts.bodyBold,
      fontSize: 12.5,
      textAlign: 'center',
      color: colors.inkSoft,
      paddingVertical: spacing.sm,
    },
    helpStatusOk: {
      color: colors.green,
    },
    helpStatusError: {
      color: colors.danger,
    },
  });
}
