import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../context/ThemeContext';
import { fonts, radii, spacing } from '../../../theme';
import { openDirections } from '../../../lib/maps';
import { ACCESS_LABEL, getCategory, istanbul, ZONE_STYLE, type ResolvedZone } from '../data';
import { distanceMeters, formatDistance } from '../geo';
import type { Place } from '../types';

const WALK_METERS_PER_MIN = 80;

function ActionButton({
  label,
  icon,
  onPress,
  tone = 'solid',
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  tone?: 'solid' | 'outline';
}) {
  const { colors } = useTheme();
  const solid = tone === 'solid';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        sheetStyles.action,
        solid
          ? { backgroundColor: colors.green, borderColor: colors.green }
          : { backgroundColor: 'transparent', borderColor: colors.line },
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
    >
      <Feather name={icon} size={17} color={solid ? '#FFFFFF' : colors.ink} />
      <Text style={[sheetStyles.actionLabel, { color: solid ? '#FFFFFF' : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function Badge({ label, color, solid }: { label: string; color: string; solid?: boolean }) {
  return (
    <View
      style={[
        sheetStyles.badge,
        solid ? { backgroundColor: color, borderColor: color } : { borderColor: color, backgroundColor: `${color}1F` },
      ]}
    >
      <Text style={[sheetStyles.badgeText, { color: solid ? '#FFFFFF' : color }]}>{label}</Text>
    </View>
  );
}

/** Details of a place: what it is, a practical tip, the price and how to get there. */
export function PlaceSheet({ place }: { place: Place }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const category = getCategory(place.category);
  const access = ACCESS_LABEL[place.zone];
  const distance = distanceMeters(place, istanbul.hotel);
  const walkMinutes = Math.max(1, Math.round(distance / WALK_METERS_PER_MIN));

  return (
    <View>
      <View style={sheetStyles.titleRow}>
        <View style={[sheetStyles.icon, { backgroundColor: category?.color ?? colors.green }]}>
          <Text style={sheetStyles.iconText}>{category?.icon ?? '📍'}</Text>
        </View>
        <View style={sheetStyles.titleTexts}>
          <Text style={[sheetStyles.title, { color: colors.ink }]}>{place.name}</Text>
          <Text style={[sheetStyles.sub, { color: colors.inkSoft }]}>{category?.label}</Text>
        </View>
      </View>

      <View style={sheetStyles.badges}>
        <Badge label={access.label} color={access.color} />
        <Badge label={place.price} color={place.price === 'Gratuit' ? '#16A34A' : '#475569'} />
        <Badge
          label={
            place.zone === 'verte'
              ? t('map.walkMinutes', { minutes: walkMinutes })
              : t('map.distanceFromHotel', { distance: formatDistance(distance) })
          }
          color="#475569"
        />
      </View>

      <Text style={[sheetStyles.body, { color: colors.ink }]}>{place.description}</Text>

      <View style={[sheetStyles.tip, { backgroundColor: colors.greenPale }]}>
        <Feather name="info" size={16} color={colors.greenDeep} style={sheetStyles.tipIcon} />
        <Text style={[sheetStyles.tipText, { color: colors.greenDeep }]}>{place.tip}</Text>
      </View>

      {place.zone === 'staff' && (
        <Text style={[sheetStyles.warn, { color: '#DC2626' }]}>{t('map.staffOnlyWarning')}</Text>
      )}
      {!place.verified && (
        <Text style={[sheetStyles.approx, { color: colors.inkSoft }]}>{t('map.approx')}</Text>
      )}

      <View style={sheetStyles.actions}>
        <ActionButton
          icon="navigation"
          label={t('map.directions')}
          onPress={() => openDirections(place, place.zone === 'verte' ? 'walking' : 'transit')}
        />
      </View>
    </View>
  );
}

/** What a zone means, in the group's own words. */
export function ZoneSheet({ zone }: { zone: ResolvedZone }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const style = ZONE_STYLE[zone.kind];
  const title =
    zone.kind === 'eviter' ? t('map.legendAvoid') : zone.kind === 'prudence' ? t('map.legendCaution') : style.label;
  return (
    <View>
      <View style={sheetStyles.titleRow}>
        <View style={[sheetStyles.icon, { backgroundColor: style.color }]}>
          <Feather name={zone.kind === 'eviter' ? 'alert-octagon' : zone.kind === 'prudence' ? 'alert-triangle' : 'compass'} size={20} color="#FFFFFF" />
        </View>
        <View style={sheetStyles.titleTexts}>
          <Text style={[sheetStyles.title, { color: colors.ink }]}>{zone.name}</Text>
          <Text style={[sheetStyles.sub, { color: style.color }]}>{title}</Text>
        </View>
      </View>
      <Text style={[sheetStyles.body, { color: colors.ink }]}>{zone.message}</Text>
      {(zone.kind === 'verte' || zone.kind === 'orange') && (
        <Text style={[sheetStyles.approx, { color: colors.inkSoft }]}>
          {t('map.zoneRadius', { km: zone.radius / 1000 })}
        </Text>
      )}
    </View>
  );
}

export function HotelSheet() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hotel = istanbul.hotel;
  return (
    <View>
      <View style={sheetStyles.titleRow}>
        <View style={[sheetStyles.icon, { backgroundColor: colors.greenDeep }]}>
          <Text style={sheetStyles.iconText}>🏨</Text>
        </View>
        <View style={sheetStyles.titleTexts}>
          <Text style={[sheetStyles.title, { color: colors.ink }]}>{hotel.name}</Text>
          <Text style={[sheetStyles.sub, { color: colors.inkSoft }]}>{t('map.hotel')}</Text>
        </View>
      </View>
      <Text style={[sheetStyles.body, { color: colors.ink }]}>{hotel.address}</Text>
      {hotel.note ? <Text style={[sheetStyles.approx, { color: colors.inkSoft }]}>{hotel.note}</Text> : null}
      <View style={sheetStyles.actions}>
        <ActionButton icon="navigation" label={t('map.backToHotel')} onPress={() => openDirections(hotel, 'walking')} />
      </View>
    </View>
  );
}

export function PersonSheet({
  name,
  detail,
  status,
  lat,
  lng,
}: {
  name: string;
  detail: string;
  status: string;
  lat: number;
  lng: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View>
      <View style={sheetStyles.titleRow}>
        <View style={[sheetStyles.icon, { backgroundColor: colors.green }]}>
          <Feather name="user" size={20} color="#FFFFFF" />
        </View>
        <View style={sheetStyles.titleTexts}>
          <Text style={[sheetStyles.title, { color: colors.ink }]}>{name}</Text>
          <Text style={[sheetStyles.sub, { color: colors.inkSoft }]}>{detail}</Text>
        </View>
      </View>
      <Text style={[sheetStyles.body, { color: colors.ink }]}>{status}</Text>
      <View style={sheetStyles.actions}>
        <ActionButton
          icon="navigation"
          tone="outline"
          label={t('map.directions')}
          onPress={() => openDirections({ lat, lng }, 'walking')}
        />
      </View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingRight: 36 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 22 },
  titleTexts: { flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23 },
  sub: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, marginTop: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, marginTop: spacing.md },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  tipIcon: { marginTop: 2 },
  tipText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 13.5, lineHeight: 19 },
  warn: { fontFamily: fonts.bodyBold, fontSize: 13, marginTop: spacing.md },
  approx: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  action: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  actionLabel: { fontFamily: fonts.bodyBold, fontSize: 15 },
});

// Re-exported so other screens can build buttons of the same look.
export { ActionButton };
