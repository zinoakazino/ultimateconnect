import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useConsultants } from '../../hooks/useConsultants';
import { toDate, timeAgo } from '../../lib/dates';
import { openDirections } from '../../lib/maps';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import { getCategory, getPlace, istanbul, resolvedZones, resolveProgram, ZONE_STYLE } from './data';
import { formatDistance, locate, type LocationStatus } from './geo';
import { MapEngine } from './MapEngine';
import type { FitTarget, MapEvent, MapPerson, MapPin, MapState } from './mapProtocol';
import { BottomSheet } from './components/BottomSheet';
import { CategoryChips } from './components/CategoryChips';
import { EmergencyButton, Legend, LocationBanner, RulesCard } from './components/MapOverlays';
import { ProgramList } from './components/ProgramList';
import { HotelSheet, PersonSheet, PlaceSheet, ZoneSheet } from './components/Sheets';

type TabKey = 'map' | 'programs';

type SheetState =
  | { kind: 'place'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'hotel' }
  | { kind: 'rules' }
  | null;

const STALE_MS = 20 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** Where a consultant is, written for the staff looking at their pin. */
function staffSummary(s: LocationStatus): string {
  const distance = formatDistance(s.distanceToHotel);
  const parts: string[] = [];
  const avoid = s.insideZones.filter((z) => z.kind === 'eviter').map((z) => z.name);
  if (avoid.length) parts.push(`Dans une zone à éviter : ${avoid.join(', ')}.`);
  if (s.band === 'staff') parts.push(`Hors de la zone autorisée, à ${distance} de l'hôtel.`);
  else if (s.band === 'orange') parts.push(`Hors de la zone verte, à ${distance} de l'hôtel.`);
  else parts.push(`Dans la zone verte, à ${distance} de l'hôtel.`);
  const caution = s.insideZones.filter((z) => z.kind === 'prudence').map((z) => z.name);
  if (caution.length) parts.push(`Zone de prudence : ${caution.join(', ')}.`);
  return parts.join(' ');
}

/**
 * "Carte Istanbul": the group's recommended places, the zones where people may go, the day
 * programs and a "Où suis-je ?" check. Everything shown comes from istanbul-data.json.
 */
