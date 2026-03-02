# Voice Input Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add press-and-hold voice input to NLInputBar that transcribes audio via Cloudflare Workers AI Whisper, then feeds text through the existing NL parse pipeline.

**Architecture:** New `POST /api/v1/ai/transcribe` endpoint accepts audio blob, runs Whisper, returns text. Frontend adds mic button to NLInputBar with MediaRecorder, sends audio to transcribe endpoint, then pipes result through existing parse flow.

**Tech Stack:** Cloudflare Workers AI (`@cf/openai/whisper`), MediaRecorder API, Vue 3, Hono, existing `api.upload()` client method.

---

### Task 1: Backend — Transcribe Endpoint Test

**Files:**
- Create: `backend/tests/unit/transcribe.test.ts`

**Step 1: Write the failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/unit/transcribe.test.ts`
Expected: FAIL — cannot find `../../src/services/transcribe.js`

**Step 3: Commit**

```bash
git add backend/tests/unit/transcribe.test.ts
git commit -m "test: add unit tests for transcribeAudio service"
```

---

### Task 2: Backend — Transcribe Service

**Files:**
- Create: `backend/src/services/transcribe.ts`

**Step 1: Implement the service**

```typescript
export async function transcribeAudio(
  audio: Uint8Array,
  ai: Ai
): Promise<string> {
  const result = await ai.run('@cf/openai/whisper', {
    audio: [...audio],
  });
  return ((result as { text: string }).text || '').trim();
}
```

**Step 2: Run tests to verify they pass**

Run: `cd backend && npx vitest run tests/unit/transcribe.test.ts`
Expected: all 3 tests PASS

**Step 3: Commit**

```bash
git add backend/src/services/transcribe.ts
git commit -m "feat: add transcribeAudio service using Workers AI Whisper"
```

---

### Task 3: Backend — Transcribe Route

**Files:**
- Modify: `backend/src/routes/ai.ts`

**Step 1: Add the transcribe route**

Add to `backend/src/routes/ai.ts`, after the existing `/parse` route and before `export { ai }`:

```typescript
import { transcribeAudio } from '../services/transcribe.js';

ai.post('/transcribe', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('audio');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'Audio file is required' }, 400);
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'Audio file too large (max 10MB)' }, 400);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audio = new Uint8Array(arrayBuffer);
    const text = await transcribeAudio(audio, c.env.AI);

    if (!text) {
      return c.json({ error: 'No speech detected' }, 422);
    }

    return c.json({ text });
  } catch (e: any) {
    return c.json({ error: 'Transcription failed', details: e.message }, 500);
  }
});
```

Note: The import for `transcribeAudio` goes at the top of the file with other imports.

**Step 2: Run all backend tests**

Run: `cd backend && npx vitest run`
Expected: all existing tests still PASS

**Step 3: Commit**

```bash
git add backend/src/routes/ai.ts
git commit -m "feat: add POST /ai/transcribe endpoint for audio-to-text"
```

---

### Task 4: Shared Types — Transcribe Response

**Files:**
- Modify: `shared/src/types.ts`

**Step 1: Add TranscribeResponse type**

Add at the end of `shared/src/types.ts`, before the closing of the file:

```typescript
export interface TranscribeResponse {
  text: string;
}
```

**Step 2: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat: add TranscribeResponse type"
```

---

### Task 5: Frontend — Voice Input in NLInputBar

**Files:**
- Modify: `frontend/src/components/NLInputBar.vue`

**Step 1: Replace the entire NLInputBar.vue with voice support**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api/client';
import type { NLParseResponse } from '@muscat/shared';

const emit = defineEmits<{
  parsed: [result: NLParseResponse];
}>();

const text = ref('');
const loading = ref(false);
const isRecording = ref(false);
const isTranscribing = ref(false);
const hasMicSupport = ref(false);
const micError = ref('');

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordStart = 0;

onMounted(() => {
  hasMicSupport.value = !!(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
});

async function handleSubmit() {
  if (!text.value.trim() || loading.value) return;
  loading.value = true;
  try {
    const result = await api.post<NLParseResponse>('/ai/parse', { text: text.value });
    emit('parsed', result);
    text.value = '';
  } catch (e: any) {
    console.error('NL parse failed:', e);
  } finally {
    loading.value = false;
  }
}

async function startRecording() {
  micError.value = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      // Ignore short taps (< 300ms)
      if (Date.now() - recordStart < 300) {
        isRecording.value = false;
        return;
      }

      const audioBlob = new Blob(audioChunks, { type: mediaRecorder!.mimeType });
      await transcribeAndParse(audioBlob);
    };

    recordStart = Date.now();
    mediaRecorder.start();
    isRecording.value = true;
  } catch (e: any) {
    if (e.name === 'NotAllowedError') {
      micError.value = 'Microphone access needed for voice input';
    } else {
      micError.value = 'Could not access microphone';
    }
    console.error('Mic error:', e);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

async function transcribeAndParse(audioBlob: Blob) {
  isRecording.value = false;
  isTranscribing.value = true;
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    const { text: transcribed } = await api.upload<{ text: string }>('/ai/transcribe', formData);

    // Feed transcription through existing NL parse
    loading.value = true;
    isTranscribing.value = false;
    const result = await api.post<NLParseResponse>('/ai/parse', { text: transcribed });
    emit('parsed', result);
  } catch (e: any) {
    console.error('Voice input failed:', e);
    micError.value = 'Voice input failed, please try again';
  } finally {
    loading.value = false;
    isTranscribing.value = false;
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="relative">
    <input
      v-model="text"
      :disabled="loading || isRecording || isTranscribing"
      :placeholder="isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : 'Add task naturally...'"
      class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 outline-none"
      :class="hasMicSupport ? 'pr-16' : 'pr-8'"
    />
    <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
      <!-- Loading spinner -->
      <div v-if="loading && !isRecording && !isTranscribing" >
        <div class="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
      </div>

      <!-- Transcribing spinner -->
      <div v-if="isTranscribing">
        <div class="w-4 h-4 border-2 border-gray-600 border-t-purple-400 rounded-full animate-spin" />
      </div>

      <!-- Mic button -->
      <button
        v-if="hasMicSupport && !loading && !isTranscribing"
        type="button"
        @pointerdown.prevent="startRecording"
        @pointerup.prevent="stopRecording"
        @pointerleave="stopRecording"
        class="p-1 rounded transition-colors touch-none"
        :class="isRecording ? 'text-red-400 animate-pulse' : 'text-gray-500 hover:text-gray-300'"
        :title="isRecording ? 'Release to send' : 'Hold to speak'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
      </button>
    </div>

    <!-- Mic error message -->
    <p v-if="micError" class="text-xs text-red-400 mt-1">
      {{ micError }}
    </p>
  </form>
</template>
```

**Step 2: Verify the app builds**

Run: `cd frontend && npx vite build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Commit**

```bash
git add frontend/src/components/NLInputBar.vue
git commit -m "feat: add voice input mic button to NLInputBar"
```

---

### Task 6: Manual Testing Checklist

After all tasks complete, verify in the browser:

1. Mic button appears in the input bar (Chrome/Safari)
2. Pressing and holding the mic button shows "Listening..." and red pulse
3. Releasing after 300ms+ triggers transcription then parse
4. Quick tap (<300ms) is ignored
5. TaskModal opens with pre-filled fields from voice transcription
6. Denying microphone permission shows error message
7. Error message clears on next attempt
