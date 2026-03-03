<script setup lang="ts">
import { ref, onMounted } from 'vue';
import TagSelect from './TagSelect.vue';
import RecurrencePicker from './RecurrencePicker.vue';
import type { Task, RecurrenceRule, NLParseResponse } from '@muscat/shared';
import { useTasks } from '../composables/useTasks';
import { useTags } from '../composables/useTags';

const props = defineProps<{
  task?: Task & { tags?: { id: string }[] };
  prefill?: NLParseResponse;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const { createTask, updateTask } = useTasks();
const { tags: allTags, fetchTags } = useTags();

const title = ref('');
const notes = ref('');
const url = ref('');
const dueDate = ref('');
const status = ref<'inbox' | 'active'>('inbox');
const recurrenceRule = ref<RecurrenceRule | null>(null);
const tagIds = ref<string[]>([]);
const files = ref<File[]>([]);
const saving = ref(false);

const isEditing = !!props.task;

onMounted(async () => {
  await fetchTags();

  if (props.task) {
    title.value = props.task.title;
    notes.value = props.task.notes || '';
    url.value = props.task.url || '';
    dueDate.value = props.task.due_date || '';
    status.value = props.task.status === 'archived' ? 'active' : props.task.status;
    recurrenceRule.value = props.task.recurrence_rule ? JSON.parse(props.task.recurrence_rule) : null;
    tagIds.value = props.task.tags?.map((t) => t.id) || [];
  } else if (props.prefill) {
    title.value = props.prefill.title || '';
    notes.value = props.prefill.notes || '';
    url.value = props.prefill.url || '';
    dueDate.value = props.prefill.due_date || '';
    status.value = props.prefill.status || 'inbox';
    recurrenceRule.value = props.prefill.recurrence_rule || null;

    // Match prefill tag names to existing tag IDs
    if (props.prefill.tags?.length) {
      for (const name of props.prefill.tags) {
        const existing = allTags.value.find((t) => t.name.toLowerCase() === name.toLowerCase());
        if (existing) tagIds.value.push(existing.id);
      }
    }
  }
});

async function handleSave() {
  if (!title.value.trim()) return;
  saving.value = true;

  try {
    const data: any = {
      title: title.value.trim(),
      notes: notes.value || undefined,
      url: url.value || undefined,
      due_date: dueDate.value || undefined,
      recurrence_rule: recurrenceRule.value || undefined,
      status: status.value,
      tag_ids: tagIds.value,
    };

    if (isEditing) {
      await updateTask(props.task!.id, data);
    } else {
      const result = await createTask(data) as any;
      // Upload files if any
      if (files.value.length && result.id) {
        const { api } = await import('../api/client');
        for (const file of files.value) {
          const formData = new FormData();
          formData.append('file', file);
          await api.upload(`/tasks/${result.id}/attachments`, formData);
        }
      }
    }

    emit('saved');
    emit('close');
  } catch (e: any) {
    console.error('Save failed:', e);
  } finally {
    saving.value = false;
  }
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files) {
    files.value = [...input.files];
  }
}
</script>

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