export function IstanbulMapScreen() {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const styles = makeStyles(colors);
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const isStaff = profile?.role === 'staff';
  // Staff reach the map from the Personnes screen (a stack screen): it needs a back arrow.
  // For consultants it is a tab, with the tab bar below.
  const showBack = route.name === 'IstanbulMap' && navigation.canGoBack();

  const [tab, setTab] = useState<TabKey>('map');
  const [categories, setCategories] = useState<string[]>([]);
  const [programId, setProgramId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [user, setUser] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [status, setStatus] = useState<LocationStatus | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(true);
  const [fit, setFit] = useState<MapState['fit']>({ target: 'default', nonce: 1 });
  const [focusId, setFocusId] = useState<string | null>(null);

  const { consultants } = useConsultants(isStaff);

  const moveCamera = useCallback((target: FitTarget, focus: string | null = null, padTop?: number) => {
    setFocusId(focus);
    setFit((f) => ({ target, nonce: f.nonce + 1, padTop }));
  }, []);

  const program = useMemo(
    () => istanbul.programs.find((p) => p.id === programId) ?? null,
    [programId]
  );

  const routeStops = useMemo(() => {
    if (!program) return null;
    return resolveProgram(program).map((s, i) => ({
      n: i + 1,
      lat: s.lat,
      lng: s.lng,
      title: s.title,
      kind: s.kind,
      placeId: s.placeId,
    }));
  }, [program]);

  const pins = useMemo<MapPin[]>(() => {
    const filtering = categories.length > 0;
    return istanbul.places
      .filter((p) => !filtering || categories.includes(p.category))
      .map((p) => {
        const c = getCategory(p.category);
        return { id: p.id, name: p.name, lat: p.lat, lng: p.lng, color: c?.color ?? '#475569', icon: c?.icon ?? '📍' };
      });
  }, [categories]);

  const people = useMemo<(MapPerson & { statusText: string })[]>(() => {
    if (!isStaff || !showPeople) return [];
    return consultants
      .filter((c) => c.locationSharing && c.location && typeof c.location.lat === 'number')
      .map((c) => {
        const loc = c.location!;
        const result = locate({ lat: loc.lat, lng: loc.lng }, istanbul);
        const worst = result.notices[0];
        const updated = toDate(loc.updatedAt as any)?.getTime();
        const stale = updated ? Date.now() - updated > STALE_MS : false;
        const color = stale
          ? '#64748B'
          : worst.level === 'red'
            ? '#DC2626'
            : worst.level === 'amber'
              ? '#D97706'
              : '#16A34A';
        return {
          id: c.uid,
          name: c.name,
          lat: loc.lat,
          lng: loc.lng,
          color,
          detail: timeAgo(loc.updatedAt as any),
          statusText: staffSummary(result),
        };
      });
  }, [consultants, isStaff, showPeople]);

  const mapState = useMemo<MapState>(
    () => ({
      hotel: { lat: istanbul.hotel.lat, lng: istanbul.hotel.lng, name: istanbul.hotel.name },
      zones: resolvedZones.map((z) => ({
        id: z.id,
        kind: z.kind,
        name: z.name,
        lat: z.centerLat,
        lng: z.centerLng,
        radius: z.radius,
        color: ZONE_STYLE[z.kind].color,
        fillOpacity: ZONE_STYLE[z.kind].fillOpacity,
        dashed: ZONE_STYLE[z.kind].dashed,
      })),
      pins,
      route: routeStops,
      user,
      people: people.map(({ statusText: _s, ...p }) => p),
      selectedId,
      dark: mode === 'dark',
      fit,
      focusId,
    }),
    [pins, routeStops, user, people, selectedId, mode, fit, focusId]
  );

  const onMapEvent = useCallback((e: MapEvent) => {
    switch (e.type) {
      case 'pinTap':
        if (e.id === 'hotel') {
          setSelectedId(null);
          setSheet({ kind: 'hotel' });
        } else {
          setSelectedId(e.id);
          setSheet({ kind: 'place', id: e.id });
        }
        break;
      case 'stopTap':
        setSelectedId(e.placeId);
        setSheet({ kind: 'place', id: e.placeId });
        break;
      case 'zoneTap':
        setSheet({ kind: 'zone', id: e.id });
        break;
      case 'personTap':
        setSheet({ kind: 'person', id: e.id });
        break;
      case 'mapTap':
        setSheet(null);
        setSelectedId(null);
        break;
      default:
        break;
    }
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setSelectedId(null);
  }, []);

  const onLocate = useCallback(async () => {
    setLocationError(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError(t('map.locationDenied'));
        return;
      }
      const position =
        (await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          12000
        )) ?? (await Location.getLastKnownPositionAsync());
      if (!position) {
        setLocationError(t('map.locationUnavailable'));
        return;
      }
      const here = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
      };
      const result = locate(here, istanbul);
      setUser(here);
      setStatus(result);
      setSheet(null);
      // Keep both the user and the hotel clear of the banners that now cover the top.
      moveCamera('user', null, 150 + Math.min(result.notices.length - 1, 2) * 34);
    } catch {
      setLocationError(t('map.locationUnavailable'));
    } finally {
      setLocating(false);
    }
  }, [moveCamera, t]);

  const onBackToHotel = useCallback(() => {
    const far = status ? status.band !== 'verte' : false;
    openDirections(istanbul.hotel, far ? 'transit' : 'walking');
  }, [status]);

  const showProgramOnMap = useCallback(
    (id: string) => {
      setProgramId(id);
      setTab('map');
      setSheet(null);
      moveCamera('route');
    },
    [moveCamera]
  );

  const openStopFromList = useCallback(
    (id: string, placeId: string) => {
      setProgramId(id);
      setTab('map');
      setSelectedId(placeId);
      setSheet({ kind: 'place', id: placeId });
      moveCamera('place', placeId);
    },
    [moveCamera]
  );

  const sheetContent = (() => {
    if (!sheet) return null;
    if (sheet.kind === 'place') {
      const place = getPlace(sheet.id);
      return place ? <PlaceSheet place={place} /> : null;
    }
    if (sheet.kind === 'zone') {
      const zone = resolvedZones.find((z) => z.id === sheet.id);
      return zone ? <ZoneSheet zone={zone} /> : null;
    }
    if (sheet.kind === 'hotel') return <HotelSheet />;
    if (sheet.kind === 'person') {
      const person = people.find((p) => p.id === sheet.id);
      return person ? (
        <PersonSheet
          name={person.name}
          detail={person.detail}
          status={person.statusText}
          lat={person.lat}
          lng={person.lng}
        />
      ) : null;
    }
    return <RulesCard />;
  })();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        {showBack && (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Feather name="arrow-left" size={22} color={colors.ink} />
          </Pressable>
        )}
        <View style={styles.headerTexts}>
          <Text style={styles.title}>{t('map.title')}</Text>
          <Text style={styles.subtitle}>
            {istanbul.meta.trip} · {istanbul.hotel.name}
          </Text>
        </View>
        <EmergencyButton />
      </View>

      <View style={styles.segment}>
        {(['map', 'programs'] as TabKey[]).map((key) => {
          const on = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.segmentItem, on && styles.segmentItemOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Feather
                name={key === 'map' ? 'map' : 'list'}
                size={16}
                color={on ? '#FFFFFF' : colors.inkSoft}
              />
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
                {key === 'map' ? t('map.segMap') : t('map.segPrograms')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'map' ? (
        <View style={styles.flex}>
          <CategoryChips selected={categories} onChange={setCategories} />
          {isStaff && (
            <View style={styles.staffRow}>
              <Pressable
                onPress={() => setShowPeople((v) => !v)}
                style={[styles.peopleToggle, showPeople && styles.peopleToggleOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: showPeople }}
              >
                <Feather name="users" size={15} color={showPeople ? '#FFFFFF' : colors.ink} />
                <Text style={[styles.peopleText, showPeople && { color: '#FFFFFF' }]}>
                  {t('map.consultantsOnMap', { count: people.length })}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.mapArea}>
            <MapEngine state={mapState} onEvent={onMapEvent} />

            <View style={styles.topOverlay} pointerEvents="box-none">
              <View style={styles.topRow} pointerEvents="box-none">
                <Legend />
                <Pressable
                  onPress={() => setSheet({ kind: 'rules' })}
                  style={styles.rulesButton}
                  accessibilityRole="button"
                >
                  <Feather name="users" size={15} color={colors.ink} />
                  <Text style={styles.rulesText}>{t('map.rulesShort')}</Text>
                </Pressable>
              </View>

              {program && (
                <View style={styles.programChip}>
                  <Feather name="navigation-2" size={14} color="#FFFFFF" />
                  <Text style={styles.programChipText} numberOfLines={1}>
                    {program.title}
                  </Text>
                  <Pressable
                    onPress={() => setProgramId(null)}
                    hitSlop={10}
                    accessibilityLabel={t('map.clearProgram')}
                  >
                    <Feather name="x" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

              {status && (
                <LocationBanner
                  status={status}
                  onClose={() => {
                    setStatus(null);
                    setUser(null);
                  }}
                />
              )}
              {locationError && (
                <View style={styles.errorBox}>
                  <Feather name="map-pin" size={16} color="#92400E" />
                  <Text style={styles.errorText}>{locationError}</Text>
                  <Pressable onPress={() => setLocationError(null)} hitSlop={10}>
                    <Feather name="x" size={16} color="#92400E" />
                  </Pressable>
                </View>
              )}
            </View>

            {!sheet && (
              <View style={styles.fabColumn} pointerEvents="box-none">
                <Pressable
                  onPress={onBackToHotel}
                  style={({ pressed }) => [styles.fab, styles.fabHotel, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                >
                  <Text style={styles.fabEmoji}>🏨</Text>
                  <Text style={styles.fabHotelText}>{t('map.backToHotel')}</Text>
                </Pressable>
                <Pressable
                  onPress={onLocate}
                  disabled={locating}
                  style={({ pressed }) => [styles.fab, styles.fabLocate, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                >
                  <Feather name="crosshair" size={18} color={colors.ink} />
                  <Text style={styles.fabLocateText}>{locating ? t('map.locating') : t('map.locate')}</Text>
                </Pressable>
              </View>
            )}

            <BottomSheet visible={sheet !== null} onClose={closeSheet}>
              {sheetContent}
            </BottomSheet>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.programsScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>{t('map.programsIntro')}</Text>
          <RulesCard />
          <View style={{ height: spacing.lg }} />
          <ProgramList
            activeId={programId}
            onShowOnMap={showProgramOnMap}
            onStopPress={openStopFromList}
          />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    back: { width: 36, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
    headerTexts: { flex: 1 },
    title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginTop: 1 },
    segment: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      padding: 4,
      gap: 4,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    segmentItem: {
      flex: 1,
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: radii.pill,
    },
    segmentItemOn: { backgroundColor: colors.green },
    segmentText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft },
    segmentTextOn: { color: '#FFFFFF' },
    staffRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row' },
    peopleToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    peopleToggleOn: { backgroundColor: colors.green, borderColor: colors.green },
    peopleText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
    mapArea: { flex: 1, overflow: 'hidden' },
    topOverlay: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.md,
      right: 56,
      gap: spacing.sm,
    },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    rulesButton: {
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
    rulesText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink },
    programChip: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.green,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 5,
      elevation: 5,
    },
    programChipText: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFFFFF' },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: '#FEF3C7',
      borderLeftWidth: 6,
      borderLeftColor: '#D97706',
    },
    errorText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12.5, lineHeight: 17, color: '#92400E' },
    fabColumn: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.lg,
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    fab: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      borderRadius: radii.pill,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.28,
      shadowRadius: 7,
      elevation: 8,
    },
    fabHotel: { backgroundColor: colors.greenDeep, borderWidth: 2, borderColor: '#FFFFFF' },
    fabHotelText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#FFFFFF' },
    fabEmoji: { fontSize: 18 },
    fabLocate: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line },
    fabLocateText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    programsScroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    intro: {
      fontFamily: fonts.body,
      fontSize: 13.5,
      lineHeight: 19,
      color: colors.inkSoft,
      marginBottom: spacing.md,
    },
  });
}
