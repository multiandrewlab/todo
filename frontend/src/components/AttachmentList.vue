<script setup lang="ts">
import type { Attachment } from '@muscat/shared';
import { api } from '../api/client';

const props = defineProps<{
  taskId: string;
  attachments: Attachment[];
}>();

const emit = defineEmits<{ deleted: [id: string] }>();

async function download(att: Attachment) {
  window.open(`/api/v1/tasks/${props.taskId}/attachments/${att.id}/download`, '_blank');
}

async function remove(att: Attachment) {
  if (!confirm(`Delete ${att.file_name}?`)) return;
  await api.delete(`/tasks/${props.taskId}/attachments/${att.id}`);
  emit('deleted', att.id);
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div v-if="attachments.length" class="mt-3 space-y-1.5">
    <div
      v-for="att in attachments"
      :key="att.id"
      class="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-800/50 rounded-xl px-3 py-2"
    >
      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
      <span class="truncate flex-1">{{ att.file_name }}</span>
      <span v-if="att.file_size" class="text-neutral-500">{{ formatSize(att.file_size) }}</span>
      <button @click.stop="download(att)" class="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Download</button>
      <button @click.stop="remove(att)" class="text-red-400 hover:text-red-300 font-medium transition-colors">Delete</button>
    </div>
  </div>
</template>
