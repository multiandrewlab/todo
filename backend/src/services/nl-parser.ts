import type { NLParseResponse } from '@muscat/shared';

export async function parseNaturalLanguage(
  text: string,
  ai: any, // Ai type from Workers
  today: string = new Date().toISOString().split('T')[0]
): Promise<NLParseResponse> {
  const result = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      {
        role: 'system',
        content: `You are a task parser. Extract structured data from natural language task descriptions.
Today's date is ${today}. Return ONLY valid JSON with these optional fields:
- title (string, required): the core task description
- notes (string): any additional details or context
- url (string): any URL mentioned
- due_date (string): date in YYYY-MM-DD format. Interpret relative dates like "tomorrow", "next week" (Monday), "next month" (1st) relative to today.
- recurrence_rule (object): { frequency: "daily"|"weekly"|"monthly"|"yearly", interval: number, daysOfWeek?: number[], dayOfMonth?: number, weekOfMonth?: number, monthOfYear?: number }
- status (string): "inbox" or "active", default to "inbox" if not clear
- tags (string[]): tag names extracted from #hashtags or inferred categories

Return ONLY the JSON object. No markdown fences. No explanation.`,
      },
      { role: 'user', content: text },
    ],
  });

  const response = (result as { response: string }).response;

  // Try to parse JSON, handle cases where AI might wrap in markdown
  let jsonStr = response.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(jsonStr);
}
