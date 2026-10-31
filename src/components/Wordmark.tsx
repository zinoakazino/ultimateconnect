import React from 'react';
import { Image, ImageStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const SOURCE_ASPECT = 1608 / 592;

interface WordmarkProps {
  width?: number;
  style?: ImageStyle;
}

export function Wordmark({ width = 200, style }: WordmarkProps) {
  const { mode } = useTheme();
  const source =
    mode === 'dark'
      ? require('../../assets/brand/wordmark-light.png')
      : require('../../assets/brand/wordmark-dark.png');

  return (
    <Image
      source={source}
      resizeMode="contain"
      style={[{ width, height: width / SOURCE_ASPECT }, style]}
    />
  );
}
