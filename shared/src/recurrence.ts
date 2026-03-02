import type { RecurrenceRule } from './types.js';

/**
 * Calculate the next occurrence date from an original due date and recurrence rule.
 * Steps forward from originalDueDate until the result is strictly after referenceDate.
 */
export function getNextOccurrence(
  originalDueDate: string,
  rule: RecurrenceRule,
  referenceDate: string
): string {
  // Stub — implemented with TDD in Task 7
  throw new Error('Not implemented');
}
