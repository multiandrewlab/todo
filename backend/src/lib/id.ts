export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().split('-')[0];
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}
