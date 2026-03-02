import { describe, it, expect } from 'vitest';
import { getNextOccurrence } from './recurrence.js';
import type { RecurrenceRule } from './types.js';

describe('getNextOccurrence', () => {
  // Daily
  it('daily: next day from original', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1 };
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-01')).toBe('2025-01-02');
  });

  it('daily: skips past reference date', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1 };
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-15')).toBe('2025-01-16');
  });

  it('every 3 days', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 3 };
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-01')).toBe('2025-01-04');
  });

  // Weekly
  it('weekly: next week same day', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1 };
    // 2025-01-06 is a Monday
    expect(getNextOccurrence('2025-01-06', rule, '2025-01-06')).toBe('2025-01-13');
  });

  it('every 2 weeks on Monday', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 2, daysOfWeek: [1] };
    expect(getNextOccurrence('2025-01-06', rule, '2025-01-06')).toBe('2025-01-20');
  });

  it('weekly on multiple days', () => {
    // Every week on Mon(1) and Wed(3), original due is Mon Jan 6
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1, daysOfWeek: [1, 3] };
    // After Mon Jan 6, next occurrence should be Wed Jan 8
    expect(getNextOccurrence('2025-01-06', rule, '2025-01-06')).toBe('2025-01-08');
  });

  // Monthly by day of month
  it('monthly on the 15th', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 15 };
    expect(getNextOccurrence('2025-01-15', rule, '2025-01-15')).toBe('2025-02-15');
  });

  it('every 3 months on the 1st', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 3, dayOfMonth: 1 };
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-01')).toBe('2025-04-01');
  });

  it('monthly on 31st handles short months', () => {
    // Feb doesn't have 31 days — should clamp to last day of month
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, dayOfMonth: 31 };
    expect(getNextOccurrence('2025-01-31', rule, '2025-01-31')).toBe('2025-02-28');
  });

  // Monthly by weekday (Nth weekday of month)
  it('2nd Tuesday every month', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 1, daysOfWeek: [2], weekOfMonth: 2 };
    // 2025-01-14 is 2nd Tuesday of Jan. Next 2nd Tuesday is Feb 11.
    expect(getNextOccurrence('2025-01-14', rule, '2025-01-14')).toBe('2025-02-11');
  });

  it('1st Monday every 2 months', () => {
    const rule: RecurrenceRule = { frequency: 'monthly', interval: 2, daysOfWeek: [1], weekOfMonth: 1 };
    // 2025-01-06 is 1st Monday of Jan. 2 months later = March. 1st Monday of March = March 3.
    expect(getNextOccurrence('2025-01-06', rule, '2025-01-06')).toBe('2025-03-03');
  });

  // Yearly
  it('yearly on March 15', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', interval: 1, monthOfYear: 3, dayOfMonth: 15 };
    expect(getNextOccurrence('2025-03-15', rule, '2025-03-15')).toBe('2026-03-15');
  });

  it('every 2 years', () => {
    const rule: RecurrenceRule = { frequency: 'yearly', interval: 2, monthOfYear: 6, dayOfMonth: 1 };
    expect(getNextOccurrence('2025-06-01', rule, '2025-06-01')).toBe('2027-06-01');
  });

  // Edge: reference date far in the future
  it('catches up to future reference date', () => {
    const rule: RecurrenceRule = { frequency: 'weekly', interval: 1 };
    // Original: Mon Jan 6 2025, reference: March 1 2025
    // Should find next Monday after March 1 = March 3
    expect(getNextOccurrence('2025-01-06', rule, '2025-03-01')).toBe('2025-03-03');
  });

  it('catches up daily with large gap', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 7 };
    // Original: Jan 1, reference: Jan 29 (28 days = 4 intervals)
    // Steps: Jan 1 + 7 = Jan 8, + 7 = Jan 15, + 7 = Jan 22, + 7 = Jan 29, + 7 = Feb 5
    expect(getNextOccurrence('2025-01-01', rule, '2025-01-29')).toBe('2025-02-05');
  });
});
