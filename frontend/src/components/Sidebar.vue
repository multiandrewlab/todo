<script setup lang="ts">
import { useRoute } from 'vue-router';
import NLInputBar from './NLInputBar.vue';
import type { NLParseResponse } from '@muscat/shared';

const route = useRoute();

defineEmits<{ navigate: []; parsed: [result: NLParseResponse] }>();

const navItems = [
  { path: '/', name: 'Inbox', icon: '\u{1F4E5}' },
  { path: '/active', name: 'Active', icon: '\u{1F4CB}' },
  { path: '/archived', name: 'Archived', icon: '\u{1F4E6}' },
  { path: '/settings', name: 'Settings', icon: '\u2699\uFE0F' },
];
</script>

<template>
  <div class="flex flex-col h-full p-4">
    <!-- App title -->
    <h1 class="text-lg font-bold text-white mb-6 px-2">Muscat</h1>

    <!-- NL Input -->
    <div class="mb-4">
      <NLInputBar @parsed="$emit('parsed', $event)" />
    </div>

    <!-- Navigation -->
    <nav class="flex-1 space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        @click="$emit('navigate')"
        :class="[
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          route.path === item.path
            ? 'bg-gray-800 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
        ]"
      >
        <span class="text-base">{{ item.icon }}</span>
        {{ item.name }}
      </router-link>
    </nav>
  </div>
</template>
