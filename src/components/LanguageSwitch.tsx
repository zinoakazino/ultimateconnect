import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, type AppLanguage } from '../context/LanguageContext';
import { fonts, radii, spacing } from '../theme';
import type { Colors } from '../theme';

const OPTIONS: { lang: AppLanguage; label: string }[] = [
  { lang: 'fr', label: 'Français' },
  { lang: 'ar', label: 'العربية' },
];

/** FR | العربية — each language is written in its own script, so it is readable before the app speaks it. */
export function LanguageSwitch({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { language, setLanguage } = useLanguage();
  return (
    <View style={[styles.row, style]}>
      {OPTIONS.map((o) => (
        <Pressable
          key={o.lang}
          style={[styles.pill, language === o.lang && styles.pillOn]}
          onPress={() => setLanguage(o.lang)}
          accessibilityRole="button"
          accessibilityState={{ selected: language === o.lang }}
          accessibilityLabel={o.label}
        >
          <Text style={[styles.text, language === o.lang && styles.textOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.sm },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    pillOn: { backgroundColor: colors.green, borderColor: colors.green },
    text: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.ink },
    textOn: { color: colors.white },
  });
}
