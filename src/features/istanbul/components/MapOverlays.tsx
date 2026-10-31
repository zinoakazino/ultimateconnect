import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../context/ThemeContext';
import { fonts, radii, spacing } from '../../../theme';
import type { Colors } from '../../../theme';
import { useIstanbul, ZONE_STYLE } from '../data';
import { circleRadii, formatDistance, type LocationNotice, type LocationStatus } from '../geo';

const RED = '#DC2626';
const AMBER = '#D97706';
const GREEN = '#16A34A';

/**
 * Red "Urgence" button that opens the offline emergency screen from anywhere. `compact` shows
 * only the icon, for crowded headers.
 */
export function EmergencyButton({ compact, style }: { compact?: boolean; style?: object }) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  return (
    <Pressable
      onPress={() => navigation.navigate('Emergency')}
      style={({ pressed }) => [
        emergencyStyles.pill,
        compact && emergencyStyles.compact,
        pressed && { opacity: 0.85 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('map.emergency')}
      hitSlop={6}
    >
      <Feather name="alert-triangle" size={compact ? 17 : 15} color="#FFFFFF" />
      {!compact && <Text style={emergencyStyles.label}>{t('map.emergency')}</Text>}
    </Pressable>
  );
}

const emergencyStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: RED,
  },
  compact: {
    width: 40,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});

