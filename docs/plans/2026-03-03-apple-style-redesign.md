# Apple-Style Dark Mode Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle Muscat's entire frontend to an Apple-inspired dark mode aesthetic with indigo accents, borderless inputs, generous spacing, and adaptive navigation (sidebar on desktop, bottom tabs on mobile).

**Architecture:** Pure Tailwind CSS class replacement across all Vue components. No new dependencies. Swap gray-* for neutral-*, blue-* for indigo-*, increase spacing/radii, add bottom tab bar to AppLayout for mobile.

**Tech Stack:** Vue 3, Tailwind CSS (utility-first), TypeScript

---

### Task 1: Update index.html theme color

**Files:**
- Modify: `frontend/index.html:6`

**Step 1: Update the theme-color meta tag**

Change line 6 from:
```html
<meta name="theme-color" content="#e94560">
```
to:
```html
<meta name="theme-color" content="#0a0a0a">
```

**Step 2: Verify the change**

Run: `cat frontend/index.html`
Expected: theme-color is `#0a0a0a`

**Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "style: update theme-color to neutral-950"
```

---

### Task 2: Restyle AppLayout — desktop sidebar + mobile bottom tabs

This is the biggest structural change. We replace the mobile hamburger menu with a bottom tab bar, keep the desktop sidebar, and update the color palette.

**Files:**
- Modify: `frontend/src/components/AppLayout.vue`

**Step 1: Replace the entire template and script section**

Replace the full content of `AppLayout.vue` with:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
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
```

Key changes:
- Removed mobile hamburger button and backdrop overlay
- Desktop sidebar: `hidden lg:flex`, `bg-neutral-900`, `border-neutral-800`
- Added mobile bottom tab bar with SVG icons, `bg-neutral-900/95 backdrop-blur-md`
- Active tab: `text-indigo-400`, inactive: `text-neutral-500`
- Main content: `max-w-3xl mx-auto`, `pb-20 lg:pb-0` for bottom tab space
- Mobile NL input bar appears at top of main content (hidden on desktop)
- All colors swapped to neutral-* palette

**Step 2: Verify the app builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add frontend/src/components/AppLayout.vue
git commit -m "style: restyle AppLayout with bottom tabs and neutral palette"
```

---

### Task 3: Restyle Sidebar (desktop only now)

**Files:**
- Modify: `frontend/src/components/Sidebar.vue`

**Step 1: Replace Sidebar.vue content**

```vue
<script setup lang="ts">
import { useRoute } from 'vue-router';
import NLInputBar from './NLInputBar.vue';
import type { NLParseResponse } from '@muscat/shared';

const route = useRoute();

defineEmits<{ parsed: [result: NLParseResponse] }>();

const navItems = [
  { path: '/', name: 'Inbox', icon: 'inbox' },
  { path: '/active', name: 'Active', icon: 'active' },
  { path: '/archived', name: 'Archived', icon: 'archived' },
  { path: '/settings', name: 'Settings', icon: 'settings' },
];
</script>

<template>
  <div class="flex flex-col h-full px-3 py-5">
    <!-- App title -->
    <h1 class="text-lg font-semibold text-neutral-50 mb-5 px-3">Muscat</h1>

    <!-- NL Input -->
    <div class="mb-5 px-1">
      <NLInputBar @parsed="$emit('parsed', $event)" />
    </div>

    <!-- Navigation -->
    <nav class="flex-1 space-y-0.5">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :class="[
          'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
          route.path === item.path
            ? 'bg-neutral-800 text-neutral-50'
            : 'text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800/50'
        ]"
      >
        <!-- Inbox icon -->
        <svg v-if="item.icon === 'inbox'" class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
        </svg>
        <!-- Active icon -->
        <svg v-else-if="item.icon === 'active'" class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        <!-- Archived icon -->
        <svg v-else-if="item.icon === 'archived'" class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        <!-- Settings icon -->
        <svg v-else-if="item.icon === 'settings'" class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {{ item.name }}
      </router-link>
    </nav>
  </div>
</template>
```

Key changes:
- Removed emoji icons, replaced with Heroicon SVGs (matching bottom tabs)
- Removed `@navigate` emit (no more slide-out sidebar to close)
- `rounded-xl` active state with `bg-neutral-800`
- `font-semibold` title instead of `font-bold`
- Neutral palette throughout

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/Sidebar.vue
git commit -m "style: restyle Sidebar with SVG icons and neutral palette"
```

