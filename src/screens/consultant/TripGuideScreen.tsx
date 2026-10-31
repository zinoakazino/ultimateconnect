import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { SectionLabel } from '../../components/SectionLabel';
import { useTheme } from '../../context/ThemeContext';
import { useTrip } from '../../hooks/useTrip';
import { usePlaces } from '../../hooks/usePlaces';
import { toDate, formatDateRange } from '../../lib/dates';
import { callPhone, openInMaps } from '../../lib/maps';
import { pickText } from '../../lib/localized';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { ConsultantStackParamList } from '../../navigation/types';
import type { PlaceCategory, PlaceDoc } from '../../types/models';

import { useLanguage } from '../../context/LanguageContext';
type Props = NativeStackScreenProps<ConsultantStackParamList, 'TripGuide'>;

export const GUIDE_SECTIONS: {
  key: PlaceCategory;
  titleKey: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: 'emergency', titleKey: 'tripGuide.emergency', icon: 'phone-call' },
  { key: 'group', titleKey: 'tripGuide.groupItinerary', icon: 'users' },
  { key: 'recommended', titleKey: 'tripGuide.onYourOwn', icon: 'compass' },
  { key: 'restaurant', titleKey: 'tripGuide.restaurants', icon: 'coffee' },
  { key: 'shopping', titleKey: 'tripGuide.shopping', icon: 'shopping-bag' },
  { key: 'tool', titleKey: 'tripGuide.usefulApps', icon: 'smartphone' },
  { key: 'info', titleKey: 'tripGuide.info', icon: 'info' },
];

export function TripGuideScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const styles = makeStyles(colors);
  const { trip } = useTrip();
  const { places } = usePlaces();

  const start = trip ? toDate(trip.startDate) : null;
  const end = trip ? toDate(trip.endDate) : null;

  const byCategory = useMemo(() => {
    const map: Record<string, PlaceDoc[]> = {};
    for (const p of places) {
      map[p.category] = map[p.category] ?? [];
      map[p.category].push(p);
    }
    Object.values(map).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [places]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Feather
            name={isRTL ? 'arrow-right' : 'arrow-left'}
            size={18}
            color={colors.ink}
          />
        </Pressable>
        <Text style={styles.title}>{t('tripGuide.title')}</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {trip && (
          <Card variant="dark" noShadow style={styles.tripCard}>
            <Text style={styles.tripName}>{pickText(trip.name, trip.nameAr, i18n.language)}</Text>
            {start && end && <Text style={styles.tripDates}>{formatDateRange(start, end)}</Text>}
          </Card>
        )}

        <Card variant="pale" noShadow style={styles.tipCard}>
          <Feather name="download" size={14} color={colors.greenDeep} style={styles.tipIcon} />
          <Text style={styles.tipText}>{t('tripGuide.offlineTip')}</Text>
        </Card>

        {GUIDE_SECTIONS.map((section) => {
          const items = byCategory[section.key] ?? [];
          if (items.length === 0) return null;
          return (
            <View key={section.key}>
              <SectionLabel style={styles.sectionLabel}>{t(section.titleKey)}</SectionLabel>
              {items.map((place) => {
                const canMap =
                  (place.lat !== undefined && place.lng !== undefined) || Boolean(place.address);
                return (
                  <Card key={place.id} variant="pale" noShadow style={styles.placeCard}>
                    <View style={styles.placeRow}>
                      <Feather name={section.icon} size={14} color={colors.greenDeep} />
                      <Text style={styles.placeName}>{pickText(place.name, place.nameAr, i18n.language)}</Text>
                    </View>
                    {place.description ? (
                      <Text style={styles.placeDesc}>{pickText(place.description, place.descriptionAr, i18n.language)}</Text>
                    ) : null}
                    {place.address ? <Text style={styles.placeAddress}>{place.address}</Text> : null}
                    {(canMap || place.phone) && (
                      <View style={styles.actions}>
                        {canMap && (
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() =>
                              openInMaps({
                                lat: place.lat,
                                lng: place.lng,
                                address: place.address,
                                label: pickText(place.name, place.nameAr, i18n.language),
                              })
                            }
                          >
                            <Feather name="navigation" size={12} color={colors.white} />
                            <Text style={styles.actionText}>{t('tripGuide.openInMaps')}</Text>
                          </Pressable>
                        )}
                        {place.phone ? (
                          <Pressable
                            style={styles.actionBtn}
                            onPress={() => callPhone(place.phone as string)}
                          >
                            <Feather name="phone" size={12} color={colors.white} />
                            <Text style={styles.actionText}>{t('tripGuide.call')}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          );
        })}

        {places.length === 0 && <Text style={styles.empty}>{t('tripGuide.empty')}</Text>}
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
    tripCard: {
      marginBottom: spacing.sm,
    },
    tripName: {
      fontFamily: fonts.display,
      fontSize: 17,
      color: colors.white,
    },
    tripDates: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 4,
    },
    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    tipIcon: {
      marginTop: 2,
    },
    tipText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.greenDeep,
    },
    sectionLabel: {
      marginTop: spacing.lg,
    },
    placeCard: {
      marginBottom: spacing.sm,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    placeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    placeName: {
      flex: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.greenDeep,
    },
    placeDesc: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.greenDeep,
      marginTop: 4,
      lineHeight: 17,
    },
    placeAddress: {
      fontFamily: fonts.mono,
      fontSize: 9.5,
      color: colors.greenDeep,
      opacity: 0.7,
      marginTop: 4,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.green,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
    },
    actionText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.white,
    },
    empty: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
  });
}