/** The result of "Où suis-je ?": one banner per notice, most severe first. */
export function LocationBanner({
  status,
  onClose,
}: {
  status: LocationStatus;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // the "where am I" messages are said in the app's language, from their code
  const noticeTitle = (n: LocationNotice) => (n.code ? t(`map.notice.${n.code}.title`, n.params) : n.title);
  const noticeText = (n: LocationNotice) =>
    n.code ? t(`map.notice.${n.code}.text`, { ...n.params, anchor: n.params?.anchor || t('map.theHotel') }) : n.text;
  const { colors, mode } = useTheme();
  const dark = mode === 'dark';
  const tone = {
    red: { bar: RED, bg: dark ? '#3B1414' : '#FEE2E2', title: dark ? '#FCA5A5' : '#B91C1C', icon: 'alert-octagon' },
    amber: { bar: AMBER, bg: dark ? '#3A2A0B' : '#FEF3C7', title: dark ? '#FCD34D' : '#92400E', icon: 'alert-triangle' },
    ok: { bar: GREEN, bg: dark ? '#0F2E1B' : '#DCFCE7', title: dark ? '#86EFAC' : '#166534', icon: 'check-circle' },
  } as const;

  return (
    <View style={bannerStyles.wrap} pointerEvents="box-none">
      {status.notices.slice(0, 3).map((n, i) => {
        const c = tone[n.level];
        // Only the most severe notice is shown in full; the others stay one line each so the
        // map remains visible.
        if (i > 0) {
          return (
            <View
              key={`${n.level}-${i}`}
              style={[bannerStyles.compact, { backgroundColor: c.bg, borderLeftColor: c.bar }]}
              accessibilityRole="alert"
            >
              <Feather name={c.icon} size={15} color={c.bar} />
              <Text style={[bannerStyles.compactText, { color: c.title }]} numberOfLines={2}>
                {noticeTitle(n)}
              </Text>
            </View>
          );
        }
        return (
          <View
            key={`${n.level}-${i}`}
            style={[bannerStyles.card, { backgroundColor: c.bg, borderLeftColor: c.bar }]}
            accessibilityRole="alert"
          >
            <Feather name={c.icon} size={20} color={c.bar} style={bannerStyles.icon} />
            <View style={bannerStyles.texts}>
              <Text style={[bannerStyles.title, { color: c.title }]}>{noticeTitle(n)}</Text>
              <Text style={[bannerStyles.text, { color: colors.ink }]}>{noticeText(n)}</Text>
              <Text style={[bannerStyles.meta, { color: colors.inkSoft }]}>
                {t('map.distanceFromHotel', { distance: formatDistance(status.distanceToHotel) })}
                {' · '}
                {t('map.locationPrivate')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={bannerStyles.close}
              accessibilityLabel={t('common.close')}
            >
              <Feather name="x" size={18} color={colors.inkSoft} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 6,
    borderRadius: radii.md,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderLeftWidth: 6,
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  compactText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16 },
  icon: { marginRight: spacing.sm, marginTop: 1 },
  texts: { flex: 1 },
  title: { fontFamily: fonts.bodyBold, fontSize: 13.5, lineHeight: 18 },
  text: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, marginTop: 4 },
  close: { marginLeft: spacing.sm, marginTop: -2 },
});

/** Collapsible legend of zone colors and place categories. */
export function Legend() {
  const { t } = useTranslation();
  const { data: istanbul } = useIstanbul();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const styles = makeLegendStyles(colors);
  const { green, orange } = circleRadii(istanbul);

  const zones: { color: string; label: string; dashed?: boolean }[] = [
    { color: ZONE_STYLE.verte.color, label: t('map.legendGreen', { km: green / 1000 }) },
    { color: ZONE_STYLE.orange.color, label: t('map.legendOrange', { km: orange / 1000 }), dashed: true },
    { color: ZONE_STYLE.eviter.color, label: t('map.legendAvoid') },
    { color: ZONE_STYLE.prudence.color, label: t('map.legendCaution') },
  ];

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Feather name="layers" size={15} color={colors.ink} />
        <Text style={styles.toggleText}>{t('map.legend')}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkSoft} />
      </Pressable>
      {open && (
        <View style={styles.panel}>
          <Text style={styles.section}>{t('map.legendZones')}</Text>
          {zones.map((z) => (
            <View key={z.label} style={styles.row}>
              <View
                style={[
                  styles.swatch,
                  { borderColor: z.color, backgroundColor: z.dashed ? 'transparent' : `${z.color}33` },
                  z.dashed && { borderStyle: 'dashed' },
                ]}
              />
              <Text style={styles.rowText}>{z.label}</Text>
            </View>
          ))}
          <Text style={[styles.section, { marginTop: spacing.sm }]}>{t('map.legendPlaces')}</Text>
          {istanbul.categories.map((c) => (
            <View key={c.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: c.color }]}>
                <Text style={styles.dotIcon}>{c.icon}</Text>
              </View>
              <Text style={styles.rowText}>{c.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function makeLegendStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: { alignSelf: 'flex-start' },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 5,
      elevation: 4,
    },
    toggleText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
    panel: {
      marginTop: spacing.xs,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      gap: 6,
      maxWidth: 290,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
    },
    section: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.inkSoft,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    rowText: { flex: 1, fontFamily: fonts.body, fontSize: 12.5, color: colors.ink },
    swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5 },
    dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    dotIcon: { fontSize: 11 },
  });
}

/** "Règles du groupe": the four rules everyone follows. */
export function RulesCard({ compact }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { data: istanbul } = useIstanbul();
  const { colors } = useTheme();
  const styles = makeRulesStyles(colors);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Feather name="users" size={16} color={colors.green} />
        <Text style={styles.title}>{t('map.rules')}</Text>
      </View>
      {istanbul.rules.map((rule) => (
        <View key={rule} style={styles.row}>
          <Feather name="check" size={15} color={colors.green} style={styles.check} />
          <Text style={[styles.text, compact && { fontSize: 12.5 }]}>{rule}</Text>
        </View>
      ))}
    </View>
  );
}

function makeRulesStyles(colors: Colors) {
  return StyleSheet.create({
    card: {
      borderRadius: radii.lg,
      padding: spacing.lg,
      backgroundColor: colors.greenPale,
      gap: spacing.sm,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { fontFamily: fonts.display, fontSize: 16, color: colors.greenDeep },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    check: { marginTop: 2 },
    text: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13.5, lineHeight: 19, color: colors.greenDeep },
  });
}
