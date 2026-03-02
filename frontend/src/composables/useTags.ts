import { ref } from 'vue';
import { api } from '../api/client';
import type { Tag } from '@muscat/shared';

const tags = ref<Tag[]>([]);
const loaded = ref(false);

export function useTags() {
  async function fetchTags() {
    if (loaded.value) return;
    const data = await api.get<{ tags: Tag[] }>('/tags');
    tags.value = data.tags;
    loaded.value = true;
  }

  async function createTag(name: string): Promise<Tag> {
    const tag = await api.post<Tag>('/tags', { name });
    tags.value.push(tag);
    return tag;
  }

  function reset() {
    loaded.value = false;
  }

  return { tags, fetchTags, createTag, reset };
}
