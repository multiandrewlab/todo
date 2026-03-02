import type { RecurrenceRule } from './types.js';

/**
 * Parse a YYYY-MM-DD string into { year, month (0-based), day }.
 */
function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

/**
 * Format year, month (0-based), day into YYYY-MM-DD string.
 */
function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Get the last day of a month (0-based month).
 */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Convert { year, month, day } to a comparable integer YYYYMMDD.
 */
function toComparable(year: number, month: number, day: number): number {
  return year * 10000 + (month + 1) * 100 + day;
}

/**
 * Find the Nth occurrence of a weekday (0=Sun..6=Sat) in a given month.
 * Returns the day-of-month, or -1 if it doesn't exist.
 */
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const firstDay = new Date(Date.UTC(year, month, 1));
  let dayOfMonth = 1 + ((weekday - firstDay.getUTCDay() + 7) % 7);
  dayOfMonth += (n - 1) * 7;
  if (dayOfMonth > lastDayOfMonth(year, month)) return -1;
  return dayOfMonth;
}

/**
 * Calculate the next occurrence date from an original due date and recurrence rule.
 * Steps forward from originalDueDate until the result is strictly after referenceDate.
 */
export function getNextOccurrence(
  originalDueDate: string,
  rule: RecurrenceRule,
  referenceDate: string
): string {
  const orig = parseDate(originalDueDate);
  const ref = parseDate(referenceDate);
  const refVal = toComparable(ref.year, ref.month, ref.day);

  switch (rule.frequency) {
    case 'daily': {
      // Start from original, add interval days until strictly after reference
      const startMs = Date.UTC(orig.year, orig.month, orig.day);
      const intervalMs = rule.interval * 24 * 60 * 60 * 1000;
      let current = startMs;
      // Jump ahead efficiently for large gaps
      const refMs = Date.UTC(ref.year, ref.month, ref.day);
      if (current <= refMs) {
        const diff = refMs - current;
        const steps = Math.floor(diff / intervalMs);
        current += steps * intervalMs;
      }
      // Step forward until strictly after reference
      while (true) {
        current += intervalMs;
        const d = new Date(current);
        const cVal = toComparable(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        if (cVal > refVal) {
          return formatDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }
      }
    }

    case 'weekly': {
      if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        // Weekly with specific days of week
        const days = [...rule.daysOfWeek].sort((a, b) => a - b);
        // Determine the "anchor" week start (Sunday of the original due date's week)
        const origMs = Date.UTC(orig.year, orig.month, orig.day);
        const origDate = new Date(origMs);
        const origDow = origDate.getUTCDay();
        const origWeekStartMs = origMs - origDow * 24 * 60 * 60 * 1000;
        const weekIntervalMs = rule.interval * 7 * 24 * 60 * 60 * 1000;

        // Start scanning from original week
        let weekStartMs = origWeekStartMs;
        // Jump ahead if needed
        const refMs = Date.UTC(ref.year, ref.month, ref.day);
        if (weekStartMs + 6 * 24 * 60 * 60 * 1000 < refMs) {
          const diff = refMs - weekStartMs;
          const weekSteps = Math.floor(diff / weekIntervalMs);
          weekStartMs += weekSteps * weekIntervalMs;
          // May need to go back one interval to not miss candidates
          if (weekStartMs > refMs) {
            weekStartMs -= weekIntervalMs;
          }
        }

        // Scan weeks
        for (let safety = 0; safety < 1000; safety++) {
          for (const dow of days) {
            const dayMs = weekStartMs + dow * 24 * 60 * 60 * 1000;
            const d = new Date(dayMs);
            const cVal = toComparable(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            if (cVal > refVal) {
              return formatDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            }
          }
          weekStartMs += weekIntervalMs;
        }
        throw new Error('Could not find next occurrence within safety limit');
      } else {
        // Weekly without specific days — just add interval*7 days
        const startMs = Date.UTC(orig.year, orig.month, orig.day);
        const intervalMs = rule.interval * 7 * 24 * 60 * 60 * 1000;
        let current = startMs;
        // Jump ahead efficiently
        const refMs = Date.UTC(ref.year, ref.month, ref.day);
        if (current <= refMs) {
          const diff = refMs - current;
          const steps = Math.floor(diff / intervalMs);
          current += steps * intervalMs;
        }
        while (true) {
          current += intervalMs;
          const d = new Date(current);
          const cVal = toComparable(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          if (cVal > refVal) {
            return formatDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          }
        }
      }
    }

    case 'monthly': {
      if (rule.weekOfMonth != null && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        // Monthly by Nth weekday
        const weekday = rule.daysOfWeek[0];
        const nth = rule.weekOfMonth;
        let year = orig.year;
        let month = orig.month;

        // Step through months by interval
        for (let safety = 0; safety < 1000; safety++) {
          month += rule.interval;
          while (month > 11) {
            month -= 12;
            year += 1;
          }
          const day = getNthWeekdayOfMonth(year, month, weekday, nth);
          if (day === -1) continue; // skip if Nth weekday doesn't exist in this month
          const cVal = toComparable(year, month, day);
          if (cVal > refVal) {
            return formatDate(year, month, day);
          }
        }
        throw new Error('Could not find next occurrence within safety limit');
      } else {
        // Monthly by day of month
        const targetDay = rule.dayOfMonth ?? orig.day;
        let year = orig.year;
        let month = orig.month;

        for (let safety = 0; safety < 1000; safety++) {
          month += rule.interval;
          while (month > 11) {
            month -= 12;
            year += 1;
          }
          const maxDay = lastDayOfMonth(year, month);
          const day = Math.min(targetDay, maxDay);
          const cVal = toComparable(year, month, day);
          if (cVal > refVal) {
            return formatDate(year, month, day);
          }
        }
        throw new Error('Could not find next occurrence within safety limit');
      }
    }

    case 'yearly': {
      const targetMonth = rule.monthOfYear != null ? rule.monthOfYear - 1 : orig.month;
      const targetDay = rule.dayOfMonth ?? orig.day;
      let year = orig.year;

      for (let safety = 0; safety < 1000; safety++) {
        year += rule.interval;
        const maxDay = lastDayOfMonth(year, targetMonth);
        const day = Math.min(targetDay, maxDay);
        const cVal = toComparable(year, targetMonth, day);
        if (cVal > refVal) {
          return formatDate(year, targetMonth, day);
        }
      }
      throw new Error('Could not find next occurrence within safety limit');
    }

    default:
      throw new Error(`Unsupported frequency: ${(rule as RecurrenceRule).frequency}`);
  }
}
