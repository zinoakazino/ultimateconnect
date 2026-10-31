import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../context/ThemeContext';
import { fonts, radii, spacing } from '../../../theme';
import type { Colors } from '../../../theme';
import { useIstanbul, ZONE_STYLE } from '../data';
import { useAuth } from '../../../context/AuthContext';

interface ProgramListProps {
  /** The program currently drawn on the map, if any. */
  activeId: string | null;
  onShowOnMap: (programId: string) => void;
  onStopPress: (programId: string, placeId: string) => void;
}

export function ProgramList({ activeId, onShowOnMap, onStopPress }: ProgramListProps) {
  const { t } = useTranslation();
  const { data: istanbul, getCategory, getPlace, resolveProgram } = useIstanbul();
  const { profile } = useAuth();
  const myGroup = profile?.groupId ?? null;
  // each group sees the ideas made for ITS free time (staff, and people without a group yet, see them all)
  const ideas = istanbul.programs.filter((p) => p.group == null || myGroup == null || p.group === myGroup);
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [openId, setOpenId] = useState<string | null>(activeId);

  return (
    <View style={styles.list}>
      {ideas.map((program) => {
        const open = openId === program.id;
        const stops = resolveProgram(program);
        const zoneColor = ZONE_STYLE[program.zone].color;
        const active = activeId === program.id;
        return (
          <View key={program.id} style={[styles.card, active && { borderColor: colors.green }]}>
            <Pressable
              onPress={() => setOpenId(open ? null : program.id)}
              style={styles.head}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <View style={styles.headTexts}>
                <Text style={styles.title}>{program.title}</Text>
                <Text style={styles.tagline}>{program.tagline}</Text>
                <View style={styles.chips}>
                  <View style={[styles.chip, { borderColor: zoneColor, backgroundColor: `${zoneColor}1F` }]}>
                    <Text style={[styles.chipText, { color: zoneColor }]}>
                      {t(program.zone === 'verte' ? 'map.zoneLabel.verte' : 'map.zoneLabel.orange')}
                    </Text>
                  </View>
                  <View style={[styles.chip, { borderColor: colors.line }]}>
                    <Text style={[styles.chipText, { color: colors.inkSoft }]}>{program.mode}</Text>
                  </View>
                  <View style={[styles.chip, { borderColor: colors.line }]}>
                    <Text style={[styles.chipText, { color: colors.inkSoft }]}>
                      {t('map.stopsCount', { count: stops.length })}
                    </Text>
                  </View>
                </View>
              </View>
              <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.inkSoft} />
            </Pressable>

            {open && (
              <View style={styles.body}>
                {program.warnings.map((w) => (
                  <View key={w} style={styles.warning}>
                    <Feather name="alert-triangle" size={15} color="#92400E" style={styles.warningIcon} />
                    <Text style={styles.warningText}>{w}</Text>
                  </View>
                ))}

                {stops.map((stop, i) => {
                  const place = stop.placeId ? getPlace(stop.placeId) : undefined;
                  const icon = place ? getCategory(place.category)?.icon : stop.kind === 'hotel' ? '🏨' : '⛴️';
                  const tappable = Boolean(stop.placeId);
                  return (
                    <Pressable
                      key={`${program.id}-${stop.key}`}
                      onPress={tappable ? () => onStopPress(program.id, stop.placeId as string) : undefined}
                      style={styles.stop}
                      accessibilityRole={tappable ? 'button' : undefined}
                    >
                      <View style={styles.stopNum}>
                        <Text style={styles.stopNumText}>{i + 1}</Text>
                      </View>
                      <View style={styles.stopTexts}>
                        <Text style={styles.stopTitle}>
                          {icon} {stop.title}
                        </Text>
                        {stop.note ? <Text style={styles.stopNote}>{stop.note}</Text> : null}
                      </View>
                      <Text style={styles.stopTime}>{stop.time || ''}</Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => onShowOnMap(program.id)}
                  style={({ pressed }) => [styles.showButton, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                >
                  <Feather name="map" size={17} color="#FFFFFF" />
                  <Text style={styles.showLabel}>{t('map.viewOnMap')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    list: { gap: spacing.md },
    card: {
      borderRadius: radii.lg,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    head: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
    headTexts: { flex: 1 },
    title: { fontFamily: fonts.display, fontSize: 16.5, lineHeight: 21, color: colors.ink },
    tagline: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
    chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill, borderWidth: 1.5 },
    chipText: { fontFamily: fonts.bodyBold, fontSize: 11.5 },
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
    warning: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radii.md,
      backgroundColor: '#FEF3C7',
      marginBottom: spacing.xs,
    },
    warningIcon: { marginTop: 2 },
    warningText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12.5, lineHeight: 18, color: '#92400E' },
    stop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 48,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.line,
    },
    stopNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stopNumText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFFFFF' },
    stopTexts: { flex: 1 },
    stopTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: colors.ink },
    stopNote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.inkSoft, marginTop: 1 },
    stopTime: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.green, minWidth: 42, textAlign: 'right' },
    showButton: {
      marginTop: spacing.md,
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.green,
    },
    showLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
  });
}
