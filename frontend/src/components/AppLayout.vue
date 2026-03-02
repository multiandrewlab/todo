<script setup lang="ts">
import { ref } from 'vue';
import Sidebar from './Sidebar.vue';
import TaskModal from './TaskModal.vue';
import type { NLParseResponse } from '@muscat/shared';

const sidebarOpen = ref(true);
const parsedResult = ref<NLParseResponse | null>(null);

function handleParsed(result: NLParseResponse) {
  parsedResult.value = result;
}

function closeModal() {
  parsedResult.value = null;
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
      <router-view />
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
