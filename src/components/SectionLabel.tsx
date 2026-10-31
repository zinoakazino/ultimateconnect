import React from 'react';
import { StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme';
import type { Colors } from '../theme';

export function SectionLabel({ children, style }: { children: string; style?: ViewStyle }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return <Text style={[styles.label, style]}>{children.toUpperCase()}</Text>;
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    label: {
      fontFamily: fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1,
      color: colors.inkSoft,
      marginTop: 16,
      marginBottom: 8,
    },
  });
}
