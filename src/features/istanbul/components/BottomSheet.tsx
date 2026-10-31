import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../context/ThemeContext';
import { radii, spacing } from '../../../theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A light bottom sheet that sits over the map (no dimmed backdrop, so the map stays usable
 * and a tap on it closes the sheet). Built on Animated only — no extra native dependency.
 */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // The web has no native animation module (it would only log a warning).
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);

  if (!mounted) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [380, 0] });

  return (
    <Animated.View
      style={[
        styles.sheet,
        { backgroundColor: colors.surface, borderColor: colors.line, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.handle, { backgroundColor: colors.line }]} />
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Feather name="x" size={20} color={colors.inkSoft} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '62%',
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 12,
  },
  top: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    minHeight: 30,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  close: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xs,
  },
});
