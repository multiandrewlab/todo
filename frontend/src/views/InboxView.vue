<script setup lang="ts">
import { ref } from 'vue';
import TaskList from '../components/TaskList.vue';
import TaskModal from '../components/TaskModal.vue';
import type { Task } from '@muscat/shared';

const showModal = ref(false);
const editingTask = ref<Task | null>(null);
const taskListKey = ref(0);

function openNew() {
  editingTask.value = null;
  showModal.value = true;
}

function openEdit(task: Task) {
  editingTask.value = task;
  showModal.value = true;
}

function handleSaved() {
  taskListKey.value++;
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold">Inbox</h2>
      <button
        @click="openNew"
        class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 transition-colors"
      >
        + New Task
      </button>
    </div>

    <TaskList :key="taskListKey" status="inbox" @edit="openEdit" />

    <TaskModal
      v-if="showModal"
      :task="editingTask ?? undefined"
      @close="showModal = false"
      @saved="handleSaved"
    />
  </div>
</template>
