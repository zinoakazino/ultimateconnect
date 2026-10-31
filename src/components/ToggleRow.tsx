import React from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts, spacing } from '../theme';
import type { Colors } from '../theme';

interface ToggleRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  style?: ViewStyle;
}

export function ToggleRow({ title, subtitle, value, onValueChange, style }: ToggleRowProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable style={[styles.row, style]} onPress={() => onValueChange(!value)}>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    flex1: { flex: 1 },
    switch: {
      width: 38,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.line,
      padding: 2,
    },
    switchOn: {
      backgroundColor: colors.green,
    },
    knob: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.white,
    },
    knobOn: I18nManager.isRTL ? { marginRight: 16 } : { marginLeft: 16 },
    title: {
      fontFamily: fonts.bodyBold,
      fontSize: 12.5,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 10.5,
      color: colors.inkSoft,
    },
  });
}
