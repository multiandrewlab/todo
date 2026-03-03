<script setup lang="ts">
import { ref, watch } from 'vue';

const emit = defineEmits<{
  search: [query: string, includeArchived: boolean];
  clear: [];
}>();

const query = ref('');
const includeArchived = ref(false);
let debounceTimer: ReturnType<typeof setTimeout>;

watch([query, includeArchived], () => {
  clearTimeout(debounceTimer);
  if (!query.value.trim()) {
    emit('clear');
    return;
  }
  debounceTimer = setTimeout(() => {
    emit('search', query.value, includeArchived.value);
  }, 300);
});
</script>

<template>
  <div class="flex items-center gap-3 mb-5">
    <div class="relative flex-1">
      <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        v-model="query"
        placeholder="Search tasks..."
        class="w-full pl-10 pr-4 py-2.5 bg-neutral-800/50 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
      />
    </div>
    <label class="flex items-center gap-1.5 text-xs text-neutral-400 whitespace-nowrap">
      <input type="checkbox" v-model="includeArchived" class="rounded accent-indigo-500" />
      Archived
    </label>
  </div>
</template>
