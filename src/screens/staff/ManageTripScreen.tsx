import React, { useEffect, useMemo, useState } from 'react';
import { I18nManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { SectionLabel } from '../../components/SectionLabel';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../hooks/useTrip';
import { usePlaces } from '../../hooks/usePlaces';
import { saveTrip } from '../../lib/api';
import { todayKey, toDate } from '../../lib/dates';
import { fonts, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { StaffStackParamList } from '../../navigation/types';
import { GUIDE_SECTIONS } from '../consultant/TripGuideScreen';

type Props = NativeStackScreenProps<StaffStackParamList, 'ManageTrip'>;

function parseDay(value: string): Date | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Reject things like 2026-02-31 that JS silently rolls over.
  if (date.getMonth() !== Number(m[2]) - 1 || date.getDate() !== Number(m[3])) return null;
  return date;
}

export function ManageTripScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { trip } = useTrip();
  const { places } = usePlaces();

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Fill the form once from the stored trip; don't clobber what staff is typing afterwards.
  useEffect(() => {
    if (hydrated || !trip) return;
    const s = toDate(trip.startDate);
    const e = toDate(trip.endDate);
    setName(trip.name ?? '');
    setStartDate(s ? todayKey(s) : '');
    setEndDate(e ? todayKey(e) : '');
    setHydrated(true);
  }, [trip, hydrated]);

  const grouped = useMemo(
    () =>
      GUIDE_SECTIONS.map((s) => ({
        ...s,
        items: places.filter((p) => p.category === s.key).sort((a, b) => a.name.localeCompare(b.name)),
      })).filter((s) => s.items.length > 0),
    [places]
  );

  const onSave = async () => {
    const start = parseDay(startDate);
    const end = parseDay(endDate);
    if (!name.trim() || !start || !end || end < start) {
      setMessage({ text: t('manage.invalidDates'), ok: false });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveTrip({ name: name.trim(), startDate: start, endDate: end });
      setMessage({ text: t('manage.saved'), ok: true });
    } catch {
      setMessage({ text: t('auth.errorGeneric'), ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Feather
            name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'}
            size={18}
            color={colors.ink}
          />
        </Pressable>
        <Text style={styles.title}>{t('manage.title')}</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <SectionLabel style={styles.firstLabel}>{t('manage.tripSection')}</SectionLabel>
        <FormField label={t('manage.tripName')} value={name} onChangeText={setName} />
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <FormField
              label={t('manage.startDate')}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-11-14"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.dateCol}>
            <FormField
              label={t('manage.endDate')}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-11-18"
              autoCapitalize="none"
            />
          </View>
        </View>
        {message ? (
          <Text style={[styles.message, message.ok ? styles.messageOk : styles.messageError]}>
            {message.text}
          </Text>
        ) : null}
        <Button label={t('manage.save')} onPress={onSave} loading={saving} />

        <SectionLabel>{t('manage.guideSection')}</SectionLabel>
        <Button
          label={t('manage.addPlace')}
          variant="outline"
          onPress={() => navigation.navigate('PlaceEditor', {})}
        />

        {grouped.length === 0 && <Text style={styles.empty}>{t('manage.noPlaces')}</Text>}

        {grouped.map((section) => (
          <View key={section.key}>
            <Text style={styles.groupTitle}>{t(section.titleKey)}</Text>
            {section.items.map((place) => (
              <Pressable
                key={place.id}
                style={styles.placeRow}
                onPress={() => navigation.navigate('PlaceEditor', { placeId: place.id })}
              >
                <Feather name={section.icon} size={14} color={colors.green} />
                <Text style={styles.placeName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Feather
                  name={I18nManager.isRTL ? 'chevron-left' : 'chevron-right'}
                  size={16}
                  color={colors.inkSoft}
                />
              </Pressable>
            ))}
          </View>
        ))}
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
    title: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: colors.ink,
    },
    scroll: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    firstLabel: {
      marginTop: 2,
    },
    dateRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    dateCol: {
      flex: 1,
    },
    message: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      marginBottom: spacing.sm,
    },
    messageOk: {
      color: colors.green,
    },
    messageError: {
      color: colors.danger,
    },
    empty: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
    groupTitle: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.inkSoft,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    placeName: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: colors.ink,
    },
  });
}
