import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
} from 'date-fns';

export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getCurrentYearMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

export function getMonthDays(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  return eachDayOfInterval({ start: monthStart, end: monthEnd });
}

/** Render a stored 24h "HH:mm" as a friendly 12h label, e.g. "09:01 AM". Falls back to raw. */
export function formatTime12h(time: string | undefined | null): string {
  if (!time || time === '-') return '--:--';
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return time;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${min} ${suffix}`;
}

/** "Today", "Yesterday", or the weekday name ("Monday"). */
export function relativeDayLabel(dateStr: string): string {
  const today = new Date();
  const d = new Date(`${dateStr}T00:00:00`);
  const diffDays = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return format(d, 'EEEE');
  return format(d, 'dd MMM');
}

/** Human label for an attendance status. */
export function statusLabel(status?: string): string {
  switch (status) {
    case 'PRESENT':
    case 'FULL_DAY':
      return 'Present';
    case 'ABSENT':
      return 'Absent';
    case 'HALF_DAY':
      return 'Half Day';
    case 'LEAVE':
    case 'SICK_LEAVE':
      return 'Leave';
    case 'PERMISSION':
      return 'Permission';
    default:
      return '—';
  }
}

/** CSS dot class for calendar status dots. */
export function statusDotClass(status?: string): string {
  switch (status) {
    case 'PRESENT':
    case 'FULL_DAY':
      return 'dot-present';
    case 'ABSENT':
      return 'dot-absent';
    case 'HALF_DAY':
      return 'dot-half';
    case 'LEAVE':
    case 'SICK_LEAVE':
      return 'dot-leave';
    case 'PERMISSION':
      return 'dot-permission';
    default:
      return '';
  }
}

export function getLastDayOfMonth(date: Date): string {
  return format(endOfMonth(date), 'dd MMM');
}

/** The 4th Sunday of the month containing `date`, or null if the month has fewer than 4 Sundays. */
export function getFourthSundayOfMonth(date: Date): Date | null {
  const sundays = getMonthDays(date).filter((d) => getDay(d) === 0);
  return sundays.length >= 4 ? sundays[3] : null;
}

/** True if `date` is the 4th Sunday of its month (a compulsory holiday). */
export function isFourthSunday(date: Date): boolean {
  const fourth = getFourthSundayOfMonth(date);
  return (
    !!fourth &&
    date.getFullYear() === fourth.getFullYear() &&
    date.getMonth() === fourth.getMonth() &&
    date.getDate() === fourth.getDate()
  );
}

export {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  getDay,
  eachDayOfInterval,
};
