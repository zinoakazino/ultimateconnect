import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../context/ThemeContext';
import { fonts, spacing } from '../../../theme';
import type { Colors } from '../../../theme';
import { istanbul } from '../data';

interface CategoryChipsProps {
  /** Selected category ids. Empty means "Tout". */
  selected: string[];
  onChange: (next: string[]) => void;
}

export function CategoryChips({ selected, onChange }: CategoryChipsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      <Pressable
        onPress={() => onChange([])}
        style={[styles.chip, selected.length === 0 && { backgroundColor: colors.green, borderColor: colors.green }]}
        accessibilityRole="button"
        accessibilityState={{ selected: selected.length === 0 }}
      >
        <Text style={[styles.label, selected.length === 0 && styles.labelOn]}>{t('map.all')}</Text>
      </Pressable>
      {istanbul.categories.map((c) => {
        const on = selected.includes(c.id);
        return (
          <Pressable
            key={c.id}
            onPress={() => toggle(c.id)}
            style={[styles.chip, on && { backgroundColor: c.color, borderColor: c.color }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>
              {c.icon} {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    scroll: { flexGrow: 0 },
    row: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    chip: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontFamily: fonts.bodySemiBold,
      fontSize: 13,
      color: colors.ink,
    },
    labelOn: {
      color: '#FFFFFF',
    },
  });
}
