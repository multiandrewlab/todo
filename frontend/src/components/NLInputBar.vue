<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api/client';
import type { NLParseResponse } from '@muscat/shared';

const emit = defineEmits<{
  parsed: [result: NLParseResponse];
}>();

const text = ref('');
const loading = ref(false);

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
</script>

<template>
  <form @submit.prevent="handleSubmit" class="relative">
    <input
      v-model="text"
      :disabled="loading"
      placeholder="Add task naturally..."
      class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 outline-none pr-8"
    />
    <div v-if="loading" class="absolute right-2 top-1/2 -translate-y-1/2">
      <div class="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
    </div>
  </form>
</template>
