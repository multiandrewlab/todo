<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from './Sidebar.vue';
import TaskModal from './TaskModal.vue';
import SearchBar from './SearchBar.vue';
import NLInputBar from './NLInputBar.vue';
import TaskRow from './TaskRow.vue';
import { useTasks } from '../composables/useTasks';
import type { NLParseResponse, Task } from '@muscat/shared';

const route = useRoute();
const parsedResult = ref<NLParseResponse | null>(null);
const searchActive = ref(false);
const { tasks: searchResults, loading: searchLoading, fetchTasks: searchTasks, archiveTask } = useTasks();

const navItems = [
  { path: '/', name: 'Inbox', icon: 'inbox' },
  { path: '/active', name: 'Active', icon: 'active' },
  { path: '/archived', name: 'Archived', icon: 'archived' },
  { path: '/settings', name: 'Settings', icon: 'settings' },
];

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
  <div class="flex h-screen bg-neutral-950 text-neutral-100">
    <!-- Desktop sidebar -->
    <aside class="hidden lg:flex w-60 flex-col bg-neutral-900 border-r border-neutral-800">
      <Sidebar @parsed="handleParsed" />
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto pb-20 lg:pb-0">
      <div class="max-w-3xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
        <!-- Mobile NL Input (hidden on desktop where it lives in sidebar) -->
        <div class="lg:hidden mb-4">
          <NLInputBar @parsed="handleParsed" />
        </div>

        <SearchBar @search="handleSearch" @clear="handleSearchClear" />

        <!-- Search results overlay -->
        <div v-if="searchActive">
          <h2 class="text-lg font-semibold mb-3 text-neutral-50">Search Results</h2>
          <div v-if="searchLoading" class="text-neutral-400 text-sm py-8 text-center">Searching...</div>
          <div v-else-if="searchResults.length === 0" class="text-neutral-500 text-sm py-8 text-center">No tasks found.</div>
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
      </div>
    </main>

    <!-- Mobile bottom tab bar -->
    <nav class="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-neutral-900/95 backdrop-blur-md border-t border-neutral-800">
      <div class="flex items-center justify-around h-14">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex flex-col items-center gap-0.5 px-3 py-1 transition-colors"
          :class="route.path === item.path ? 'text-indigo-400' : 'text-neutral-500'"
        >
          <!-- Inbox icon -->
          <svg v-if="item.icon === 'inbox'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
          </svg>
          <!-- Active icon -->
          <svg v-else-if="item.icon === 'active'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <!-- Archived icon -->
          <svg v-else-if="item.icon === 'archived'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <!-- Settings icon -->
          <svg v-else-if="item.icon === 'settings'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span class="text-[10px] font-medium">{{ item.name }}</span>
        </router-link>
      </div>
    </nav>

    <!-- NL Parse Modal -->
    <TaskModal
      v-if="parsedResult"
      :prefill="parsedResult"
      @close="closeModal"
      @saved="closeModal"
    />
  </div>
</template>
