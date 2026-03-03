<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
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

onBeforeUnmount(() => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
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
      class="w-full px-4 py-2.5 bg-neutral-800/50 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
      :class="hasMicSupport ? 'pr-16' : 'pr-8'"
    />
    <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
      <!-- Loading spinner -->
      <div v-if="loading && !isRecording && !isTranscribing">
        <div class="w-4 h-4 border-2 border-neutral-600 border-t-indigo-400 rounded-full animate-spin" />
      </div>

      <!-- Transcribing spinner -->
      <div v-if="isTranscribing">
        <div class="w-4 h-4 border-2 border-neutral-600 border-t-indigo-400 rounded-full animate-spin" />
      </div>

      <!-- Mic button -->
      <button
        v-if="hasMicSupport && !loading && !isTranscribing"
        type="button"
        @pointerdown.prevent="startRecording"
        @pointerup.prevent="stopRecording"
        @pointerleave="stopRecording"
        class="p-1 rounded-lg transition-colors touch-none"
        :class="isRecording ? 'text-red-400 animate-pulse' : 'text-neutral-500 hover:text-indigo-400'"
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
    <p v-if="micError" class="text-xs text-red-400 mt-1.5 px-1">
      {{ micError }}
    </p>
  </form>
</template>
