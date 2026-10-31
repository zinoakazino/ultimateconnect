import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts, radii, spacing } from '../theme';
import type { Colors } from '../theme';

interface FormFieldProps extends TextInputProps {
  label: string;
}

export function FormField({ label, style, ...rest }: FormFieldProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: spacing.md,
    },
    label: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.6,
      color: colors.inkSoft,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: 14,
      fontFamily: fonts.body,
      color: colors.ink,
      backgroundColor: colors.surface,
    },
  });
}