---

### Task 4: Restyle NLInputBar

**Files:**
- Modify: `frontend/src/components/NLInputBar.vue` (template section only, lines 116-160)

**Step 1: Replace the template section**

Replace everything from `<template>` to `</template>` with:

```html
<template>
  <form @submit.prevent="handleSubmit" class="relative">
    <input
      v-model="text"
      :disabled="loading || isRecording || isTranscribing"
      :placeholder="isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : 'Add task naturally...'"
      class="w-full px-4 py-2.5 bg-neutral-800/50 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
      :class="hasMicSupport ? 'pr-16' : 'pr-8'"
    />
    <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
      <!-- Loading spinner -->
      <div v-if="loading && !isRecording && !isTranscribing">
        <div class="w-4 h-4 border-2 border-neutral-600 border-t-indigo-400 rounded-full animate-spin" />
      </div>

      <!-- Transcribing spinner -->
      <div v-if="isTranscribing">
        <div class="w-4 h-4 border-2 border-neutral-600 border-t-indigo-400 rounded-full animate-spin" />
      </div>

      <!-- Mic button -->
      <button
        v-if="hasMicSupport && !loading && !isTranscribing"
        type="button"
        @pointerdown.prevent="startRecording"
        @pointerup.prevent="stopRecording"
        @pointerleave="stopRecording"
        class="p-1 rounded-lg transition-colors touch-none"
        :class="isRecording ? 'text-red-400 animate-pulse' : 'text-neutral-500 hover:text-indigo-400'"
        :title="isRecording ? 'Release to send' : 'Hold to speak'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
      </button>
    </div>

    <!-- Mic error message -->
    <p v-if="micError" class="text-xs text-red-400 mt-1.5 px-1">
      {{ micError }}
    </p>
  </form>
</template>
```

Key changes: borderless `bg-neutral-800/50 rounded-xl`, focus ring `ring-2 ring-indigo-500/30`, indigo spinner, neutral text colors.

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/NLInputBar.vue
git commit -m "style: restyle NLInputBar with borderless input"
```

---

### Task 5: Restyle SearchBar

**Files:**
- Modify: `frontend/src/components/SearchBar.vue` (template section, lines 25-42)

**Step 1: Replace the template section**

```html
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
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/SearchBar.vue
git commit -m "style: restyle SearchBar with borderless input"
```

---

### Task 6: Restyle TaskRow

**Files:**
- Modify: `frontend/src/components/TaskRow.vue` (template section, lines 90-184)

**Step 1: Replace the template section**

```html
<template>
  <div class="group border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors relative overflow-hidden">
    <!-- Swipe backgrounds -->
    <div
      v-if="swipeBackground === 'archive'"
      class="absolute inset-0 bg-red-500/10 flex items-center justify-end pr-5"
    >
      <span class="text-sm font-medium text-red-400">Archive</span>
    </div>
    <div
      v-if="swipeBackground === 'activate'"
      class="absolute inset-0 bg-emerald-500/10 flex items-center pl-5"
    >
      <span class="text-sm font-medium text-emerald-400">Activate</span>
    </div>

    <!-- Swipeable content -->
    <div
      class="flex items-center gap-3 px-4 py-3.5 cursor-pointer relative bg-neutral-950"
      :style="{ transform: `translateX(${touchDeltaX}px)`, transition: isAnimating ? 'transform 0.3s ease' : 'none' }"
      @click="expanded = !expanded"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!-- Archive checkbox -->
      <button
        v-if="task.status !== 'archived'"
        class="w-5 h-5 rounded-full border-[1.5px] border-neutral-600 hover:border-indigo-400 flex-shrink-0 transition-colors"
        @click.stop="emit('archive', task.id)"
        title="Archive"
      />
      <div v-else class="w-5 h-5 rounded-full bg-neutral-700 flex-shrink-0 flex items-center justify-center">
        <svg class="w-3 h-3 text-neutral-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      </div>

      <!-- Title and tags -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium truncate" :class="task.status === 'archived' ? 'line-through text-neutral-500' : 'text-neutral-50'">
            {{ task.title }}
          </span>
          <span
            v-for="tag in task.tags"
            :key="tag.id"
            class="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 flex-shrink-0"
          >
            {{ tag.name }}
          </span>
        </div>

        <!-- URL preview -->
        <div v-if="task.url_title" class="flex items-center gap-1.5 mt-1">
          <img v-if="task.url_favicon" :src="task.url_favicon" class="w-3 h-3" alt="" />
          <a :href="task.url!" target="_blank" class="text-xs text-indigo-400 truncate hover:underline" @click.stop>
            {{ task.url_title }}
          </a>
        </div>
      </div>

      <!-- Due date -->
      <span v-if="task.due_date" class="text-xs font-medium flex-shrink-0" :class="dueDateClass">
        {{ formattedDate }}
      </span>

      <!-- Edit button -->
      <button
        class="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-500 hover:text-neutral-300 transition-opacity rounded-lg"
        @click.stop="emit('edit', task)"
        title="Edit"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>

    <!-- Expanded section -->
    <div v-if="expanded" class="px-4 pb-3.5 pl-12">
      <p v-if="task.notes" class="text-sm text-neutral-400 whitespace-pre-wrap mb-2">{{ task.notes }}</p>
      <p v-if="task.url && !task.url_title" class="text-xs text-indigo-400 break-all">
        <a :href="task.url" target="_blank" class="hover:underline">{{ task.url }}</a>
      </p>
      <p v-if="task.recurrence_rule" class="text-xs text-neutral-500 mt-1">Recurring task</p>
      <AttachmentList
        v-if="attachments.length"
        :task-id="task.id"
        :attachments="attachments"
        @deleted="handleAttachmentDeleted"
      />
    </div>
  </div>
