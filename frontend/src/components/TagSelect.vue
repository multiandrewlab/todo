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
    <div class="flex flex-wrap gap-1 mb-1">
      <span
        v-for="tag in selectedTags"
        :key="tag.id"
        class="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200 flex items-center gap-1"
      >
        {{ tag.name }}
        <button @click="remove(tag.id)" class="hover:text-red-400">&times;</button>
      </span>
    </div>

    <!-- Dropdown trigger -->
    <button
      type="button"
      class="w-full text-left px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-300 hover:border-gray-600"
      @click="open = !open"
    >
      {{ selectedTags.length ? `${selectedTags.length} selected` : 'Select tags...' }}
    </button>

    <!-- Dropdown -->
    <div v-if="open" class="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto">
      <input
        v-model="search"
        placeholder="Filter tags..."
        class="w-full px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm text-gray-200 outline-none"
      />

      <div
        v-for="tag in filteredTags"
        :key="tag.id"
        class="px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-700 flex items-center gap-2"
        @click="toggle(tag.id)"
      >
        <input type="checkbox" :checked="modelValue.includes(tag.id)" class="rounded" />
        <span class="text-gray-200">{{ tag.name }}</span>
      </div>

      <!-- Add new inline -->
      <div class="border-t border-gray-700 px-3 py-1.5 flex gap-2">
        <input
          v-model="newTagName"
          placeholder="New tag..."
          class="flex-1 bg-transparent text-sm text-gray-200 outline-none"
          @keydown.enter.prevent="addNew"
        />
        <button
          type="button"
          @click="addNew"
          class="text-xs text-blue-400 hover:text-blue-300"
        >
          Add
        </button>
      </div>
    </div>
  </div>
</template>
