import React, { useState } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Button } from '../../components/Button';
import { ToggleRow } from '../../components/ToggleRow';
import { useTheme } from '../../context/ThemeContext';
import { useSchedule, newScheduleItemId, compareScheduleItems } from '../../hooks/useSchedule';
import { useConsultants } from '../../hooks/useConsultants';
import { useTripGroups } from '../../hooks/useTripGroups';
import { notifyUsers } from '../../lib/api';
import { todayKey } from '../../lib/dates';
import { groupTag } from '../../lib/groups';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { ScheduleItem } from '../../types/models';

function addDays(key: string, delta: number) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return todayKey(date);
}

function formatDateLabel(key: string, locale: string) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function ScheduleComposerScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [dateKey, setDateKey] = useState(todayKey());
  const { items, publish } = useSchedule(dateKey);
  const { consultants } = useConsultants();
  const { groups } = useTripGroups();

  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [important, setImportant] = useState(false);
  // who the new line is for: everybody (null) or one travel group
  const [audience, setAudience] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [draft, setDraft] = useState<ScheduleItem[] | null>(null);

  const list = draft ?? items;
  const prevIcon = I18nManager.isRTL ? 'chevron-right' : 'chevron-left';
  const nextIcon = I18nManager.isRTL ? 'chevron-left' : 'chevron-right';

  const addItem = () => {
    if (!time.trim() || !title.trim()) return;
    const item: ScheduleItem = {
      id: newScheduleItemId(),
      time: time.trim(),
      title: title.trim(),
      important,
      createdBy: 'staff',
      ...(audience != null ? { group: audience } : {}),
    };
    setDraft([...(draft ?? items), item].sort(compareScheduleItems));
    setTime('');
    setTitle('');
    setImportant(false);
  };

  const removeItem = (id: string) => {
    setDraft((list ?? items).filter((i) => i.id !== id));
  };

  const onPublish = async () => {
    if (!draft) return;
    setPublishing(true);
    try {
      // Only items that weren't already published count as news, so re-publishing
      // doesn't re-alert everyone about reminders they've already received.
      const alreadyPublished = new Set(items.map((i) => i.id));
      const newImportant = draft.filter((i) => i.important && !alreadyPublished.has(i.id));
      await publish(draft);
      const consultantIds = consultants.map((c) => c.uid);
      if (consultantIds.length > 0) {
        await notifyUsers(
          consultantIds,
          'schedule',
          t('staffSchedule.updatedNotice', { date: formatDateLabel(dateKey, i18n.language) })
        );
        for (const item of newImportant) {
          // a line for one travel group is only news to that group (and to people not placed in a group yet)
          const who =
            item.group != null
              ? consultants.filter((c) => c.groupId == null || c.groupId === item.group).map((c) => c.uid)
              : consultantIds;
          await notifyUsers(who, 'reminder', `${t('home.reminderPrefix')}${item.title}`);
        }
      }
      setDraft(null);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>{t('staffSchedule.title')}</Text>
        <View style={styles.dateNav}>
          <Pressable onPress={() => setDateKey((k) => addDays(k, -1))} hitSlop={8}>
            <Feather name={prevIcon} size={16} color={colors.inkSoft} />
          </Pressable>
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{formatDateLabel(dateKey, i18n.language)}</Text>
          </View>
          <Pressable onPress={() => setDateKey((k) => addDays(k, 1))} hitSlop={8}>
            <Feather name={nextIcon} size={16} color={colors.inkSoft} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {list.map((item) => (
          <View key={item.id} style={styles.item}>
            <Text style={styles.itemTime}>{item.time}</Text>
            <Text style={styles.itemTitle}>
              {item.group != null ? `${groupTag(item.group)} · ` : ''}
              {item.title}
              {item.important ? '  📌' : ''}
            </Text>
            <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
              <Feather name="x" size={15} color={colors.inkSoft} />
            </Pressable>
          </View>
        ))}
        {list.length === 0 && <Text style={styles.empty}>{t('staffSchedule.empty')}</Text>}

        <View style={styles.addRow}>
          <TextInput
            style={styles.timeInput}
            value={time}
            onChangeText={setTime}
            placeholder="--:--"
            placeholderTextColor={colors.inkSoft}
          />
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder={t('staffSchedule.addPlaceholder') ?? ''}
            placeholderTextColor={colors.inkSoft}
          />
          <Pressable style={styles.plusBtn} onPress={addItem}>
            <Feather name="plus" size={16} color={colors.white} />
          </Pressable>
        </View>

        {groups.length > 0 && (
          <View style={styles.audience}>
            <Text style={styles.audienceLabel}>{t('staffSchedule.forWho')}</Text>
            <View style={styles.audienceChips}>
              {[null, ...groups.map((g) => g.id)].map((g) => (
                <Pressable
                  key={g ?? 'all'}
                  style={[styles.chip, audience === g && styles.chipOn]}
                  onPress={() => setAudience(g)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, audience === g && styles.chipTextOn]}>
                    {g == null ? t('staffSchedule.everyone') : t('staffSchedule.groupOnly', { n: g })}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <ToggleRow
          title={t('staffSchedule.markImportant')}
          subtitle={t('staffSchedule.markImportantSub')}
          value={important}
          onValueChange={setImportant}
          style={styles.toggleRow}
        />

        <Button
          label={
            draft
              ? t('staffSchedule.publishAll', { count: consultants.length })
              : t('staffSchedule.publish')
          }
          onPress={onPublish}
          loading={publishing}
          disabled={!draft}
          style={styles.publishBtn}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 19,
      color: colors.ink,
    },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    datePill: {
      backgroundColor: colors.greenPale,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    datePillText: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.greenDeep,
    },
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    itemTime: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.green,
      width: 44,
    },
    itemTitle: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.ink,
    },
    empty: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      paddingVertical: spacing.sm,
    },
    addRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    timeInput: {
      width: 60,
      borderWidth: 1,
      borderColor: colors.line,
      borderStyle: 'dashed',
      borderRadius: radii.sm,
      paddingVertical: 8,
      textAlign: 'center',
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.ink,
    },
    titleInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.line,
      borderStyle: 'dashed',
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.ink,
    },
    plusBtn: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    audience: {
      marginTop: spacing.md,
    },
    audienceLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.inkSoft,
      marginBottom: 6,
    },
    audienceChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
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
    toggleRow: {
      marginTop: spacing.lg,
    },
    publishBtn: {
      marginTop: spacing.xl,
    },
  });
}