</template>
```

Also update the `dueDateClass` computed in the script section (line 75-81):

Change:
```typescript
const dueDateClass = computed(() => {
  if (!props.task.due_date) return '';
  const today = new Date().toISOString().split('T')[0];
  if (props.task.due_date < today) return 'text-red-400';
  if (props.task.due_date === today) return 'text-orange-400';
  return 'text-gray-400';
});
```

To:
```typescript
const dueDateClass = computed(() => {
  if (!props.task.due_date) return '';
  const today = new Date().toISOString().split('T')[0];
  if (props.task.due_date < today) return 'text-red-400';
  if (props.task.due_date === today) return 'text-amber-400';
  return 'text-neutral-500';
});
```

Key changes: neutral palette, `rounded-full` tags, `indigo-400` links, `amber-400` for today, taller rows (`py-3.5 px-4`), softer swipe backgrounds.

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/TaskRow.vue
git commit -m "style: restyle TaskRow with Apple Reminders aesthetic"
```

---

### Task 7: Restyle TaskModal

**Files:**
- Modify: `frontend/src/components/TaskModal.vue` (template section, lines 110-211)

**Step 1: Replace the template section**

```html
<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />

    <!-- Modal -->
    <div class="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <div class="p-6">
        <h3 class="text-lg font-semibold text-neutral-50 mb-5">{{ isEditing ? 'Edit Task' : 'New Task' }}</h3>

        <form @submit.prevent="handleSave" class="space-y-4">
          <!-- Title -->
          <input
            v-model="title"
            placeholder="Task title"
            required
            class="w-full px-4 py-2.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
          />

          <!-- Notes -->
          <textarea
            v-model="notes"
            placeholder="Notes (optional)"
            rows="3"
            class="w-full px-4 py-2.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30 resize-none"
          />

          <!-- URL -->
          <input
            v-model="url"
            placeholder="URL (optional)"
            type="url"
            class="w-full px-4 py-2.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
          />

          <!-- Due date -->
          <div>
            <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Due date</label>
            <input
              v-model="dueDate"
              type="date"
              class="px-4 py-2 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <!-- Status -->
          <div>
            <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Status</label>
            <select
              v-model="status"
              class="px-4 py-2 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none"
            >
              <option value="inbox">Inbox</option>
              <option value="active">Active</option>
            </select>
          </div>

          <!-- Recurrence -->
          <RecurrencePicker v-model="recurrenceRule" />

          <!-- Tags -->
          <div>
            <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Tags</label>
            <TagSelect v-model="tagIds" />
          </div>

          <!-- File upload (only for new tasks) -->
          <div v-if="!isEditing">
            <label class="text-xs font-medium text-neutral-400 mb-1.5 block">Attachments</label>
            <input
              type="file"
              multiple
              @change="handleFileChange"
              class="text-sm text-neutral-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:bg-neutral-800 file:text-neutral-300 file:cursor-pointer file:font-medium"
            />
            <div v-if="files.length" class="mt-1.5 text-xs text-neutral-500">
              {{ files.length }} file(s) selected
            </div>
          </div>

          <!-- Buttons -->
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              @click="emit('close')"
              class="px-5 py-2.5 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="saving || !title.trim()"
              class="px-5 py-2.5 text-sm font-medium bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 transition-colors disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : isEditing ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
```

