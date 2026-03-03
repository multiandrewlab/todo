<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Task, Tag, Attachment } from '@muscat/shared';
import AttachmentList from './AttachmentList.vue';
import { useTasks } from '../composables/useTasks';

const props = defineProps<{
  task: Task & { tags?: Tag[] };
}>();

const emit = defineEmits<{
  archive: [id: string];
  activate: [id: string];
  edit: [task: Task];
}>();

const expanded = ref(false);
const attachments = ref<Attachment[]>([]);
const detailsLoaded = ref(false);
const { getTask } = useTasks();

watch(expanded, async (isExpanded) => {
  if (isExpanded && !detailsLoaded.value) {
    try {
      const full = await getTask(props.task.id);
      attachments.value = (full as any).attachments || [];
      detailsLoaded.value = true;
    } catch (e) {
      console.error('Failed to load task details:', e);
    }
  }
});

function handleAttachmentDeleted(attId: string) {
  attachments.value = attachments.value.filter(a => a.id !== attId);
}

// Swipe gesture state
const touchStartX = ref(0);
const touchDeltaX = ref(0);
const isSwiping = ref(false);
const isAnimating = ref(false);

function onTouchStart(e: TouchEvent) {
  if (isAnimating.value) return;
  touchStartX.value = e.touches[0].clientX;
  isSwiping.value = true;
}

function onTouchMove(e: TouchEvent) {
  if (!isSwiping.value) return;
  touchDeltaX.value = e.touches[0].clientX - touchStartX.value;
}

function onTouchEnd() {
  if (!isSwiping.value) return;
  if (touchDeltaX.value < -100) {
    emit('archive', props.task.id);
  } else if (touchDeltaX.value > 100 && props.task.status === 'inbox') {
    emit('activate', props.task.id);
  }
  // Snap back with animation
  isAnimating.value = true;
  touchDeltaX.value = 0;
  isSwiping.value = false;
  setTimeout(() => { isAnimating.value = false; }, 300);
}

const swipeBackground = computed(() => {
  if (touchDeltaX.value < -30) return 'archive';
  if (touchDeltaX.value > 30 && props.task.status === 'inbox') return 'activate';
  return null;
});

const dueDateClass = computed(() => {
  if (!props.task.due_date) return '';
  const today = new Date().toISOString().split('T')[0];
  if (props.task.due_date < today) return 'text-red-400';
  if (props.task.due_date === today) return 'text-amber-400';
  return 'text-neutral-500';
});

const formattedDate = computed(() => {
  if (!props.task.due_date) return '';
  const date = new Date(props.task.due_date + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
});
</script>

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
