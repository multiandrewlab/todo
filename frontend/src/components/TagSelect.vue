<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useTags } from '../composables/useTags';

const props = defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const { tags, fetchTags, createTag } = useTags();
const open = ref(false);
const search = ref('');
const newTagName = ref('');

onMounted(() => fetchTags());

const filteredTags = computed(() =>
  tags.value.filter((t) =>
    t.name.toLowerCase().includes(search.value.toLowerCase())
  )
);

const selectedTags = computed(() =>
  tags.value.filter((t) => props.modelValue.includes(t.id))
);

function toggle(tagId: string) {
  const current = [...props.modelValue];
  const index = current.indexOf(tagId);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(tagId);
  }
  emit('update:modelValue', current);
}

async function addNew() {
  if (!newTagName.value.trim()) return;
  const tag = await createTag(newTagName.value.trim());
  emit('update:modelValue', [...props.modelValue, tag.id]);
  newTagName.value = '';
}

function remove(tagId: string) {
  emit('update:modelValue', props.modelValue.filter((id) => id !== tagId));
}
</script>

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
