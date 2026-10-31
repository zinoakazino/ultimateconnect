import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Wordmark } from '../../components/Wordmark';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { Card } from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fetchRosterChoices } from '../../lib/api';
import { translateAuthError } from '../../lib/authErrors';
import { groupTag, nameMatches } from '../../lib/groups';
import { fonts, radii, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';
import type { RosterChoice } from '../../types/models';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The participants list: once the invite code is right, the names still free are offered. Taking
  // one gives the person their prepared account (their real name, group and flights, already validated).
  const [choices, setChoices] = useState<RosterChoice[]>([]);
  const [picked, setPicked] = useState<RosterChoice | null>(null);
  const [notListed, setNotListed] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setPicked(null);
    setNotListed(false);
    const code = inviteCode.trim();
    if (code.length < 3) {
      setChoices([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      fetchRosterChoices(code)
        .then((list) => alive && setChoices(list))
        .catch(() => alive && setChoices([]));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [inviteCode]);

  const hasList = choices.length > 0;
  const showNameField = !hasList || notListed;
  const shownName = picked ? picked.name : name;
  const matches = useMemo(() => choices.filter((c) => nameMatches(c.name, search)), [choices, search]);

  const canSubmit =
    shownName.trim() &&
    phone &&
    email &&
    inviteCode &&
    password.length >= 6 &&
    agreed &&
    (!hasList || picked || notListed);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signUp({ name: shownName, phone, email, password, inviteCode, rosterId: picked?.id });
    } catch (err: any) {
      setError(translateAuthError(t, err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LanguageSwitch style={styles.langSwitch} />
          <Wordmark width={170} style={styles.brand} />
          <Text style={styles.title}>{t('auth.createAccountTitle')}</Text>
          <Text style={styles.sub}>{t('auth.joinTeam')}</Text>

          <FormField
            label={t('auth.inviteCode')}
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
          />

          {hasList && (
            <Card variant="pale" noShadow style={styles.roster}>
              <Text style={styles.rosterTitle}>{t('auth.rosterTitle')}</Text>
              {picked ? (
                <View style={styles.pickedRow}>
                  <View style={styles.pickedText}>
                    <Text style={styles.pickedLabel}>{t('auth.rosterChosen')}</Text>
                    <Text style={styles.pickedName}>{picked.name}</Text>
                  </View>
                  <Pressable onPress={() => setPicked(null)} hitSlop={8}>
                    <Text style={styles.link}>{t('auth.rosterChange')}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.rosterHint}>{t('auth.rosterHint')}</Text>
                  <TextInput
                    style={styles.search}
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t('auth.rosterSearch') ?? ''}
                    placeholderTextColor={colors.inkSoft}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <ScrollView style={styles.list} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {matches.map((c) => (
                      <Pressable
                        key={c.id}
                        style={styles.choice}
                        onPress={() => {
                          setPicked(c);
                          setNotListed(false);
                          setSearch('');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={c.name}
                      >
                        <View style={styles.dot} />
                        <Text style={styles.choiceName}>{c.name}</Text>
                        {c.groupId != null ? <Text style={styles.choiceTag}>{groupTag(c.groupId)}</Text> : null}
                      </Pressable>
                    ))}
                    {matches.length === 0 && <Text style={styles.noMatch}>{t('auth.rosterNoMatch')}</Text>}
                  </ScrollView>
                  <Pressable
                    style={[styles.choice, styles.noneChoice]}
                    onPress={() => setNotListed((v) => !v)}
                    accessibilityRole="button"
                  >
                    <View style={[styles.dot, notListed && styles.dotOn]} />
                    <View style={styles.noneText}>
                      <Text style={styles.choiceName}>{t('auth.rosterNone')}</Text>
                      {notListed ? <Text style={styles.noneSub}>{t('auth.rosterNoneSub')}</Text> : null}
                    </View>
                  </Pressable>
                </>
              )}
            </Card>
          )}

          {showNameField && <FormField label={t('auth.fullName')} value={name} onChangeText={setName} />}
          <FormField
            label={t('auth.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <FormField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <FormField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)}>
            <View style={[styles.checkbox, agreed && styles.checkboxOn]} />
            <Text style={styles.agreeText}>{t('auth.agreeTerms')}</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={t('auth.createAccountBtn')}
            onPress={onSubmit}
            loading={loading}
            disabled={!canSubmit}
            style={styles.cta}
          />

          <Text style={styles.alt}>
            {t('auth.alreadyHaveAccount')}{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
              {t('auth.logInLink')}
            </Text>
          </Text>

          <Card variant="pale" noShadow style={styles.note}>
            <Text style={styles.noteText}>{picked ? t('auth.rosterReady') : t('auth.staffReviewNote')}</Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      padding: spacing.xxl,
      paddingTop: spacing.xxxl,
    },
    langSwitch: { alignSelf: 'flex-end', marginBottom: spacing.md },
    brand: { alignSelf: 'center', marginBottom: spacing.lg },
    title: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: 4,
    },
    sub: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      textAlign: 'center',
      marginBottom: spacing.xl,
    },
    roster: {
      marginBottom: spacing.md,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    rosterTitle: {
      fontFamily: fonts.display,
      fontSize: 16,
      color: colors.greenDeep,
    },
    rosterHint: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.greenDeep,
      marginTop: 4,
      marginBottom: spacing.sm,
    },
    search: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontFamily: fonts.body,
      fontSize: 14,
      color: '#142019',
      backgroundColor: '#FFFFFF',
    },
    list: {
      maxHeight: 238,
      marginTop: spacing.xs,
    },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(15,50,37,0.12)',
    },
    noneChoice: { borderBottomWidth: 0 },
    noneText: { flex: 1 },
    noneSub: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.greenDeep,
      marginTop: 3,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.green,
      backgroundColor: '#FFFFFF',
    },
    dotOn: { backgroundColor: colors.green },
    choiceName: {
      flex: 1,
      fontFamily: fonts.bodySemiBold,
      fontSize: 14,
      color: '#0F3225',
    },
    choiceTag: {
      fontFamily: fonts.mono,
      fontSize: 10.5,
      color: colors.greenDeep,
      opacity: 0.8,
    },
    noMatch: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.greenDeep,
      paddingVertical: spacing.md,
      textAlign: 'center',
    },
    pickedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    pickedText: { flex: 1, minWidth: 0 },
    pickedLabel: {
      fontFamily: fonts.mono,
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.greenDeep,
      opacity: 0.75,
    },
    pickedName: {
      fontFamily: fonts.display,
      fontSize: 18,
      color: '#0F3225',
      marginTop: 2,
    },
    agreeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginVertical: spacing.sm,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 5,
      borderWidth: 1.4,
      borderColor: colors.green,
      marginTop: 1,
    },
    checkboxOn: {
      backgroundColor: colors.green,
    },
    agreeText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.inkSoft,
      lineHeight: 18,
    },
    cta: { marginTop: spacing.xs },
    error: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.danger,
      marginBottom: spacing.sm,
    },
    alt: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
    link: {
      fontFamily: fonts.bodyBold,
      color: colors.green,
    },
    note: {
      marginTop: spacing.xl,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    noteText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.greenDeep,
      lineHeight: 17,
    },
  });
}
