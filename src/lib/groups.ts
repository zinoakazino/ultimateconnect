import type { ScheduleItem } from '../types/models';

/**
 * The programme lines a person sees: those for everybody plus those for their own travel group.
 * Someone with no group (staff, or a late sign-up the staff have not placed yet) sees every line — each one
 * then carries its group tag, so nothing is hidden from the people who organise or have to find their group.
 */
export function itemsForGroup(items: ScheduleItem[], groupId: number | null): ScheduleItem[] {
  // always a new array: callers sort the result, and the input is shared live data
  if (groupId == null) return items.slice();
  return items.filter((item) => item.group == null || item.group === groupId);
}

/** "G1": the tag shown beside a line that is for one group only. */
export const groupTag = (group: number) => `G${group}`;

/** Folds accents and case, so « kherbouche chaima » finds « Chaima Kherbouche ». */
export function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Every word typed must appear in the name, in any order, whatever the accents or capitals. */
export function nameMatches(name: string, query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = fold(name);
  return words.every((w) => hay.includes(w));
}

/** "2026-11-05" -> "jeu. 5 nov." in the app's language (built from the parts: no time-zone shift). */
export function shortDay(iso: string, locale: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}
