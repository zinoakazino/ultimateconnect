import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { RTL_LANGUAGES } from '../i18n';

export type AppLanguage = 'fr' | 'ar';

interface LanguageContextValue {
  language: AppLanguage;
  isRTL: boolean;
  /** true right after switching languages changed reading direction — app needs a manual restart to fully mirror layout */
  restartPending: boolean;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  dismissRestartNotice: () => void;
}

const STORAGE_KEY = 'uc_language';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<AppLanguage>('fr');
  const [restartPending, setRestartPending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'fr' || saved === 'ar') {
        i18n.changeLanguage(saved);
        setLanguageState(saved);
        const shouldBeRTL = RTL_LANGUAGES.includes(saved);
        if (I18nManager.isRTL !== shouldBeRTL) {
          I18nManager.allowRTL(shouldBeRTL);
          I18nManager.forceRTL(shouldBeRTL);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = async (lang: AppLanguage) => {
    await i18n.changeLanguage(lang);
    setLanguageState(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang);
    const shouldBeRTL = RTL_LANGUAGES.includes(lang);
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      setRestartPending(true);
    }
  };

  const value = useMemo(
    () => ({
      language,
      isRTL: RTL_LANGUAGES.includes(language),
      restartPending,
      setLanguage,
      dismissRestartNotice: () => setRestartPending(false),
    }),
    [language, restartPending]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
