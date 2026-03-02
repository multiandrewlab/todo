import { describe, it, expect, vi } from 'vitest';
import { transcribeAudio } from '../../src/services/transcribe.js';

function mockAI(text: string) {
  return {
    run: vi.fn().mockResolvedValue({ text }),
  };
}

describe('transcribeAudio', () => {
  it('returns transcribed text from audio bytes', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const ai = mockAI('Buy milk tomorrow');
    const result = await transcribeAudio(audio, ai);
    expect(result).toBe('Buy milk tomorrow');
    expect(ai.run).toHaveBeenCalledWith('@cf/openai/whisper', { audio: [1, 2, 3] });
  });

  it('trims whitespace from transcription', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const result = await transcribeAudio(audio, mockAI('  hello world  '));
    expect(result).toBe('hello world');
  });

  it('returns empty string for empty transcription', async () => {
    const audio = new Uint8Array([1, 2, 3]);
    const result = await transcribeAudio(audio, mockAI(''));
    expect(result).toBe('');
  });
});
