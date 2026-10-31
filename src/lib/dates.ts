import i18next from '../i18n';

export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function locale() {
  return i18next.language || 'fr';
}

/**
 * "14 – 18 novembre 2026" (or across months/years). Built from parts on purpose:
 * asking Intl for a day + year without a month yields junk like "2026 (day: 18)".
 */
export function formatDateRange(start: Date, end: Date) {
  const month = (d: Date) => d.toLocaleDateString(locale(), { month: 'long' });
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${month(start)} ${start.getFullYear()} – ${end.getDate()} ${month(end)} ${end.getFullYear()}`;
}

export function daysUntil(target: Date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffMs = startOfTarget.getTime() - startOfToday.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function timeAgo(value: Date | string | null | undefined) {
  const date = toDate(value);
  if (!date) return '';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return i18next.t('time.justNow');
  if (minutes < 60) return i18next.t('time.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18next.t('time.hours', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return i18next.t('time.yesterday');
  if (days < 7) return i18next.t('time.days', { count: days });
  return date.toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
