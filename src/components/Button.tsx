import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts, radii } from '../theme';
import type { Colors } from '../theme';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'solid' | 'dark' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'solid',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'solid' && styles.solid,
        variant === 'dark' && styles.dark,
        variant === 'outline' && styles.outline,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.green : colors.white} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'outline' ? styles.labelOutline : styles.labelSolid,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    base: {
      borderRadius: radii.md,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    solid: {
      backgroundColor: colors.green,
    },
    dark: {
      backgroundColor: colors.greenDeep,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.line,
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
    },
    labelSolid: {
      color: colors.white,
    },
    labelOutline: {
      color: colors.ink,
    },
  });
}
