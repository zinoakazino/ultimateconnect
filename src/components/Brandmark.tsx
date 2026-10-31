import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme';

interface BrandmarkProps {
  size?: 'sm' | 'md' | 'lg';
  letter?: string;
  onDark?: boolean;
  style?: ViewStyle;
}

const SIZES = { sm: 30, md: 34, lg: 52 };
const FONT_SIZES = { sm: 13, md: 15, lg: 22 };

export function Brandmark({ size = 'sm', letter = 'U', onDark = false, style }: BrandmarkProps) {
  const { colors } = useTheme();
  const dimension = SIZES[size];
  return (
    <View
      style={[
        styles.base,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          borderColor: onDark ? colors.lineOnDark : colors.green,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.letter,
          { fontSize: FONT_SIZES[size], color: onDark ? colors.white : colors.green },
        ]}
      >
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: fonts.display,
  },
});
