<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useTasks } from '../composables/useTasks';
import TaskRow from './TaskRow.vue';
import type { Task } from '@muscat/shared';

const props = defineProps<{
  status: 'inbox' | 'active' | 'archived';
}>();

const emit = defineEmits<{
  edit: [task: Task];
}>();

const { tasks, loading, fetchTasks, archiveTask } = useTasks();

async function handleArchive(taskId: string) {
  await archiveTask(taskId);
  await fetchTasks({ status: props.status });
}

onMounted(() => fetchTasks({ status: props.status }));
watch(() => props.status, () => fetchTasks({ status: props.status }));
</script>

<template>
  <div>
    <div v-if="loading" class="text-gray-400 text-sm py-4">Loading...</div>
    <div v-else-if="tasks.length === 0" class="text-gray-500 text-sm py-4">
      {{ status === 'inbox' ? 'Inbox is empty.' : status === 'active' ? 'No active tasks.' : 'No archived tasks.' }}
    </div>
    <div v-else>
      <TaskRow
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        @archive="handleArchive"
        @edit="emit('edit', task)"
      />
    </div>
  </div>
</template>
