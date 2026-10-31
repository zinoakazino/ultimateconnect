import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radii, shadow, spacing } from '../theme';
import type { Colors } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'white' | 'pale' | 'dark';
  noShadow?: boolean;
}

export function Card({ children, style, variant = 'white', noShadow }: CardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View
      style={[
        styles.base,
        variant === 'pale' && styles.pale,
        variant === 'dark' && styles.dark,
        !noShadow && variant === 'white' && shadow.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    base: {
      borderRadius: radii.xl,
      padding: spacing.lg,
      backgroundColor: colors.surface,
    },
    pale: {
      backgroundColor: colors.greenPale,
    },
    dark: {
      backgroundColor: colors.greenDeep,
    },
  });
}
