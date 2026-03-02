<script setup lang="ts">
import { ref } from 'vue';
import TaskList from '../components/TaskList.vue';
import type { Task } from '@muscat/shared';

const editingTask = ref<Task | null>(null);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Active</h2>
    </div>
    <TaskList status="active" @edit="editingTask = $event" />
  </div>
</template>
