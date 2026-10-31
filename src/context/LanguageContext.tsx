import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import { RTL_LANGUAGES } from '../i18n';

export type AppLanguage = 'fr' | 'ar';

interface LanguageContextValue {
  language: AppLanguage;
  /** Arabic reads right to left: the whole layout is mirrored while it is on. */
  isRTL: boolean;
  /** Changes the language at once, everywhere (no restart): the choice is remembered on this device. */
  setLanguage: (lang: AppLanguage) => Promise<void>;
}

const STORAGE_KEY = 'uc_language';

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const ARABIC_STYLE_ID = 'uc-arabic-text';

/** The page follows the language too (reading direction and `lang`), so scroll bars, selection and pop-ups mirror as well. */
function applyToPage(lang: AppLanguage) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
  if (!document.getElementById(ARABIC_STYLE_ID)) {
    // Arabic letters join each other: the letter-spacing of the small capital labels would pull them apart
    const style = document.createElement('style');
    style.id = ARABIC_STYLE_ID;
    style.textContent = 'html[lang="ar"] * { letter-spacing: normal !important; }';
    document.head.appendChild(style);
  }
}

/** First visit, nothing chosen yet: a phone / browser set to Arabic gets the Arabic app, anything else French. */
function deviceLanguage(): AppLanguage {
  try {
    return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'fr';
  } catch {
    return 'fr';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<AppLanguage>('fr');

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        if (!alive) return;
        const next: AppLanguage = saved === 'fr' || saved === 'ar' ? saved : deviceLanguage();
        i18n.changeLanguage(next);
        setLanguageState(next);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => applyToPage(language), [language]);

  const setLanguage = async (lang: AppLanguage) => {
    await i18n.changeLanguage(lang);
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // the language still changes for this visit
    }
  };

  const value = useMemo(
    () => ({ language, isRTL: RTL_LANGUAGES.includes(language), setLanguage }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
