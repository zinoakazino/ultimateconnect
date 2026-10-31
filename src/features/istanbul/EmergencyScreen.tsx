import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useTheme } from '../../context/ThemeContext';
import { usePlaces } from '../../hooks/usePlaces';
import { callPhone, openDirections } from '../../lib/maps';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import { getPlace, istanbul } from './data';
import { RulesCard } from './components/MapOverlays';

const RED = '#DC2626';

/**
 * Everything someone needs when something goes wrong, readable without a connection:
 * the emergency number, the hotel address in Turkish for a taxi driver, the staff phone numbers
 * and the usual tourist scams. All of it comes from the bundled istanbul-data.json.
 */
export function EmergencyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation<any>();
  const { places } = usePlaces();
  const [copied, setCopied] = useState(false);

  const { emergency, hotel } = istanbul;
  const police = getPlace('police-touristique');
  // Contacts the staff manage in the app itself (Gérer le voyage → Urgences et contacts).
  // The 112 entry is already the big button above.
  const liveContacts = places.filter(
    (p) => p.category === 'emergency' && p.phone && p.phone.replace(/\s/g, '') !== emergency.number
  );
  // A staff member listed in the data file takes the number entered in the app under the same
  // name, so numbers can be filled in from the app without editing the file. Whatever is left
  // over is shown below as an additional contact.
  const claimed = new Set<string>();
  const staffContacts = emergency.staff.map((c) => {
    const live = liveContacts.find((p) => p.name.toLowerCase().includes(c.name.toLowerCase()));
    if (live) claimed.add(live.id);
    return { ...c, phone: c.phone || live?.phone || '' };
  });
  const otherContacts = liveContacts.filter((p) => !claimed.has(p.id));

  const copyAddress = async () => {
    try {
      await Clipboard.setStringAsync(`${hotel.name}\n${hotel.address}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Copy is a convenience; the address is on screen anyway.
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Feather name="arrow-left" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t('emergency.title')}</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => callPhone(emergency.number)}
          style={({ pressed }) => [styles.callButton, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
          accessibilityLabel={`${t('emergency.call')} ${emergency.number}`}
        >
          <Feather name="phone-call" size={30} color="#FFFFFF" />
          <View style={styles.callTexts}>
            <Text style={styles.callNumber}>{emergency.number}</Text>
            <Text style={styles.callLabel}>{emergency.numberLabel}</Text>
          </View>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('emergency.taxiTitle')}</Text>
          <Text style={styles.phraseTr}>{emergency.taxiPhraseTurkish}</Text>
          <Text style={styles.phraseFr}>{emergency.taxiPhraseFrench}</Text>
          <View style={styles.addressBox}>
            <Text style={styles.addressName}>{hotel.name}</Text>
            <Text style={styles.addressText}>{hotel.addressTurkish.split('\n').slice(1).join('\n')}</Text>
          </View>
          <Pressable
            onPress={copyAddress}
            style={({ pressed }) => [styles.outlineButton, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Feather name={copied ? 'check' : 'copy'} size={17} color={colors.ink} />
            <Text style={styles.outlineLabel}>{copied ? t('emergency.copied') : t('emergency.copy')}</Text>
          </Pressable>
          <Pressable
            onPress={() => openDirections(hotel, 'walking')}
            style={({ pressed }) => [styles.solidButton, pressed && { opacity: 0.88 }]}
            accessibilityRole="button"
          >
            <Feather name="navigation" size={17} color="#FFFFFF" />
            <Text style={styles.solidLabel}>{t('map.backToHotel')}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('emergency.staff')}</Text>
          {staffContacts.map((c) => (
            <View key={c.name} style={styles.contactRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.contactTexts}>
                <Text style={styles.contactName}>{c.name}</Text>
                {c.role ? <Text style={styles.contactRole}>{c.role}</Text> : null}
              </View>
              {c.phone ? (
                <Pressable
                  onPress={() => callPhone(c.phone)}
                  style={styles.callSmall}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('emergency.call')} ${c.name}`}
                >
                  <Feather name="phone" size={16} color="#FFFFFF" />
                  <Text style={styles.callSmallText}>{c.phone}</Text>
                </Pressable>
              ) : (
                <Text style={styles.soon}>{t('emergency.soon')}</Text>
              )}
            </View>
          ))}
          {otherContacts.map((p) => (
            <View key={p.id} style={styles.contactRow}>
              <View style={[styles.avatar, { backgroundColor: colors.greenDeep }]}>
                <Feather name="phone" size={15} color="#FFFFFF" />
              </View>
              <View style={styles.contactTexts}>
                <Text style={styles.contactName}>{p.name}</Text>
              </View>
              <Pressable
                onPress={() => callPhone(p.phone as string)}
                style={styles.callSmall}
                accessibilityRole="button"
              >
                <Feather name="phone" size={16} color="#FFFFFF" />
                <Text style={styles.callSmallText}>{p.phone}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {police && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('emergency.police')}</Text>
            <Text style={styles.cardText}>{police.name}</Text>
            <Text style={styles.cardHint}>{police.tip}</Text>
            <Pressable
              onPress={() => openDirections(police, 'walking')}
              style={({ pressed }) => [styles.outlineButton, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              <Feather name="navigation" size={17} color={colors.ink} />
              <Text style={styles.outlineLabel}>{t('map.directions')}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('emergency.scams')}</Text>
          {emergency.scams.map((s) => (
            <View key={s.title} style={styles.scam}>
              <Feather name="alert-triangle" size={16} color="#D97706" style={styles.scamIcon} />
              <View style={styles.scamTexts}>
                <Text style={styles.scamTitle}>{s.title}</Text>
                <Text style={styles.scamText}>{s.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <RulesCard />
        <Text style={styles.offline}>{t('emergency.offline')}</Text>
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
      paddingVertical: spacing.sm,
    },
    back: { width: 36, height: 40, justifyContent: 'center' },
    title: { fontFamily: fonts.display, fontSize: 20, color: RED },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
    callButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      padding: spacing.lg,
      minHeight: 84,
      borderRadius: radii.xl,
      backgroundColor: RED,
    },
    callTexts: { flex: 1 },
    callNumber: { fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 40, color: '#FFFFFF' },
    callLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, lineHeight: 17, color: '#FFFFFF' },
    card: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      gap: spacing.sm,
    },
    cardTitle: {
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.inkSoft,
    },
    cardText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
    cardHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
    phraseTr: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, color: colors.ink },
    phraseFr: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
    addressBox: {
      marginTop: spacing.xs,
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.greenPale,
      gap: 4,
    },
    addressName: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, color: colors.greenDeep },
    addressText: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 28, color: colors.greenDeep },
    outlineButton: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: colors.line,
    },
    outlineLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    solidButton: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radii.md,
      backgroundColor: colors.green,
    },
    solidLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 52,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: spacing.sm,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
    contactTexts: { flex: 1 },
    contactName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    contactRole: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 1 },
    callSmall: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.green,
    },
    callSmallText: { fontFamily: fonts.bodyBold, fontSize: 13, color: '#FFFFFF' },
    soon: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, maxWidth: 130, textAlign: 'right' },
    scam: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs },
    scamIcon: { marginTop: 3 },
    scamTexts: { flex: 1 },
    scamTitle: { fontFamily: fonts.bodyBold, fontSize: 14.5, color: colors.ink },
    scamText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft, marginTop: 2 },
    offline: {
      fontFamily: fonts.body,
      fontSize: 12,
      textAlign: 'center',
      color: colors.inkSoft,
      marginTop: spacing.sm,
    },
  });
}
