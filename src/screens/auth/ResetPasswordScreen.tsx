import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
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

/** Shown to someone who followed the "choose a new password" link from their email. */
export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (password !== repeat) {
      setError(t('auth.newPasswordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await setNewPassword(password);
    } catch (err: any) {
      setError(translateAuthError(t, err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Wordmark width={190} style={styles.brand} />
          <Text style={styles.title}>{t('auth.newPasswordTitle')}</Text>
          <Text style={styles.sub}>{t('auth.newPasswordSubtitle')}</Text>

          <FormField
            label={t('auth.newPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••••"
          />
          <FormField
            label={t('auth.newPasswordRepeat')}
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            placeholder="••••••••••"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label={t('auth.newPasswordSave')} onPress={onSubmit} loading={loading} style={styles.cta} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
    brand: { alignSelf: 'center', marginBottom: spacing.lg },
    title: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, textAlign: 'center', marginBottom: 4 },
    sub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginBottom: spacing.xxl },
    cta: { marginTop: spacing.sm },
    error: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginBottom: spacing.sm },
  });
}
