import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { FlightsCard } from '../../components/FlightsCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUnread } from '../../context/UnreadContext';
import { useConsultants } from '../../hooks/useConsultants';
import { resolveHelpRequest, useOpenHelpRequests } from '../../hooks/useHelpRequests';
import { useRoster } from '../../hooks/useRoster';
import { useTripGroups } from '../../hooks/useTripGroups';
import { timeAgo, toDate } from '../../lib/dates';
import { groupTag } from '../../lib/groups';
import { callPhone, openInMaps } from '../../lib/maps';
import { notifyUsers, setProfileGroup, setVerified } from '../../lib/api';
import { bilingual } from '../../lib/localized';
import { HelpButton } from '../../components/GuideModal';
import { dmThreadId } from '../../types/models';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { StaffStackParamList, StaffTabParamList } from '../../navigation/types';
import type { UserDoc } from '../../types/models';

type Props = CompositeScreenProps<
  BottomTabScreenProps<StaffTabParamList, 'Consultants'>,
  NativeStackScreenProps<StaffStackParamList>
>;

const STALE_MS = 20 * 60 * 1000;

export function ConsultantsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { profile, authUser } = useAuth();
  const { consultants } = useConsultants();
  const { unreadThreadIds } = useUnread();
  const helpRequests = useOpenHelpRequests(true);
  const { roster } = useRoster();
  const { groups } = useTripGroups();
  const [search, setSearch] = useState('');
  // 'all' | 'none' (no group yet) | a group number
  const [groupFilter, setGroupFilter] = useState<'all' | 'none' | number>('all');
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [showFlights, setShowFlights] = useState(false);
  const [showPending, setShowPending] = useState(false);

  const staffUid = authUser?.uid ?? '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = consultants.slice().sort((a, b) => a.name.localeCompare(b.name));
    const inGroup = sorted.filter((c) =>
      groupFilter === 'all' ? true : groupFilter === 'none' ? c.groupId == null : c.groupId === groupFilter
    );
    if (!q) return inGroup;
    return inGroup.filter((c) => c.name.toLowerCase().includes(q));
  }, [consultants, search, groupFilter]);

  const sharingCount = consultants.filter((c) => c.locationSharing && c.location).length;
  const countIn = (g: number) => consultants.filter((c) => c.groupId === g).length;
  const withoutGroup = consultants.filter((c) => c.groupId == null).length;
  const pending = roster.filter((r) => r.profileUid == null);
  const filterOptions: { key: 'all' | 'none' | number; label: string }[] = [
    { key: 'all', label: `${t('staffConsultants.allGroups')} (${consultants.length})` },
    ...groups.map((g) => ({ key: g.id, label: `${t('staffConsultants.groupChip', { n: g.id })} (${countIn(g.id)})` })),
    ...(withoutGroup > 0 ? [{ key: 'none' as const, label: `${t('staffConsultants.noGroup')} (${withoutGroup})` }] : []),
  ];

  const chooseGroup = (c: UserDoc, groupId: number | null) => {
    setEditingUid(null);
    if (groupId === c.groupId) return;
    // Their flights depend on it: the person is told, so nobody keeps reading the other group's times.
    setProfileGroup(c.uid, groupId)
      .then(() =>
        groupId != null
          ? notifyUsers([c.uid], 'schedule', bilingual('staffConsultants.groupChangedNotice', { n: groupId }))
          : undefined
      )
      .catch(() => {});
  };

  const toggleVerified = (c: UserDoc) => {
    setVerified(c.uid, !c.verified).catch(() => {});
  };

  const openThread = (c: UserDoc) => {
    if (!profile) return;
    navigation.navigate('DmThread', {
      threadId: dmThreadId(staffUid, c.uid),
      title: c.name,
      staffId: staffUid,
      staffName: profile.name,
      consultantId: c.uid,
      consultantName: c.name,
    });
  };

  const header = (
    <View>
      {helpRequests.map((h) => (
        <View key={h.id} style={styles.helpCard}>
          <View style={styles.helpTop}>
            <Feather name="alert-triangle" size={15} color={colors.white} />
            <Text style={styles.helpTitle}>
              {t('staffConsultants.helpFrom', { name: h.name })}
            </Text>
            <Text style={styles.helpTime}>{timeAgo(h.createdAt)}</Text>
          </View>
          <View style={styles.helpActions}>
            {h.phone ? (
              <Pressable style={styles.helpBtn} onPress={() => callPhone(h.phone)}>
                <Feather name="phone" size={12} color={colors.danger} />
                <Text style={styles.helpBtnText}>{t('home.call')}</Text>
              </Pressable>
            ) : null}
            {h.lat !== undefined && h.lng !== undefined ? (
              <Pressable
                style={styles.helpBtn}
                onPress={() => openInMaps({ lat: h.lat, lng: h.lng, label: h.name })}
              >
                <Feather name="navigation" size={12} color={colors.danger} />
                <Text style={styles.helpBtnText}>{t('tripGuide.openInMaps')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.helpBtn}
              onPress={() => resolveHelpRequest(h.id).catch(() => {})}
            >
              <Feather name="check" size={12} color={colors.danger} />
              <Text style={styles.helpBtnText}>{t('staffConsultants.resolved')}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {groups.length > 0 && (
        <View style={styles.chipRow}>
          {filterOptions.map((o) => {
            const on = groupFilter === o.key;
            return (
              <Pressable key={String(o.key)} style={[styles.chip, on && styles.chipOn]} onPress={() => setGroupFilter(o.key)}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {roster.length > 0 && (
        <View style={styles.sumBox}>
          <Pressable style={styles.sumRow} onPress={() => setShowPending((v) => !v)} hitSlop={6}>
            <Feather name={pending.length === 0 ? 'check-circle' : 'user-plus'} size={14} color={colors.green} />
            <Text style={styles.sumText}>
              {t('staffConsultants.registered', { done: roster.length - pending.length, total: roster.length })}
            </Text>
            <Feather name={showPending ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkSoft} />
          </Pressable>
          {showPending && (
            <View style={styles.pendingList}>
              <Text style={styles.pendingTitle}>
                {pending.length === 0
                  ? t('staffConsultants.pendingAll')
                  : t('staffConsultants.pendingTitle', { count: pending.length })}
              </Text>
              {pending.length > 0 && <Text style={styles.pendingHint}>{t('staffConsultants.pendingHint')}</Text>}
              {pending.map((r) => (
                <View key={r.id} style={styles.pendingRow}>
                  <Text style={styles.pendingName}>{r.name}</Text>
                  {r.groupId != null ? <Text style={styles.pendingTag}>{groupTag(r.groupId)}</Text> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {groups.length > 0 && (
        <View style={styles.sumBox}>
          <Pressable style={styles.sumRow} onPress={() => setShowFlights((v) => !v)} hitSlop={6}>
            <Feather name="send" size={14} color={colors.green} />
            <Text style={styles.sumText}>{t('staffConsultants.flightsToggle')}</Text>
            <Feather name={showFlights ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkSoft} />
          </Pressable>
          {showFlights &&
            groups.map((g) => <FlightsCard key={g.id} group={g} people={countIn(g.id)} defaultOpen />)}
        </View>
      )}

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder={t('staffConsultants.searchPlaceholder') ?? ''}
        placeholderTextColor={colors.inkSoft}
      />
    </View>
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{t('staffConsultants.title')}</Text>
        <Text style={styles.count}>
          {consultants.length} {t('staffConsultants.totalSuffix')}
        </Text>
        <HelpButton guide="staffPeople" style={{ alignSelf: 'center' }} />
        <Pressable
          style={styles.mapLink}
          onPress={() => navigation.navigate('IstanbulMap')}
          accessibilityRole="button"
          accessibilityLabel={t('map.title') ?? undefined}
          hitSlop={8}
        >
          <Feather name="map" size={15} color={colors.white} />
          <Text style={styles.mapLinkText}>{t('map.title')}</Text>
        </Pressable>
      </View>
      {sharingCount > 0 && (
        <Text style={styles.sharingSummary}>
          {t('staffConsultants.sharingCount', { count: sharingCount })}
        </Text>
      )}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const loc = item.locationSharing ? item.location : undefined;
          const locDate = loc ? toDate(loc.updatedAt) : null;
          const stale = locDate ? Date.now() - locDate.getTime() > STALE_MS : false;
          const unread = unreadThreadIds.includes(dmThreadId(staffUid, item.uid));
          return (
            <View>
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>{item.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Pressable
                    style={[styles.groupBadge, item.groupId == null && styles.groupBadgeNone]}
                    onPress={() => setEditingUid(editingUid === item.uid ? null : item.uid)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={t('staffConsultants.setGroupFor', { name: item.name })}
                  >
                    <Text style={[styles.groupBadgeText, item.groupId == null && styles.groupBadgeTextNone]}>
                      {item.groupId != null ? groupTag(item.groupId) : '—'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.status, item.verified ? styles.statusOk : styles.statusWarn]}>
                  {item.verified ? t('staffConsultants.confirmed') : t('staffConsultants.notVerified')}
                  <Text style={styles.statusMuted}> · {timeAgo(item.lastActive)}</Text>
                </Text>
                {loc ? (
                  <Text style={[styles.locLine, stale && styles.locStale]}>
                    {t(stale ? 'staffConsultants.lastKnown' : 'staffConsultants.locatedAgo', {
                      ago: timeAgo(loc.updatedAt),
                    })}
                  </Text>
                ) : null}
              </View>
              {loc ? (
                <Pressable
                  style={[styles.iconBtn, styles.locBtn]}
                  onPress={() => openInMaps({ lat: loc.lat, lng: loc.lng, label: item.name })}
                  accessibilityLabel={t('staffConsultants.viewLocation') ?? undefined}
                  hitSlop={6}
                >
                  <Feather name="map-pin" size={14} color={colors.white} />
                </Pressable>
              ) : null}
              <Pressable style={styles.verifyBtn} onPress={() => toggleVerified(item)} hitSlop={8}>
                <Feather
                  name={item.verified ? 'check-circle' : 'circle'}
                  size={19}
                  color={item.verified ? colors.green : colors.inkSoft}
                />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => openThread(item)} hitSlop={6}>
                <Feather name="message-circle" size={14} color={colors.greenDeep} />
                {unread && <View style={styles.unreadDot} />}
              </Pressable>
            </View>
            {editingUid === item.uid && (
              <View style={styles.chooser}>
                <Text style={styles.chooserLabel}>{t('staffConsultants.setGroupFor', { name: item.name })}</Text>
                <View style={styles.chooserChips}>
                  {[...groups.map((g) => g.id), null].map((g) => (
                    <Pressable
                      key={g ?? 'none'}
                      style={[styles.chip, item.groupId === g && styles.chipOn]}
                      onPress={() => chooseGroup(item, g)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, item.groupId === g && styles.chipTextOn]}>
                        {g == null ? t('staffConsultants.noGroup') : t('staffConsultants.groupChip', { n: g })}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>{t('staffConsultants.empty')}</Text>}
      />
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 19,
      color: colors.ink,
    },
    count: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkSoft,
    },
    mapLink: {
      marginLeft: 'auto',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.green,
    },
    mapLinkText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12.5,
      color: colors.white,
    },
    sharingSummary: {
      paddingHorizontal: spacing.lg,
      marginTop: 2,
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.green,
    },
    search: {
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 9,
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.ink,
      backgroundColor: colors.surface,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    helpCard: {
      marginTop: spacing.sm,
      backgroundColor: colors.danger,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    helpTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    helpTitle: {
      flex: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.white,
    },
    helpTime: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: 'rgba(255,255,255,0.85)',
    },
    helpActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    helpBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.white,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    helpBtnText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.danger,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.greenPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: {
      fontFamily: fonts.display,
      fontSize: 13,
      color: colors.greenDeep,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    name: {
      flexShrink: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 12.5,
      color: colors.ink,
    },
    groupBadge: {
      borderRadius: radii.pill,
      paddingHorizontal: 7,
      paddingVertical: 1,
      backgroundColor: colors.greenPale,
    },
    groupBadgeNone: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.line,
    },
    groupBadgeText: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.greenDeep,
    },
    groupBadgeTextNone: {
      color: colors.inkSoft,
    },
    chooser: {
      marginLeft: 40,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    chooserLabel: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkSoft,
      marginBottom: spacing.sm,
    },
    chooserChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    chipOn: {
      backgroundColor: colors.green,
      borderColor: colors.green,
    },
    chipText: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 12,
      color: colors.ink,
    },
    chipTextOn: {
      color: colors.white,
    },
    sumBox: {
      marginTop: spacing.sm,
    },
    sumRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
    },
    sumText: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 12.5,
      color: colors.ink,
    },
    pendingList: {
      paddingVertical: spacing.xs,
    },
    pendingTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 12.5,
      color: colors.ink,
    },
    pendingHint: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      color: colors.inkSoft,
      marginTop: 2,
      marginBottom: spacing.xs,
    },
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 5,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    pendingName: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.ink,
    },
    pendingTag: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkSoft,
    },
    status: {
      fontFamily: fonts.body,
      fontSize: 10,
      marginTop: 1,
    },
    statusOk: {
      color: colors.green,
    },
    statusWarn: {
      color: colors.warn,
    },
    statusMuted: {
      color: colors.inkSoft,
    },
    locLine: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.green,
      marginTop: 2,
    },
    locStale: {
      color: colors.inkSoft,
    },
    iconBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.greenPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locBtn: {
      backgroundColor: colors.green,
    },
    verifyBtn: {
      paddingHorizontal: 2,
    },
    unreadDot: {
      position: 'absolute',
      top: -1,
      right: -1,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: colors.danger,
      borderWidth: 1.5,
      borderColor: colors.bg,
    },
    empty: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      paddingVertical: spacing.lg,
      textAlign: 'center',
    },
  });
}