Key changes: `rounded-2xl` modal, `backdrop-blur-sm`, borderless `rounded-xl` inputs, `indigo-500` primary button, `p-6` padding, `space-y-4` spacing.

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/TaskModal.vue
git commit -m "style: restyle TaskModal with rounded cards and indigo accent"
```

---

### Task 8: Restyle TagSelect

**Files:**
- Modify: `frontend/src/components/TagSelect.vue` (template section, lines 48-107)

**Step 1: Replace the template section**

```html
<template>
  <div class="relative">
    <!-- Selected chips -->
    <div class="flex flex-wrap gap-1.5 mb-1.5">
      <span
        v-for="tag in selectedTags"
        :key="tag.id"
        class="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-200 flex items-center gap-1.5 font-medium"
      >
        {{ tag.name }}
        <button @click="remove(tag.id)" class="hover:text-red-400 transition-colors">&times;</button>
      </span>
    </div>

    <!-- Dropdown trigger -->
    <button
      type="button"
      class="w-full text-left px-4 py-2 bg-neutral-800 rounded-xl text-sm text-neutral-300 hover:bg-neutral-700/50 transition-colors"
      @click="open = !open"
    >
      {{ selectedTags.length ? `${selectedTags.length} selected` : 'Select tags...' }}
    </button>

    <!-- Dropdown -->
    <div v-if="open" class="absolute z-10 w-full mt-1.5 bg-neutral-800 rounded-xl shadow-lg max-h-48 overflow-y-auto border border-neutral-700">
      <input
        v-model="search"
        placeholder="Filter tags..."
        class="w-full px-4 py-2 bg-neutral-800 border-b border-neutral-700 rounded-t-xl text-sm text-neutral-200 outline-none placeholder-neutral-500"
      />

      <div
        v-for="tag in filteredTags"
        :key="tag.id"
        class="px-4 py-2 text-sm cursor-pointer hover:bg-neutral-700/50 flex items-center gap-2.5 transition-colors"
        @click="toggle(tag.id)"
      >
        <input type="checkbox" :checked="modelValue.includes(tag.id)" class="rounded accent-indigo-500" />
        <span class="text-neutral-200">{{ tag.name }}</span>
      </div>

      <!-- Add new inline -->
      <div class="border-t border-neutral-700 px-4 py-2 flex gap-2">
        <input
          v-model="newTagName"
          placeholder="New tag..."
          class="flex-1 bg-transparent text-sm text-neutral-200 outline-none placeholder-neutral-500"
          @keydown.enter.prevent="addNew"
        />
        <button
          type="button"
          @click="addNew"
          class="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  </div>
