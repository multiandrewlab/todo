<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Task, Tag } from '@muscat/shared';

const props = defineProps<{
  task: Task & { tags?: Tag[] };
}>();

const emit = defineEmits<{
  archive: [id: string];
  edit: [task: Task];
}>();

const expanded = ref(false);

const dueDateClass = computed(() => {
  if (!props.task.due_date) return '';
  const today = new Date().toISOString().split('T')[0];
  if (props.task.due_date < today) return 'text-red-400';
  if (props.task.due_date === today) return 'text-orange-400';
  return 'text-gray-400';
});

const formattedDate = computed(() => {
  if (!props.task.due_date) return '';
  const date = new Date(props.task.due_date + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
});
</script>

<template>
  <div class="group border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
    <div class="flex items-center gap-3 px-3 py-2 cursor-pointer" @click="expanded = !expanded">
      <!-- Archive checkbox -->
      <button
        v-if="task.status !== 'archived'"
        class="w-5 h-5 rounded-full border-2 border-gray-600 hover:border-gray-400 flex-shrink-0 transition-colors"
        @click.stop="emit('archive', task.id)"
        title="Archive"
      />
      <div v-else class="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center">
        <svg class="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      </div>

      <!-- Title and tags -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium truncate" :class="task.status === 'archived' ? 'line-through text-gray-500' : 'text-gray-100'">
            {{ task.title }}
          </span>
          <span
            v-for="tag in task.tags"
            :key="tag.id"
            class="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 flex-shrink-0"
          >
            {{ tag.name }}
          </span>
        </div>

        <!-- URL preview -->
        <div v-if="task.url_title" class="flex items-center gap-1.5 mt-0.5">
          <img v-if="task.url_favicon" :src="task.url_favicon" class="w-3 h-3" alt="" />
          <a :href="task.url!" target="_blank" class="text-xs text-blue-400 truncate hover:underline" @click.stop>
            {{ task.url_title }}
          </a>
        </div>
      </div>

      <!-- Due date -->
      <span v-if="task.due_date" class="text-xs flex-shrink-0" :class="dueDateClass">
        {{ formattedDate }}
      </span>

      <!-- Edit button -->
      <button
        class="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-gray-300 transition-opacity"
        @click.stop="emit('edit', task)"
        title="Edit"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>

    <!-- Expanded section -->
    <div v-if="expanded" class="px-3 pb-3 pl-11">
      <p v-if="task.notes" class="text-sm text-gray-400 whitespace-pre-wrap mb-2">{{ task.notes }}</p>
      <p v-if="task.url && !task.url_title" class="text-xs text-blue-400 break-all">
        <a :href="task.url" target="_blank" class="hover:underline">{{ task.url }}</a>
      </p>
      <p v-if="task.recurrence_rule" class="text-xs text-gray-500 mt-1">Recurring task</p>
    </div>
  </div>
</template>
