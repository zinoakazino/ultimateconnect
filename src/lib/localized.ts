import i18next from '../i18n';

/** Texts the staff write can come in two languages: the Arabic one is shown when the app is in Arabic and one was written. */
export const pickText = (fr: string, ar: string | undefined | null, lang: string) => (lang === 'ar' && ar ? ar : fr);

/**
 * An alert made by the app itself (programme updated, group changed…) is stored ONCE in both languages, joined by this
 * mark, and every reader sees theirs. A text without the mark (typed by staff, or an older alert) is shown as it is.
 */
export const BILINGUAL_MARK = '␞';

export const bilingualText = (fr: string, ar: string) => `${fr}${BILINGUAL_MARK}${ar}`;

export function pickNotificationText(text: string, lang: string) {
  const at = text.indexOf(BILINGUAL_MARK);
  if (at < 0) return text;
  const fr = text.slice(0, at);
  const ar = text.slice(at + 1);
  return lang === 'ar' && ar ? ar : fr;
}

/** The same translated sentence in French and in Arabic, ready to store. `params` may depend on the language (dates). */
export function bilingual(key: string, params?: Record<string, unknown> | ((lng: 'fr' | 'ar') => Record<string, unknown>)) {
  const say = (lng: 'fr' | 'ar') => i18next.getFixedT(lng)(key, typeof params === 'function' ? params(lng) : params) as string;
  return bilingualText(say('fr'), say('ar'));
}

/** "Rappel : <line>" for an important programme line, in both languages (the Arabic one uses the Arabic title when there is one). */
export const reminderText = (title: string, titleAr?: string) =>
  bilingualText(
    `${i18next.getFixedT('fr')('home.reminderPrefix')}${title}`,
    `${i18next.getFixedT('ar')('home.reminderPrefix')}${titleAr || title}`
  );
