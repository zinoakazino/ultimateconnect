import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { fonts, radii, spacing } from '../theme';
import type { Colors } from '../theme';

export interface GuideStep {
  /** A Feather icon name. */
  icon: string;
  title: string;
  body: string;
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** The steps of a guide, from the translation file (`guide.<key>.steps`). Empty when the key does not exist. */
export function useGuideSteps(key: string): GuideStep[] {
  const { t } = useTranslation();
  const steps = t(`guide.${key}.steps`, { returnObjects: true }) as unknown;
  return Array.isArray(steps) ? (steps as GuideStep[]) : [];
}

interface GuideModalProps {
  visible: boolean;
  steps: GuideStep[];
  onClose: () => void;
}

/** A pop-up that explains the app step by step: Previous / Next, dots, and a way out at any moment. */
export function GuideModal({ visible, steps, onClose }: GuideModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isRTL } = useLanguage();
  const styles = makeStyles(colors);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const step = steps[index];
  if (!step) return null;
  const many = steps.length > 1;
  const last = index === steps.length - 1;
  // a pop-up lives outside the page's root view: it carries its own reading direction (react-native-web understands `dir`)
  const direction = { dir: isRTL ? 'rtl' : 'ltr' } as object;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View {...direction} style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel={t('common.close') ?? undefined}
          >
            <Feather name="x" size={18} color={colors.inkSoft} />
          </Pressable>

          <View style={styles.iconWrap}>
            <Feather name={step.icon as FeatherName} size={26} color={colors.white} />
          </View>
          {many && <Text style={styles.count}>{t('guide.stepOf', { n: index + 1, total: steps.length })}</Text>}
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>

          {many && (
            <View style={styles.dots}>
              {steps.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
          )}

          <View style={styles.actions}>
            {index > 0 ? (
              <Button label={t('guide.back')} variant="outline" onPress={() => setIndex(index - 1)} style={styles.btn} />
            ) : many ? (
              <Pressable onPress={onClose} hitSlop={8} style={styles.skipWrap}>
                <Text style={styles.skip}>{t('guide.skip')}</Text>
              </Pressable>
            ) : null}
            <Button
              label={last ? t('guide.done') : t('guide.next')}
              onPress={() => (last ? onClose() : setIndex(index + 1))}
              style={styles.btn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** The round "?" that opens the guide of the screen it sits on. */
export function HelpButton({ guide, style }: { guide: string; style?: ViewStyle }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const steps = useGuideSteps(guide);
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  return (
    <>
      <Pressable
        style={[styles.helpBtn, style]}
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('guide.help') ?? undefined}
      >
        <Text style={styles.helpText}>?</Text>
      </Pressable>
      <GuideModal visible={open} steps={steps} onClose={() => setOpen(false)} />
    </>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(8,20,14,0.62)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.xl,
      paddingTop: spacing.xxl,
      alignItems: 'center',
    },
    close: {
      position: 'absolute',
      top: spacing.md,
      right: spacing.md,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    count: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.8,
      color: colors.inkSoft,
      marginTop: spacing.md,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 19,
      color: colors.ink,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    body: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 21,
      color: colors.inkSoft,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    dots: {
      flexDirection: 'row',
      gap: 6,
      marginTop: spacing.lg,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.line,
    },
    dotOn: {
      width: 20,
      backgroundColor: colors.green,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      alignSelf: 'stretch',
    },
    btn: { flex: 1 },
    skipWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    skip: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.inkSoft },
    helpBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.greenPale,
      alignItems: 'center',
      justifyContent: 'center',
    },
    helpText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.greenDeep },
  });
}
