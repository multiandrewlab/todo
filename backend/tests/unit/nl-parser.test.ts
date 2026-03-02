import { describe, it, expect } from 'vitest';
import { parseNaturalLanguage } from '../../src/services/nl-parser.js';

function mockAI(response: object) {
  return {
    run: async () => ({ response: JSON.stringify(response) }),
  };
}

describe('parseNaturalLanguage', () => {
  it('extracts title from simple input', async () => {
    const result = await parseNaturalLanguage(
      'Buy groceries',
      mockAI({ title: 'Buy groceries' }),
      '2025-01-06'
    );
    expect(result.title).toBe('Buy groceries');
  });

  it('extracts title and due date', async () => {
    const result = await parseNaturalLanguage(
      'Call Andy next week',
      mockAI({ title: 'Call Andy', due_date: '2025-01-13' }),
      '2025-01-06'
    );
    expect(result.title).toBe('Call Andy');
    expect(result.due_date).toBe('2025-01-13');
  });

  it('extracts tags from hashtags', async () => {
    const result = await parseNaturalLanguage(
      'Review PR #urgent #work',
      mockAI({ title: 'Review PR', tags: ['urgent', 'work'] }),
      '2025-01-06'
    );
    expect(result.tags).toContain('urgent');
    expect(result.tags).toContain('work');
  });

  it('extracts URL', async () => {
    const result = await parseNaturalLanguage(
      'Read https://example.com/article',
      mockAI({ title: 'Read article', url: 'https://example.com/article' }),
      '2025-01-06'
    );
    expect(result.url).toBe('https://example.com/article');
  });

  it('extracts recurrence rule', async () => {
    const result = await parseNaturalLanguage(
      'Take vitamins every morning',
      mockAI({ title: 'Take vitamins', recurrence_rule: { frequency: 'daily', interval: 1 } }),
      '2025-01-06'
    );
    expect(result.recurrence_rule?.frequency).toBe('daily');
    expect(result.recurrence_rule?.interval).toBe(1);
  });

  it('handles markdown-wrapped JSON response', async () => {
    const mockAIWrapped = {
      run: async () => ({ response: '```json\n{"title": "Test"}\n```' }),
    };
    const result = await parseNaturalLanguage('Test', mockAIWrapped as any, '2025-01-06');
    expect(result.title).toBe('Test');
  });

  it('handles all fields together', async () => {
    const result = await parseNaturalLanguage(
      'Call dentist tomorrow at 2pm #health, make sure to bring insurance card',
      mockAI({
        title: 'Call dentist',
        due_date: '2025-01-07',
        tags: ['health'],
        notes: 'Make sure to bring insurance card',
        status: 'inbox',
      }),
      '2025-01-06'
    );
    expect(result.title).toBe('Call dentist');
    expect(result.due_date).toBe('2025-01-07');
    expect(result.tags).toContain('health');
    expect(result.notes).toBe('Make sure to bring insurance card');
    expect(result.status).toBe('inbox');
  });
});
