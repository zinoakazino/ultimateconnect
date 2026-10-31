import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SectionLabel } from '../../components/SectionLabel';
import { ToggleRow } from '../../components/ToggleRow';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useConsultants } from '../../hooks/useConsultants';
import { useSchedule, newScheduleItemId } from '../../hooks/useSchedule';
import {
  closeCheckin,
  openCheckin,
  useCheckinResponses,
  useLatestCheckin,
} from '../../hooks/useCheckin';
import { readReceipts, useRecentBroadcasts } from '../../hooks/useBroadcasts';
import { createBroadcast, newId, notifyUsers } from '../../lib/api';
import { timeAgo, todayKey } from '../../lib/dates';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { BroadcastDoc, UserDoc } from '../../types/models';

type Receipt = { read: string[]; unread: string[] } | 'loading';

export function BroadcastScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { authUser } = useAuth();
  const { consultants } = useConsultants();
  const { items, publish } = useSchedule(todayKey());
  const latestCheckin = useLatestCheckin();
  const responses = useCheckinResponses(latestCheckin?.id);
  const recent = useRecentBroadcasts(5);

  const [message, setMessage] = useState('');
  const [audienceMode, setAudienceMode] = useState<'all' | 'pick'>('all');
  const [picked, setPicked] = useState<string[]>([]);
  const [pinToSchedule, setPinToSchedule] = useState(true);
  const [requireCheckin, setRequireCheckin] = useState(false);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});

  const nameOf = (uid: string) => consultants.find((c) => c.uid === uid)?.name ?? '—';
  const audienceIds = audienceMode === 'all' ? consultants.map((c) => c.uid) : picked;

  const togglePicked = (uid: string) => {
    setPicked((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const onSend = async () => {
    const text = message.trim();
    const staffUid = authUser?.uid;
    if (!text || audienceIds.length === 0 || sending || !staffUid) return;
    setSending(true);
    try {
      const broadcastId = newId();
      // The announcement lands in everyone's alerts; every copy shares this id, so "who has
      // read it" is a single query.
      await notifyUsers(audienceIds, 'broadcast', text, { broadcastId });
      await createBroadcast({ id: broadcastId, text, audience: audienceIds, createdBy: staffUid });
      if (requireCheckin) {
        await openCheckin(text.length > 120 ? `${text.slice(0, 117)}…` : text, staffUid);
      }
      if (pinToSchedule) {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        await publish([
          ...items,
          { id: newScheduleItemId(), time, title: text, important: true, createdBy: staffUid },
        ]);
      }
      setMessage('');
      setPicked([]);
      setRequireCheckin(false);
      setJustSent(true);
      setTimeout(() => setJustSent(false), 3000);
    } finally {
      setSending(false);
    }
  };

  const loadReceipts = async (b: BroadcastDoc) => {
    setReceipts((prev) => ({ ...prev, [b.id]: 'loading' }));
    const result = await readReceipts(b);
    setReceipts((prev) => ({ ...prev, [b.id]: result }));
  };

  const answeredUids = new Set(responses.map((r) => r.uid));
  const missing = consultants.filter((c) => !answeredUids.has(c.uid));

  const previewParts = [t('staffBroadcast.previewNotif')];
  if (pinToSchedule) previewParts.push(t('staffBroadcast.previewPinned'));
  if (requireCheckin) previewParts.push(t('staffBroadcast.previewCheckin'));

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{t('staffBroadcast.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {latestCheckin && (
          <Card noShadow style={styles.rollCard}>
            <View style={styles.rollTop}>
              <Feather name="map-pin" size={14} color={colors.green} />
              <Text style={styles.rollTitle} numberOfLines={2}>
                {latestCheckin.title}
              </Text>
              <View style={[styles.rollBadge, latestCheckin.closed && styles.rollBadgeClosed]}>
                <Text style={styles.rollBadgeText}>
                  {latestCheckin.closed ? t('staffBroadcast.rollClosed') : t('staffBroadcast.rollCall')}
                </Text>
              </View>
            </View>
            <Text style={styles.rollCount}>
              {t('staffBroadcast.present', { count: responses.length, total: consultants.length })}
            </Text>
            {missing.length > 0 && (
              <Text style={styles.rollMissing}>
                {t('staffBroadcast.missing')} : {missing.map((c) => c.name).join(', ')}
              </Text>
            )}
            {!latestCheckin.closed && (
              <Button
                label={t('staffBroadcast.closeRollCall')}
                variant="outline"
                onPress={() => closeCheckin(latestCheckin.id).catch(() => {})}
                style={styles.rollClose}
              />
            )}
          </Card>
        )}

        <SectionLabel style={styles.firstLabel}>{t('staffBroadcast.message')}</SectionLabel>
        <TextInput
          style={styles.box}
          value={message}
          onChangeText={setMessage}
          placeholder={t('staffBroadcast.messagePlaceholder') ?? ''}
          placeholderTextColor={colors.inkSoft}
          multiline
        />

        <SectionLabel>{t('staffBroadcast.audience')}</SectionLabel>
        <View style={styles.pillRow}>
          <Pressable
            style={[styles.pill, audienceMode === 'all' && styles.pillOn]}
            onPress={() => setAudienceMode('all')}
          >
            <Text style={[styles.pillText, audienceMode === 'all' && styles.pillTextOn]}>
              {t('staffBroadcast.allConsultants', { count: consultants.length })}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.pill, audienceMode === 'pick' && styles.pillOn]}
            onPress={() => setAudienceMode('pick')}
          >
            <Text style={[styles.pillText, audienceMode === 'pick' && styles.pillTextOn]}>
              {t('staffBroadcast.choosePeople')}
            </Text>
          </Pressable>
        </View>

        {audienceMode === 'pick' && (
          <View style={styles.pickList}>
            {consultants.map((c: UserDoc) => (
              <Pressable key={c.uid} style={styles.pickRow} onPress={() => togglePicked(c.uid)}>
                <Feather
                  name={picked.includes(c.uid) ? 'check-square' : 'square'}
                  size={16}
                  color={picked.includes(c.uid) ? colors.green : colors.inkSoft}
                />
                <Text style={styles.pickName}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <ToggleRow
          title={t('staffBroadcast.pinSchedule')}
          subtitle={t('staffBroadcast.pinScheduleSub')}
          value={pinToSchedule}
          onValueChange={setPinToSchedule}
          style={styles.toggle}
        />
        <ToggleRow
          title={t('staffBroadcast.requireCheckin')}
          subtitle={t('staffBroadcast.requireCheckinSub')}
          value={requireCheckin}
          onValueChange={setRequireCheckin}
          style={styles.toggle}
        />

        <Card variant="pale" noShadow style={styles.preview}>
          <Text style={styles.previewText}>
            {t('staffBroadcast.previewPrefix')}
            {previewParts.join(t('common.separator'))}.
          </Text>
        </Card>

        <Button
          label={t('staffBroadcast.sendNow')}
          variant="dark"
          onPress={onSend}
          loading={sending}
          disabled={!message.trim() || audienceIds.length === 0}
          style={styles.sendBtn}
        />
        {justSent && <Text style={styles.sentNote}>{t('staffBroadcast.sent')}</Text>}

        {recent.length > 0 && (
          <>
            <SectionLabel>{t('staffBroadcast.sentTitle')}</SectionLabel>
            {recent.map((b) => {
              const receipt = receipts[b.id];
              return (
                <View key={b.id} style={styles.sentRow}>
                  <Text style={styles.sentText} numberOfLines={3}>
                    {b.text}
                  </Text>
                  <View style={styles.sentMeta}>
                    <Text style={styles.sentTime}>{timeAgo(b.createdAt)}</Text>
                    {receipt === undefined && (
                      <Pressable onPress={() => loadReceipts(b)} hitSlop={8}>
                        <Text style={styles.sentLink}>{t('staffBroadcast.seeReaders')}</Text>
                      </Pressable>
                    )}
                  </View>
                  {receipt === 'loading' && (
                    <Text style={styles.sentReceipt}>{t('common.loading')}</Text>
                  )}
                  {receipt && receipt !== 'loading' && (
                    <>
                      <Text style={styles.sentReceipt}>
                        {t('staffBroadcast.readBy', {
                          count: receipt.read.length,
                          total: b.audience.length,
                        })}
                      </Text>
                      {receipt.unread.length > 0 && (
                        <Text style={styles.sentUnread}>
                          {t('staffBroadcast.notReadYet', {
                            names: receipt.unread.map(nameOf).join(', '),
                          })}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 19,
      color: colors.ink,
    },
    body: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    rollCard: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
    },
    rollTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    rollTitle: {
      flex: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    rollBadge: {
      backgroundColor: colors.green,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    rollBadgeClosed: {
      backgroundColor: colors.inkSoft,
    },
    rollBadgeText: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.white,
    },
    rollCount: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: colors.ink,
      marginTop: spacing.sm,
    },
    rollMissing: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.warn,
      marginTop: spacing.xs,
    },
    rollClose: {
      marginTop: spacing.md,
      paddingVertical: 10,
    },
    firstLabel: {
      marginTop: spacing.md,
    },
    box: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.md,
      padding: spacing.md,
      minHeight: 90,
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.ink,
      textAlignVertical: 'top',
      backgroundColor: colors.surface,
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
      fontSize: 10,
      color: colors.inkSoft,
    },
    pillTextOn: {
      color: colors.white,
    },
    pickList: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
    },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    pickName: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.ink,
    },
    toggle: {
      marginTop: spacing.lg,
    },
    preview: {
      marginTop: spacing.lg,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    previewText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.greenDeep,
      lineHeight: 16,
    },
    sendBtn: {
      marginTop: spacing.lg,
    },
    sentNote: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.green,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    sentRow: {
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    sentText: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      lineHeight: 18,
      color: colors.ink,
    },
    sentMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4,
    },
    sentTime: {
      fontFamily: fonts.mono,
      fontSize: 9,
      color: colors.inkSoft,
    },
    sentLink: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.green,
    },
    sentReceipt: {
      fontFamily: fonts.bodyBold,
      fontSize: 11.5,
      color: colors.ink,
      marginTop: 4,
    },
    sentUnread: {
      fontFamily: fonts.body,
      fontSize: 11,
      lineHeight: 16,
      color: colors.warn,
      marginTop: 2,
    },
  });
}