</template>
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/TagSelect.vue
git commit -m "style: restyle TagSelect with pill chips and rounded dropdown"
```

---

### Task 9: Restyle RecurrencePicker

**Files:**
- Modify: `frontend/src/components/RecurrencePicker.vue` (template section, lines 54-152)

**Step 1: Replace the template section**

```html
<template>
  <div>
    <label class="flex items-center gap-2 text-sm text-neutral-300 mb-2">
      <input type="checkbox" v-model="enabled" class="rounded accent-indigo-500" />
      Repeat
    </label>

    <div v-if="enabled" class="space-y-3 pl-6">
      <!-- Frequency -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-neutral-400">Every</span>
        <input
          v-model.number="interval"
          type="number"
          min="1"
          class="w-16 px-3 py-1.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
        />
        <select
          v-model="frequency"
          class="px-3 py-1.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none"
        >
          <option value="daily">day(s)</option>
          <option value="weekly">week(s)</option>
          <option value="monthly">month(s)</option>
          <option value="yearly">year(s)</option>
        </select>
      </div>

      <!-- Weekly: day of week checkboxes -->
      <div v-if="frequency === 'weekly'" class="flex gap-1.5">
        <button
          v-for="(name, i) in dayNames"
          :key="i"
          type="button"
          :class="[
            'w-9 h-9 rounded-xl text-xs font-medium transition-colors',
            daysOfWeek.includes(i) ? 'bg-indigo-500 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          ]"
          @click="daysOfWeek.includes(i) ? daysOfWeek.splice(daysOfWeek.indexOf(i), 1) : daysOfWeek.push(i)"
        >
          {{ name }}
        </button>
      </div>

      <!-- Monthly -->
      <div v-if="frequency === 'monthly'" class="space-y-2">
        <div class="flex gap-4">
          <label class="flex items-center gap-1 text-sm text-neutral-400">
            <input type="radio" v-model="monthlyMode" value="dayOfMonth" class="accent-indigo-500" />
            On day
          </label>
          <label class="flex items-center gap-1 text-sm text-neutral-400">
            <input type="radio" v-model="monthlyMode" value="weekOfMonth" class="accent-indigo-500" />
            On the
          </label>
        </div>

        <div v-if="monthlyMode === 'dayOfMonth'">
          <input
            v-model.number="dayOfMonth"
            type="number"
            min="1"
            max="31"
            class="w-16 px-3 py-1.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div v-else class="flex items-center gap-2">
          <select v-model.number="weekOfMonth" class="px-3 py-1.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none">
            <option :value="1">1st</option>
            <option :value="2">2nd</option>
            <option :value="3">3rd</option>
            <option :value="4">4th</option>
            <option :value="5">5th</option>
          </select>
          <select v-model.number="daysOfWeek[0]" class="px-3 py-1.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none">
            <option v-for="(name, i) in dayNames" :key="i" :value="i">{{ name }}</option>
          </select>
        </div>
      </div>

      <!-- Yearly -->
      <div v-if="frequency === 'yearly'" class="flex items-center gap-2">
        <span class="text-sm text-neutral-400">In</span>
        <select v-model.number="monthOfYear" class="px-3 py-1.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none">
          <option v-for="(name, i) in monthNames" :key="i" :value="i + 1">{{ name }}</option>
        </select>
        <span class="text-sm text-neutral-400">on day</span>
        <input
          v-model.number="dayOfMonth"
          type="number"
          min="1"
          max="31"
          class="w-16 px-3 py-1.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>
    </div>
  </div>
</template>
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/RecurrencePicker.vue
git commit -m "style: restyle RecurrencePicker with rounded inputs and indigo accent"
```

---

### Task 10: Restyle AttachmentList

**Files:**
- Modify: `frontend/src/components/AttachmentList.vue` (template section, lines 30-46)

**Step 1: Replace the template section**

```html
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
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/AttachmentList.vue
git commit -m "style: restyle AttachmentList with rounded cards"
```

---

### Task 11: Restyle TaskList

**Files:**
- Modify: `frontend/src/components/TaskList.vue` (template section, lines 27-42)

**Step 1: Replace the template section**

```html
<template>
  <div>
    <div v-if="loading" class="text-neutral-400 text-sm py-8 text-center">Loading...</div>
    <div v-else-if="tasks.length === 0" class="text-neutral-500 text-sm py-8 text-center">
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
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/TaskList.vue
git commit -m "style: restyle TaskList empty states"
```

---

### Task 12: Restyle Views (LoginView, InboxView, ActiveView, ArchivedView, ShareTargetView)

**Files:**
- Modify: `frontend/src/views/LoginView.vue`
- Modify: `frontend/src/views/InboxView.vue`
- Modify: `frontend/src/views/ActiveView.vue`
- Modify: `frontend/src/views/ArchivedView.vue`
- Modify: `frontend/src/views/ShareTargetView.vue`

**Step 1: Replace LoginView.vue template**

```html
<template>
  <div class="flex items-center justify-center h-screen bg-neutral-950">
    <div class="text-center">
      <h1 class="text-3xl font-semibold text-neutral-50 mb-3">Muscat</h1>
      <p class="text-neutral-400 mb-8">Personal Task OS</p>

      <div v-if="error === 'unauthorized'" class="mb-4 text-red-400 text-sm">
        Your account is not authorized. Contact the administrator.
      </div>

      <a
        href="/api/v1/auth/login"
        class="inline-block px-8 py-3 bg-white text-neutral-900 font-medium rounded-xl hover:bg-neutral-100 transition-colors shadow-sm"
      >
        Sign in with Google
      </a>
    </div>
  </div>
