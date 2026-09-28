import { site } from '../../site.config';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY = 86_400_000;

/** Today's calendar date in the site timezone, as a UTC-midnight Date. */
function todayInTz(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

/** ISO week number (1–53) and ISO week-year of a UTC-midnight date. */
function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(date);
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday); // Thursday of this week
  const year = d.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  return { week: Math.ceil(((d.getTime() - jan1) / DAY + 1) / 7), year };
}

/**
 * Meta line for "This week": the previous ISO week (Mon–Sun) in the site timezone,
 * e.g. `week 39 · 21–27 sep 2026`.
 */
export function previousWeekMeta(now = new Date(), timeZone = site.timezone): string {
  const today = todayInTz(now, timeZone);
  const weekday = today.getUTCDay() || 7;
  const start = new Date(today.getTime() - (weekday - 1 + 7) * DAY);
  const end = new Date(start.getTime() + 6 * DAY);
  const { week } = isoWeek(start);

  const [d1, m1, y1] = [start.getUTCDate(), MONTHS[start.getUTCMonth()], start.getUTCFullYear()];
  const [d2, m2, y2] = [end.getUTCDate(), MONTHS[end.getUTCMonth()], end.getUTCFullYear()];
  let range: string;
  if (y1 !== y2) range = `${d1} ${m1} ${y1}–${d2} ${m2} ${y2}`;
  else if (m1 !== m2) range = `${d1} ${m1}–${d2} ${m2} ${y2}`;
  else range = `${d1}–${d2} ${m2} ${y2}`;

  return `week ${String(week).padStart(2, '0')} · ${range}`;
}

/** `D mon YYYY`, e.g. `21 sep 2026`. Accepts `YYYY-MM-DD`, ISO timestamps or Dates. */
export function formatDate(value: string | Date, timeZone = site.timezone): string {
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00Z`)
      : new Date(value);
  const d = todayInTz(date, timeZone);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Compact relative time, e.g. `40m ago`, `5h ago`, `3d ago`. */
export function relativeTime(value: string, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
