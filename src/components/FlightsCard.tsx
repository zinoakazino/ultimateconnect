import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { Card } from './Card';
import { useTheme } from '../context/ThemeContext';
import { shortDay } from '../lib/groups';
import { fonts, radii, spacing } from '../theme';
import type { Colors } from '../theme';
import type { TripGroupDoc } from '../types/models';

interface FlightsCardProps {
  group: TripGroupDoc;
  /** The signed-in person's own flights ("Vos vols") rather than just a group's sheet (staff, people not placed yet). */
  own?: boolean;
  /** How many people are in the group — shown to staff. */
  people?: number;
  /** Folded or open when it first shows. Several cards on one screen start folded. */
  defaultOpen?: boolean;
}

/** A group's flights as a boarding-pass sheet: out, back, meeting point, baggage, hotel arrival and check-out. */
export function FlightsCard({ group, own = false, people, defaultOpen = true }: FlightsCardProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [open, setOpen] = useState(defaultOpen);

  // the two free texts come in French and Arabic: the Arabic one when the app is in Arabic (and it was written)
  const arabic = i18n.language === 'ar';
  const meetPlace = (arabic && group.meetPlaceAr) || group.meetPlace;
  const note = (arabic && group.noteAr) || group.note;

  const baggage = [
    group.bagHoldKg != null
      ? group.bagHoldCount > 1
        ? t('flights.bagHoldMany', { count: group.bagHoldCount, kg: group.bagHoldKg })
        : t('flights.bagHold', { kg: group.bagHoldKg })
      : null,
    group.bagCabinKg != null ? t('flights.bagCabin', { kg: group.bagCabinKg }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card style={styles.card}>
      <Pressable
        style={styles.head}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${t('flights.group', { n: group.id })} · ${open ? t('flights.hide') : t('flights.show')}`}
      >
        <View style={styles.headText}>
          <Text style={styles.kicker}>
            {(own ? `${t('flights.title')} · ` : '') + t('flights.group', { n: group.id })}
            {people != null ? ` · ${t('flights.people', { count: people })}` : ''}
          </Text>
          <Text style={styles.airline}>{group.airline}</Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.green} />
      </Pressable>

      {open && (
        <View>
          <Leg
            colors={colors}
            label={t('flights.outbound')}
            day={shortDay(group.outDate, i18n.language)}
            dep={group.outDep}
            arr={group.outArr}
            from={group.outFrom}
            to={group.outTo}
          />
          <Leg
            colors={colors}
            label={t('flights.inbound')}
            day={shortDay(group.backDate, i18n.language)}
            dep={group.backDep}
            arr={group.backArr}
            from={group.backFrom}
            to={group.backTo}
          />
          <Text style={styles.local}>{t('flights.localTimes')}</Text>

          <View style={styles.rule} />
          {group.meetTime ? (
            <Info colors={colors} label={t('flights.meet')} value={group.meetTime} sub={meetPlace} />
          ) : null}
          {baggage ? <Info colors={colors} label={t('flights.baggage')} value={baggage} /> : null}
          {group.hotelArrival ? (
            <Info
              colors={colors}
              label={t('flights.hotelArrival')}
              value={t('flights.aroundTime', { time: group.hotelArrival })}
            />
          ) : null}
          <Info
            colors={colors}
            label={t('flights.checkout')}
            value={group.checkoutBy ? t('flights.beforeTime', { time: group.checkoutBy }) : t('flights.checkoutLater')}
          />
          {note ? (
            <View style={styles.noteBox}>
              <Feather name="info" size={13} color={colors.greenDeep} style={styles.noteIcon} />
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

interface LegProps {
  colors: Colors;
  label: string;
  day: string;
  dep: string;
  arr: string;
  from: string;
  to: string;
}

function Leg({ colors, label, day, dep, arr, from, to }: LegProps) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.leg}>
      <Text style={styles.legLabel}>{`${label} · ${day}`.toUpperCase()}</Text>
      <View style={styles.legRow}>
        <View style={styles.side}>
          <Text style={styles.time}>{dep}</Text>
          <Text style={styles.place}>{from}</Text>
        </View>
        <View style={styles.mid}>
          <View style={styles.midLine} />
          <Feather name="arrow-right" size={14} color={colors.green} />
          <View style={styles.midLine} />
        </View>
        <View style={[styles.side, styles.sideEnd]}>
          <Text style={styles.time}>{arr}</Text>
          <Text style={[styles.place, styles.placeEnd]}>{to}</Text>
        </View>
      </View>
    </View>
  );
}

function Info({ colors, label, value, sub }: { colors: Colors; label: string; value: string; sub?: string }) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueWrap}>
        <Text style={styles.infoValue}>{value}</Text>
        {sub ? <Text style={styles.infoSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    card: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    headText: { flex: 1, minWidth: 0 },
    kicker: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.green,
    },
    airline: {
      fontFamily: fonts.display,
      fontSize: 18,
      color: colors.ink,
      marginTop: 2,
    },
    leg: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    legLabel: {
      fontFamily: fonts.mono,
      fontSize: 9.5,
      letterSpacing: 0.8,
      color: colors.inkSoft,
    },
    legRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: spacing.sm,
    },
    side: { flex: 1.15, minWidth: 0 },
    sideEnd: { alignItems: 'flex-end' },
    time: {
      fontFamily: fonts.display,
      fontSize: 26,
      color: colors.ink,
      letterSpacing: 0.5,
    },
    place: {
      fontFamily: fonts.body,
      fontSize: 11,
      lineHeight: 15,
      color: colors.inkSoft,
      marginTop: 2,
    },
    placeEnd: { textAlign: 'right' },
    mid: {
      flex: 0.7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingTop: 13,
      paddingHorizontal: spacing.xs,
    },
    midLine: { flex: 1, height: 1, backgroundColor: colors.line },
    local: {
      fontFamily: fonts.mono,
      fontSize: 9.5,
      color: colors.inkSoft,
      marginTop: spacing.md,
    },
    rule: {
      height: 1,
      backgroundColor: colors.line,
      marginTop: spacing.md,
    },
    info: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    infoLabel: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      lineHeight: 17,
    },
    infoValueWrap: { flex: 1.3, alignItems: 'flex-end' },
    infoValue: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
      textAlign: 'right',
      lineHeight: 18,
    },
    infoSub: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.inkSoft,
      textAlign: 'right',
      lineHeight: 15,
      marginTop: 2,
    },
    noteBox: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.greenPale,
    },
    noteIcon: { marginTop: 2 },
    noteText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.greenDeep,
    },
  });
}
