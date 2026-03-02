export async function transcribeAudio(
  audio: Uint8Array,
  ai: Ai
): Promise<string> {
  const result = await ai.run('@cf/openai/whisper', {
    audio: [...audio],
  });
  return ((result as { text: string }).text || '').trim();
}
