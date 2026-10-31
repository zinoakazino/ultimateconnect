import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Wordmark } from '../../components/Wordmark';
import { FormField } from '../../components/FormField';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { translateAuthError } from '../../lib/authErrors';
import { fonts, spacing } from '../../theme';
import type { Colors } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(translateAuthError(t, err));
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError(t('auth.resetEnterEmail'));
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setNotice(t('auth.resetSent'));
    } catch (err: any) {
      // Don't reveal whether an address has an account: same message either way.
      if (err?.code === 'auth/user-not-found') setNotice(t('auth.resetSent'));
      else setError(translateAuthError(t, err));
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
          <Wordmark width={190} style={styles.brand} />
          <Text style={styles.title}>{t('auth.welcomeBack')}</Text>
          <Text style={styles.sub}>{t('auth.signInSubtitle')}</Text>

          <FormField
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@email.com"
          />
          <FormField
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••••"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Button label={t('auth.logIn')} onPress={onSubmit} loading={loading} style={styles.cta} />

          <Text style={[styles.alt, styles.forgot]}>
            <Text style={styles.link} onPress={onForgotPassword}>
              {t('auth.forgotPassword')}
            </Text>
          </Text>

          <Text style={styles.alt}>
            {t('auth.newHere')}{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('SignUp')}>
              {t('auth.createAccountLink')}
            </Text>
          </Text>
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
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    brand: { alignSelf: 'center', marginBottom: spacing.lg },
    title: {
      fontFamily: fonts.display,
      fontSize: 24,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: 4,
    },
    sub: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      textAlign: 'center',
      marginBottom: spacing.xxl,
    },
    cta: { marginTop: spacing.sm },
    error: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.danger,
      marginBottom: spacing.sm,
    },
    notice: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.green,
      marginBottom: spacing.sm,
    },
    alt: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    forgot: { marginTop: spacing.lg },
    link: {
      fontFamily: fonts.bodyBold,
      color: colors.green,
    },
  });
}
