<script setup lang="ts">
import { ref } from 'vue';
import Sidebar from './Sidebar.vue';
import TaskModal from './TaskModal.vue';
import SearchBar from './SearchBar.vue';
import TaskRow from './TaskRow.vue';
import { useTasks } from '../composables/useTasks';
import type { NLParseResponse, Task } from '@muscat/shared';

const sidebarOpen = ref(true);
const parsedResult = ref<NLParseResponse | null>(null);
const searchActive = ref(false);
const { tasks: searchResults, loading: searchLoading, fetchTasks: searchTasks, archiveTask } = useTasks();

function handleParsed(result: NLParseResponse) {
  parsedResult.value = result;
}

function closeModal() {
  parsedResult.value = null;
}

async function handleSearch(query: string, includeArchived: boolean) {
  searchActive.value = true;
  await searchTasks({ search: query, include_archived: includeArchived });
}

function handleSearchClear() {
  searchActive.value = false;
}

async function handleSearchArchive(taskId: string) {
  await archiveTask(taskId);
}
</script>

<template>
  <div class="flex h-screen bg-gray-950 text-gray-100">
    <!-- Mobile menu button -->
    <button
      class="fixed top-3 left-3 z-50 p-2 rounded-lg bg-gray-800 lg:hidden"
      @click="sidebarOpen = !sidebarOpen"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 transition-transform lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <Sidebar @navigate="sidebarOpen = false" @parsed="handleParsed" />
    </aside>

    <!-- Backdrop on mobile -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/50 z-30 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto p-4 lg:p-6">
      <SearchBar @search="handleSearch" @clear="handleSearchClear" />

      <!-- Search results overlay -->
      <div v-if="searchActive">
        <h2 class="text-lg font-semibold mb-3">Search Results</h2>
        <div v-if="searchLoading" class="text-gray-400 text-sm py-4">Searching...</div>
        <div v-else-if="searchResults.length === 0" class="text-gray-500 text-sm py-4">No tasks found.</div>
        <div v-else>
          <TaskRow
            v-for="task in searchResults"
            :key="task.id"
            :task="task"
            @archive="handleSearchArchive"
          />
        </div>
      </div>

      <!-- Normal route content -->
      <router-view v-if="!searchActive" />
    </main>

    <!-- NL Parse Modal -->
    <TaskModal
      v-if="parsedResult"
      :prefill="parsedResult"
      @close="closeModal"
      @saved="closeModal"
    />
  </div>
</template>