</template>
```

**Step 2: Replace InboxView.vue template**

```html
<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-semibold text-neutral-50">Inbox</h2>
      <button
        @click="openNew"
        class="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-400 transition-colors"
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
```

**Step 3: Replace ActiveView.vue template**

```html
<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-semibold text-neutral-50">Active</h2>
      <button
        @click="openNew"
        class="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-400 transition-colors"
      >
        + New Task
      </button>
    </div>

    <TaskList :key="taskListKey" status="active" @edit="openEdit" />

    <TaskModal
      v-if="showModal"
      :task="editingTask ?? undefined"
      @close="showModal = false"
      @saved="handleSaved"
    />
  </div>
</template>
```

**Step 4: Replace ArchivedView.vue template**

```html
<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-semibold text-neutral-50">Archived</h2>
    </div>
    <TaskList status="archived" @edit="editingTask = $event" />
  </div>
</template>
```

**Step 5: Replace ShareTargetView.vue template**

```html
<template>
  <div class="flex items-center justify-center h-screen bg-neutral-950">
    <div class="text-center">
      <div class="w-8 h-8 border-2 border-neutral-600 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
      <p class="text-neutral-400">Adding to inbox...</p>
    </div>
  </div>
</template>
```

**Step 6: Verify build**

Run: `cd frontend && npm run build`

**Step 7: Commit**

```bash
git add frontend/src/views/
git commit -m "style: restyle all views with neutral palette and indigo accent"
```

---

### Task 13: Restyle SettingsView with grouped cards

**Files:**
- Modify: `frontend/src/views/SettingsView.vue` (template section, lines 68-141)

**Step 1: Replace the template section**

```html
<template>
  <div>
    <h2 class="text-xl font-semibold text-neutral-50 mb-6">Settings</h2>

    <!-- Current user -->
    <div class="mb-6">
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 px-1">Account</h3>
      <div class="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-neutral-200">{{ user?.email }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">Signed in</p>
          </div>
          <button
            @click="handleLogout"
            class="px-4 py-2 text-sm font-medium text-red-400 border border-neutral-700 rounded-xl hover:bg-red-500/10 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>

    <!-- Email allowlist -->
    <div>
      <h3 class="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2 px-1">Email Allowlist</h3>
      <p class="text-xs text-neutral-500 mb-3 px-1">Only these email addresses can sign in.</p>

      <div v-if="loading" class="text-neutral-400 text-sm py-8 text-center">Loading...</div>

      <div v-else>
        <!-- Add email form -->
        <form @submit.prevent="addEmail" class="flex gap-2 mb-3">
          <input
            v-model="newEmail"
            type="email"
            placeholder="user@example.com"
            class="flex-1 px-4 py-2.5 bg-neutral-800 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-shadow focus:ring-2 focus:ring-indigo-500/30"
          />
          <button
            type="submit"
            :disabled="saving"
            class="px-5 py-2.5 text-sm font-medium bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <p v-if="error" class="text-xs text-red-400 mb-2 px-1">{{ error }}</p>

        <!-- Email list -->
        <div class="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div
            v-for="(email, index) in allowedEmails"
            :key="email"
            :class="[
              'flex items-center justify-between px-4 py-3',
              index < allowedEmails.length - 1 ? 'border-b border-neutral-800' : ''
            ]"
          >
            <span class="text-sm text-neutral-200">{{ email }}</span>
            <button
              @click="removeEmail(email)"
              :disabled="saving"
              class="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            >
              Remove
            </button>
          </div>
          <p v-if="allowedEmails.length === 0" class="text-sm text-neutral-500 py-4 text-center">
            No emails in allowlist. Anyone with a Google account can sign in.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
```

Key changes: iOS-style grouped sections with `rounded-2xl bg-neutral-900 border border-neutral-800`, uppercase section headers, internal dividers between items, borderless inputs.

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/views/SettingsView.vue
git commit -m "style: restyle SettingsView with iOS-style grouped cards"
```

---

### Task 14: Final build verification

**Step 1: Clean build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with 0 errors

**Step 2: Spot-check for any leftover old colors**

Search for any remaining `gray-` or `blue-` Tailwind classes in the frontend src:
```bash
grep -r "gray-\|blue-" frontend/src/ --include="*.vue" -l
```
Expected: No files returned (all converted to neutral-*/indigo-*)

**Step 3: Commit any remaining fixes if needed**
