import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

export const RTL_LANGUAGES = ['ar'];

i18next.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: 'fr',
  fallbackLng: 'fr',
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
});

export default i18next;
